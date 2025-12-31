/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

/**
 * Akash API Credentials
 *
 * Credentials for authenticating with Akash Network.
 * Supports both Console API key authentication and wallet-based signing.
 */
export class AkashApiCredentials implements ICredentialType {
  name = 'akashApi';
  displayName = 'Akash API';
  documentationUrl = 'https://docs.akash.network/';

  properties: INodeProperties[] = [
    {
      displayName: 'Network',
      name: 'network',
      type: 'options',
      options: [
        {
          name: 'Mainnet',
          value: 'mainnet',
        },
        {
          name: 'Testnet (Sandbox)',
          value: 'testnet',
        },
      ],
      default: 'mainnet',
      description: 'Select the Akash network to connect to',
    },
    {
      displayName: 'API Endpoint',
      name: 'apiEndpoint',
      type: 'string',
      default: 'https://console-api.akash.network',
      description: 'Akash Console API endpoint. Leave default for standard access.',
      hint: 'Only change if using a custom API endpoint',
    },
    {
      displayName: 'Wallet Address',
      name: 'walletAddress',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'akash1...',
      description: 'Your Akash wallet address (starts with akash1)',
      typeOptions: {
        password: false,
      },
    },
    {
      displayName: 'Authentication Method',
      name: 'authMethod',
      type: 'options',
      options: [
        {
          name: 'Mnemonic Phrase',
          value: 'mnemonic',
          description: 'Use 24-word recovery phrase for signing',
        },
        {
          name: 'Private Key',
          value: 'privateKey',
          description: 'Use private key directly for signing',
        },
      ],
      default: 'mnemonic',
      description: 'Choose how to authenticate for transaction signing',
    },
    {
      displayName: 'Mnemonic Phrase',
      name: 'mnemonic',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      placeholder: 'word1 word2 word3 ... word24',
      description: 'Your 24-word recovery phrase (keep this secure!)',
      displayOptions: {
        show: {
          authMethod: ['mnemonic'],
        },
      },
    },
    {
      displayName: 'Private Key',
      name: 'privateKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      placeholder: '0x...',
      description: 'Your private key in hex format (keep this secure!)',
      displayOptions: {
        show: {
          authMethod: ['privateKey'],
        },
      },
    },
    {
      displayName: 'Chain ID',
      name: 'chainId',
      type: 'string',
      default: '',
      placeholder: 'akashnet-2',
      description:
        'Chain ID (auto-populated based on network selection). Override only if necessary.',
      hint: 'Leave empty to use default chain ID for selected network',
    },
  ];

  // Test the credentials by checking wallet balance
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.apiEndpoint || "https://console-api.akash.network"}}',
      url: '/v1/address/{{$credentials.walletAddress}}/balance',
      method: 'GET',
    },
  };
}
