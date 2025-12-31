/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IDataObject } from 'n8n-workflow';

/**
 * Akash Network Type Definitions
 *
 * This file contains all TypeScript interfaces and types used
 * throughout the Akash n8n node implementation.
 */

// ============================================================================
// Credential Types
// ============================================================================

export interface IAkashApiCredentials {
  apiEndpoint: string;
  walletAddress: string;
  mnemonic?: string;
  privateKey?: string;
  network: 'mainnet' | 'testnet';
  chainId?: string;
}

export interface IAkashRpcCredentials {
  rpcEndpoint: string;
  restEndpoint: string;
  websocketEndpoint?: string;
}

// ============================================================================
// SDL (Stack Definition Language) Types
// ============================================================================

/**
 * SDL v2.0 Manifest structure
 * SDL is the YAML format used to define deployments on Akash
 */
export interface ISDLManifest {
  version: string;
  services: Record<string, ISDLService>;
  profiles: {
    compute: Record<string, ISDLComputeProfile>;
    placement: Record<string, ISDLPlacementProfile>;
  };
  deployment: Record<string, ISDLDeploymentConfig>;
}

export interface ISDLService {
  image: string;
  command?: string[];
  args?: string[];
  env?: string[];
  expose?: ISDLExpose[];
  params?: ISDLServiceParams;
}

export interface ISDLExpose {
  port: number;
  as?: number;
  proto?: 'tcp' | 'udp';
  to?: ISDLExposeTo[];
  accept?: string[];
}

export interface ISDLExposeTo {
  global?: boolean;
  service?: string;
}

export interface ISDLServiceParams {
  storage?: Record<string, ISDLStorageParams>;
}

export interface ISDLStorageParams {
  mount: string;
  readOnly?: boolean;
}

export interface ISDLComputeProfile {
  resources: ISDLResources;
}

export interface ISDLResources {
  cpu: {
    units: number | string;
  };
  memory: {
    size: string;
  };
  storage: ISDLStorage[] | ISDLStorage;
  gpu?: ISDLGpu;
}

export interface ISDLStorage {
  size: string;
  name?: string;
  class?: string;
}

export interface ISDLGpu {
  units: number;
  attributes?: {
    vendor?: {
      nvidia?: ISDLGpuModel[];
    };
  };
}

export interface ISDLGpuModel {
  model: string;
  ram?: string;
  interface?: string;
}

export interface ISDLPlacementProfile {
  attributes?: Record<string, string>;
  signedBy?: {
    anyOf?: string[];
    allOf?: string[];
  };
  pricing: Record<string, ISDLPricing>;
}

export interface ISDLPricing {
  denom: string;
  amount: number;
}

export interface ISDLDeploymentConfig {
  [serviceName: string]: {
    profile: string;
    count: number;
  };
}

// ============================================================================
// Deployment Types
// ============================================================================

/**
 * Deployment sequence identifiers
 * dseq = deployment sequence
 * gseq = group sequence
 * oseq = order sequence
 */
export interface IDeploymentId {
  [key: string]: any;
  owner: string;
  dseq: string;
}

export interface IGroupId extends IDeploymentId {
  gseq: number;
}

export interface IOrderId extends IGroupId {
  oseq: number;
}

export interface IDeployment {
  [key: string]: any;
  deploymentId: IDeploymentId;
  state: DeploymentState;
  version: string;
  createdAt: string;
  dseq?: string;
  escrowAccount?: IEscrowAccount;
  groups?: IDeploymentGroup[];
}

export interface IDeploymentGroup {
  groupId: IGroupId;
  state: GroupState;
  groupSpec: IGroupSpec;
  createdAt: string;
}

export interface IGroupSpec {
  name: string;
  requirements: IPlacementRequirements;
  resources: IResourceGroup[];
}

export interface IPlacementRequirements {
  attributes?: IAttribute[];
  signedBy?: ISignedBy;
}

export interface IAttribute {
  key: string;
  value: string;
}

export interface ISignedBy {
  anyOf?: string[];
  allOf?: string[];
}

export interface IResourceGroup {
  resources: IResourceUnits;
  count: number;
  price: ICoin;
}

export interface IResourceUnits {
  cpu: {
    units: { val: string };
    attributes?: IAttribute[];
  };
  memory: {
    quantity: { val: string };
    attributes?: IAttribute[];
  };
  storage: IStorageResource[];
  gpu?: {
    units: { val: string };
    attributes?: IAttribute[];
  };
  endpoints?: IEndpoint[];
}

export interface IStorageResource {
  name: string;
  quantity: { val: string };
  attributes?: IAttribute[];
}

export interface IEndpoint {
  kind: number;
  sequenceNumber: number;
}

export interface IEscrowAccount {
  id: {
    scope: string;
    xid: string;
  };
  owner: string;
  state: EscrowState;
  balance: ICoin;
  transferred: ICoin;
  settledAt: string;
  depositor: string;
  funds: ICoin;
}

export interface ICoin {
  denom: string;
  amount: string;
}

export type DeploymentState = 'active' | 'closed' | 'insufficient_funds';
export type GroupState = 'open' | 'paused' | 'closed' | 'insufficient_funds';
export type EscrowState = 'active' | 'closed' | 'overdrawn';

// ============================================================================
// Lease Types
// ============================================================================

export interface ILeaseId extends IOrderId {
  provider: string;
}

export interface ILease {
  [key: string]: any;
  leaseId: ILeaseId;
  state: LeaseState;
  price: ICoin;
  createdAt: string;
  closedOn?: string;
}

export interface ILeaseStatus {
  [key: string]: any;
  services: Record<string, IServiceStatus>;
  forwardedPorts: Record<string, IForwardedPort[]>;
}

export interface IServiceStatus {
  name: string;
  available: number;
  total: number;
  uris?: string[];
  observedGeneration: number;
  replicas: number;
  updatedReplicas: number;
  readyReplicas: number;
  availableReplicas: number;
}

export interface IForwardedPort {
  host: string;
  port: number;
  externalPort: number;
  proto: string;
  name: string;
}

export type LeaseState = 'active' | 'closed' | 'insufficient_funds';

// ============================================================================
// Order Types
// ============================================================================

export interface IOrder {
  [key: string]: any;
  orderId: IOrderId;
  state: OrderState;
  spec: IGroupSpec;
  createdAt: string;
}

export type OrderState = 'open' | 'active' | 'closed';

// ============================================================================
// Bid Types
// ============================================================================

export interface IBidId extends IOrderId {
  provider: string;
}

export interface IBid {
  [key: string]: any;
  bidId: IBidId;
  state: BidState;
  price: ICoin;
  createdAt: string;
  resourcesOffer: IResourceGroup[];
}

export type BidState = 'open' | 'active' | 'lost' | 'closed';

// ============================================================================
// Provider Types
// ============================================================================

export interface IProvider {
  [key: string]: any;
  owner: string;
  hostUri: string;
  attributes: IAttribute[];
  info: IProviderInfo;
  isActive?: boolean;
  leaseCount?: number;
}

export interface IProviderInfo {
  email?: string;
  website?: string;
}

export interface IProviderStatus {
  [key: string]: any;
  cluster?: IClusterStatus;
  bidEngine?: IBidEngineStatus;
  manifest?: IManifestStatus;
  publicHostnames?: string[];
  timestamp?: string;
}

export interface IClusterStatus {
  leases: number;
  inventory: IInventory;
}

export interface IInventory {
  active: IInventoryMetric[];
  pending: IInventoryMetric[];
  available: IInventoryMetric;
}

export interface IInventoryMetric {
  cpu: number;
  memory: number;
  storageEphemeral: number;
  gpu: number;
}

export interface IBidEngineStatus {
  orders: number;
}

export interface IManifestStatus {
  deployments: number;
}

export interface IProviderCapabilities {
  gpus: IGpuCapability[];
  storage: IStorageCapability[];
  regions: string[];
}

export interface IGpuCapability {
  vendor: string;
  model: string;
  memory: string;
  count: number;
}

export interface IStorageCapability {
  class: string;
  type: string;
}

// ============================================================================
// Certificate Types
// ============================================================================

export interface ICertificate {
  [key: string]: any;
  owner: string;
  serial: string;
  state: CertificateState;
  cert: {
    cert: string;
    pubkey: string;
  };
}

export type CertificateState = 'valid' | 'revoked';

// ============================================================================
// Wallet Types
// ============================================================================

export interface IWalletBalance {
  balances: ICoin[];
  pagination?: IPagination;
}

export interface IDelegation {
  delegation: {
    delegatorAddress: string;
    validatorAddress: string;
    shares: string;
  };
  balance: ICoin;
}

export interface IReward {
  validatorAddress: string;
  reward: ICoin[];
}

export interface ITransaction {
  txhash: string;
  height: string;
  timestamp: string;
  gasWanted: string;
  gasUsed: string;
  tx: IDataObject;
  logs?: IDataObject[];
}

// ============================================================================
// Marketplace Types
// ============================================================================

export interface INetworkCapacity {
  [key: string]: any;
  // CPU capacity
  cpu?: {
    total: number;
    used: number;
    available: number;
  };
  activeCpu: number;
  pendingCpu: number;
  availableCpu: number;
  // Memory capacity
  memory?: {
    total: number;
    used: number;
    available: number;
  };
  activeMemory: number;
  pendingMemory: number;
  availableMemory: number;
  // Storage capacity
  storage?: {
    total: number;
    used: number;
    available: number;
  };
  activeStorage: number;
  pendingStorage: number;
  availableStorage: number;
  // GPU capacity
  gpu?: {
    total: number;
    used: number;
    available: number;
  };
  activeGpu: number;
  pendingGpu: number;
  availableGpu: number;
  // Provider stats
  totalProviders?: number;
  activeProviders?: number;
  // Deployment stats
  activeDeployments?: number;
  activeLeases?: number;
}

export interface IPricingStats {
  [key: string]: any;
  cpuPrice: string;
  memoryPrice: string;
  storagePrice: string;
  gpuPrice?: string;
}

export interface ICostEstimate {
  hourly: ICoin;
  daily: ICoin;
  monthly: ICoin;
  providers: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface IPagination {
  nextKey?: string;
  total?: string;
}

export interface IApiResponse<T> {
  data: T;
  pagination?: IPagination;
}

export interface IDeploymentsResponse {
  deployments: IDeployment[];
  pagination?: IPagination;
}

export interface ILeasesResponse {
  leases: ILease[];
  pagination?: IPagination;
}

export interface IOrdersResponse {
  orders: IOrder[];
  pagination?: IPagination;
}

export interface IBidsResponse {
  bids: IBid[];
  pagination?: IPagination;
}

export interface IProvidersResponse {
  providers: IProvider[];
  pagination?: IPagination;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface ITransactionResult {
  transactionHash: string;
  code: number;
  height: number;
  gasUsed: number;
  gasWanted: number;
  rawLog?: string;
  events?: IDataObject[];
}

export interface IMsgCreateDeployment {
  owner: string;
  version: Uint8Array;
  groups: IGroupSpec[];
  deposit: ICoin;
  depositor: string;
}

export interface IMsgCloseDeployment {
  id: IDeploymentId;
}

export interface IMsgUpdateDeployment {
  id: IDeploymentId;
  version: Uint8Array;
}

export interface IMsgDepositDeployment {
  id: IDeploymentId;
  amount: ICoin;
  depositor: string;
}

export interface IMsgCreateLease {
  bidId: IBidId;
}

export interface IMsgCloseLease {
  leaseId: ILeaseId;
}

export interface IMsgWithdrawLease {
  leaseId: ILeaseId;
}

export interface IMsgCreateCertificate {
  owner: string;
  cert: Uint8Array;
  pubkey: Uint8Array;
}

export interface IMsgRevokeCertificate {
  id: {
    owner: string;
    serial: string;
  };
}

// ============================================================================
// Event Types (for Trigger Node)
// ============================================================================

export interface IAkashEvent {
  type: AkashEventType;
  attributes: IAttribute[];
  timestamp: string;
  height: number;
  txHash?: string;
}

export type AkashEventType =
  | 'deployment.created'
  | 'deployment.updated'
  | 'deployment.closed'
  | 'lease.created'
  | 'lease.closed'
  | 'bid.created'
  | 'bid.closed'
  | 'order.created'
  | 'order.closed'
  | 'provider.created'
  | 'provider.updated';

export interface IDeploymentEvent extends IAkashEvent {
  deploymentId: IDeploymentId;
  state?: DeploymentState;
}

export interface ILeaseEvent extends IAkashEvent {
  leaseId: ILeaseId;
  state?: LeaseState;
  price?: ICoin;
}

export interface IBidEvent extends IAkashEvent {
  bidId: IBidId;
  state?: BidState;
  price?: ICoin;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface IFilterOptions {
  gpuVendor?: string;
  gpuModel?: string;
  region?: string;
  minCpu?: number;
  minMemory?: string;
  minStorage?: string;
  maxPrice?: string;
  auditor?: string;
}

export interface ISortOptions {
  field: 'price' | 'uptime' | 'leases';
  direction: 'asc' | 'desc';
}

export interface ILogEntry {
  timestamp: string;
  service: string;
  message: string;
}

export interface IShellSession {
  podName: string;
  serviceName: string;
  command: string[];
  stdin: boolean;
  tty: boolean;
}

// ============================================================================
// Node Operation Types
// ============================================================================

export type AkashResource =
  | 'deployment'
  | 'lease'
  | 'order'
  | 'bid'
  | 'provider'
  | 'certificate'
  | 'wallet'
  | 'marketplace';

export type DeploymentOperation =
  | 'create'
  | 'get'
  | 'getMany'
  | 'update'
  | 'close'
  | 'status'
  | 'logs'
  | 'deposit'
  | 'groups'
  | 'escrow';

export type LeaseOperation =
  | 'create'
  | 'get'
  | 'getMany'
  | 'close'
  | 'status'
  | 'events'
  | 'withdraw'
  | 'shell'
  | 'sendManifest';

export type OrderOperation = 'get' | 'getMany' | 'bids' | 'close';

export type BidOperation = 'get' | 'getMany' | 'accept' | 'close';

export type ProviderOperation =
  | 'get'
  | 'getMany'
  | 'attributes'
  | 'status'
  | 'leases'
  | 'capabilities'
  | 'filter';

export type CertificateOperation = 'create' | 'get' | 'getMany' | 'revoke';

export type WalletOperation =
  | 'balance'
  | 'escrowBalances'
  | 'history'
  | 'send'
  | 'delegations'
  | 'rewards';

export type MarketplaceOperation =
  | 'capacity'
  | 'pricing'
  | 'activeDeployments'
  | 'providerCount'
  | 'utilization'
  | 'estimate';
