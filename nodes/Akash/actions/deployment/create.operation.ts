/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { createCosmosClient, createConsoleApiClient } from '../../transport';
import { parseSDL, validateSDL, sdlToManifest, calculateSDLPrice } from '../../helpers';
import { TIMEOUTS, POLLING_INTERVALS } from '../../constants';

/**
 * Create Deployment Operation
 *
 * Creates a new deployment on Akash Network from an SDL manifest.
 * This operation:
 * 1. Validates the SDL
 * 2. Creates the deployment on-chain
 * 3. Waits for bids from providers
 * 4. Optionally accepts the best bid and sends manifest
 */

export const description: INodeProperties[] = [
  {
    displayName: 'SDL Manifest',
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
        operation: ['create'],
      },
    },
    description:
      'SDL (Stack Definition Language) YAML manifest defining the deployment. See Akash documentation for SDL format.',
    placeholder: `version: "2.0"
services:
  web:
    image: nginx:latest
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  dcloud:
    web:
      profile: web
      count: 1`,
  },
  {
    displayName: 'Initial Deposit (AKT)',
    name: 'deposit',
    type: 'number',
    default: 5,
    required: true,
    displayOptions: {
      show: {
        resource: ['deployment'],
        operation: ['create'],
      },
    },
    description:
      'Initial deposit in AKT to fund the deployment escrow. Minimum 5 AKT recommended.',
    typeOptions: {
      minValue: 0.5,
      numberPrecision: 6,
    },
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
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Auto Accept Bid',
        name: 'autoAcceptBid',
        type: 'boolean',
        default: true,
        description:
          'Whether to automatically accept the lowest bid and create a lease',
      },
      {
        displayName: 'Wait for Bids (Seconds)',
        name: 'bidWaitTime',
        type: 'number',
        default: 120,
        description: 'How long to wait for bids before selecting one (in seconds)',
        typeOptions: {
          minValue: 30,
          maxValue: 600,
        },
      },
      {
        displayName: 'Preferred Provider',
        name: 'preferredProvider',
        type: 'string',
        default: '',
        description: 'Preferred provider address to accept bid from (if available)',
        placeholder: 'akash1provider...',
      },
      {
        displayName: 'Max Price (uAKT/block)',
        name: 'maxPrice',
        type: 'number',
        default: 0,
        description:
          'Maximum price willing to pay per block in uAKT. 0 means no limit.',
      },
      {
        displayName: 'Send Manifest',
        name: 'sendManifest',
        type: 'boolean',
        default: true,
        description:
          'Whether to automatically send the manifest to the provider after lease creation',
      },
      {
        displayName: 'Validate Only',
        name: 'validateOnly',
        type: 'boolean',
        default: false,
        description:
          'Only validate the SDL without creating the deployment',
      },
    ],
  },
];

export async function execute(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const sdl = this.getNodeParameter('sdl', index) as string;
  const deposit = this.getNodeParameter('deposit', index) as number;
  const options = this.getNodeParameter('options', index, {}) as {
    autoAcceptBid?: boolean;
    bidWaitTime?: number;
    preferredProvider?: string;
    maxPrice?: number;
    sendManifest?: boolean;
    validateOnly?: boolean;
  };

  // Parse and validate SDL
  const parsedSdl = parseSDL(sdl);
  const validation = validateSDL(parsedSdl);

  if (!validation.valid) {
    throw new Error(`SDL validation failed:\n${validation.errors.join('\n')}`);
  }

  // If validate only, return validation result
  if (options.validateOnly) {
    const estimatedPrice = calculateSDLPrice(parsedSdl);
    return [
      {
        json: {
          valid: true,
          estimatedPricePerBlock: estimatedPrice,
          services: Object.keys(parsedSdl.services),
          profiles: Object.keys(parsedSdl.profiles.compute),
        },
      },
    ];
  }

  // Create deployment
  const cosmosClient = await createCosmosClient(this);
  const consoleClient = await createConsoleApiClient(this);

  const { result, dseq } = await cosmosClient.createDeployment(sdl, deposit.toString());

  const response: Record<string, unknown> = {
    success: result.code === 0,
    transactionHash: result.transactionHash,
    dseq,
    owner: cosmosClient.getWalletAddress(),
    deposit: `${deposit} AKT`,
    height: result.height,
    gasUsed: result.gasUsed,
  };

  // Wait for bids if auto-accept is enabled
  if (options.autoAcceptBid !== false) {
    const bidWaitTime = (options.bidWaitTime || 120) * 1000;
    const pollInterval = POLLING_INTERVALS.bidPolling;
    const startTime = Date.now();

    let bestBid = null;
    let bids = [];

    // Poll for bids
    while (Date.now() - startTime < bidWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      try {
        bids = await consoleClient.getBids(
          cosmosClient.getWalletAddress(),
          dseq,
          1, // gseq
          1, // oseq
        );

        if (bids.length > 0) {
          // Filter by max price if set
          let eligibleBids = bids;
          if (options.maxPrice && options.maxPrice > 0) {
            eligibleBids = bids.filter(
              (b) => parseInt(b.price.amount, 10) <= options.maxPrice!,
            );
          }

          // Check for preferred provider
          if (options.preferredProvider) {
            const preferredBid = eligibleBids.find(
              (b) => b.bidId.provider === options.preferredProvider,
            );
            if (preferredBid) {
              bestBid = preferredBid;
              break;
            }
          }

          // Select lowest price bid
          if (eligibleBids.length > 0) {
            bestBid = eligibleBids.reduce((prev, curr) =>
              parseInt(curr.price.amount, 10) < parseInt(prev.price.amount, 10)
                ? curr
                : prev,
            );

            // Wait a bit more for potentially better bids
            if (Date.now() - startTime > 30000) {
              break;
            }
          }
        }
      } catch (error) {
        // Continue polling
      }
    }

    response.bidsReceived = bids.length;

    if (bestBid) {
      // Accept the bid (create lease)
      const leaseResult = await cosmosClient.createLease(
        dseq,
        bestBid.bidId.gseq,
        bestBid.bidId.oseq,
        bestBid.bidId.provider,
      );

      response.lease = {
        created: leaseResult.code === 0,
        transactionHash: leaseResult.transactionHash,
        provider: bestBid.bidId.provider,
        price: bestBid.price,
        gseq: bestBid.bidId.gseq,
        oseq: bestBid.bidId.oseq,
      };

      // Send manifest if enabled
      if (options.sendManifest !== false && leaseResult.code === 0) {
        try {
          const manifest = sdlToManifest(parsedSdl);
          await consoleClient.sendManifest(
            cosmosClient.getWalletAddress(),
            dseq,
            bestBid.bidId.provider,
            manifest,
          );
          response.manifestSent = true;
        } catch (error) {
          response.manifestSent = false;
          response.manifestError = (error as Error).message;
        }
      }
    } else {
      response.lease = null;
      response.message = 'No suitable bids received within the wait time';
    }
  }

  await cosmosClient.disconnect();

  return [{ json: response as any }];
}
