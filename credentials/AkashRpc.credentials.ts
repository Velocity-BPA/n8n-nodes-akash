/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

/**
 * Akash RPC Credentials
 *
 * Credentials for direct RPC communication with Akash Network nodes.
 * Used for direct blockchain queries and custom node connections.
 */
export class AkashRpcCredentials implements ICredentialType {
  name = 'akashRpc';
  displayName = 'Akash RPC';
  documentationUrl = 'https://docs.akash.network/';

  properties: INodeProperties[] = [
    {
      displayName: 'RPC Endpoint',
      name: 'rpcEndpoint',
      type: 'string',
      default: 'https://rpc.akashnet.net',
      required: true,
      placeholder: 'https://rpc.akashnet.net',
      description: 'Tendermint RPC endpoint URL',
      hint: 'Standard port is 26657',
    },
    {
      displayName: 'REST Endpoint',
      name: 'restEndpoint',
      type: 'string',
      default: 'https://api.akashnet.net',
      required: true,
      placeholder: 'https://api.akashnet.net',
      description: 'Cosmos REST API endpoint URL',
      hint: 'Also known as LCD or API endpoint. Standard port is 1317',
    },
    {
      displayName: 'WebSocket Endpoint',
      name: 'websocketEndpoint',
      type: 'string',
      default: 'wss://rpc.akashnet.net/websocket',
      placeholder: 'wss://rpc.akashnet.net/websocket',
      description: 'WebSocket endpoint for real-time events (optional)',
      hint: 'Used for event subscriptions. Usually RPC endpoint with /websocket path',
    },
    {
      displayName: 'Custom Headers',
      name: 'customHeaders',
      type: 'fixedCollection',
      default: {},
      typeOptions: {
        multipleValues: true,
      },
      description: 'Custom headers to send with RPC requests',
      options: [
        {
          name: 'header',
          displayName: 'Header',
          values: [
            {
              displayName: 'Name',
              name: 'name',
              type: 'string',
              default: '',
            },
            {
              displayName: 'Value',
              name: 'value',
              type: 'string',
              default: '',
            },
          ],
        },
      ],
    },
  ];

  // Test connection by querying node status
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.rpcEndpoint}}',
      url: '/status',
      method: 'GET',
    },
  };
}
