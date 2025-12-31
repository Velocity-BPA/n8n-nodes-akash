/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { createConsoleApiClient } from '../../transport';

/**
 * Get Deployment Operation
 *
 * Retrieves a specific deployment by its sequence number.
 */

export const getDescription: INodeProperties[] = [
  {
    displayName: 'Deployment Sequence (DSEQ)',
    name: 'dseq',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['get'],
      },
    },
    description: 'The deployment sequence number (DSEQ)',
    placeholder: '12345678',
  },
  {
    displayName: 'Owner Address',
    name: 'owner',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['get'],
      },
    },
    description:
      'Owner wallet address. Leave empty to use credentials wallet address.',
    placeholder: 'akash1...',
  },
];

export async function executeGet(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const dseq = this.getNodeParameter('dseq', index) as string;
  const owner = this.getNodeParameter('owner', index, '') as string;

  const client = await createConsoleApiClient(this);
  const credentials = await this.getCredentials('akashApi');
  const ownerAddress = owner || (credentials.walletAddress as string);

  const deployment = await client.getDeployment(ownerAddress, dseq);

  return [{ json: deployment as any }];
}

/**
 * List Deployments Operation
 *
 * Retrieves all deployments for an owner.
 */

export const listDescription: INodeProperties[] = [
  {
    displayName: 'Owner Address',
    name: 'owner',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['getMany'],
      },
    },
    description:
      'Owner wallet address. Leave empty to use credentials wallet address.',
    placeholder: 'akash1...',
  },
  {
    displayName: 'Filters',
    name: 'filters',
    type: 'collection',
    placeholder: 'Add Filter',
    default: {},
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['getMany'],
      },
    },
    options: [
      {
        displayName: 'State',
        name: 'state',
        type: 'options',
        options: [
          { name: 'All', value: 'all' },
          { name: 'Active', value: 'active' },
          { name: 'Closed', value: 'closed' },
          { name: 'Insufficient Funds', value: 'insufficient_funds' },
        ],
        default: 'all',
        description: 'Filter by deployment state',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 100,
        description: 'Maximum number of deployments to return',
        typeOptions: {
          minValue: 1,
          maxValue: 1000,
        },
      },
    ],
  },
];

export async function executeList(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const owner = this.getNodeParameter('owner', index, '') as string;
  const filters = this.getNodeParameter('filters', index, {}) as {
    state?: string;
    limit?: number;
  };

  const client = await createConsoleApiClient(this);
  const credentials = await this.getCredentials('akashApi');
  const ownerAddress = owner || (credentials.walletAddress as string);

  let deployments = await client.getDeployments(ownerAddress);

  // Apply filters
  if (filters.state && filters.state !== 'all') {
    deployments = deployments.filter((d) => d.state === filters.state);
  }

  if (filters.limit) {
    deployments = deployments.slice(0, filters.limit);
  }

  return deployments.map((deployment) => ({
    json: deployment as any,
  }));
}
