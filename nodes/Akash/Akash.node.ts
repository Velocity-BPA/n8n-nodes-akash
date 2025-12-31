/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

// Deployment operations
import {
	description as createDeploymentDescription,
	execute as createDeployment,
} from './actions/deployment/create.operation';
import {
	getDescription as getDeploymentDescription,
	listDescription as getDeploymentsDescription,
	executeGet as getDeployment,
	executeList as getDeployments,
} from './actions/deployment/get.operation';
import {
	updateDescription,
	closeDescription,
	statusDescription,
	logsDescription,
	depositDescription,
	executeUpdate as updateDeployment,
	executeClose as closeDeployment,
	executeStatus as deploymentStatus,
	executeLogs as deploymentLogs,
	executeDeposit as depositDeployment,
} from './actions/deployment/operations';

// Lease operations
import {
	getDescription as getLeaseDescription,
	getManyDescription as getLeasesDescription,
	closeDescription as closeLeaseDescription,
	statusDescription as leaseStatusDescription,
	sendManifestDescription,
	executeGet as getLease,
	executeGetMany as getLeases,
	executeClose as closeLease,
	executeStatus as leaseStatus,
	executeSendManifest as sendManifest,
} from './actions/lease/operations';

// Order operations
import {
	getDescription as getOrderDescription,
	getManyDescription as getOrdersDescription,
	executeGet as getOrder,
	executeGetMany as getOrders,
} from './actions/order/operations';

// Bid operations
import {
	getBidDescription,
	getBidsDescription,
	acceptBidDescription,
	getBid,
	getBids,
	acceptBid,
} from './actions/bid/operations';

// Provider operations
import {
	getProviderDescription,
	getProvidersDescription,
	filterProvidersDescription,
	getProviderStatusDescription,
	getProviderLeasesDescription,
	getProvider,
	getProviders,
	filterProviders,
	getProviderStatus,
	getProviderLeases,
} from './actions/provider/operations';

// Certificate operations
import {
	createCertificateDescription,
	revokeCertificateDescription,
	getCertificateDescription,
	getCertificatesDescription,
	createCertificate,
	revokeCertificate,
	getCertificate,
	getCertificates,
} from './actions/certificate/operations';

// Wallet operations
import {
	getBalanceDescription,
	sendDescription,
	getDelegationsDescription,
	getRewardsDescription,
	getEscrowBalancesDescription,
	getBalance,
	send,
	getDelegations,
	getRewards,
	getEscrowBalances,
} from './actions/wallet/operations';

// Marketplace operations
import {
	getCapacityDescription,
	getPricingDescription,
	estimateDescription,
	getActiveDeploymentsDescription,
	getProviderCountDescription,
	getUtilizationDescription,
	getCapacity,
	getPricing,
	estimate,
	getActiveDeployments,
	getProviderCount,
	getUtilization,
} from './actions/marketplace/operations';

// Log licensing notice once on load
const LICENSING_NOTICE = `[Velocity BPA Licensing Notice]

This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).

Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.

For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.`;

let licenseNoticeLogged = false;

export class Akash implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Akash',
		name: 'akash',
		icon: 'file:akash.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Akash Network decentralized cloud computing platform',
		defaults: {
			name: 'Akash',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'akashApi',
				required: true,
			},
		],
		properties: [
			// Resource selector
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Bid',
						value: 'bid',
						description: 'Manage provider bids on orders',
					},
					{
						name: 'Certificate',
						value: 'certificate',
						description: 'Manage mTLS certificates',
					},
					{
						name: 'Deployment',
						value: 'deployment',
						description: 'Manage deployments on Akash Network',
					},
					{
						name: 'Lease',
						value: 'lease',
						description: 'Manage leases with providers',
					},
					{
						name: 'Marketplace',
						value: 'marketplace',
						description: 'Network statistics and cost estimation',
					},
					{
						name: 'Order',
						value: 'order',
						description: 'Manage deployment orders',
					},
					{
						name: 'Provider',
						value: 'provider',
						description: 'Query provider information',
					},
					{
						name: 'Wallet',
						value: 'wallet',
						description: 'Manage AKT tokens and balances',
					},
				],
				default: 'deployment',
			},

			// Deployment operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['deployment'],
					},
				},
				options: [
					{
						name: 'Close',
						value: 'close',
						description: 'Close a deployment',
						action: 'Close a deployment',
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new deployment from SDL',
						action: 'Create a deployment',
					},
					{
						name: 'Deposit',
						value: 'deposit',
						description: 'Add funds to deployment escrow',
						action: 'Deposit to deployment',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a deployment by sequence number',
						action: 'Get a deployment',
					},
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'Get all deployments for an owner',
						action: 'Get many deployments',
					},
					{
						name: 'Logs',
						value: 'logs',
						description: 'Get deployment logs',
						action: 'Get deployment logs',
					},
					{
						name: 'Status',
						value: 'status',
						description: 'Get deployment status from provider',
						action: 'Get deployment status',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update deployment with new SDL',
						action: 'Update a deployment',
					},
				],
				default: 'create',
			},

			// Lease operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['lease'],
					},
				},
				options: [
					{
						name: 'Close',
						value: 'close',
						description: 'Close a lease',
						action: 'Close a lease',
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a lease from accepted bid',
						action: 'Create a lease',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a lease by ID',
						action: 'Get a lease',
					},
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'Get all leases',
						action: 'Get many leases',
					},
					{
						name: 'Send Manifest',
						value: 'sendManifest',
						description: 'Send manifest to provider',
						action: 'Send manifest',
					},
					{
						name: 'Status',
						value: 'status',
						description: 'Get lease status from provider',
						action: 'Get lease status',
					},
				],
				default: 'getMany',
			},

			// Order operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['order'],
					},
				},
				options: [
					{
						name: 'Close',
						value: 'close',
						description: 'Close an order',
						action: 'Close an order',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get an order by ID',
						action: 'Get an order',
					},
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'Get all orders',
						action: 'Get many orders',
					},
				],
				default: 'getMany',
			},

			// Bid operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['bid'],
					},
				},
				options: [
					{
						name: 'Accept',
						value: 'accept',
						description: 'Accept a bid and create lease',
						action: 'Accept a bid',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a bid by ID',
						action: 'Get a bid',
					},
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'Get all bids for an order',
						action: 'Get many bids',
					},
				],
				default: 'getMany',
			},

			// Provider operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['provider'],
					},
				},
				options: [
					{
						name: 'Filter',
						value: 'filter',
						description: 'Filter providers by capabilities',
						action: 'Filter providers',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a provider by address',
						action: 'Get a provider',
					},
					{
						name: 'Get Leases',
						value: 'leases',
						description: 'Get leases for a provider',
						action: 'Get provider leases',
					},
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'Get all providers',
						action: 'Get many providers',
					},
					{
						name: 'Status',
						value: 'status',
						description: 'Get provider online status',
						action: 'Get provider status',
					},
				],
				default: 'getMany',
			},

			// Certificate operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['certificate'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new certificate',
						action: 'Create a certificate',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a certificate',
						action: 'Get a certificate',
					},
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'Get all certificates',
						action: 'Get many certificates',
					},
					{
						name: 'Revoke',
						value: 'revoke',
						description: 'Revoke a certificate',
						action: 'Revoke a certificate',
					},
				],
				default: 'getMany',
			},

			// Wallet operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['wallet'],
					},
				},
				options: [
					{
						name: 'Balance',
						value: 'balance',
						description: 'Get AKT balance',
						action: 'Get balance',
					},
					{
						name: 'Delegations',
						value: 'delegations',
						description: 'Get staking delegations',
						action: 'Get delegations',
					},
					{
						name: 'Escrow Balances',
						value: 'escrowBalances',
						description: 'Get escrow balances for deployments',
						action: 'Get escrow balances',
					},
					{
						name: 'Rewards',
						value: 'rewards',
						description: 'Get staking rewards',
						action: 'Get rewards',
					},
					{
						name: 'Send',
						value: 'send',
						description: 'Send AKT to another address',
						action: 'Send AKT',
					},
				],
				default: 'balance',
			},

			// Marketplace operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['marketplace'],
					},
				},
				options: [
					{
						name: 'Active Deployments',
						value: 'activeDeployments',
						description: 'Get count of active deployments',
						action: 'Get active deployments',
					},
					{
						name: 'Capacity',
						value: 'capacity',
						description: 'Get network capacity',
						action: 'Get network capacity',
					},
					{
						name: 'Estimate',
						value: 'estimate',
						description: 'Estimate deployment cost',
						action: 'Estimate cost',
					},
					{
						name: 'Pricing',
						value: 'pricing',
						description: 'Get pricing statistics',
						action: 'Get pricing',
					},
					{
						name: 'Provider Count',
						value: 'providerCount',
						description: 'Get count of providers',
						action: 'Get provider count',
					},
					{
						name: 'Utilization',
						value: 'utilization',
						description: 'Get network utilization',
						action: 'Get utilization',
					},
				],
				default: 'capacity',
			},

			// All operation-specific properties
			...createDeploymentDescription,
			...getDeploymentDescription,
			...getDeploymentsDescription,
			...updateDescription,
			...closeDescription,
			...statusDescription,
			...logsDescription,
			...depositDescription,

			...getLeaseDescription,
			...getLeasesDescription,
			...closeLeaseDescription,
			...leaseStatusDescription,
			...sendManifestDescription,

			...getOrderDescription,
			...getOrdersDescription,

			...getBidDescription,
			...getBidsDescription,
			...acceptBidDescription,

			...getProviderDescription,
			...getProvidersDescription,
			...filterProvidersDescription,
			...getProviderStatusDescription,
			...getProviderLeasesDescription,

			...createCertificateDescription,
			...revokeCertificateDescription,
			...getCertificateDescription,
			...getCertificatesDescription,

			...getBalanceDescription,
			...sendDescription,
			...getDelegationsDescription,
			...getRewardsDescription,
			...getEscrowBalancesDescription,

			...getCapacityDescription,
			...getPricingDescription,
			...estimateDescription,
			...getActiveDeploymentsDescription,
			...getProviderCountDescription,
			...getUtilizationDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Log licensing notice once
		if (!licenseNoticeLogged) {
			console.warn(LICENSING_NOTICE);
			licenseNoticeLogged = true;
		}

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let result: INodeExecutionData[] = [];

				// Route to appropriate operation handler
				if (resource === 'deployment') {
					switch (operation) {
						case 'create':
							result = await createDeployment.call(this, i);
							break;
						case 'get':
							result = await getDeployment.call(this, i);
							break;
						case 'getMany':
							result = await getDeployments.call(this, i);
							break;
						case 'update':
							result = await updateDeployment.call(this, i);
							break;
						case 'close':
							result = await closeDeployment.call(this, i);
							break;
						case 'status':
							result = await deploymentStatus.call(this, i);
							break;
						case 'logs':
							result = await deploymentLogs.call(this, i);
							break;
						case 'deposit':
							result = await depositDeployment.call(this, i);
							break;
					}
				} else if (resource === 'lease') {
					switch (operation) {
						case 'get':
							result = await getLease.call(this, i);
							break;
						case 'getMany':
							result = await getLeases.call(this, i);
							break;
						case 'close':
							result = await closeLease.call(this, i);
							break;
						case 'status':
							result = await leaseStatus.call(this, i);
							break;
						case 'sendManifest':
							result = await sendManifest.call(this, i);
							break;
					}
				} else if (resource === 'order') {
					switch (operation) {
						case 'get':
							result = await getOrder.call(this, i);
							break;
						case 'getMany':
							result = await getOrders.call(this, i);
							break;
					}
				} else if (resource === 'bid') {
					switch (operation) {
						case 'get':
							result = await getBid.call(this, i);
							break;
						case 'getMany':
							result = await getBids.call(this, i);
							break;
						case 'accept':
							result = await acceptBid.call(this, i);
							break;
					}
				} else if (resource === 'provider') {
					switch (operation) {
						case 'get':
							result = await getProvider.call(this, i);
							break;
						case 'getMany':
							result = await getProviders.call(this, i);
							break;
						case 'filter':
							result = await filterProviders.call(this, i);
							break;
						case 'status':
							result = await getProviderStatus.call(this, i);
							break;
						case 'leases':
							result = await getProviderLeases.call(this, i);
							break;
					}
				} else if (resource === 'certificate') {
					switch (operation) {
						case 'create':
							result = await createCertificate.call(this, i);
							break;
						case 'get':
							result = await getCertificate.call(this, i);
							break;
						case 'getMany':
							result = await getCertificates.call(this, i);
							break;
						case 'revoke':
							result = await revokeCertificate.call(this, i);
							break;
					}
				} else if (resource === 'wallet') {
					switch (operation) {
						case 'balance':
							result = await getBalance.call(this, i);
							break;
						case 'send':
							result = await send.call(this, i);
							break;
						case 'delegations':
							result = await getDelegations.call(this, i);
							break;
						case 'rewards':
							result = await getRewards.call(this, i);
							break;
						case 'escrowBalances':
							result = await getEscrowBalances.call(this, i);
							break;
					}
				} else if (resource === 'marketplace') {
					switch (operation) {
						case 'capacity':
							result = await getCapacity.call(this, i);
							break;
						case 'pricing':
							result = await getPricing.call(this, i);
							break;
						case 'estimate':
							result = await estimate.call(this, i);
							break;
						case 'activeDeployments':
							result = await getActiveDeployments.call(this, i);
							break;
						case 'providerCount':
							result = await getProviderCount.call(this, i);
							break;
						case 'utilization':
							result = await getUtilization.call(this, i);
							break;
					}
				}

				returnData.push(...result);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
