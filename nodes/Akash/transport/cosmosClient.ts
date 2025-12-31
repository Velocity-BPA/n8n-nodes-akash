/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, ILoadOptionsFunctions, IHookFunctions } from 'n8n-workflow';
import {
  SigningStargateClient,
  StargateClient,
  QueryClient,
  setupBankExtension,
  setupStakingExtension,
  setupDistributionExtension,
  GasPrice,
  DeliverTxResponse,
  StdFee,
} from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet, OfflineDirectSigner } from '@cosmjs/proto-signing';
import { Tendermint37Client } from '@cosmjs/tendermint-rpc';
import { fromHex, toBase64 } from '@cosmjs/encoding';
import { Secp256k1, sha256, Random, Slip10, Slip10Curve, stringToPath } from '@cosmjs/crypto';
import {
  IAkashApiCredentials,
  IAkashRpcCredentials,
  ITransactionResult,
  IWalletBalance,
  IDelegation,
  IReward,
  ICoin,
  IDeploymentId,
  IGroupSpec,
} from '../types';
import { AKASH_ENDPOINTS, CHAIN_IDS, GAS_SETTINGS, TOKEN_DENOMINATIONS } from '../constants';
import { generateVersionHash, sdlToGroups, sdlToManifest, parseSDL } from '../helpers/sdlParser';
import { aktToUakt, createAktCoin } from '../helpers/amountConverter';

/**
 * Cosmos Client
 *
 * Client for direct blockchain interaction using CosmJS.
 * Handles transaction signing and broadcasting for Akash-specific operations.
 */

// Akash-specific message type URLs
const MSG_TYPES = {
  createDeployment: '/akash.deployment.v1beta3.MsgCreateDeployment',
  closeDeployment: '/akash.deployment.v1beta3.MsgCloseDeployment',
  updateDeployment: '/akash.deployment.v1beta3.MsgUpdateDeployment',
  depositDeployment: '/akash.deployment.v1beta3.MsgDepositDeployment',
  createLease: '/akash.market.v1beta4.MsgCreateLease',
  closeLease: '/akash.market.v1beta4.MsgWithdrawLease',
  withdrawLease: '/akash.market.v1beta4.MsgWithdrawLease',
  createCertificate: '/akash.cert.v1beta3.MsgCreateCertificate',
  revokeCertificate: '/akash.cert.v1beta3.MsgRevokeCertificate',
  sendTokens: '/cosmos.bank.v1beta1.MsgSend',
} as const;

export class CosmosClient {
  private rpcEndpoint: string;
  private restEndpoint: string;
  private chainId: string;
  private gasPrice: GasPrice;
  private signer?: OfflineDirectSigner;
  private signingClient?: SigningStargateClient;
  private queryClient?: QueryClient;
  private walletAddress?: string;

  constructor(
    credentials: IAkashApiCredentials | IAkashRpcCredentials,
    network: 'mainnet' | 'testnet' = 'mainnet',
  ) {
    // Determine endpoints based on credential type
    if ('rpcEndpoint' in credentials && credentials.rpcEndpoint) {
      this.rpcEndpoint = credentials.rpcEndpoint;
      this.restEndpoint = credentials.restEndpoint || AKASH_ENDPOINTS[network].rest;
    } else {
      const apiCreds = credentials as IAkashApiCredentials;
      this.rpcEndpoint = AKASH_ENDPOINTS[apiCreds.network || network].rpc;
      this.restEndpoint = AKASH_ENDPOINTS[apiCreds.network || network].rest;
    }

    this.chainId = CHAIN_IDS[network];
    this.gasPrice = GasPrice.fromString(GAS_SETTINGS.defaultGasPrice);
  }

  /**
   * Initialize the client with wallet credentials
   */
  async initialize(credentials: IAkashApiCredentials): Promise<void> {
    if (credentials.mnemonic) {
      this.signer = await DirectSecp256k1HdWallet.fromMnemonic(credentials.mnemonic, {
        prefix: 'akash',
        hdPaths: [stringToPath("m/44'/118'/0'/0/0")],
      });
    } else if (credentials.privateKey) {
      // Handle private key (simplified - full implementation would need more)
      const privateKeyBytes = fromHex(credentials.privateKey.replace('0x', ''));
      const uncompressedPubkey = (await Secp256k1.makeKeypair(privateKeyBytes)).pubkey;
      const pubkeyCompressed = Secp256k1.compressPubkey(uncompressedPubkey);
      
      // Create a simple signer from private key
      this.signer = {
        getAccounts: async () => [{
          address: credentials.walletAddress,
          algo: 'secp256k1' as const,
          pubkey: pubkeyCompressed,
        }],
        signDirect: async (_signerAddress, signDoc) => {
          const signBytes = signDoc.bodyBytes;
          const messageHash = sha256(signBytes);
          const signature = await Secp256k1.createSignature(messageHash, privateKeyBytes);
          return {
            signed: signDoc,
            signature: {
              pub_key: {
                type: 'tendermint/PubKeySecp256k1',
                value: toBase64(pubkeyCompressed),
              },
              signature: toBase64(signature.toFixedLength()),
            },
          };
        },
      } as OfflineDirectSigner;
    }

    if (this.signer) {
      const accounts = await this.signer.getAccounts();
      this.walletAddress = accounts[0]?.address || credentials.walletAddress;

      this.signingClient = await SigningStargateClient.connectWithSigner(
        this.rpcEndpoint,
        this.signer,
        { gasPrice: this.gasPrice },
      );
    }

    // Initialize query client
    const tendermint = await Tendermint37Client.connect(this.rpcEndpoint);
    this.queryClient = QueryClient.withExtensions(
      tendermint,
      setupBankExtension,
      setupStakingExtension,
      setupDistributionExtension,
    );
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    if (!this.walletAddress) {
      throw new Error('Client not initialized. Call initialize() first.');
    }
    return this.walletAddress;
  }

  /**
   * Get read-only Stargate client
   */
  async getQueryClient(): Promise<StargateClient> {
    return StargateClient.connect(this.rpcEndpoint);
  }

  // ============================================================================
  // Wallet Operations
  // ============================================================================

  /**
   * Get wallet balance
   */
  async getBalance(address?: string): Promise<IWalletBalance> {
    const client = await this.getQueryClient();
    const addr = address || this.walletAddress;
    
    if (!addr) {
      throw new Error('No wallet address available');
    }

    const balances = await client.getAllBalances(addr);
    return {
      balances: balances.map((b) => ({
        denom: b.denom,
        amount: b.amount,
      })),
    };
  }

  /**
   * Send tokens
   */
  async sendTokens(
    recipient: string,
    amount: string,
    denom: string = TOKEN_DENOMINATIONS.uakt,
    memo?: string,
  ): Promise<ITransactionResult> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    const sendAmount: ICoin = { denom, amount };

    const result = await this.signingClient.sendTokens(
      this.walletAddress,
      recipient,
      [sendAmount],
      'auto',
      memo,
    );

    return this.formatTxResult(result);
  }

  /**
   * Get delegations
   */
  async getDelegations(delegator?: string): Promise<IDelegation[]> {
    if (!this.queryClient) {
      throw new Error('Query client not initialized');
    }

    const addr = delegator || this.walletAddress;
    if (!addr) {
      throw new Error('No wallet address available');
    }

    const staking = (this.queryClient as unknown as { staking: { delegatorDelegations: (addr: string) => Promise<{ delegationResponses: Array<{ delegation: { delegatorAddress: string; validatorAddress: string; shares: string }; balance: { denom: string; amount: string } }> }> } }).staking;
    const response = await staking.delegatorDelegations(addr);

    return response.delegationResponses.map((d) => ({
      delegation: {
        delegatorAddress: d.delegation.delegatorAddress,
        validatorAddress: d.delegation.validatorAddress,
        shares: d.delegation.shares,
      },
      balance: {
        denom: d.balance.denom,
        amount: d.balance.amount,
      },
    }));
  }

  /**
   * Get staking rewards
   */
  async getRewards(delegator?: string): Promise<IReward[]> {
    if (!this.queryClient) {
      throw new Error('Query client not initialized');
    }

    const addr = delegator || this.walletAddress;
    if (!addr) {
      throw new Error('No wallet address available');
    }

    const distribution = (this.queryClient as unknown as { distribution: { delegationTotalRewards: (addr: string) => Promise<{ rewards: Array<{ validatorAddress: string; reward: Array<{ denom: string; amount: string }> }> }> } }).distribution;
    const response = await distribution.delegationTotalRewards(addr);

    return response.rewards.map((r) => ({
      validatorAddress: r.validatorAddress,
      reward: r.reward.map((c) => ({
        denom: c.denom,
        amount: c.amount,
      })),
    }));
  }

  // ============================================================================
  // Deployment Operations
  // ============================================================================

  /**
   * Create a new deployment
   */
  async createDeployment(
    sdlContent: string,
    deposit: string,
  ): Promise<{ result: ITransactionResult; dseq: string }> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    const sdl = parseSDL(sdlContent);
    const groups = sdlToGroups(sdl);
    const version = generateVersionHash(sdl);

    // Get current block height for dseq
    const client = await this.getQueryClient();
    const height = await client.getHeight();
    const dseq = height.toString();

    const msg = {
      typeUrl: MSG_TYPES.createDeployment,
      value: {
        id: {
          owner: this.walletAddress,
          dseq,
        },
        groups,
        version,
        deposit: createAktCoin(deposit),
        depositor: this.walletAddress,
      },
    };

    const result = await this.signingClient.signAndBroadcast(
      this.walletAddress,
      [msg],
      'auto',
      'Created via n8n-nodes-akash',
    );

    return {
      result: this.formatTxResult(result),
      dseq,
    };
  }

  /**
   * Close a deployment
   */
  async closeDeployment(dseq: string): Promise<ITransactionResult> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    const msg = {
      typeUrl: MSG_TYPES.closeDeployment,
      value: {
        id: {
          owner: this.walletAddress,
          dseq,
        },
      },
    };

    const result = await this.signingClient.signAndBroadcast(
      this.walletAddress,
      [msg],
      'auto',
      'Closed via n8n-nodes-akash',
    );

    return this.formatTxResult(result);
  }

  /**
   * Update deployment
   */
  async updateDeployment(dseq: string, sdlContent: string): Promise<ITransactionResult> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    const sdl = parseSDL(sdlContent);
    const version = generateVersionHash(sdl);

    const msg = {
      typeUrl: MSG_TYPES.updateDeployment,
      value: {
        id: {
          owner: this.walletAddress,
          dseq,
        },
        version,
      },
    };

    const result = await this.signingClient.signAndBroadcast(
      this.walletAddress,
      [msg],
      'auto',
      'Updated via n8n-nodes-akash',
    );

    return this.formatTxResult(result);
  }

  /**
   * Deposit funds to deployment
   */
  async depositDeployment(dseq: string, amount: string): Promise<ITransactionResult> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    const msg = {
      typeUrl: MSG_TYPES.depositDeployment,
      value: {
        id: {
          owner: this.walletAddress,
          dseq,
        },
        amount: createAktCoin(amount),
        depositor: this.walletAddress,
      },
    };

    const result = await this.signingClient.signAndBroadcast(
      this.walletAddress,
      [msg],
      'auto',
      'Deposit via n8n-nodes-akash',
    );

    return this.formatTxResult(result);
  }

  // ============================================================================
  // Lease Operations
  // ============================================================================

  /**
   * Create lease from bid
   */
  async createLease(
    dseq: string,
    gseq: number,
    oseq: number,
    provider: string,
  ): Promise<ITransactionResult> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    const msg = {
      typeUrl: MSG_TYPES.createLease,
      value: {
        bidId: {
          owner: this.walletAddress,
          dseq,
          gseq,
          oseq,
          provider,
        },
      },
    };

    const result = await this.signingClient.signAndBroadcast(
      this.walletAddress,
      [msg],
      'auto',
      'Lease created via n8n-nodes-akash',
    );

    return this.formatTxResult(result);
  }

  /**
   * Close lease
   */
  async closeLease(
    dseq: string,
    gseq: number,
    oseq: number,
    provider: string,
  ): Promise<ITransactionResult> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    const msg = {
      typeUrl: MSG_TYPES.closeLease,
      value: {
        leaseId: {
          owner: this.walletAddress,
          dseq,
          gseq,
          oseq,
          provider,
        },
      },
    };

    const result = await this.signingClient.signAndBroadcast(
      this.walletAddress,
      [msg],
      'auto',
      'Lease closed via n8n-nodes-akash',
    );

    return this.formatTxResult(result);
  }

  /**
   * Withdraw earnings from lease (for providers)
   */
  async withdrawLease(
    dseq: string,
    gseq: number,
    oseq: number,
    provider: string,
  ): Promise<ITransactionResult> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    const msg = {
      typeUrl: MSG_TYPES.withdrawLease,
      value: {
        leaseId: {
          owner: this.walletAddress,
          dseq,
          gseq,
          oseq,
          provider,
        },
      },
    };

    const result = await this.signingClient.signAndBroadcast(
      this.walletAddress,
      [msg],
      'auto',
      'Withdraw via n8n-nodes-akash',
    );

    return this.formatTxResult(result);
  }

  // ============================================================================
  // Certificate Operations
  // ============================================================================

  /**
   * Create a new certificate
   * Certificates are required for secure communication with providers
   */
  async createCertificate(): Promise<{
    result: ITransactionResult;
    cert: string;
    pubkey: string;
    serial: string;
  }> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    // Generate certificate (simplified - real implementation needs proper X.509)
    const entropy = Random.getBytes(32);
    const slip10Result = Slip10.derivePath(
      Slip10Curve.Secp256k1,
      entropy,
      stringToPath("m/44'/118'/0'/0/0"),
    );
    const keypair = await Secp256k1.makeKeypair(slip10Result.privkey);

    const cert = toBase64(keypair.pubkey);
    const pubkey = toBase64(Secp256k1.compressPubkey(keypair.pubkey));
    const serial = Date.now().toString();

    const msg = {
      typeUrl: MSG_TYPES.createCertificate,
      value: {
        owner: this.walletAddress,
        cert: new Uint8Array(Buffer.from(cert)),
        pubkey: new Uint8Array(Buffer.from(pubkey)),
      },
    };

    const result = await this.signingClient.signAndBroadcast(
      this.walletAddress,
      [msg],
      'auto',
      'Certificate created via n8n-nodes-akash',
    );

    return {
      result: this.formatTxResult(result),
      cert,
      pubkey,
      serial,
    };
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(serial: string): Promise<ITransactionResult> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    const msg = {
      typeUrl: MSG_TYPES.revokeCertificate,
      value: {
        id: {
          owner: this.walletAddress,
          serial,
        },
      },
    };

    const result = await this.signingClient.signAndBroadcast(
      this.walletAddress,
      [msg],
      'auto',
      'Certificate revoked via n8n-nodes-akash',
    );

    return this.formatTxResult(result);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Format transaction result
   */
  private formatTxResult(result: DeliverTxResponse): ITransactionResult {
    return {
      transactionHash: result.transactionHash,
      code: result.code,
      height: Number(result.height),
      gasUsed: Number(result.gasUsed),
      gasWanted: Number(result.gasWanted),
      rawLog: result.rawLog,
      events: result.events as any,
    };
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(messages: unknown[]): Promise<number> {
    if (!this.signingClient || !this.walletAddress) {
      throw new Error('Signing client not initialized');
    }

    const gasEstimate = await this.signingClient.simulate(
      this.walletAddress,
      messages as { typeUrl: string; value: unknown }[],
      undefined,
    );

    return Math.ceil(gasEstimate * GAS_SETTINGS.simulationGasMultiplier);
  }

  /**
   * Disconnect client
   */
  async disconnect(): Promise<void> {
    if (this.signingClient) {
      this.signingClient.disconnect();
    }
  }
}

/**
 * Create Cosmos client from n8n context
 */
export async function createCosmosClient(
  context: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
  credentialName: string = 'akashApi',
): Promise<CosmosClient> {
  const credentials = await context.getCredentials(credentialName) as IAkashApiCredentials;
  const client = new CosmosClient(credentials, credentials.network || 'mainnet');
  await client.initialize(credentials);
  return client;
}
