/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
	ITriggerFunctions,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
} from 'n8n-workflow';

import { AkashWebSocketClient } from './transport/websocket';
import { IAkashEvent } from './types';

// Log licensing notice once on load
const LICENSING_NOTICE = `[Velocity BPA Licensing Notice]

This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).

Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.

For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.`;

let licenseNoticeLogged = false;

// Extended event type with additional parsed fields
interface IParsedAkashEvent extends IAkashEvent {
	owner?: string;
	provider?: string;
	dseq?: number;
	gseq?: number;
	oseq?: number;
	data?: Record<string, unknown>;
}

export class AkashTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Akash Trigger',
		name: 'akashTrigger',
		icon: 'file:akash.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["eventType"]}}',
		description: 'Listen for real-time events from Akash Network',
		defaults: {
			name: 'Akash Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'akashRpc',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event Type',
				name: 'eventType',
				type: 'options',
				options: [
					{
						name: 'All Events',
						value: 'all',
						description: 'Listen for all Akash events',
					},
					{
						name: 'Deployment Created',
						value: 'deployment.created',
						description: 'Triggered when a new deployment is created',
					},
					{
						name: 'Deployment Updated',
						value: 'deployment.updated',
						description: 'Triggered when a deployment is updated',
					},
					{
						name: 'Deployment Closed',
						value: 'deployment.closed',
						description: 'Triggered when a deployment is closed',
					},
					{
						name: 'Lease Created',
						value: 'lease.created',
						description: 'Triggered when a new lease is created',
					},
					{
						name: 'Lease Closed',
						value: 'lease.closed',
						description: 'Triggered when a lease is closed',
					},
					{
						name: 'Bid Created',
						value: 'bid.created',
						description: 'Triggered when a provider creates a bid',
					},
					{
						name: 'Bid Closed',
						value: 'bid.closed',
						description: 'Triggered when a bid is closed or accepted',
					},
					{
						name: 'Provider Created',
						value: 'provider.created',
						description: 'Triggered when a new provider registers',
					},
					{
						name: 'Provider Updated',
						value: 'provider.updated',
						description: 'Triggered when a provider updates attributes',
					},
					{
						name: 'New Block',
						value: 'block',
						description: 'Triggered on each new block',
					},
				],
				default: 'all',
				description: 'Type of event to listen for',
			},
			{
				displayName: 'Filter Options',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				options: [
					{
						displayName: 'Owner Address',
						name: 'owner',
						type: 'string',
						default: '',
						description: 'Filter events by deployment owner address',
						placeholder: 'akash1...',
					},
					{
						displayName: 'Provider Address',
						name: 'provider',
						type: 'string',
						default: '',
						description: 'Filter events by provider address',
						placeholder: 'akash1provider...',
					},
					{
						displayName: 'Deployment Sequence (dseq)',
						name: 'dseq',
						type: 'number',
						default: 0,
						description: 'Filter events by deployment sequence number',
					},
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		// Log licensing notice once
		if (!licenseNoticeLogged) {
			console.warn(LICENSING_NOTICE);
			licenseNoticeLogged = true;
		}

		const eventType = this.getNodeParameter('eventType') as string;
		const filters = this.getNodeParameter('filters', {}) as {
			owner?: string;
			provider?: string;
			dseq?: number;
		};

		// Get RPC credentials
		const credentials = await this.getCredentials('akashRpc');
		const wsEndpoint = credentials.wsEndpoint as string || 'wss://rpc.akashnet.net:443/websocket';

		// Create WebSocket client
		const wsClient = new AkashWebSocketClient(wsEndpoint);

		// Parse attributes to extract common fields
		const parseEvent = (event: IAkashEvent): IParsedAkashEvent => {
			const parsed: IParsedAkashEvent = { ...event };
			const attrMap = new Map(event.attributes.map(a => [a.key, a.value]));
			
			parsed.owner = attrMap.get('owner');
			parsed.provider = attrMap.get('provider');
			const dseqStr = attrMap.get('dseq');
			if (dseqStr) parsed.dseq = parseInt(dseqStr, 10);
			const gseqStr = attrMap.get('gseq');
			if (gseqStr) parsed.gseq = parseInt(gseqStr, 10);
			const oseqStr = attrMap.get('oseq');
			if (oseqStr) parsed.oseq = parseInt(oseqStr, 10);
			
			// Convert attributes to data object
			const data: Record<string, unknown> = {};
			for (const attr of event.attributes) {
				data[attr.key] = attr.value;
			}
			parsed.data = data;
			
			return parsed;
		};

		// Event handler
		const handleEvent = (event: IAkashEvent) => {
			const parsed = parseEvent(event);
			
			// Apply filters
			if (filters.owner && parsed.owner !== filters.owner) {
				return;
			}
			if (filters.provider && parsed.provider !== filters.provider) {
				return;
			}
			if (filters.dseq && parsed.dseq !== filters.dseq) {
				return;
			}

			// Check event type filter
			if (eventType !== 'all' && event.type !== eventType) {
				return;
			}

			// Emit event
			this.emit([
				this.helpers.returnJsonArray([
					{
						eventType: event.type,
						timestamp: event.timestamp,
						blockHeight: event.height,
						transactionHash: event.txHash,
						owner: parsed.owner,
						provider: parsed.provider,
						dseq: parsed.dseq,
						gseq: parsed.gseq,
						oseq: parsed.oseq,
						data: parsed.data,
					},
				]),
			]);
		};

		// Subscribe to events
		wsClient.on('event', handleEvent);

		// Connect and subscribe based on event type
		await wsClient.connect();

		if (eventType === 'all') {
			await wsClient.subscribeToAllEvents();
		} else if (eventType === 'block') {
			await wsClient.subscribeToBlocks();
		} else if (eventType.startsWith('deployment.')) {
			await wsClient.subscribeToDeployments(filters.owner);
		} else if (eventType.startsWith('lease.')) {
			await wsClient.subscribeToLeases(filters.owner);
		} else if (eventType.startsWith('bid.')) {
			await wsClient.subscribeToBids(filters.owner);
		} else if (eventType.startsWith('provider.')) {
			await wsClient.subscribeToProviders();
		}

		// Cleanup function
		const closeFunction = async () => {
			wsClient.removeListener('event', handleEvent);
			await wsClient.disconnect();
		};

		return {
			closeFunction,
		};
	}
}
