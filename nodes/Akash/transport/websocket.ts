/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { IAkashEvent, IAttribute, AkashEventType, IAkashApiCredentials } from '../types';
import { AKASH_ENDPOINTS, TIMEOUTS } from '../constants';

/**
 * WebSocket Client for Akash Network
 *
 * Handles real-time event subscriptions via Tendermint WebSocket.
 * Used by the trigger node to monitor blockchain events.
 */

interface TendermintEvent {
  type: string;
  attributes: Array<{
    key: string;
    value: string;
  }>;
}

interface TendermintMessage {
  id?: string;
  jsonrpc: string;
  result?: {
    query?: string;
    data?: {
      type: string;
      value: {
        TxResult?: {
          height: string;
          tx: string;
          result: {
            events: TendermintEvent[];
          };
        };
        block?: {
          header: {
            height: string;
            time: string;
          };
        };
      };
    };
    events?: Record<string, string[]>;
  };
  error?: {
    code: number;
    message: string;
    data?: string;
  };
}

export class AkashWebSocketClient extends EventEmitter {
  private ws?: WebSocket;
  private wsEndpoint: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private subscriptions: Map<string, string> = new Map();
  private messageId: number = 0;
  private isConnected: boolean = false;
  private pingInterval?: NodeJS.Timeout;

  constructor(endpointOrCredentials: string | IAkashApiCredentials) {
    super();

    if (typeof endpointOrCredentials === 'string') {
      this.wsEndpoint = endpointOrCredentials;
    } else {
      const network = endpointOrCredentials.network || 'mainnet';
      this.wsEndpoint = AKASH_ENDPOINTS[network].websocket;
    }
  }

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsEndpoint);

        this.ws.on('open', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startPing();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          this.emit('error', error);
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.ws.on('close', () => {
          this.isConnected = false;
          this.stopPing();
          this.emit('disconnected');
          this.attemptReconnect();
        });

        // Set connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, TIMEOUTS.websocket);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.stopPing();
    this.subscriptions.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.isConnected = false;
  }

  /**
   * Subscribe to deployment events
   */
  subscribeToDeployments(owner?: string): void {
    let query = "message.module='deployment'";
    if (owner) {
      query += ` AND message.sender='${owner}'`;
    }
    this.subscribe('deployments', query);
  }

  /**
   * Subscribe to lease events
   */
  subscribeToLeases(owner?: string): void {
    let query = "message.module='market'";
    if (owner) {
      query += ` AND message.sender='${owner}'`;
    }
    this.subscribe('leases', query);
  }

  /**
   * Subscribe to bid events
   */
  subscribeToBids(owner?: string, dseq?: string): void {
    let query = "message.action='/akash.market.v1beta4.MsgCreateBid'";
    if (owner) {
      query += ` AND akash.market.v1beta4.EventBidCreated.owner='${owner}'`;
    }
    if (dseq) {
      query += ` AND akash.market.v1beta4.EventBidCreated.dseq='${dseq}'`;
    }
    this.subscribe('bids', query);
  }

  /**
   * Subscribe to provider events
   */
  subscribeToProviders(): void {
    const query = "message.module='provider'";
    this.subscribe('providers', query);
  }

  /**
   * Subscribe to new blocks
   */
  subscribeToBlocks(): void {
    this.subscribe('blocks', "tm.event='NewBlock'");
  }

  /**
   * Subscribe to all Akash events
   */
  subscribeToAllEvents(owner?: string): void {
    this.subscribeToDeployments(owner);
    this.subscribeToLeases(owner);
    this.subscribeToBids(owner);
  }

  /**
   * Generic subscribe method
   */
  private subscribe(name: string, query: string): void {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const id = this.getNextMessageId();
    this.subscriptions.set(name, id);

    const subscribeMessage = {
      jsonrpc: '2.0',
      method: 'subscribe',
      id,
      params: {
        query,
      },
    };

    this.ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(name: string): void {
    if (!this.ws || !this.isConnected) {
      return;
    }

    const id = this.subscriptions.get(name);
    if (!id) {
      return;
    }

    const unsubscribeMessage = {
      jsonrpc: '2.0',
      method: 'unsubscribe',
      id: this.getNextMessageId(),
      params: {
        query: id,
      },
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
    this.subscriptions.delete(name);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: TendermintMessage = JSON.parse(data.toString());

      if (message.error) {
        this.emit('error', new Error(message.error.message));
        return;
      }

      if (message.result?.data) {
        const events = this.parseEvents(message);
        for (const event of events) {
          this.emit('event', event);
          this.emitTypedEvent(event);
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Parse Tendermint events into Akash events
   */
  private parseEvents(message: TendermintMessage): IAkashEvent[] {
    const events: IAkashEvent[] = [];

    if (!message.result?.data?.value?.TxResult) {
      return events;
    }

    const txResult = message.result.data.value.TxResult;
    const height = parseInt(txResult.height, 10);
    const timestamp = new Date().toISOString();

    for (const event of txResult.result.events) {
      const akashEvent = this.convertEvent(event, height, timestamp);
      if (akashEvent) {
        events.push(akashEvent);
      }
    }

    return events;
  }

  /**
   * Convert Tendermint event to Akash event
   */
  private convertEvent(
    event: TendermintEvent,
    height: number,
    timestamp: string,
  ): IAkashEvent | null {
    const eventTypeMap: Record<string, AkashEventType> = {
      'akash.deployment.v1beta3.EventDeploymentCreated': 'deployment.created',
      'akash.deployment.v1beta3.EventDeploymentUpdated': 'deployment.updated',
      'akash.deployment.v1beta3.EventDeploymentClosed': 'deployment.closed',
      'akash.market.v1beta4.EventLeaseCreated': 'lease.created',
      'akash.market.v1beta4.EventLeaseClosed': 'lease.closed',
      'akash.market.v1beta4.EventBidCreated': 'bid.created',
      'akash.market.v1beta4.EventBidClosed': 'bid.closed',
      'akash.market.v1beta4.EventOrderCreated': 'order.created',
      'akash.market.v1beta4.EventOrderClosed': 'order.closed',
      'akash.provider.v1beta3.EventProviderCreated': 'provider.created',
      'akash.provider.v1beta3.EventProviderUpdated': 'provider.updated',
    };

    const akashEventType = eventTypeMap[event.type];
    if (!akashEventType) {
      return null;
    }

    const attributes: IAttribute[] = event.attributes.map((attr) => ({
      key: Buffer.from(attr.key, 'base64').toString(),
      value: Buffer.from(attr.value, 'base64').toString(),
    }));

    return {
      type: akashEventType,
      attributes,
      height,
      timestamp,
    };
  }

  /**
   * Emit typed event based on event type
   */
  private emitTypedEvent(event: IAkashEvent): void {
    const [category] = event.type.split('.');
    this.emit(category, event);
  }

  /**
   * Start ping to keep connection alive
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.ping();
      }
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.emit('reconnecting', this.reconnectAttempts);
      this.connect().catch((error) => {
        this.emit('error', error);
      });
    }, delay);
  }

  /**
   * Get next message ID
   */
  private getNextMessageId(): string {
    this.messageId++;
    return `msg-${this.messageId}`;
  }

  /**
   * Check if connected
   */
  isActive(): boolean {
    return this.isConnected;
  }
}

/**
 * Create WebSocket client
 */
export function createWebSocketClient(credentials: IAkashApiCredentials): AkashWebSocketClient {
  return new AkashWebSocketClient(credentials);
}
