# n8n-nodes-akash

> [Velocity BPA Licensing Notice]
>
> This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
>
> Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.
>
> For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.

A comprehensive n8n community node for **Akash Network**, the world's first decentralized open-source cloud. Deploy containerized applications at a fraction of the cost of traditional cloud providers using the Akash decentralized marketplace.

![n8n](https://img.shields.io/badge/n8n-community--node-orange)
![Akash Network](https://img.shields.io/badge/Akash-Network-FF414C)
![License](https://img.shields.io/badge/license-BSL--1.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Cosmos SDK](https://img.shields.io/badge/Cosmos-SDK-6F7390)

## Features

- **Complete Deployment Management** - Create, update, close, and monitor deployments using SDL manifests
- **Lease Lifecycle Control** - Manage the full lease lifecycle from bid acceptance to closure
- **Provider Discovery** - Filter and find providers by GPU type, region, price, and capacity
- **Marketplace Insights** - Access network capacity, pricing statistics, and cost estimation
- **Wallet Operations** - Check balances, send AKT, and manage staking delegations
- **Real-time Events** - Trigger workflows on deployment, lease, and bid events via WebSocket
- **mTLS Certificate Management** - Create and manage certificates for secure provider communication
- **SDL Validation** - Validate deployment manifests before submission

## Installation

### Community Nodes (Recommended)

1. Open your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Click **Install**
4. Enter `n8n-nodes-akash` and click **Install**

### Manual Installation

```bash
# Navigate to your n8n installation
cd ~/.n8n

# Install the package
npm install n8n-nodes-akash

# Restart n8n
```

### Development Installation

```bash
# Clone the repository
git clone https://github.com/Velocity-BPA/n8n-nodes-akash.git
cd n8n-nodes-akash

# Install dependencies
npm install

# Build the project
npm run build

# Link to n8n
mkdir -p ~/.n8n/custom
ln -s $(pwd) ~/.n8n/custom/n8n-nodes-akash

# Restart n8n
```

## Credentials Setup

### Akash API Credentials

Used for most operations (deployments, leases, providers, marketplace).

| Field | Description | Required |
|-------|-------------|----------|
| Network | Mainnet or Testnet | Yes |
| API Endpoint | Console API URL (auto-filled based on network) | Yes |
| Wallet Address | Your Akash address (akash1...) | Yes |
| Auth Method | Mnemonic or Private Key | Yes |
| Mnemonic | 24-word recovery phrase | If using mnemonic |
| Private Key | Hex-encoded private key | If using private key |
| Chain ID | Auto-filled based on network | Yes |

### Akash RPC Credentials

Used for trigger node and direct blockchain access.

| Field | Description | Required |
|-------|-------------|----------|
| RPC Endpoint | Tendermint RPC URL | Yes |
| REST Endpoint | Cosmos REST API URL | Yes |
| WebSocket Endpoint | WebSocket URL for events | Yes |
| Custom Headers | Optional HTTP headers | No |

## Resources & Operations

### Deployment

| Operation | Description |
|-----------|-------------|
| Create | Deploy from SDL manifest |
| Get | Retrieve deployment details |
| Get Many | List all deployments |
| Update | Update deployment with new SDL |
| Close | Close and terminate deployment |
| Status | Get real-time status from provider |
| Logs | Retrieve deployment logs |
| Deposit | Add funds to escrow |

### Lease

| Operation | Description |
|-----------|-------------|
| Create | Create lease from accepted bid |
| Get | Retrieve lease details |
| Get Many | List all leases |
| Close | Close active lease |
| Status | Get lease status from provider |
| Send Manifest | Send deployment manifest to provider |

### Order

| Operation | Description |
|-----------|-------------|
| Get | Retrieve order details |
| Get Many | List all orders |
| Close | Close open order |

### Bid

| Operation | Description |
|-----------|-------------|
| Get | Retrieve bid details |
| Get Many | List bids for order |
| Accept | Accept bid and create lease |

### Provider

| Operation | Description |
|-----------|-------------|
| Get | Retrieve provider details |
| Get Many | List all providers |
| Filter | Filter by GPU, region, price |
| Status | Check provider online status |
| Leases | Get provider's active leases |

### Certificate

| Operation | Description |
|-----------|-------------|
| Create | Generate new mTLS certificate |
| Get | Retrieve certificate details |
| Get Many | List all certificates |
| Revoke | Revoke active certificate |

### Wallet

| Operation | Description |
|-----------|-------------|
| Balance | Get AKT balance |
| Send | Transfer AKT to address |
| Delegations | View staking delegations |
| Rewards | View staking rewards |
| Escrow Balances | View deployment escrow balances |

### Marketplace

| Operation | Description |
|-----------|-------------|
| Capacity | Network resource capacity |
| Pricing | Current pricing statistics |
| Estimate | Estimate deployment cost |
| Active Deployments | Count of active deployments |
| Provider Count | Number of providers |
| Utilization | Network utilization stats |

## Trigger Node

The Akash Trigger node listens for real-time events from the Akash Network.

### Event Types

- **Deployment Events**: Created, Updated, Closed
- **Lease Events**: Created, Closed
- **Bid Events**: Created, Closed
- **Provider Events**: Created, Updated
- **Block Events**: New block notifications

### Filters

- Filter by owner address
- Filter by provider address
- Filter by deployment sequence (dseq)

## Usage Examples

### Deploy a Simple Web Application

```yaml
# SDL Manifest for nginx deployment
version: "2.0"
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
      count: 1
```

### Deploy GPU Workload for AI Inference

```yaml
version: "2.0"
services:
  inference:
    image: nvidia/cuda:12.0-runtime
    expose:
      - port: 8080
        as: 8080
        to:
          - global: true
profiles:
  compute:
    inference:
      resources:
        cpu:
          units: 4
        memory:
          size: 16Gi
        storage:
          - size: 100Gi
        gpu:
          units: 1
          attributes:
            vendor:
              nvidia:
                - model: a100
  placement:
    dcloud:
      attributes:
        host: akash
      signedBy:
        anyOf:
          - akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63
      pricing:
        inference:
          denom: uakt
          amount: 50000
deployment:
  dcloud:
    inference:
      profile: inference
      count: 1
```

### Workflow: Auto-Scale Based on Traffic

1. **HTTP Trigger** - Receives webhook from monitoring
2. **IF Node** - Check if scale-up needed
3. **Akash Node** - Update deployment with new replica count
4. **Slack Node** - Notify team of scaling event

### Workflow: Cost Monitoring

1. **Schedule Trigger** - Daily check
2. **Akash Node** - Get escrow balances
3. **IF Node** - Check if balance low
4. **Akash Node** - Deposit more AKT if needed
5. **Email Node** - Send alert if balance critical

## Akash Network Concepts

### SDL (Stack Definition Language)

SDL is a YAML-based manifest format that defines your deployment:

- **Services**: Docker images and their configurations
- **Profiles**: Resource requirements (CPU, memory, storage, GPU)
- **Placement**: Provider requirements and pricing
- **Deployment**: How services map to profiles

### Deployment Lifecycle

1. **Create Deployment** - Submit SDL to blockchain
2. **Receive Bids** - Providers bid on your order
3. **Accept Bid** - Choose a provider and create lease
4. **Send Manifest** - Provider deploys your workload
5. **Monitor** - Track status and logs
6. **Close** - Terminate when done

### Identifiers

- **dseq** (Deployment Sequence): Unique deployment ID
- **gseq** (Group Sequence): Group within deployment
- **oseq** (Order Sequence): Order within group
- **Provider**: Address of hosting provider

### Escrow System

Deployments are funded via escrow accounts:
- Deposit AKT to create deployments
- Funds are drawn as blocks are produced
- Remaining balance returned on close

## Networks

| Network | Chain ID | Purpose |
|---------|----------|---------|
| Mainnet | akashnet-2 | Production deployments |
| Testnet | sandbox-01 | Testing and development |

## Error Handling

The node provides detailed error messages for common issues:

- **Invalid SDL**: Validation errors with specific field references
- **Insufficient Funds**: Clear indication of required deposit
- **No Bids**: Suggestions for adjusting pricing or requirements
- **Provider Offline**: Automatic retry suggestions
- **Transaction Failed**: Gas estimation and retry guidance

## Security Best Practices

1. **Protect Your Mnemonic** - Never share or expose your recovery phrase
2. **Use Testnet First** - Always test deployments on testnet
3. **Minimum Deposits** - Start with minimum required deposits
4. **Monitor Escrow** - Set up alerts for low balances
5. **Audit Providers** - Prefer audited providers for sensitive workloads
6. **Certificate Rotation** - Periodically rotate mTLS certificates

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## Author

**Velocity BPA**
- Website: [velobpa.com](https://velobpa.com)
- GitHub: [Velocity-BPA](https://github.com/Velocity-BPA)

## Licensing

This n8n community node is licensed under the **Business Source License 1.1**.

### Free Use
Permitted for personal, educational, research, and internal business use.

### Commercial Use
Use of this node within any SaaS, PaaS, hosted platform, managed service,
or paid automation offering requires a commercial license.

For licensing inquiries:
**licensing@velobpa.com**

See [LICENSE](LICENSE), [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md), and [LICENSING_FAQ.md](LICENSING_FAQ.md) for details.

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Support

- **Documentation**: [Akash Network Docs](https://docs.akash.network)
- **Issues**: [GitHub Issues](https://github.com/Velocity-BPA/n8n-nodes-akash/issues)
- **Discord**: [Akash Network Discord](https://discord.akash.network)
- **Commercial Support**: licensing@velobpa.com

## Acknowledgments

- [Akash Network](https://akash.network) - The decentralized cloud platform
- [n8n](https://n8n.io) - The workflow automation platform
- [Cosmos SDK](https://cosmos.network) - The blockchain framework
- [@cosmjs](https://github.com/cosmos/cosmjs) - JavaScript Cosmos SDK library
