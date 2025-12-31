/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Akash Provider Constants
 *
 * This file contains constants related to Akash providers including
 * supported GPU types, regions, auditor addresses, and provider attributes.
 */

/**
 * Supported GPU types on Akash Network
 * These are the GPU models that providers can offer
 */
export const GPU_TYPES = {
  nvidia: {
    a100: {
      name: 'NVIDIA A100',
      vendor: 'nvidia',
      model: 'a100',
      memory: ['40Gi', '80Gi'],
    },
    a10: {
      name: 'NVIDIA A10',
      vendor: 'nvidia',
      model: 'a10',
      memory: ['24Gi'],
    },
    a6000: {
      name: 'NVIDIA A6000',
      vendor: 'nvidia',
      model: 'rtxa6000',
      memory: ['48Gi'],
    },
    rtx3080: {
      name: 'NVIDIA RTX 3080',
      vendor: 'nvidia',
      model: 'rtx3080',
      memory: ['10Gi', '12Gi'],
    },
    rtx3090: {
      name: 'NVIDIA RTX 3090',
      vendor: 'nvidia',
      model: 'rtx3090',
      memory: ['24Gi'],
    },
    rtx4090: {
      name: 'NVIDIA RTX 4090',
      vendor: 'nvidia',
      model: 'rtx4090',
      memory: ['24Gi'],
    },
    t4: {
      name: 'NVIDIA T4',
      vendor: 'nvidia',
      model: 't4',
      memory: ['16Gi'],
    },
    v100: {
      name: 'NVIDIA V100',
      vendor: 'nvidia',
      model: 'v100',
      memory: ['16Gi', '32Gi'],
    },
    h100: {
      name: 'NVIDIA H100',
      vendor: 'nvidia',
      model: 'h100',
      memory: ['80Gi'],
    },
  },
} as const;

/**
 * Region codes for Akash providers
 * Based on common cloud provider region naming
 */
export const REGIONS = {
  'us-east': { name: 'US East', country: 'US', continent: 'North America' },
  'us-west': { name: 'US West', country: 'US', continent: 'North America' },
  'us-central': { name: 'US Central', country: 'US', continent: 'North America' },
  'eu-west': { name: 'EU West', country: 'EU', continent: 'Europe' },
  'eu-central': { name: 'EU Central', country: 'EU', continent: 'Europe' },
  'eu-north': { name: 'EU North', country: 'EU', continent: 'Europe' },
  'ap-southeast': { name: 'Asia Pacific Southeast', country: 'SG', continent: 'Asia' },
  'ap-northeast': { name: 'Asia Pacific Northeast', country: 'JP', continent: 'Asia' },
  'ap-south': { name: 'Asia Pacific South', country: 'IN', continent: 'Asia' },
  'sa-east': { name: 'South America East', country: 'BR', continent: 'South America' },
} as const;

/**
 * Official Akash Network Auditor Addresses
 * Auditors verify provider attributes (GPU, region, etc.)
 */
export const AUDITORS = {
  mainnet: {
    akash: 'akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63',
    akt: 'akash1f6gmtjpx4r8qda9nxjwq26fp5mcjyqmaq5m6j7',
  },
  testnet: {
    akash: 'akash1f6gmtjpx4r8qda9nxjwq26fp5mcjyqmaq5m6j7',
  },
} as const;

/**
 * Provider attribute keys
 * These are the standard attributes providers can have
 */
export const PROVIDER_ATTRIBUTES = {
  // Location attributes
  region: 'region',
  country: 'country',
  city: 'city',
  timezone: 'timezone',

  // Capability attributes
  hostUri: 'host',
  email: 'email',
  organization: 'organization',
  website: 'website',
  tier: 'tier',

  // Hardware attributes
  gpuVendor: 'gpu-vendor',
  gpuModel: 'gpu-model',
  gpuMemory: 'gpu-memory',
  gpuInterface: 'gpu-interface',

  // Storage attributes
  storageClass: 'storage-class',
  persistentStorage: 'persistent-storage',
  persistentStorageType: 'persistent-storage-type',

  // Network attributes
  networkDownload: 'network-download',
  networkUpload: 'network-upload',
} as const;

/**
 * Storage class types
 */
export const STORAGE_CLASSES = {
  default: 'default',
  beta1: 'beta1',
  beta2: 'beta2',
  beta3: 'beta3',
  ram: 'ram',
} as const;

/**
 * Persistent storage types
 */
export const PERSISTENT_STORAGE_TYPES = {
  hdd: 'hdd',
  ssd: 'ssd',
  nvme: 'nvme',
} as const;

/**
 * Provider status codes
 */
export const PROVIDER_STATUS = {
  active: 'active',
  inactive: 'inactive',
  unknown: 'unknown',
} as const;

/**
 * Minimum requirements for provider filtering
 */
export const MINIMUM_REQUIREMENTS = {
  cpu: 0.1, // 100m
  memory: '128Mi',
  storage: '512Mi',
} as const;

export type GpuVendor = keyof typeof GPU_TYPES;
export type GpuModel = keyof (typeof GPU_TYPES)['nvidia'];
export type RegionCode = keyof typeof REGIONS;
export type StorageClass = keyof typeof STORAGE_CLASSES;
export type PersistentStorageType = keyof typeof PERSISTENT_STORAGE_TYPES;
export type ProviderStatus = keyof typeof PROVIDER_STATUS;
