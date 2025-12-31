/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { createCosmosClient, createConsoleApiClient } from '../../transport';
import { parseSDL, validateSDL, sdlToManifest } from '../../helpers';

/**
 * Update Deployment Operation
 */
export const updateDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (DSEQ)',
    name: 'dseq',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['update'],
      },
    },
    description: 'The deployment sequence number to update',
  },
  {
    displayName: 'New SDL Manifest',
    name: 'sdl',
    type: 'string',
    typeOptions: {
      rows: 15,
      alwaysOpenEditWindow: true,
    },
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['update'],
      },
    },
    description: 'Updated SDL manifest. Note: Resource changes may require closing and recreating.',
  },
  {
    displayName: 'Provider Address',
    name: 'provider',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['update'],
      },
    },
    description: 'Provider address to send the updated manifest to',
    placeholder: 'akash1provider...',
  },
];

export async function executeUpdate(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const sdl = this.getNodeParameter('sdl', index) as string;
  const provider = this.getNodeParameter('provider', index) as string;

  // Validate SDL
  const parsedSdl = parseSDL(sdl);
  const validation = validateSDL(parsedSdl);
  if (!validation.valid) {
    throw new Error(`SDL validation failed:\n${validation.errors.join('\n')}`);
  }

  const cosmosClient = await createCosmosClient(this);
  const consoleClient = await createConsoleApiClient(this);

  // Update deployment on-chain
  const result = await cosmosClient.updateDeployment(dseq, sdl);

  const response: Record<string, unknown> = {
    success: result.code === 0,
    transactionHash: result.transactionHash,
    dseq,
    height: result.height,
  };

  // Send updated manifest to provider
  if (result.code === 0) {
    try {
      const manifest = sdlToManifest(parsedSdl);
      await consoleClient.sendManifest(
        cosmosClient.getWalletAddress(),
        dseq,
        provider,
        manifest,
      );
      response.manifestSent = true;
    } catch (error) {
      response.manifestSent = false;
      response.manifestError = (error as Error).message;
    }
  }

  await cosmosClient.disconnect();
  return [{ json: response as any }];
}
export const closeDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (DSEQ)',
    name: 'dseq',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['close'],
      },
    },
    description: 'The deployment sequence number to close',
  },
];

export async function executeClose(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;

  const cosmosClient = await createCosmosClient(this);
  const result = await cosmosClient.closeDeployment(dseq);

  await cosmosClient.disconnect();

  return [
    {
      json: {
        success: result.code === 0,
        transactionHash: result.transactionHash,
        dseq,
        height: result.height,
        gasUsed: result.gasUsed,
      },
    },
  ];
}

/**
 * Get Deployment Status Operation
 */
export const statusDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (DSEQ)',
    name: 'dseq',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['status'],
      },
    },
    description: 'The deployment sequence number',
  },
  {
    displayName: 'Owner Address',
    name: 'owner',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['status'],
      },
    },
    description: 'Owner wallet address. Leave empty to use credentials.',
  },
];

export async function executeStatus(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const owner = this.getNodeParameter('owner', index, '') as string;

  const client = await createConsoleApiClient(this);
  const credentials = await this.getCredentials('akashApi');
  const ownerAddress = owner || (credentials.walletAddress as string);

  const status = await client.getDeploymentStatus(ownerAddress, dseq);

  return [{ json: status as any }];
}
export const logsDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (DSEQ)',
    name: 'dseq',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['logs'],
      },
    },
    description: 'The deployment sequence number',
  },
  {
    displayName: 'Owner Address',
    name: 'owner',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['logs'],
      },
    },
    description: 'Owner wallet address. Leave empty to use credentials.',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['logs'],
      },
    },
    options: [
      {
        displayName: 'Service Name',
        name: 'service',
        type: 'string',
        default: '',
        description: 'Filter logs by service name',
      },
      {
        displayName: 'Tail Lines',
        name: 'tail',
        type: 'number',
        default: 100,
        description: 'Number of lines to return from the end',
        typeOptions: {
          minValue: 1,
          maxValue: 10000,
        },
      },
    ],
  },
];

export async function executeLogs(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const owner = this.getNodeParameter('owner', index, '') as string;
  const options = this.getNodeParameter('options', index, {}) as {
    service?: string;
    tail?: number;
  };

  const client = await createConsoleApiClient(this);
  const credentials = await this.getCredentials('akashApi');
  const ownerAddress = owner || (credentials.walletAddress as string);

  const logs = await client.getDeploymentLogs(ownerAddress, dseq, {
    service: options.service,
    tail: options.tail,
  });

  return logs.map((log) => ({ json: log as any }));
}
export const depositDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (DSEQ)',
    name: 'dseq',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['deposit'],
      },
    },
    description: 'The deployment sequence number',
  },
  {
    displayName: 'Amount (AKT)',
    name: 'amount',
    type: 'number',
    default: 5,
    required: true,
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['deposit'],
      },
    },
    description: 'Amount of AKT to deposit',
    typeOptions: {
      minValue: 0.1,
      numberPrecision: 6,
    },
  },
];

export async function executeDeposit(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const amount = this.getNodeParameter('amount', index) as number;

  const cosmosClient = await createCosmosClient(this);
  const result = await cosmosClient.depositDeployment(dseq, amount.toString());

  await cosmosClient.disconnect();

  return [
    {
      json: {
        success: result.code === 0,
        transactionHash: result.transactionHash,
        dseq,
        amount: `${amount} AKT`,
        height: result.height,
        gasUsed: result.gasUsed,
      },
    },
  ];
}
