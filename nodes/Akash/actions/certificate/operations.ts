/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { createCosmosClient, createConsoleApiClient } from '../../transport';

/**
 * Certificate Operations for Akash Network
 *
 * Certificates are used for secure communication between tenants and providers.
 * Each wallet address can have one active certificate at a time.
 * - Create Certificate: Generate and publish a new certificate
 * - Revoke Certificate: Revoke an existing certificate
 * - Get Certificate: Retrieve certificate details
 * - Get Certificates: List all certificates for an address
 */

export const createCertificateDescription: INodeProperties[] = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['certificate'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Validity Days',
				name: 'validityDays',
				type: 'number',
				default: 365,
				description: 'Certificate validity period in days',
				typeOptions: {
					minValue: 1,
					maxValue: 3650,
				},
			},
		],
	},
];

export const revokeCertificateDescription: INodeProperties[] = [
	{
		displayName: 'Certificate Serial',
		name: 'serial',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['certificate'],
				operation: ['revoke'],
			},
		},
		description: 'The serial number of the certificate to revoke',
	},
];

export const getCertificateDescription: INodeProperties[] = [
	{
		displayName: 'Owner Address',
		name: 'owner',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['certificate'],
				operation: ['get'],
			},
		},
		description: 'Certificate owner address (akash1...)',
		placeholder: 'akash1...',
	},
	{
		displayName: 'Certificate Serial',
		name: 'serial',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['certificate'],
				operation: ['get'],
			},
		},
		description: 'The serial number of the certificate',
	},
];

export const getCertificatesDescription: INodeProperties[] = [
	{
		displayName: 'Owner Address',
		name: 'owner',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['certificate'],
				operation: ['getMany'],
			},
		},
		description: 'Certificate owner address. Leave empty to use connected wallet.',
		placeholder: 'akash1...',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['certificate'],
				operation: ['getMany'],
			},
		},
		options: [
			{
				displayName: 'State Filter',
				name: 'state',
				type: 'options',
				default: 'all',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Valid', value: 'valid' },
					{ name: 'Revoked', value: 'revoked' },
				],
			},
		],
	},
];

export async function createCertificate(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const options = this.getNodeParameter('options', index, {}) as {
		validityDays?: number;
	};

	const cosmosClient = await createCosmosClient(this);

	const certResult = await cosmosClient.createCertificate();

	await cosmosClient.disconnect();

	return [
		{
			json: {
				success: certResult.result.code === 0,
				transactionHash: certResult.result.transactionHash,
				owner: cosmosClient.getWalletAddress(),
				cert: certResult.cert,
				pubkey: certResult.pubkey,
				serial: certResult.serial,
				validityDays: options.validityDays || 365,
				height: certResult.result.height,
				gasUsed: certResult.result.gasUsed,
				message:
					certResult.result.code === 0
						? 'Certificate created successfully'
						: 'Failed to create certificate',
			},
		},
	];
}

export async function revokeCertificate(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const serial = this.getNodeParameter('serial', index) as string;

	const cosmosClient = await createCosmosClient(this);

	const result = await cosmosClient.revokeCertificate(serial);

	await cosmosClient.disconnect();

	return [
		{
			json: {
				success: result.code === 0,
				transactionHash: result.transactionHash,
				serial,
				height: result.height,
				gasUsed: result.gasUsed,
				message:
					result.code === 0
						? 'Certificate revoked successfully'
						: 'Failed to revoke certificate',
			},
		},
	];
}

export async function getCertificate(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const owner = this.getNodeParameter('owner', index) as string;
	const serial = this.getNodeParameter('serial', index) as string;

	const consoleClient = await createConsoleApiClient(this);
	const certificate = await consoleClient.getCertificate(owner, serial);

	return [{ json: certificate as any }];
}

export async function getCertificates(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	let owner = this.getNodeParameter('owner', index, '') as string;
	const options = this.getNodeParameter('options', index, {}) as {
		state?: string;
	};

	// If no owner provided, use connected wallet
	if (!owner) {
		const cosmosClient = await createCosmosClient(this);
		owner = cosmosClient.getWalletAddress();
		await cosmosClient.disconnect();
	}

	const consoleClient = await createConsoleApiClient(this);
	let certificates = await consoleClient.getCertificates(owner);

	// Filter by state
	if (options.state && options.state !== 'all') {
		certificates = certificates.filter(
			(cert) => cert.state.toLowerCase() === options.state!.toLowerCase(),
		);
	}

	return certificates.map((cert) => ({ json: cert as any }));
}
