# DeFi Tools Collection

A comprehensive suite of LangChain-compatible tools for interacting with major DeFi protocols on the Hedera network. These tools enable AI agents to perform various decentralized finance operations including trading, lending, staking, and automated order management.

## 🚀 Overview

This collection provides production-ready tools for integrating with Hedera's DeFi ecosystem, offering both read-only data queries and transaction execution capabilities. All tools are designed for seamless integration with LangChain agents and WebSocket applications.

### Supported Networks
- **Mainnet**: Production environment with real assets
- **Testnet**: Development and testing environment
- **Previewnet**: Preview network for early testing

## 📊 Available Tools

### 🔄 **SaucerSwap Tools**
Hedera's leading decentralized exchange platform.

#### `SaucerSwap-Quote/` - Price Quotes & Estimates
- **Purpose**: Get real-time swap quotes without executing trades
- **Features**: 
  - Multi-path routing analysis
  - Price impact calculations
  - Slippage estimations
  - Gas fee estimates
- **Use Cases**: Price discovery, trade analysis, arbitrage detection
- **Operations**: Quote exact input/output, best path analysis

#### `Saucer-Swap/` - Swap Execution 
- **Purpose**: Execute actual token swaps on SaucerSwap DEX
- **Features**:
  - HBAR ↔ Token swaps
  - Token ↔ Token direct swaps
  - Slippage protection (0.01% - 50%)
  - Deadline protection
- **Use Cases**: Token trading, portfolio rebalancing
- **Operations**: Exact input/output swaps, HBAR conversions

#### `saucerswap-api/` - Protocol Analytics
- **Purpose**: Query SaucerSwap's REST API for protocol data
- **Features**:
  - Total Value Locked (TVL) statistics
  - Trading volume analytics
  - Active farms information
  - Account-specific farm positions
- **Use Cases**: Market analysis, yield farming monitoring
- **Operations**: Protocol stats, farm data, account positions

#### `SaucerSwap-InfinityPool/` - SAUCE Staking
- **Purpose**: Stake SAUCE tokens to earn xSAUCE rewards
- **Features**:
  - SAUCE → xSAUCE staking
  - xSAUCE → SAUCE unstaking
  - Automatic token association
  - Compound rewards tracking
- **Use Cases**: Yield farming, governance token accumulation
- **Operations**: Stake, unstake, approve, associate

### 💰 **Bonzo Finance Tools**
Hedera's leading lending and borrowing protocol.

#### `bonzo/` - Protocol Analytics
- **Purpose**: Query Bonzo Finance API for lending protocol data
- **Features**:
  - Account lending/borrowing positions
  - Market data and APY rates
  - Protocol statistics
  - BONZO token information
- **Use Cases**: Portfolio monitoring, yield analysis
- **Operations**: Account dashboard, market info, pool stats

#### `bonzoTransaction/` - Deposit Operations
- **Purpose**: Execute multi-token deposits into Bonzo Finance
- **Features**:
  - Multi-step deposit flows
  - Automatic WHBAR association
  - Interest-bearing aToken minting
  - WebSocket flow management
- **Use Cases**: Yield generation, liquidity provision
- **Operations**: Full deposit flow, token association

### 🎯 **AutoSwapLimit Tools**
Automated limit order system for HBAR-based swaps.

#### `autoswap-limit/` - Order Creation & Management
- **Purpose**: Create and manage automated limit orders
- **Features**:
  - HBAR → Token limit orders
  - Price trigger automation
  - Expiration management
  - Contract balance monitoring
- **Use Cases**: Automated trading, dollar-cost averaging
- **Operations**: Create orders, query details, contract info

#### `autoswap-limit-queries/` - Order Monitoring
- **Purpose**: Query and monitor existing limit orders
- **Features**:
  - Real-time order status
  - Execution readiness analysis
  - Order portfolio overview
  - Detailed order analytics
- **Use Cases**: Order tracking, execution monitoring
- **Operations**: User orders, order details, comprehensive queries

## 🛠️ Tool Architecture

### Integration Patterns

Each tool follows a consistent architecture:

```typescript
// Core API client
export { default as toolName } from './api-client';

// LangChain integration
export { 
  createToolLangchainTool,
  createToolLangchainTools,
} from './langchain-tools';

// Configuration and schemas
export { 
  TOOL_CONFIG,
  TOOL_OPERATIONS,
  toolParameters,
} from './api-client';
```

### Common Features

All tools provide:
- ✅ **LangChain Integration**: Direct compatibility with AI agents
- ✅ **Error Handling**: Comprehensive error messages and troubleshooting
- ✅ **Parameter Validation**: Zod schema validation for all inputs
- ✅ **Network Support**: Automatic network detection and configuration
- ✅ **Security**: Transaction signing requirements and validation
- ✅ **Documentation**: Detailed usage examples and API references

## 🚀 Quick Start

### Basic LangChain Integration

```typescript
import { 
  createSaucerSwapLangchainTool,
  createBonzoLangchainTool,
  createAutoSwapLimitLangchainTool
} from '../defi';

// Initialize tools
const swapTool = createSaucerSwapLangchainTool(client, context, userAccountId);
const bonzoTool = createBonzoLangchainTool(client, context, userAccountId);
const limitOrderTool = createAutoSwapLimitLangchainTool(client, context, userAccountId);

// Use in LangChain agent
const tools = [swapTool, bonzoTool, limitOrderTool];
```

### WebSocket Agent Integration

```typescript
import { createAutoSwapLimitOrdersQueryLangchainTool } from '../defi/autoswap-limit-queries';

// Monitor user orders
const ordersMonitor = createAutoSwapLimitOrdersQueryLangchainTool(
  client, 
  context, 
  userAccountId
);

// Check for executable orders
const orders = await ordersMonitor.invoke({
  operation: 'get_user_orders_with_details'
});
```

## 📈 Use Cases & Workflows

### 1. **Automated Trading Workflow**
```typescript
// 1. Get price quote
const quote = await quoteTool.invoke({
  operation: 'get_swap_quote',
  tokenIn: 'HBAR',
  tokenOut: 'SAUCE',
  amountIn: '1'
});

// 2. Create limit order if price is favorable
if (quote.priceImpact < 0.03) {
  await limitOrderTool.invoke({
    operation: 'create_swap_order',
    tokenOut: 'SAUCE',
    amountIn: 1,
    triggerPrice: quote.price,
    expirationHours: 24
  });
}

// 3. Monitor order execution
const status = await ordersQueryTool.invoke({
  operation: 'get_user_orders_with_details'
});
```

### 2. **Yield Farming Strategy**
```typescript
// 1. Stake SAUCE for xSAUCE
await infinityPoolTool.invoke({
  operation: 'full_stake_flow',
  sauceAmount: 100
});

// 2. Deposit HBAR into Bonzo Finance
await bonzoDepositTool.invoke({
  operation: 'full_deposit_flow',
  token: 'HBAR',
  amount: '10'
});

// 3. Monitor positions
const bonzoPositions = await bonzoTool.invoke({
  operation: 'account_dashboard'
});

const farmStats = await saucerApiTool.invoke({
  operation: 'account_farms'
});
```

### 3. **Portfolio Rebalancing**
```typescript
// 1. Check current balances
const positions = await bonzoTool.invoke({
  operation: 'account_dashboard'
});

// 2. Calculate rebalancing needs
const targetAllocation = calculateRebalancing(positions);

// 3. Execute swaps
for (const trade of targetAllocation.trades) {
  await swapTool.invoke({
    operation: 'swap_exact_tokens_for_tokens',
    tokenIn: trade.from,
    tokenOut: trade.to,
    amountIn: trade.amount,
    slippageTolerance: 0.03
  });
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Network Configuration
HEDERA_NETWORK=mainnet          # or 'testnet', 'previewnet'

# Account Configuration
HEDERA_ACCOUNT_ID=0.0.1234567   # Your Hedera account ID
HEDERA_PRIVATE_KEY=your_key     # Your private key (for transaction signing)

# Optional: Custom RPC endpoints
HEDERA_RPC_URL=https://mainnet.hashio.io/api
```

### Tool-Specific Configuration

Each tool can be configured independently:

```typescript
// Custom network configuration
const customConfig = {
  network: 'testnet',
  rpcUrl: 'https://testnet.hashio.io/api',
  contracts: {
    router: '0.0.1414040',
    // ... other contracts
  }
};
```

## 🛡️ Security Considerations

### Transaction Safety
- ✅ All transactions require explicit user signing
- ✅ Parameter validation prevents invalid operations
- ✅ Slippage protection for all swaps
- ✅ Deadline protection prevents stale transactions

### Account Security
- ✅ Private keys handled securely
- ✅ Account ID validation
- ✅ Network isolation (mainnet/testnet)
- ✅ Contract address verification

### Best Practices
- Always use testnet for development
- Verify contract addresses before mainnet use
- Set appropriate slippage tolerances
- Monitor transaction deadlines
- Keep private keys secure

## 📝 Token Support

### Mainnet Tokens
| Token | Symbol | Contract ID | Decimals |
|-------|--------|-------------|----------|
| HBAR | HBAR | Native | 8 |
| SAUCE | SAUCE | 0.0.731861 | 6 |
| USDC | USDC | 0.0.456858 | 6 |
| USDT | USDT | 0.0.749738 | 6 |
| xSAUCE | xSAUCE | 0.0.731870 | 6 |

### Testnet Tokens
| Token | Symbol | Contract ID | Decimals |
|-------|--------|-------------|----------|
| HBAR | HBAR | Native | 8 |
| SAUCE | SAUCE | 0.0.1183558 | 6 |
| WHBAR | WHBAR | 0.0.1456986 | 8 |
| USDC | USDC | 0.0.456858 | 6 |

## 🤝 Contributing

When adding new DeFi tools:

1. Follow the established architecture pattern
2. Include comprehensive error handling
3. Add LangChain integration
4. Provide detailed documentation
5. Include usage examples
6. Add parameter validation schemas

## 📄 License

This DeFi tools collection is part of the Agentra project and follows the same licensing terms.

---

## 🔗 Individual Tool Documentation

For detailed documentation on specific tools:

- [SaucerSwap Quote Tool](./SaucerSwap-Quote/README.md)
- [SaucerSwap Swap Tool](./Saucer-Swap/UniswapV2Router02%20README.md)
- [SaucerSwap Infinity Pool Tool](./SaucerSwap-InfinityPool/README.md)
- [Bonzo Finance Transactions](./bonzoTransaction/Bonzo%20Finance%20Transaction%20README.md)
- [AutoSwapLimit Orders Query](./autoswap-limit-queries/README.md)

Each tool directory contains detailed API documentation, usage examples, and integration guides.