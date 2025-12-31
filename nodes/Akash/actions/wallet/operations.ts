/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { createCosmosClient } from '../../transport';
import { aktToUakt, uaktToAkt, formatCoin } from '../../helpers';
import { ICoin, IReward } from '../../types';

/**
 * Wallet Operations for Akash Network
 *
 * Wallet operations for managing AKT tokens and staking.
 * - Balance: Get AKT balance
 * - Send: Send AKT to another address
 * - Delegations: View staking delegations
 * - Rewards: View staking rewards
 */

export const getBalanceDescription: INodeProperties[] = [
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['balance'],
			},
		},
		description: 'Wallet address to check balance. Leave empty to use connected wallet.',
		placeholder: 'akash1...',
	},
];

export const sendDescription: INodeProperties[] = [
	{
		displayName: 'Recipient Address',
		name: 'recipient',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['send'],
			},
		},
		description: 'Recipient wallet address (akash1...)',
		placeholder: 'akash1...',
	},
	{
		displayName: 'Amount (AKT)',
		name: 'amount',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['send'],
			},
		},
		description: 'Amount of AKT to send',
		typeOptions: {
			minValue: 0.000001,
			numberPrecision: 6,
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['send'],
			},
		},
		options: [
			{
				displayName: 'Memo',
				name: 'memo',
				type: 'string',
				default: '',
				description: 'Optional memo to include with the transaction',
			},
		],
	},
];

export const getDelegationsDescription: INodeProperties[] = [
	{
		displayName: 'Delegator Address',
		name: 'delegator',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['delegations'],
			},
		},
		description: 'Delegator address. Leave empty to use connected wallet.',
		placeholder: 'akash1...',
	},
];

export const getRewardsDescription: INodeProperties[] = [
	{
		displayName: 'Delegator Address',
		name: 'delegator',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['rewards'],
			},
		},
		description: 'Delegator address. Leave empty to use connected wallet.',
		placeholder: 'akash1...',
	},
];

export const getEscrowBalancesDescription: INodeProperties[] = [
	{
		displayName: 'Owner Address',
		name: 'owner',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['escrowBalances'],
			},
		},
		description: 'Deployment owner address. Leave empty to use connected wallet.',
		placeholder: 'akash1...',
	},
];

export async function getBalance(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	let address = this.getNodeParameter('address', index, '') as string;

	const cosmosClient = await createCosmosClient(this);

	// If no address provided, use connected wallet
	if (!address) {
		address = cosmosClient.getWalletAddress();
	}

	const balance = await cosmosClient.getBalance(address);

	await cosmosClient.disconnect();

	// Parse balance
	const uaktBalance = balance.balances.find((b: ICoin) => b.denom === 'uakt');
	const aktAmount = uaktBalance ? uaktToAkt(uaktBalance.amount) : '0';

	return [
		{
			json: {
				address,
				balances: balance,
				akt: aktAmount,
				uakt: uaktBalance?.amount || '0',
				formatted: formatCoin({ amount: uaktBalance?.amount || '0', denom: 'uakt' }),
			},
		},
	];
}

export async function send(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const recipient = this.getNodeParameter('recipient', index) as string;
	const amount = this.getNodeParameter('amount', index) as number;
	const options = this.getNodeParameter('options', index, {}) as {
		memo?: string;
	};

	// Validate recipient address
	if (!recipient.startsWith('akash1')) {
		throw new Error('Invalid recipient address. Must start with akash1');
	}

	const cosmosClient = await createCosmosClient(this);

	// Convert AKT to uAKT
	const uaktAmount = aktToUakt(amount.toString());

	const result = await cosmosClient.sendTokens(recipient, uaktAmount, 'uakt', options.memo);

	await cosmosClient.disconnect();

	return [
		{
			json: {
				success: result.code === 0,
				transactionHash: result.transactionHash,
				from: cosmosClient.getWalletAddress(),
				to: recipient,
				amount: `${amount} AKT`,
				amountUakt: uaktAmount,
				memo: options.memo || '',
				height: result.height,
				gasUsed: result.gasUsed,
			},
		},
	];
}

export async function getDelegations(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	let delegator = this.getNodeParameter('delegator', index, '') as string;

	const cosmosClient = await createCosmosClient(this);

	if (!delegator) {
		delegator = cosmosClient.getWalletAddress();
	}

	const delegations = await cosmosClient.getDelegations(delegator);

	await cosmosClient.disconnect();

	// Calculate total delegated
	let totalDelegated = BigInt(0);
	const formattedDelegations = delegations.map((d) => {
		const amount = BigInt(d.balance?.amount || '0');
		totalDelegated += amount;
		return {
			validator: d.delegation?.validatorAddress,
			amount: d.balance?.amount || '0',
			amountAkt: uaktToAkt(d.balance?.amount || '0'),
			shares: d.delegation?.shares,
		};
	});

	return [
		{
			json: {
				delegator,
				totalDelegated: totalDelegated.toString(),
				totalDelegatedAkt: uaktToAkt(totalDelegated.toString()),
				delegations: formattedDelegations,
				count: delegations.length,
			},
		},
	];
}

export async function getRewards(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	let delegator = this.getNodeParameter('delegator', index, '') as string;

	const cosmosClient = await createCosmosClient(this);

	if (!delegator) {
		delegator = cosmosClient.getWalletAddress();
	}

	const rewards = await cosmosClient.getRewards(delegator);

	await cosmosClient.disconnect();

	// Calculate total rewards from all validators
	let totalRewardsUakt = BigInt(0);
	for (const r of rewards) {
		const uaktReward = r.reward.find((c: ICoin) => c.denom === 'uakt');
		if (uaktReward) {
			totalRewardsUakt += BigInt(uaktReward.amount.split('.')[0] || '0');
		}
	}
	const totalRewards = totalRewardsUakt.toString();

	const formattedRewards = rewards.map((r: IReward) => ({
		validator: r.validatorAddress,
		rewards: r.reward,
	}));

	return [
		{
			json: {
				delegator,
				totalRewards,
				totalRewardsAkt: uaktToAkt(totalRewards),
				byValidator: formattedRewards,
			},
		},
	];
}

export async function getEscrowBalances(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	let owner = this.getNodeParameter('owner', index, '') as string;

	const cosmosClient = await createCosmosClient(this);

	if (!owner) {
		owner = cosmosClient.getWalletAddress();
	}

	// Get all deployments for the owner via Console API
	const { createConsoleApiClient } = await import('../../transport');
	const consoleClient = await createConsoleApiClient(this);
	const deployments = await consoleClient.getDeployments(owner, { state: 'active' });

	await cosmosClient.disconnect();

	// Extract escrow balances from deployments
	const escrowBalances = deployments.map((d) => ({
		dseq: d.dseq || d.deploymentId?.dseq || 'unknown',
		balance: d.escrowAccount?.balance || { denom: 'uakt', amount: '0' },
		balanceAkt: uaktToAkt(d.escrowAccount?.balance?.amount || '0'),
		transferred: d.escrowAccount?.transferred || { denom: 'uakt', amount: '0' },
		state: d.state,
	}));

	// Calculate totals
	let totalBalance = BigInt(0);
	for (const e of escrowBalances) {
		totalBalance += BigInt(e.balance.amount || '0');
	}

	return [
		{
			json: {
				owner,
				totalEscrowBalance: totalBalance.toString(),
				totalEscrowBalanceAkt: uaktToAkt(totalBalance.toString()),
				deployments: escrowBalances,
				count: escrowBalances.length,
			},
		},
	];
}
