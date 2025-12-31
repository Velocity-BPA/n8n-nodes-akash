/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { createConsoleApiClient } from '../../transport';
import { GPU_TYPES, REGIONS } from '../../constants';

/**
 * Provider Operations for Akash Network
 *
 * Providers are entities that run workloads on behalf of tenants.
 * - Get Provider: Retrieve provider details
 * - Get Providers: List all providers
 * - Filter Providers: Find providers by capabilities
 * - Get Provider Status: Check provider online status
 */

export const getProviderDescription: INodeProperties[] = [
	{
		displayName: 'Provider Address',
		name: 'provider',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['provider'],
				operation: ['get'],
			},
		},
		description: 'Provider address (akash1...)',
		placeholder: 'akash1provider...',
	},
];

export const getProvidersDescription: INodeProperties[] = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['provider'],
				operation: ['getMany'],
			},
		},
		options: [
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				description: 'Maximum number of providers to return',
				typeOptions: {
					minValue: 1,
					maxValue: 500,
				},
			},
			{
				displayName: 'Active Only',
				name: 'activeOnly',
				type: 'boolean',
				default: true,
				description: 'Whether to only return active providers',
			},
		],
	},
];

export const filterProvidersDescription: INodeProperties[] = [
	{
		displayName: 'Filter Criteria',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['provider'],
				operation: ['filter'],
			},
		},
		options: [
			{
				displayName: 'GPU Type',
				name: 'gpuType',
				type: 'options',
				default: '',
				options: [
					{ name: 'Any GPU', value: '' },
					...Object.entries(GPU_TYPES.nvidia).map(([key, value]) => ({
						name: value.name,
						value: key,
					})),
				],
				description: 'Filter by GPU type',
			},
			{
				displayName: 'Region',
				name: 'region',
				type: 'options',
				default: '',
				options: [
					{ name: 'Any Region', value: '' },
					...Object.entries(REGIONS).map(([key, value]) => ({
						name: value.name,
						value: key,
					})),
				],
				description: 'Filter by region',
			},
			{
				displayName: 'Minimum CPU (Cores)',
				name: 'minCpu',
				type: 'number',
				default: 0,
				description: 'Minimum available CPU cores',
			},
			{
				displayName: 'Minimum Memory (GB)',
				name: 'minMemory',
				type: 'number',
				default: 0,
				description: 'Minimum available memory in GB',
			},
			{
				displayName: 'Minimum Storage (GB)',
				name: 'minStorage',
				type: 'number',
				default: 0,
				description: 'Minimum available storage in GB',
			},
			{
				displayName: 'Max Price (uAKT/block)',
				name: 'maxPrice',
				type: 'number',
				default: 0,
				description: 'Maximum price per block in uAKT (0 = no limit)',
			},
			{
				displayName: 'Audited Only',
				name: 'auditedOnly',
				type: 'boolean',
				default: false,
				description: 'Whether to only return audited providers',
			},
		],
	},
];

export const getProviderStatusDescription: INodeProperties[] = [
	{
		displayName: 'Provider Address',
		name: 'provider',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['provider'],
				operation: ['status'],
			},
		},
		description: 'Provider address (akash1...)',
		placeholder: 'akash1provider...',
	},
];

export const getProviderLeasesDescription: INodeProperties[] = [
	{
		displayName: 'Provider Address',
		name: 'provider',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['provider'],
				operation: ['leases'],
			},
		},
		description: 'Provider address (akash1...)',
		placeholder: 'akash1provider...',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['provider'],
				operation: ['leases'],
			},
		},
		options: [
			{
				displayName: 'State Filter',
				name: 'state',
				type: 'options',
				default: 'active',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Active', value: 'active' },
					{ name: 'Closed', value: 'closed' },
				],
			},
		],
	},
];

export async function getProvider(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const provider = this.getNodeParameter('provider', index) as string;

	const consoleClient = await createConsoleApiClient(this);
	const providerData = await consoleClient.getProvider(provider);

	return [{ json: providerData as any }];
}

export async function getProviders(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const options = this.getNodeParameter('options', index, {}) as {
		limit?: number;
		activeOnly?: boolean;
	};

	const consoleClient = await createConsoleApiClient(this);
	let providers = await consoleClient.getProviders();

	// Filter active only
	if (options.activeOnly !== false) {
		providers = providers.filter((p) => p.isActive);
	}

	// Apply limit
	if (options.limit && options.limit > 0) {
		providers = providers.slice(0, options.limit);
	}

	return providers.map((provider) => ({ json: provider as any }));
}

export async function filterProviders(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const filters = this.getNodeParameter('filters', index, {}) as {
		gpuType?: string;
		region?: string;
		minCpu?: number;
		minMemory?: number;
		minStorage?: number;
		maxPrice?: number;
		auditedOnly?: boolean;
	};

	const consoleClient = await createConsoleApiClient(this);
	
	// Convert filter params to match API expectations
	const apiFilters: {
		gpuVendor?: string;
		gpuModel?: string;
		region?: string;
		minCpu?: number;
		minMemory?: string;
		maxPrice?: string;
		auditor?: string;
	} = {
		region: filters.region,
		minCpu: filters.minCpu,
		minMemory: filters.minMemory ? `${filters.minMemory}Gi` : undefined,
		maxPrice: filters.maxPrice ? filters.maxPrice.toString() : undefined,
	};
	
	if (filters.gpuType) {
		apiFilters.gpuVendor = 'nvidia';
		apiFilters.gpuModel = filters.gpuType;
	}
	
	const providers = await consoleClient.filterProviders(apiFilters);

	return providers.map((provider) => ({ json: provider as any }));
}

export async function getProviderStatus(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const provider = this.getNodeParameter('provider', index) as string;

	const consoleClient = await createConsoleApiClient(this);
	const status = await consoleClient.getProviderStatus(provider);

	return [{ json: status as any }];
}

export async function getProviderLeases(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const provider = this.getNodeParameter('provider', index) as string;
	const options = this.getNodeParameter('options', index, {}) as {
		state?: string;
	};

	const consoleClient = await createConsoleApiClient(this);

	// Get all leases and filter by provider
	// Note: This is a workaround since Console API doesn't have direct provider lease endpoint
	const allLeases = await consoleClient.getLeases();

	// Filter by provider
	let leases = allLeases.filter((lease) => lease.leaseId?.provider === provider);

	if (options.state && options.state !== 'all') {
		leases = leases.filter(
			(lease) => lease.state.toLowerCase() === options.state!.toLowerCase(),
		);
	}

	return leases.map((lease) => ({ json: lease as any }));
}
