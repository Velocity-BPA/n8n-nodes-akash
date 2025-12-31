/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { createCosmosClient, createConsoleApiClient } from '../../transport';

/**
 * Lease Operations
 *
 * Leases represent active agreements between deployers and providers.
 * A lease is created when a bid is accepted and contains payment terms.
 */

// Get Single Lease
export const getDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (dseq)',
    name: 'dseq',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
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
        resource: ['lease'],
        operation: ['get'],
      },
    },
    description: 'The group sequence number (default: 1)',
  },
  {
    displayName: 'Order Sequence (oseq)',
    name: 'oseq',
    type: 'number',
    default: 1,
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['get'],
      },
    },
    description: 'The order sequence number (default: 1)',
  },
  {
    displayName: 'Provider Address',
    name: 'provider',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['get'],
      },
    },
    description: 'The provider address (akash1...)',
    placeholder: 'akash1...',
  },
];

export async function executeGet(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const gseq = this.getNodeParameter('gseq', index, 1) as number;
  const oseq = this.getNodeParameter('oseq', index, 1) as number;
  const provider = this.getNodeParameter('provider', index) as string;

  const consoleClient = await createConsoleApiClient(this);
  const cosmosClient = await createCosmosClient(this);
  const owner = cosmosClient.getWalletAddress();

  const lease = await consoleClient.getLease(owner, dseq, gseq, oseq, provider);

  await cosmosClient.disconnect();

  return [{ json: lease as any }];
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
        resource: ['lease'],
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
          { name: 'Active', value: 'active' },
          { name: 'Closed', value: 'closed' },
          { name: 'Insufficient Funds', value: 'insufficient_funds' },
        ],
        default: 'active',
        description: 'Filter by lease state',
      },
      {
        displayName: 'Provider',
        name: 'provider',
        type: 'string',
        default: '',
        description: 'Filter by provider address',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 50,
        description: 'Maximum number of leases to return',
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
    provider?: string;
    limit?: number;
  };

  const consoleClient = await createConsoleApiClient(this);
  const cosmosClient = await createCosmosClient(this);

  const owner = filters.owner || cosmosClient.getWalletAddress();

  let leases = await consoleClient.getLeases(owner);

  // Apply filters locally
  if (filters.dseq) {
    leases = leases.filter((lease) => lease.leaseId?.dseq === filters.dseq);
  }
  if (filters.state) {
    leases = leases.filter((lease) => lease.state === filters.state);
  }
  if (filters.provider) {
    leases = leases.filter((lease) => lease.leaseId?.provider === filters.provider);
  }

  await cosmosClient.disconnect();

  const limit = filters.limit || 50;
  const limitedLeases = leases.slice(0, limit);

  return limitedLeases.map((lease) => ({ json: lease as any }));
}

// Close Lease
export const closeDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (dseq)',
    name: 'dseq',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['close'],
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
        resource: ['lease'],
        operation: ['close'],
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
        resource: ['lease'],
        operation: ['close'],
      },
    },
    description: 'The order sequence number',
  },
  {
    displayName: 'Provider Address',
    name: 'provider',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['close'],
      },
    },
    description: 'The provider address',
  },
];

export async function executeClose(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const gseq = this.getNodeParameter('gseq', index, 1) as number;
  const oseq = this.getNodeParameter('oseq', index, 1) as number;
  const provider = this.getNodeParameter('provider', index) as string;

  const cosmosClient = await createCosmosClient(this);
  const result = await cosmosClient.closeLease(dseq, gseq, oseq, provider);

  await cosmosClient.disconnect();

  return [
    {
      json: {
        success: result.code === 0,
        transactionHash: result.transactionHash,
        height: result.height,
        gasUsed: result.gasUsed,
        dseq,
        gseq,
        oseq,
        provider,
      },
    },
  ];
}

// Get Lease Status
export const statusDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (dseq)',
    name: 'dseq',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['status'],
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
        resource: ['lease'],
        operation: ['status'],
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
        resource: ['lease'],
        operation: ['status'],
      },
    },
    description: 'The order sequence number',
  },
  {
    displayName: 'Provider Address',
    name: 'provider',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['status'],
      },
    },
    description: 'The provider address',
  },
];

export async function executeStatus(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const gseq = this.getNodeParameter('gseq', index, 1) as number;
  const oseq = this.getNodeParameter('oseq', index, 1) as number;
  const provider = this.getNodeParameter('provider', index) as string;

  const consoleClient = await createConsoleApiClient(this);
  const cosmosClient = await createCosmosClient(this);
  const owner = cosmosClient.getWalletAddress();

  const status = await consoleClient.getLeaseStatus(owner, dseq, gseq, oseq, provider);

  await cosmosClient.disconnect();

  return [{ json: status as any }];
}

// Send Manifest to Lease
export const sendManifestDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (dseq)',
    name: 'dseq',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['sendManifest'],
      },
    },
    description: 'The deployment sequence number',
  },
  {
    displayName: 'Provider Address',
    name: 'provider',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['sendManifest'],
      },
    },
    description: 'The provider address',
  },
  {
    displayName: 'SDL Manifest',
    name: 'sdl',
    type: 'string',
    typeOptions: {
      rows: 15,
      alwaysOpenEditWindow: true,
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['sendManifest'],
      },
    },
    description: 'The SDL manifest to send to the provider',
  },
];

export async function executeSendManifest(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const provider = this.getNodeParameter('provider', index) as string;
  const sdl = this.getNodeParameter('sdl', index) as string;

  const { parseSDL, sdlToManifest } = await import('../../helpers');

  const consoleClient = await createConsoleApiClient(this);
  const cosmosClient = await createCosmosClient(this);
  const owner = cosmosClient.getWalletAddress();

  const parsedSdl = parseSDL(sdl);
  const manifest = sdlToManifest(parsedSdl);

  await consoleClient.sendManifest(owner, dseq, provider, manifest);

  await cosmosClient.disconnect();

  return [
    {
      json: {
        success: true,
        dseq,
        provider,
        message: 'Manifest sent successfully',
      },
    },
  ];
}

// Withdraw Lease Earnings (for providers)
export const withdrawDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (dseq)',
    name: 'dseq',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['withdraw'],
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
        resource: ['lease'],
        operation: ['withdraw'],
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
        resource: ['lease'],
        operation: ['withdraw'],
      },
    },
    description: 'The order sequence number',
  },
  {
    displayName: 'Owner Address',
    name: 'owner',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['lease'],
        operation: ['withdraw'],
      },
    },
    description: 'The deployment owner address',
  },
];

export async function executeWithdraw(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const gseq = this.getNodeParameter('gseq', index, 1) as number;
  const oseq = this.getNodeParameter('oseq', index, 1) as number;
  const owner = this.getNodeParameter('owner', index) as string;

  const cosmosClient = await createCosmosClient(this);
  const result = await cosmosClient.withdrawLease(dseq, gseq, oseq, owner);

  await cosmosClient.disconnect();

  return [
    {
      json: {
        success: result.code === 0,
        transactionHash: result.transactionHash,
        height: result.height,
        gasUsed: result.gasUsed,
        dseq,
        gseq,
        oseq,
        owner,
      },
    },
  ];
}

// Combined exports
export const description: INodeProperties[] = [
  ...getDescription,
  ...getManyDescription,
  ...closeDescription,
  ...statusDescription,
  ...sendManifestDescription,
  ...withdrawDescription,
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
    case 'close':
      return executeClose.call(this, index);
    case 'status':
      return executeStatus.call(this, index);
    case 'sendManifest':
      return executeSendManifest.call(this, index);
    case 'withdraw':
      return executeWithdraw.call(this, index);
    default:
      throw new Error(`Unknown lease operation: ${operation}`);
  }
}
