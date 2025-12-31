/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { createCosmosClient, createConsoleApiClient } from '../../transport';

/**
 * Order Operations
 *
 * Orders are created automatically when a deployment is created.
 * Providers submit bids against orders.
 */

// Get Single Order
export const getDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (dseq)',
    name: 'dseq',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['order'],
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
    displayOptions: {
      show: {
        resource: ['order'],
        operation: ['get'],
      },
    },
    description: 'The group sequence number',
  },
  {
    displayName: 'Order Sequence (oseq)',
    name: 'oseq',
    type: 'number',
    default: 1,
    displayOptions: {
      show: {
        resource: ['order'],
        operation: ['get'],
      },
    },
    description: 'The order sequence number',
  },
];

export async function executeGet(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const gseq = this.getNodeParameter('gseq', index, 1) as number;
  const oseq = this.getNodeParameter('oseq', index, 1) as number;

  const consoleClient = await createConsoleApiClient(this);
  const cosmosClient = await createCosmosClient(this);
  const owner = cosmosClient.getWalletAddress();

  const order = await consoleClient.getOrder(owner, dseq, gseq, oseq);

  await cosmosClient.disconnect();

  return [{ json: order as any }];
}
export const getManyDescription: INodeProperties[] = [
  {
    displayName: 'Filters',
    name: 'filters',
    type: 'collection',
    placeholder: 'Add Filter',
    default: {},
    displayOptions: {
      show: {
        resource: ['order'],
        operation: ['getMany'],
      },
    },
    options: [
      {
        displayName: 'Owner',
        name: 'owner',
        type: 'string',
        default: '',
        description: 'Filter by owner address. Leave empty to use credentials wallet.',
      },
      {
        displayName: 'Deployment Sequence (dseq)',
        name: 'dseq',
        type: 'string',
        default: '',
        description: 'Filter by deployment sequence',
      },
      {
        displayName: 'State',
        name: 'state',
        type: 'options',
        options: [
          { name: 'All', value: '' },
          { name: 'Open', value: 'open' },
          { name: 'Active', value: 'active' },
          { name: 'Closed', value: 'closed' },
        ],
        default: 'open',
        description: 'Filter by order state',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 50,
        description: 'Maximum number of orders to return',
      },
    ],
  },
];

export async function executeGetMany(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const filters = this.getNodeParameter('filters', index, {}) as {
    owner?: string;
    dseq?: string;
    state?: string;
    limit?: number;
  };

  const consoleClient = await createConsoleApiClient(this);
  const cosmosClient = await createCosmosClient(this);

  const owner = filters.owner || cosmosClient.getWalletAddress();

  let orders = await consoleClient.getOrders(owner);

  // Apply filters locally
  if (filters.dseq) {
    orders = orders.filter((order) => order.orderId?.dseq === filters.dseq);
  }
  if (filters.state) {
    orders = orders.filter((order) => order.state === filters.state);
  }

  await cosmosClient.disconnect();

  const limit = filters.limit || 50;
  const limitedOrders = orders.slice(0, limit);

  return limitedOrders.map((order) => ({ json: order as any }));
}

// Get Order Bids
export const bidsDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (dseq)',
    name: 'dseq',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['order'],
        operation: ['bids'],
      },
    },
    description: 'The deployment sequence number',
  },
  {
    displayName: 'Group Sequence (gseq)',
    name: 'gseq',
    type: 'number',
    default: 1,
    displayOptions: {
      show: {
        resource: ['order'],
        operation: ['bids'],
      },
    },
    description: 'The group sequence number',
  },
  {
    displayName: 'Order Sequence (oseq)',
    name: 'oseq',
    type: 'number',
    default: 1,
    displayOptions: {
      show: {
        resource: ['order'],
        operation: ['bids'],
      },
    },
    description: 'The order sequence number',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['order'],
        operation: ['bids'],
      },
    },
    options: [
      {
        displayName: 'State Filter',
        name: 'state',
        type: 'options',
        options: [
          { name: 'All', value: '' },
          { name: 'Open', value: 'open' },
          { name: 'Active', value: 'active' },
          { name: 'Closed', value: 'closed' },
        ],
        default: 'open',
        description: 'Filter bids by state',
      },
      {
        displayName: 'Sort by Price',
        name: 'sortByPrice',
        type: 'boolean',
        default: true,
        description: 'Whether to sort bids by price (lowest first)',
      },
    ],
  },
];

export async function executeBids(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const gseq = this.getNodeParameter('gseq', index, 1) as number;
  const oseq = this.getNodeParameter('oseq', index, 1) as number;
  const options = this.getNodeParameter('options', index, {}) as {
    state?: string;
    sortByPrice?: boolean;
  };

  const consoleClient = await createConsoleApiClient(this);
  const cosmosClient = await createCosmosClient(this);
  const owner = cosmosClient.getWalletAddress();

  let bids = await consoleClient.getBids(owner, dseq, gseq, oseq);

  // Filter by state if specified
  if (options.state) {
    bids = bids.filter((bid) => bid.state === options.state);
  }

  // Sort by price if requested
  if (options.sortByPrice !== false) {
    bids = bids.sort(
      (a, b) => parseInt(a.price.amount, 10) - parseInt(b.price.amount, 10),
    );
  }

  await cosmosClient.disconnect();

  return bids.map((bid) => ({ json: bid as any }));
}

// Combined exports
export const description: INodeProperties[] = [
  ...getDescription,
  ...getManyDescription,
  ...bidsDescription,
];

export async function execute(
  this: IExecuteFunctions,
  operation: string,
  index: number,
): Promise<INodeExecutionData[]> {
  switch (operation) {
    case 'get':
      return executeGet.call(this, index);
    case 'getMany':
      return executeGetMany.call(this, index);
    case 'bids':
      return executeBids.call(this, index);
    default:
      throw new Error(`Unknown order operation: ${operation}`);
  }
}
