/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, INodeExecutionData, INodeProperties, IDataObject } from 'n8n-workflow';
import { createCosmosClient, createConsoleApiClient } from '../../transport';

/**
 * Bid Operations for Akash Network
 *
 * Bids are offers from providers to fulfill deployment orders.
 * - Get Bid: Retrieve a specific bid
 * - Get Bids: List all bids for an order
 * - Accept Bid: Accept a bid and create a lease
 */

export const getBidDescription: INodeProperties[] = [
	{
		displayName: 'Owner Address',
		name: 'owner',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['get'],
			},
		},
		description: 'Deployment owner address (akash1...)',
		placeholder: 'akash1...',
	},
	{
		displayName: 'Deployment Sequence (dseq)',
		name: 'dseq',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['get'],
			},
		},
		description: 'The deployment sequence number',
	},
	{
		displayName: 'Group Sequence (gseq)',
		name: 'gseq',
		type: 'number',
		default: 1,
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['get'],
			},
		},
		description: 'The group sequence number within the deployment',
	},
	{
		displayName: 'Order Sequence (oseq)',
		name: 'oseq',
		type: 'number',
		default: 1,
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['get'],
			},
		},
		description: 'The order sequence number within the group',
	},
	{
		displayName: 'Provider Address',
		name: 'provider',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['get'],
			},
		},
		description: 'Provider address who submitted the bid',
		placeholder: 'akash1provider...',
	},
];

export const getBidsDescription: INodeProperties[] = [
	{
		displayName: 'Owner Address',
		name: 'owner',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['getMany'],
			},
		},
		description: 'Deployment owner address (akash1...)',
		placeholder: 'akash1...',
	},
	{
		displayName: 'Deployment Sequence (dseq)',
		name: 'dseq',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['getMany'],
			},
		},
		description: 'The deployment sequence number',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['getMany'],
			},
		},
		options: [
			{
				displayName: 'Group Sequence (gseq)',
				name: 'gseq',
				type: 'number',
				default: 1,
				description: 'Filter by group sequence',
			},
			{
				displayName: 'Order Sequence (oseq)',
				name: 'oseq',
				type: 'number',
				default: 1,
				description: 'Filter by order sequence',
			},
			{
				displayName: 'State Filter',
				name: 'state',
				type: 'options',
				default: 'open',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Open', value: 'open' },
					{ name: 'Active', value: 'active' },
					{ name: 'Lost', value: 'lost' },
					{ name: 'Closed', value: 'closed' },
				],
				description: 'Filter bids by state',
			},
		],
	},
];

export const acceptBidDescription: INodeProperties[] = [
	{
		displayName: 'Owner Address',
		name: 'owner',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['accept'],
			},
		},
		description: 'Deployment owner address - must match your wallet',
		placeholder: 'akash1...',
	},
	{
		displayName: 'Deployment Sequence (dseq)',
		name: 'dseq',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['accept'],
			},
		},
		description: 'The deployment sequence number',
	},
	{
		displayName: 'Group Sequence (gseq)',
		name: 'gseq',
		type: 'number',
		default: 1,
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['accept'],
			},
		},
		description: 'The group sequence number',
	},
	{
		displayName: 'Order Sequence (oseq)',
		name: 'oseq',
		type: 'number',
		default: 1,
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['accept'],
			},
		},
		description: 'The order sequence number',
	},
	{
		displayName: 'Provider Address',
		name: 'provider',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['bid'],
				operation: ['accept'],
			},
		},
		description: 'Provider address whose bid to accept',
		placeholder: 'akash1provider...',
	},
];

export async function getBid(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const owner = this.getNodeParameter('owner', index) as string;
	const dseq = this.getNodeParameter('dseq', index) as number;
	const gseq = this.getNodeParameter('gseq', index) as number;
	const oseq = this.getNodeParameter('oseq', index) as number;
	const provider = this.getNodeParameter('provider', index) as string;

	const consoleClient = await createConsoleApiClient(this);
	const bid = await consoleClient.getBid(owner, dseq.toString(), gseq, oseq, provider);

	return [{ json: bid as unknown as IDataObject }];
}

export async function getBids(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const owner = this.getNodeParameter('owner', index) as string;
	const dseq = this.getNodeParameter('dseq', index) as number;
	const options = this.getNodeParameter('options', index, {}) as {
		gseq?: number;
		oseq?: number;
		state?: string;
	};

	const consoleClient = await createConsoleApiClient(this);
	const bids = await consoleClient.getBids(
		owner,
		dseq.toString(),
		options.gseq || 1,
		options.oseq || 1,
	);

	// Filter by state if specified
	let filteredBids = bids;
	if (options.state && options.state !== 'all') {
		filteredBids = bids.filter(
			(bid) => bid.state.toLowerCase() === options.state!.toLowerCase(),
		);
	}

	return filteredBids.map((bid) => ({ json: bid as unknown as IDataObject }));
}

export async function acceptBid(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const dseq = this.getNodeParameter('dseq', index) as number;
	const gseq = this.getNodeParameter('gseq', index) as number;
	const oseq = this.getNodeParameter('oseq', index) as number;
	const provider = this.getNodeParameter('provider', index) as string;

	const cosmosClient = await createCosmosClient(this);

	// Create lease (which effectively accepts the bid)
	const result = await cosmosClient.createLease(dseq.toString(), gseq, oseq, provider);

	await cosmosClient.disconnect();

	return [
		{
			json: {
				success: result.code === 0,
				transactionHash: result.transactionHash,
				dseq,
				gseq,
				oseq,
				provider,
				height: result.height,
				gasUsed: result.gasUsed,
				message: result.code === 0 ? 'Bid accepted, lease created' : 'Failed to accept bid',
			},
		},
	];
}
