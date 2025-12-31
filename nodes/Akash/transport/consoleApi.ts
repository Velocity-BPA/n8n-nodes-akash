/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { IExecuteFunctions, ILoadOptionsFunctions, IHookFunctions } from 'n8n-workflow';
import {
  IDeployment,
  ILease,
  ILeaseStatus,
  IOrder,
  IBid,
  IProvider,
  IProviderStatus,
  ICertificate,
  INetworkCapacity,
  IPricingStats,
  ILogEntry,
  IAkashApiCredentials,
} from '../types';
import { AKASH_ENDPOINTS, CONSOLE_API_VERSION, TIMEOUTS } from '../constants';

/**
 * Console API Client
 *
 * Client for interacting with the Akash Console API.
 * The Console API provides a REST interface for managing deployments,
 * leases, and other Akash resources.
 */

export class ConsoleApiClient {
  private client: AxiosInstance;
  private credentials: IAkashApiCredentials;

  constructor(credentials: IAkashApiCredentials) {
    this.credentials = credentials;

    const baseURL =
      credentials.apiEndpoint ||
      AKASH_ENDPOINTS[credentials.network || 'mainnet'].console;

    this.client = axios.create({
      baseURL: `${baseURL}/${CONSOLE_API_VERSION}`,
      timeout: TIMEOUTS.api,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => this.handleError(error),
    );
  }

  /**
   * Handle API errors with descriptive messages
   */
  private handleError(error: AxiosError): never {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown>;
      const message = data?.message || data?.error || error.message;

      switch (status) {
        case 400:
          throw new Error(`Bad Request: ${message}`);
        case 401:
          throw new Error('Authentication failed: Invalid credentials');
        case 403:
          throw new Error(`Access denied: ${message}`);
        case 404:
          throw new Error(`Resource not found: ${message}`);
        case 429:
          throw new Error('Rate limit exceeded. Please try again later.');
        case 500:
          throw new Error(`Server error: ${message}`);
        default:
          throw new Error(`API error (${status}): ${message}`);
      }
    } else if (error.request) {
      throw new Error('No response from Akash API. Please check your network connection.');
    } else {
      throw new Error(`Request error: ${error.message}`);
    }
  }

  /**
   * Make authenticated request
   */
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }

  // ============================================================================
  // Deployment Operations
  // ============================================================================

  /**
   * Get all deployments for owner
   */
  async getDeployments(owner?: string, filters?: { state?: string }): Promise<IDeployment[]> {
    const address = owner || this.credentials.walletAddress;
    const params: Record<string, string> = { owner: address };
    if (filters?.state) {
      params.state = filters.state;
    }
    return this.request<IDeployment[]>({
      method: 'GET',
      url: `/deployments`,
      params,
    });
  }

  /**
   * Get a specific deployment
   */
  async getDeployment(owner: string, dseq: string): Promise<IDeployment> {
    return this.request<IDeployment>({
      method: 'GET',
      url: `/deployments/${owner}/${dseq}`,
    });
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(owner: string, dseq: string): Promise<ILeaseStatus> {
    return this.request<ILeaseStatus>({
      method: 'GET',
      url: `/deployments/${owner}/${dseq}/status`,
    });
  }

  /**
   * Get deployment logs
   */
  async getDeploymentLogs(
    owner: string,
    dseq: string,
    options?: {
      service?: string;
      follow?: boolean;
      tail?: number;
    },
  ): Promise<ILogEntry[]> {
    return this.request<ILogEntry[]>({
      method: 'GET',
      url: `/deployments/${owner}/${dseq}/logs`,
      params: options,
    });
  }

  // ============================================================================
  // Lease Operations
  // ============================================================================

  /**
   * Get all leases for owner
   */
  async getLeases(owner?: string): Promise<ILease[]> {
    const address = owner || this.credentials.walletAddress;
    return this.request<ILease[]>({
      method: 'GET',
      url: `/leases`,
      params: { owner: address },
    });
  }

  /**
   * Get a specific lease
   */
  async getLease(
    owner: string,
    dseq: string,
    gseq: number,
    oseq: number,
    provider: string,
  ): Promise<ILease> {
    return this.request<ILease>({
      method: 'GET',
      url: `/leases/${owner}/${dseq}/${gseq}/${oseq}/${provider}`,
    });
  }

  /**
   * Get lease status from provider
   */
  async getLeaseStatus(
    owner: string,
    dseq: string,
    gseq: number,
    oseq: number,
    provider: string,
  ): Promise<ILeaseStatus> {
    return this.request<ILeaseStatus>({
      method: 'GET',
      url: `/leases/${owner}/${dseq}/${gseq}/${oseq}/${provider}/status`,
    });
  }

  /**
   * Send manifest to provider
   */
  async sendManifest(
    owner: string,
    dseq: string,
    provider: string,
    manifest: object,
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>({
      method: 'POST',
      url: `/deployments/${owner}/${dseq}/manifest`,
      data: {
        provider,
        manifest,
      },
    });
  }

  // ============================================================================
  // Order Operations
  // ============================================================================

  /**
   * Get all orders for owner
   */
  async getOrders(owner?: string): Promise<IOrder[]> {
    const address = owner || this.credentials.walletAddress;
    return this.request<IOrder[]>({
      method: 'GET',
      url: `/orders`,
      params: { owner: address },
    });
  }

  /**
   * Get a specific order
   */
  async getOrder(owner: string, dseq: string, gseq: number, oseq: number): Promise<IOrder> {
    return this.request<IOrder>({
      method: 'GET',
      url: `/orders/${owner}/${dseq}/${gseq}/${oseq}`,
    });
  }

  // ============================================================================
  // Bid Operations
  // ============================================================================

  /**
   * Get bids for an order
   */
  async getBids(owner: string, dseq: string, gseq: number, oseq: number): Promise<IBid[]> {
    return this.request<IBid[]>({
      method: 'GET',
      url: `/bids`,
      params: { owner, dseq, gseq, oseq },
    });
  }

  /**
   * Get a specific bid
   */
  async getBid(
    owner: string,
    dseq: string,
    gseq: number,
    oseq: number,
    provider: string,
  ): Promise<IBid> {
    return this.request<IBid>({
      method: 'GET',
      url: `/bids/${owner}/${dseq}/${gseq}/${oseq}/${provider}`,
    });
  }

  // ============================================================================
  // Provider Operations
  // ============================================================================

  /**
   * Get all providers
   */
  async getProviders(): Promise<IProvider[]> {
    return this.request<IProvider[]>({
      method: 'GET',
      url: `/providers`,
    });
  }

  /**
   * Get a specific provider
   */
  async getProvider(address: string): Promise<IProvider> {
    return this.request<IProvider>({
      method: 'GET',
      url: `/providers/${address}`,
    });
  }

  /**
   * Get provider status
   */
  async getProviderStatus(address: string): Promise<IProviderStatus> {
    return this.request<IProviderStatus>({
      method: 'GET',
      url: `/providers/${address}/status`,
    });
  }

  /**
   * Filter providers by capabilities
   */
  async filterProviders(filters: {
    gpuVendor?: string;
    gpuModel?: string;
    region?: string;
    minCpu?: number;
    minMemory?: string;
    maxPrice?: string;
    auditor?: string;
  }): Promise<IProvider[]> {
    return this.request<IProvider[]>({
      method: 'GET',
      url: `/providers/filter`,
      params: filters,
    });
  }

  // ============================================================================
  // Certificate Operations
  // ============================================================================

  /**
   * Get certificates for owner
   */
  async getCertificates(owner?: string): Promise<ICertificate[]> {
    const address = owner || this.credentials.walletAddress;
    return this.request<ICertificate[]>({
      method: 'GET',
      url: `/certificates`,
      params: { owner: address },
    });
  }

  /**
   * Get a specific certificate
   */
  async getCertificate(owner: string, serial: string): Promise<ICertificate> {
    return this.request<ICertificate>({
      method: 'GET',
      url: `/certificates/${owner}/${serial}`,
    });
  }

  // ============================================================================
  // Marketplace Operations
  // ============================================================================

  /**
   * Get network capacity statistics
   */
  async getNetworkCapacity(): Promise<INetworkCapacity> {
    return this.request<INetworkCapacity>({
      method: 'GET',
      url: `/network/capacity`,
    });
  }

  /**
   * Get pricing statistics
   */
  async getPricingStats(): Promise<IPricingStats> {
    return this.request<IPricingStats>({
      method: 'GET',
      url: `/network/pricing`,
    });
  }

  /**
   * Get active deployments count
   */
  async getActiveDeploymentsCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>({
      method: 'GET',
      url: `/network/deployments/count`,
    });
  }

  /**
   * Get provider count
   */
  async getProviderCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>({
      method: 'GET',
      url: `/network/providers/count`,
    });
  }

  /**
   * Estimate deployment cost
   */
  async estimateDeploymentCost(sdl: string): Promise<{
    hourly: { denom: string; amount: string };
    daily: { denom: string; amount: string };
    monthly: { denom: string; amount: string };
    providers: number;
  }> {
    return this.request({
      method: 'POST',
      url: `/deployments/estimate`,
      data: { sdl },
    });
  }
}

/**
 * Create Console API client from n8n context
 */
export async function createConsoleApiClient(
  context: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
  credentialName: string = 'akashApi',
): Promise<ConsoleApiClient> {
  const credentials = await context.getCredentials(credentialName) as IAkashApiCredentials;
  return new ConsoleApiClient(credentials);
}
