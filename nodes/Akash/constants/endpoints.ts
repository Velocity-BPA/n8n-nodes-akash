/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Akash Network API Endpoints
 *
 * These are the official endpoints for interacting with the Akash Network.
 * Mainnet is the production network, Testnet (Sandbox) is for development.
 */

export const AKASH_ENDPOINTS = {
  mainnet: {
    console: 'https://console-api.akash.network',
    rpc: 'https://rpc.akashnet.net',
    rest: 'https://api.akashnet.net',
    websocket: 'wss://rpc.akashnet.net/websocket',
    explorer: 'https://www.mintscan.io/akash',
  },
  testnet: {
    console: 'https://console-api.sandbox.akash.network',
    rpc: 'https://rpc.sandbox-01.aksh.pw',
    rest: 'https://api.sandbox-01.aksh.pw',
    websocket: 'wss://rpc.sandbox-01.aksh.pw/websocket',
    explorer: 'https://testnet.mintscan.io/akash-testnet',
  },
} as const;

/**
 * Chain IDs for Akash networks
 */
export const CHAIN_IDS = {
  mainnet: 'akashnet-2',
  testnet: 'sandbox-01',
} as const;

/**
 * Default gas settings for Akash transactions
 */
export const GAS_SETTINGS = {
  defaultGasLimit: 200000,
  defaultGasPrice: '0.025uakt',
  gasMultiplier: 1.3,
  simulationGasMultiplier: 1.5,
} as const;

/**
 * Token denominations
 */
export const TOKEN_DENOMINATIONS = {
  akt: 'akt',
  uakt: 'uakt',
  usdc: 'ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1',
} as const;

/**
 * Conversion factor: 1 AKT = 1,000,000 uAKT
 */
export const AKT_DECIMALS = 6;
export const UAKT_PER_AKT = 1_000_000;

/**
 * Console API version
 */
export const CONSOLE_API_VERSION = 'v1';

/**
 * Default timeouts in milliseconds
 */
export const TIMEOUTS = {
  api: 30000,
  transaction: 60000,
  websocket: 120000,
  bidWait: 300000, // 5 minutes to wait for bids
} as const;

/**
 * Polling intervals in milliseconds
 */
export const POLLING_INTERVALS = {
  deploymentStatus: 5000,
  leaseStatus: 5000,
  bidPolling: 3000,
  providerStatus: 30000,
} as const;

export type NetworkType = keyof typeof AKASH_ENDPOINTS;
export type ChainId = (typeof CHAIN_IDS)[NetworkType];
