/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { UAKT_PER_AKT, AKT_DECIMALS, TOKEN_DENOMINATIONS } from '../constants';
import { ICoin } from '../types';

/**
 * Amount Converter Helper
 *
 * Handles conversion between AKT and uAKT (micro-AKT).
 * 1 AKT = 1,000,000 uAKT
 */

/**
 * Convert AKT to uAKT
 * @param akt - Amount in AKT
 * @returns Amount in uAKT as string
 */
export function aktToUakt(akt: number | string): string {
  const aktNum = typeof akt === 'string' ? parseFloat(akt) : akt;

  if (isNaN(aktNum)) {
    throw new Error(`Invalid AKT amount: ${akt}`);
  }

  if (aktNum < 0) {
    throw new Error('Amount cannot be negative');
  }

  // Use BigInt for precision
  const uaktValue = Math.round(aktNum * UAKT_PER_AKT);
  return uaktValue.toString();
}

/**
 * Convert uAKT to AKT
 * @param uakt - Amount in uAKT
 * @returns Amount in AKT as string with proper decimal places
 */
export function uaktToAkt(uakt: number | string): string {
  const uaktNum = typeof uakt === 'string' ? parseInt(uakt, 10) : Math.round(uakt);

  if (isNaN(uaktNum)) {
    throw new Error(`Invalid uAKT amount: ${uakt}`);
  }

  const aktValue = uaktNum / UAKT_PER_AKT;
  return aktValue.toFixed(AKT_DECIMALS);
}

/**
 * Create a Coin object with uAKT denomination
 * @param amount - Amount in AKT
 * @returns ICoin object with uakt denom
 */
export function createAktCoin(amount: number | string): ICoin {
  return {
    denom: TOKEN_DENOMINATIONS.uakt,
    amount: aktToUakt(amount),
  };
}

/**
 * Create a Coin object with specified denomination
 * @param amount - Amount as string
 * @param denom - Token denomination
 * @returns ICoin object
 */
export function createCoin(amount: string, denom: string): ICoin {
  return {
    denom,
    amount,
  };
}

/**
 * Parse a Coin object and return human-readable format
 * @param coin - ICoin object
 * @returns Formatted string like "1.5 AKT"
 */
export function formatCoin(coin: ICoin): string {
  if (coin.denom === TOKEN_DENOMINATIONS.uakt) {
    const akt = uaktToAkt(coin.amount);
    return `${akt} AKT`;
  }

  if (coin.denom === TOKEN_DENOMINATIONS.usdc) {
    // USDC has 6 decimals on Cosmos
    const usdc = (parseInt(coin.amount, 10) / 1_000_000).toFixed(6);
    return `${usdc} USDC`;
  }

  return `${coin.amount} ${coin.denom}`;
}

/**
 * Parse an amount string that may include unit
 * @param amountStr - Amount string like "5 AKT" or "5000000 uakt"
 * @returns ICoin object
 */
export function parseAmountString(amountStr: string): ICoin {
  const trimmed = amountStr.trim().toLowerCase();

  // Check for AKT denomination
  const aktMatch = trimmed.match(/^([\d.]+)\s*akt$/i);
  if (aktMatch) {
    return createAktCoin(aktMatch[1]);
  }

  // Check for uAKT denomination
  const uaktMatch = trimmed.match(/^(\d+)\s*uakt$/i);
  if (uaktMatch) {
    return {
      denom: TOKEN_DENOMINATIONS.uakt,
      amount: uaktMatch[1],
    };
  }

  // Check for USDC denomination
  const usdcMatch = trimmed.match(/^([\d.]+)\s*usdc$/i);
  if (usdcMatch) {
    const amount = Math.round(parseFloat(usdcMatch[1]) * 1_000_000).toString();
    return {
      denom: TOKEN_DENOMINATIONS.usdc,
      amount,
    };
  }

  // If just a number, assume AKT
  const numMatch = trimmed.match(/^[\d.]+$/);
  if (numMatch) {
    return createAktCoin(trimmed);
  }

  throw new Error(`Unable to parse amount string: ${amountStr}`);
}

/**
 * Calculate total cost from price per block and duration
 * @param pricePerBlock - Price per block in uAKT
 * @param blocks - Number of blocks
 * @returns Total cost in uAKT
 */
export function calculateTotalCost(pricePerBlock: string, blocks: number): string {
  const price = BigInt(pricePerBlock);
  const totalUakt = price * BigInt(blocks);
  return totalUakt.toString();
}

/**
 * Estimate monthly cost from hourly price
 * Akash uses approximately 1 block per 6 seconds
 * @param hourlyPrice - Hourly price in uAKT
 * @returns Monthly cost estimate in uAKT
 */
export function estimateMonthlyCost(hourlyPrice: string): string {
  const hourly = BigInt(hourlyPrice);
  const monthly = hourly * BigInt(24) * BigInt(30);
  return monthly.toString();
}

/**
 * Parse memory size string to bytes
 * Supports units: Ki, Mi, Gi, Ti (binary) and K, M, G, T (decimal)
 * @param sizeStr - Size string like "512Mi" or "2Gi"
 * @returns Size in bytes
 */
export function parseMemorySize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGTP]i?)?$/i);

  if (!match) {
    throw new Error(`Invalid memory size format: ${sizeStr}`);
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || '').toLowerCase();

  const multipliers: Record<string, number> = {
    '': 1,
    k: 1000,
    ki: 1024,
    m: 1000000,
    mi: 1024 * 1024,
    g: 1000000000,
    gi: 1024 * 1024 * 1024,
    t: 1000000000000,
    ti: 1024 * 1024 * 1024 * 1024,
    p: 1000000000000000,
    pi: 1024 * 1024 * 1024 * 1024 * 1024,
  };

  if (!(unit in multipliers)) {
    throw new Error(`Unknown memory unit: ${unit}`);
  }

  return Math.round(value * multipliers[unit]);
}

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @param binary - Use binary units (Ki, Mi, Gi) if true
 * @returns Formatted string
 */
export function formatBytes(bytes: number, binary: boolean = true): string {
  const base = binary ? 1024 : 1000;
  const units = binary ? ['B', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi'] : ['B', 'K', 'M', 'G', 'T', 'P'];

  if (bytes === 0) return '0 B';

  const exp = Math.floor(Math.log(bytes) / Math.log(base));
  const value = bytes / Math.pow(base, exp);

  return `${value.toFixed(2)} ${units[exp]}`;
}

/**
 * Parse CPU units string
 * Supports formats: 0.5, 500m, 1000m, 1
 * @param cpuStr - CPU string
 * @returns CPU units as number (1 = 1 CPU)
 */
export function parseCpuUnits(cpuStr: string): number {
  const trimmed = cpuStr.trim().toLowerCase();

  // Check for millicpu format
  const milliMatch = trimmed.match(/^(\d+)m$/);
  if (milliMatch) {
    return parseInt(milliMatch[1], 10) / 1000;
  }

  // Direct number
  const value = parseFloat(trimmed);
  if (!isNaN(value)) {
    return value;
  }

  throw new Error(`Invalid CPU units format: ${cpuStr}`);
}

/**
 * Format CPU units to string
 * @param cpu - CPU units as number
 * @param useMillicpu - Output in millicpu format
 * @returns Formatted CPU string
 */
export function formatCpuUnits(cpu: number, useMillicpu: boolean = false): string {
  if (useMillicpu) {
    return `${Math.round(cpu * 1000)}m`;
  }
  return cpu.toString();
}

/**
 * Compare two amounts (in same denomination)
 * @param a - First amount
 * @param b - Second amount
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareAmounts(a: string, b: string): -1 | 0 | 1 {
  const aBig = BigInt(a);
  const bBig = BigInt(b);

  if (aBig < bBig) return -1;
  if (aBig > bBig) return 1;
  return 0;
}

/**
 * Add two amounts
 * @param a - First amount
 * @param b - Second amount
 * @returns Sum as string
 */
export function addAmounts(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

/**
 * Subtract two amounts
 * @param a - First amount
 * @param b - Second amount
 * @returns Difference as string (throws if result would be negative)
 */
export function subtractAmounts(a: string, b: string): string {
  const result = BigInt(a) - BigInt(b);
  if (result < 0) {
    throw new Error('Subtraction would result in negative amount');
  }
  return result.toString();
}
