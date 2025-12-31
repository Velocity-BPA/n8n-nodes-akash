/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import * as yaml from 'js-yaml';
import { createHash } from 'crypto';
import {
  ISDLManifest,
  ISDLService,
  ISDLComputeProfile,
  ISDLPlacementProfile,
  ISDLResources,
  IGroupSpec,
  IResourceGroup,
  IResourceUnits,
  IAttribute,
  ICoin,
} from '../types';
import { parseMemorySize, parseCpuUnits, aktToUakt } from './amountConverter';
import { TOKEN_DENOMINATIONS } from '../constants';

/**
 * SDL Parser Helper
 *
 * Parses and validates Akash SDL (Stack Definition Language) manifests.
 * SDL v2.0 is a YAML format used to define deployments on Akash Network.
 */

/**
 * Parse SDL YAML string into structured manifest
 * @param sdlContent - Raw SDL YAML content
 * @returns Parsed SDL manifest
 */
export function parseSDL(sdlContent: string): ISDLManifest {
  try {
    const parsed = yaml.load(sdlContent) as ISDLManifest;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid SDL: must be a valid YAML object');
    }

    return parsed;
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`SDL YAML parsing error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate SDL manifest structure
 * @param sdl - Parsed SDL manifest
 * @returns Validation result with errors if any
 */
export function validateSDL(sdl: ISDLManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check version
  if (!sdl.version) {
    errors.push('Missing required field: version');
  } else if (sdl.version !== '2.0' && sdl.version !== '2.1') {
    errors.push(`Unsupported SDL version: ${sdl.version}. Supported versions: 2.0, 2.1`);
  }

  // Check services
  if (!sdl.services || Object.keys(sdl.services).length === 0) {
    errors.push('Missing required field: services (at least one service required)');
  } else {
    for (const [serviceName, service] of Object.entries(sdl.services)) {
      const serviceErrors = validateService(serviceName, service);
      errors.push(...serviceErrors);
    }
  }

  // Check profiles
  if (!sdl.profiles) {
    errors.push('Missing required field: profiles');
  } else {
    if (!sdl.profiles.compute || Object.keys(sdl.profiles.compute).length === 0) {
      errors.push('Missing required field: profiles.compute');
    } else {
      for (const [profileName, profile] of Object.entries(sdl.profiles.compute)) {
        const profileErrors = validateComputeProfile(profileName, profile);
        errors.push(...profileErrors);
      }
    }

    if (!sdl.profiles.placement || Object.keys(sdl.profiles.placement).length === 0) {
      errors.push('Missing required field: profiles.placement');
    } else {
      for (const [profileName, profile] of Object.entries(sdl.profiles.placement)) {
        const profileErrors = validatePlacementProfile(profileName, profile);
        errors.push(...profileErrors);
      }
    }
  }

  // Check deployment
  if (!sdl.deployment || Object.keys(sdl.deployment).length === 0) {
    errors.push('Missing required field: deployment');
  } else {
    for (const [placementName, placement] of Object.entries(sdl.deployment)) {
      // Check that placement exists in profiles
      if (!sdl.profiles?.placement?.[placementName]) {
        errors.push(`Deployment references undefined placement profile: ${placementName}`);
      }

      // Check each service in the deployment
      for (const [serviceName, config] of Object.entries(placement)) {
        if (!sdl.services?.[serviceName]) {
          errors.push(`Deployment references undefined service: ${serviceName}`);
        }
        if (!sdl.profiles?.compute?.[config.profile]) {
          errors.push(`Deployment references undefined compute profile: ${config.profile}`);
        }
        if (typeof config.count !== 'number' || config.count < 1) {
          errors.push(`Invalid count for service ${serviceName}: must be a positive integer`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a service definition
 */
function validateService(name: string, service: ISDLService): string[] {
  const errors: string[] = [];
  const prefix = `Service '${name}'`;

  if (!service.image) {
    errors.push(`${prefix}: missing required field 'image'`);
  }

  if (service.expose) {
    for (let i = 0; i < service.expose.length; i++) {
      const expose = service.expose[i];
      if (!expose.port || typeof expose.port !== 'number') {
        errors.push(`${prefix}: expose[${i}] missing or invalid 'port'`);
      }
      if (expose.proto && !['tcp', 'udp'].includes(expose.proto)) {
        errors.push(`${prefix}: expose[${i}] invalid proto '${expose.proto}' (must be tcp or udp)`);
      }
    }
  }

  return errors;
}

/**
 * Validate a compute profile definition
 */
function validateComputeProfile(name: string, profile: ISDLComputeProfile): string[] {
  const errors: string[] = [];
  const prefix = `Compute profile '${name}'`;

  if (!profile.resources) {
    errors.push(`${prefix}: missing required field 'resources'`);
    return errors;
  }

  const resources = profile.resources;

  // Validate CPU
  if (!resources.cpu || !resources.cpu.units) {
    errors.push(`${prefix}: missing required field 'resources.cpu.units'`);
  } else {
    try {
      const cpuValue = parseCpuUnits(String(resources.cpu.units));
      if (cpuValue <= 0) {
        errors.push(`${prefix}: cpu.units must be positive`);
      }
    } catch {
      errors.push(`${prefix}: invalid cpu.units format`);
    }
  }

  // Validate memory
  if (!resources.memory || !resources.memory.size) {
    errors.push(`${prefix}: missing required field 'resources.memory.size'`);
  } else {
    try {
      const memValue = parseMemorySize(resources.memory.size);
      if (memValue <= 0) {
        errors.push(`${prefix}: memory.size must be positive`);
      }
    } catch {
      errors.push(`${prefix}: invalid memory.size format`);
    }
  }

  // Validate storage
  if (!resources.storage) {
    errors.push(`${prefix}: missing required field 'resources.storage'`);
  }

  // Validate GPU if present
  if (resources.gpu) {
    if (typeof resources.gpu.units !== 'number' || resources.gpu.units < 0) {
      errors.push(`${prefix}: gpu.units must be a non-negative number`);
    }
  }

  return errors;
}

/**
 * Validate a placement profile definition
 */
function validatePlacementProfile(name: string, profile: ISDLPlacementProfile): string[] {
  const errors: string[] = [];
  const prefix = `Placement profile '${name}'`;

  if (!profile.pricing || Object.keys(profile.pricing).length === 0) {
    errors.push(`${prefix}: missing required field 'pricing'`);
  } else {
    for (const [computeProfile, pricing] of Object.entries(profile.pricing)) {
      if (!pricing.denom) {
        errors.push(`${prefix}: pricing for '${computeProfile}' missing 'denom'`);
      }
      if (typeof pricing.amount !== 'number' || pricing.amount <= 0) {
        errors.push(`${prefix}: pricing for '${computeProfile}' must have positive 'amount'`);
      }
    }
  }

  return errors;
}

/**
 * Generate version hash from SDL content
 * Used to identify deployment versions
 * @param sdl - SDL manifest
 * @returns Version hash as Uint8Array
 */
export function generateVersionHash(sdl: ISDLManifest): Uint8Array {
  const sdlString = JSON.stringify(sdl);
  const hash = createHash('sha256').update(sdlString).digest();
  return new Uint8Array(hash);
}

/**
 * Convert SDL manifest to deployment groups for blockchain transaction
 * @param sdl - Validated SDL manifest
 * @returns Array of GroupSpec objects
 */
export function sdlToGroups(sdl: ISDLManifest): IGroupSpec[] {
  const groups: IGroupSpec[] = [];

  for (const [placementName, placement] of Object.entries(sdl.deployment)) {
    const placementProfile = sdl.profiles.placement[placementName];

    const resources: IResourceGroup[] = [];

    for (const [serviceName, config] of Object.entries(placement)) {
      const computeProfile = sdl.profiles.compute[config.profile];
      const pricing = placementProfile.pricing[config.profile];

      const resourceUnits = convertResources(computeProfile.resources, sdl.services[serviceName]);

      resources.push({
        resources: resourceUnits,
        count: config.count,
        price: {
          denom: pricing.denom,
          amount: aktToUakt(pricing.amount),
        },
      });
    }

    // Build placement requirements
    const requirements: { attributes?: IAttribute[]; signedBy?: { anyOf?: string[]; allOf?: string[] } } = {};

    if (placementProfile.attributes) {
      requirements.attributes = Object.entries(placementProfile.attributes).map(([key, value]) => ({
        key,
        value: String(value),
      }));
    }

    if (placementProfile.signedBy) {
      requirements.signedBy = placementProfile.signedBy;
    }

    groups.push({
      name: placementName,
      requirements,
      resources,
    });
  }

  return groups;
}

/**
 * Convert SDL resources to blockchain format
 */
function convertResources(resources: ISDLResources, service: ISDLService): IResourceUnits {
  // Convert CPU (to millicpu string format)
  const cpuValue = parseCpuUnits(String(resources.cpu.units));
  const cpuMillis = Math.round(cpuValue * 1000);

  // Convert memory (to bytes string)
  const memoryBytes = parseMemorySize(resources.memory.size);

  // Convert storage
  const storageList = Array.isArray(resources.storage) ? resources.storage : [resources.storage];
  const storageResources = storageList.map((s, index) => ({
    name: s.name || (index === 0 ? 'default' : `storage-${index}`),
    quantity: { val: parseMemorySize(s.size).toString() },
    attributes: s.class ? [{ key: 'class', value: s.class }] : undefined,
  }));

  const result: IResourceUnits = {
    cpu: {
      units: { val: cpuMillis.toString() },
    },
    memory: {
      quantity: { val: memoryBytes.toString() },
    },
    storage: storageResources,
  };

  // Add GPU if present
  if (resources.gpu && resources.gpu.units > 0) {
    const gpuAttributes: IAttribute[] = [];

    if (resources.gpu.attributes?.vendor?.nvidia) {
      const models = resources.gpu.attributes.vendor.nvidia;
      if (models.length > 0) {
        gpuAttributes.push({ key: 'vendor', value: 'nvidia' });
        if (models[0].model) {
          gpuAttributes.push({ key: 'model', value: models[0].model });
        }
        if (models[0].ram) {
          gpuAttributes.push({ key: 'ram', value: models[0].ram });
        }
      }
    }

    result.gpu = {
      units: { val: resources.gpu.units.toString() },
      attributes: gpuAttributes.length > 0 ? gpuAttributes : undefined,
    };
  }

  // Add endpoints from service expose
  if (service.expose && service.expose.length > 0) {
    result.endpoints = service.expose.map((expose, index) => ({
      kind: expose.to?.some(t => t.global) ? 1 : 0, // 1 = public, 0 = private
      sequenceNumber: index,
    }));
  }

  return result;
}

/**
 * Convert SDL manifest to provider manifest format
 * This is sent to the provider after lease creation
 * @param sdl - SDL manifest
 * @returns Manifest for provider
 */
export function sdlToManifest(sdl: ISDLManifest): object {
  const groups: object[] = [];

  for (const [placementName, placement] of Object.entries(sdl.deployment)) {
    const services: object[] = [];

    for (const [serviceName, config] of Object.entries(placement)) {
      const service = sdl.services[serviceName];
      const computeProfile = sdl.profiles.compute[config.profile];

      const manifestService: Record<string, unknown> = {
        name: serviceName,
        image: service.image,
        count: config.count,
        resources: convertManifestResources(computeProfile.resources),
      };

      if (service.command) {
        manifestService.command = service.command;
      }

      if (service.args) {
        manifestService.args = service.args;
      }

      if (service.env) {
        manifestService.env = service.env.map((e) => {
          const [key, ...valueParts] = e.split('=');
          return { name: key, value: valueParts.join('=') };
        });
      }

      if (service.expose) {
        manifestService.expose = service.expose.map((exp) => ({
          port: exp.port,
          externalPort: exp.as || exp.port,
          proto: exp.proto || 'tcp',
          service: '',
          global: exp.to?.some(t => t.global) || false,
          hosts: exp.accept || null,
          httpOptions: {
            maxBodySize: 1048576,
            readTimeout: 60000,
            sendTimeout: 60000,
            nextTries: 3,
            nextTimeout: 0,
            nextCases: ['error', 'timeout'],
          },
          ip: '',
          endpointSequenceNumber: 0,
        }));
      }

      if (service.params?.storage) {
        manifestService.params = {
          storage: Object.entries(service.params.storage).map(([name, params]) => ({
            name,
            mount: params.mount,
            readOnly: params.readOnly || false,
          })),
        };
      }

      services.push(manifestService);
    }

    groups.push({
      name: placementName,
      services,
    });
  }

  return groups;
}

/**
 * Convert resources for manifest format
 */
function convertManifestResources(resources: ISDLResources): object {
  const cpuValue = parseCpuUnits(String(resources.cpu.units));
  const memoryBytes = parseMemorySize(resources.memory.size);

  const storageList = Array.isArray(resources.storage) ? resources.storage : [resources.storage];

  const result: Record<string, unknown> = {
    cpu: {
      units: Math.round(cpuValue * 1000),
      attributes: [],
    },
    memory: {
      size: memoryBytes.toString(),
      attributes: [],
    },
    storage: storageList.map((s, index) => ({
      name: s.name || (index === 0 ? 'default' : `storage-${index}`),
      size: parseMemorySize(s.size).toString(),
      attributes: s.class ? [{ key: 'class', value: s.class }] : [],
    })),
  };

  if (resources.gpu && resources.gpu.units > 0) {
    result.gpu = {
      units: resources.gpu.units,
      attributes: resources.gpu.attributes?.vendor?.nvidia?.map((m) => ({
        key: 'vendor/nvidia/model',
        value: m.model,
      })) || [],
    };
  }

  return result;
}

/**
 * Create a simple SDL for a Docker image deployment
 * @param options - Deployment options
 * @returns SDL manifest string
 */
export function createSimpleSDL(options: {
  serviceName: string;
  image: string;
  cpu: number;
  memory: string;
  storage: string;
  port?: number;
  env?: Record<string, string>;
  replicas?: number;
  maxPrice?: number;
}): string {
  const {
    serviceName,
    image,
    cpu,
    memory,
    storage,
    port,
    env,
    replicas = 1,
    maxPrice = 100,
  } = options;

  const sdl: Record<string, unknown> = {
    version: '2.0',
    services: {
      [serviceName]: {
        image,
        ...(env && { env: Object.entries(env).map(([k, v]) => `${k}=${v}`) }),
        ...(port && {
          expose: [
            {
              port,
              as: 80,
              to: [{ global: true }],
            },
          ],
        }),
      },
    },
    profiles: {
      compute: {
        [serviceName]: {
          resources: {
            cpu: { units: cpu },
            memory: { size: memory },
            storage: [{ size: storage }],
          },
        },
      },
      placement: {
        dcloud: {
          pricing: {
            [serviceName]: {
              denom: 'uakt',
              amount: maxPrice,
            },
          },
        },
      },
    },
    deployment: {
      dcloud: {
        [serviceName]: {
          profile: serviceName,
          count: replicas,
        },
      },
    },
  };

  return yaml.dump(sdl, { lineWidth: -1 });
}

/**
 * Calculate the total price from an SDL
 * @param sdl - SDL manifest
 * @returns Total price in uAKT per block
 */
export function calculateSDLPrice(sdl: ISDLManifest): ICoin {
  let totalAmount = BigInt(0);

  for (const [placementName, placement] of Object.entries(sdl.deployment)) {
    const placementProfile = sdl.profiles.placement[placementName];

    for (const [_serviceName, config] of Object.entries(placement)) {
      const pricing = placementProfile.pricing[config.profile];
      const priceUakt = aktToUakt(pricing.amount);
      totalAmount += BigInt(priceUakt) * BigInt(config.count);
    }
  }

  return {
    denom: TOKEN_DENOMINATIONS.uakt,
    amount: totalAmount.toString(),
  };
}
