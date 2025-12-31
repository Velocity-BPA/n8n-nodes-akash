/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { createConsoleApiClient } from '../../transport';

/**
 * Marketplace Operations for Akash Network
 *
 * Network-wide statistics and cost estimation.
 * - Capacity: Get network capacity stats
 * - Pricing: Get pricing statistics
 * - Estimate: Estimate deployment costs
 */

export const getCapacityDescription: INodeProperties[] = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['marketplace'],
				operation: ['capacity'],
			},
		},
		options: [
			{
				displayName: 'Include GPU Stats',
				name: 'includeGpu',
				type: 'boolean',
				default: true,
				description: 'Whether to include GPU capacity statistics',
			},
		],
	},
];

export const getPricingDescription: INodeProperties[] = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['marketplace'],
				operation: ['pricing'],
			},
		},
		options: [
			{
				displayName: 'Resource Type',
				name: 'resourceType',
				type: 'options',
				default: 'all',
				options: [
					{ name: 'All Resources', value: 'all' },
					{ name: 'CPU', value: 'cpu' },
					{ name: 'Memory', value: 'memory' },
					{ name: 'Storage', value: 'storage' },
					{ name: 'GPU', value: 'gpu' },
				],
				description: 'Filter pricing by resource type',
			},
		],
	},
];

export const estimateDescription: INodeProperties[] = [
	{
		displayName: 'SDL Manifest',
		name: 'sdl',
		type: 'string',
		typeOptions: {
			rows: 10,
			alwaysOpenEditWindow: true,
		},
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['marketplace'],
				operation: ['estimate'],
			},
		},
		description: 'SDL manifest to estimate costs for',
		placeholder: `version: "2.0"
services:
  web:
    image: nginx:latest
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  dcloud:
    web:
      profile: web
      count: 1`,
	},
	{
		displayName: 'Duration',
		name: 'duration',
		type: 'options',
		default: 'month',
		displayOptions: {
			show: {
				resource: ['marketplace'],
				operation: ['estimate'],
			},
		},
		options: [
			{ name: 'Per Hour', value: 'hour' },
			{ name: 'Per Day', value: 'day' },
			{ name: 'Per Week', value: 'week' },
			{ name: 'Per Month', value: 'month' },
		],
		description: 'Time period for cost estimation',
	},
];

export const getActiveDeploymentsDescription: INodeProperties[] = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['marketplace'],
				operation: ['activeDeployments'],
			},
		},
		options: [
			{
				displayName: 'Include Details',
				name: 'includeDetails',
				type: 'boolean',
				default: false,
				description: 'Whether to include detailed breakdown by provider',
			},
		],
	},
];

export const getProviderCountDescription: INodeProperties[] = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['marketplace'],
				operation: ['providerCount'],
			},
		},
		options: [
			{
				displayName: 'Active Only',
				name: 'activeOnly',
				type: 'boolean',
				default: true,
				description: 'Whether to count only active providers',
			},
		],
	},
];

export const getUtilizationDescription: INodeProperties[] = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['marketplace'],
				operation: ['utilization'],
			},
		},
		options: [
			{
				displayName: 'Resource Type',
				name: 'resourceType',
				type: 'options',
				default: 'all',
				options: [
					{ name: 'All Resources', value: 'all' },
					{ name: 'CPU', value: 'cpu' },
					{ name: 'Memory', value: 'memory' },
					{ name: 'Storage', value: 'storage' },
					{ name: 'GPU', value: 'gpu' },
				],
			},
		],
	},
];

export async function getCapacity(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const options = this.getNodeParameter('options', index, {}) as {
		includeGpu?: boolean;
	};

	const consoleClient = await createConsoleApiClient(this);
	const capacity = await consoleClient.getNetworkCapacity();

	const result: Record<string, unknown> = {
		cpu: capacity.cpu,
		memory: capacity.memory,
		storage: capacity.storage,
		totalProviders: capacity.totalProviders,
		activeProviders: capacity.activeProviders,
	};

	if (options.includeGpu !== false) {
		result.gpu = capacity.gpu;
	}

	return [{ json: result as any }];
}

export async function getPricing(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const options = this.getNodeParameter('options', index, {}) as {
		resourceType?: string;
	};

	const consoleClient = await createConsoleApiClient(this);
	const pricing = await consoleClient.getPricingStats();

	let result = pricing;

	// Filter by resource type if specified
	if (options.resourceType && options.resourceType !== 'all') {
		result = {
			[options.resourceType]: pricing[options.resourceType as keyof typeof pricing],
		} as typeof pricing;
	}

	return [{ json: result as any }];
}

export async function estimate(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const sdl = this.getNodeParameter('sdl', index) as string;
	const duration = this.getNodeParameter('duration', index) as string;

	const consoleClient = await createConsoleApiClient(this);

	// Parse SDL to extract resource requirements
	const { parseSDL, calculateSDLPrice } = await import('../../helpers');
	const parsedSdl = parseSDL(sdl);
	const basePrice = calculateSDLPrice(parsedSdl);

	// Get cost estimate from Console API
	const estimate = await consoleClient.estimateDeploymentCost(sdl);

	// Calculate duration multiplier
	// Assuming basePrice is per block (~6 seconds), calculate for different durations
	const blocksPerHour = 600; // ~6 second blocks
	const multipliers: Record<string, number> = {
		hour: blocksPerHour,
		day: blocksPerHour * 24,
		week: blocksPerHour * 24 * 7,
		month: blocksPerHour * 24 * 30,
	};

	const multiplier = multipliers[duration] || multipliers.month;
	const basePriceNum = typeof basePrice === 'string' ? parseFloat(basePrice) : Number(basePrice);
	const estimatedCostUakt = basePriceNum * multiplier;
	const estimatedCostAkt = estimatedCostUakt / 1_000_000;

	return [
		{
			json: {
				duration,
				pricePerBlock: basePrice,
				estimatedCostUakt,
				estimatedCostAkt: estimatedCostAkt.toFixed(6),
				blocksPerPeriod: multiplier,
				resources: {
					services: Object.keys(parsedSdl.services).length,
					profiles: Object.keys(parsedSdl.profiles.compute).length,
				},
				apiEstimate: estimate,
			},
		},
	];
}

export async function getActiveDeployments(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const options = this.getNodeParameter('options', index, {}) as {
		includeDetails?: boolean;
	};

	const consoleClient = await createConsoleApiClient(this);
	const capacity = await consoleClient.getNetworkCapacity();

	const result: Record<string, unknown> = {
		totalActiveDeployments: capacity.activeDeployments || 0,
		totalActiveLeases: capacity.activeLeases || 0,
	};

	if (options.includeDetails) {
		// Get provider breakdown
		const providers = await consoleClient.getProviders();
		const activeProviders = providers.filter((p) => p.isActive);

		result.byProvider = activeProviders.map((p) => ({
			provider: p.owner,
			leaseCount: p.leaseCount || 0,
		}));
	}

	return [{ json: result as any }];
}

export async function getProviderCount(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const options = this.getNodeParameter('options', index, {}) as {
		activeOnly?: boolean;
	};

	const consoleClient = await createConsoleApiClient(this);
	const providers = await consoleClient.getProviders();

	let count = providers.length;
	if (options.activeOnly !== false) {
		count = providers.filter((p) => p.isActive).length;
	}

	return [
		{
			json: {
				totalProviders: providers.length,
				activeProviders: providers.filter((p) => p.isActive).length,
				inactiveProviders: providers.filter((p) => !p.isActive).length,
				count,
				activeOnly: options.activeOnly !== false,
			},
		},
	];
}

export async function getUtilization(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const options = this.getNodeParameter('options', index, {}) as {
		resourceType?: string;
	};

	const consoleClient = await createConsoleApiClient(this);
	const capacity = await consoleClient.getNetworkCapacity();

	// Calculate utilization percentages
	const calculateUtilization = (available: number, total: number): number => {
		if (total === 0) return 0;
		return Math.round(((total - available) / total) * 100 * 100) / 100;
	};

	const utilization: Record<string, unknown> = {
		cpu: {
			total: capacity.cpu?.total || 0,
			available: capacity.cpu?.available || 0,
			used: (capacity.cpu?.total || 0) - (capacity.cpu?.available || 0),
			utilizationPercent: calculateUtilization(
				capacity.cpu?.available || 0,
				capacity.cpu?.total || 0,
			),
		},
		memory: {
			total: capacity.memory?.total || 0,
			available: capacity.memory?.available || 0,
			used: (capacity.memory?.total || 0) - (capacity.memory?.available || 0),
			utilizationPercent: calculateUtilization(
				capacity.memory?.available || 0,
				capacity.memory?.total || 0,
			),
		},
		storage: {
			total: capacity.storage?.total || 0,
			available: capacity.storage?.available || 0,
			used: (capacity.storage?.total || 0) - (capacity.storage?.available || 0),
			utilizationPercent: calculateUtilization(
				capacity.storage?.available || 0,
				capacity.storage?.total || 0,
			),
		},
		gpu: {
			total: capacity.gpu?.total || 0,
			available: capacity.gpu?.available || 0,
			used: (capacity.gpu?.total || 0) - (capacity.gpu?.available || 0),
			utilizationPercent: calculateUtilization(
				capacity.gpu?.available || 0,
				capacity.gpu?.total || 0,
			),
		},
	};

	// Filter by resource type if specified
	if (options.resourceType && options.resourceType !== 'all') {
		return [{ json: { [options.resourceType]: utilization[options.resourceType] } as any }];
	}

	return [{ json: utilization as any }];
}
