# AutoSwapLimit Orders Query Tool

A comprehensive LangChain tool for querying and monitoring limit orders on the AutoSwapLimit contract on Hedera network. This tool provides real-time order information, status tracking, and detailed analytics without requiring transaction execution.

## Overview

This tool enables AI agents to query user limit orders on the AutoSwapLimit DeFi protocol. It uses direct RPC calls via ethers.js to retrieve order information from the smart contract, providing comprehensive order tracking and status monitoring capabilities.

## Features

### 🔍 Order Querying
- **User Order Lists**: Get all order IDs for a specific user
- **Order Details**: Retrieve detailed information for specific orders
- **Comprehensive Queries**: Get all user orders with complete details in one call
- **Real-time Status**: Check order execution status and expiration

### 📊 Order Analytics
- **Status Tracking**: Active, expired, and executed order counts
- **Price Information**: Trigger prices and minimum output amounts
- **Timing Details**: Creation time, expiration time, and remaining time
- **Execution Analysis**: Determine which orders can be executed

### 🌐 Network Support
- **Mainnet**: Production environment with real assets
- **Testnet**: Development and testing environment
- **Automatic Network Detection**: Uses environment configuration

### 🔄 Token Support
- **SAUCE Token**: SaucerSwap native token
- **WHBAR**: Wrapped HBAR for DeFi operations
- **USDC**: USD Coin stablecoin
- **Automatic Token Recognition**: Smart token identification by contract address

## Contract Details

### AutoSwapLimit Contracts
- **Mainnet**: `0.0.6506134`
- **Testnet**: `0.0.6506134`
- **EVM Address**: `0x0000000000000000000000000000000000634696`

### Supported Networks
| Network | RPC Endpoint | Contract ID |
|---------|-------------|-------------|
| Mainnet | `https://mainnet.hashio.io/api` | `0.0.6506134` |
| Testnet | `https://testnet.hashio.io/api` | `0.0.6506134` |
| Previewnet | `https://previewnet.hashio.io/api` | `0.0.6506134` |

## Operations

### 1. Get User Orders (`get_user_orders`)
Retrieves the list of order IDs for a specific user.

**Parameters:**
- `userAccountId` (optional): Target user's account ID (defaults to current user)

**Returns:**
- Array of order IDs
- Basic order structure (without detailed information)
- Total order count

### 2. Get Order Details (`get_order_details`)
Retrieves detailed information for a specific order ID.

**Parameters:**
- `orderId` (required): The order ID to query
- `userAccountId` (optional): User's account ID for context

**Returns:**
- Complete order information
- Token details and amounts
- Execution status and timing
- Price and trigger information

### 3. Get User Orders with Details (`get_user_orders_with_details`) ⭐ **RECOMMENDED**
Retrieves all user orders with complete detailed information in a single call.

**Parameters:**
- `userAccountId` (optional): Target user's account ID (defaults to current user)

**Returns:**
- Complete list of orders with full details
- Order statistics (active, expired, executed counts)
- Token information and pricing
- Execution analysis for each order

## Usage Examples

### LangChain Integration

```typescript
import { createAutoSwapLimitOrdersQueryLangchainTool } from './langchain-tools';
import { HederaAgentKit } from '@hedera/agent-kit';

// Create the tool
const ordersQueryTool = createAutoSwapLimitOrdersQueryLangchainTool(
  client,
  context,
  userAccountId
);

// Query all user orders with details (recommended)
const result = await ordersQueryTool.invoke({
  operation: 'get_user_orders_with_details'
});

// Query specific order details
const orderDetails = await ordersQueryTool.invoke({
  operation: 'get_order_details',
  orderId: 123
});

// Query basic order list
const orderList = await ordersQueryTool.invoke({
  operation: 'get_user_orders',
  userAccountId: '0.0.1234567'
});
```

### Direct API Usage

```typescript
import { getAutoSwapLimitOrdersQuery } from './api-client';

// Get comprehensive order information
const orders = await getAutoSwapLimitOrdersQuery(
  client,
  context,
  {
    operation: 'get_user_orders_with_details',
    userAccountId: '0.0.1234567'
  },
  userAccountId
);

console.log(`Found ${orders.data.totalOrders} orders`);
console.log(`Active: ${orders.data.activeOrders}`);
console.log(`Expired: ${orders.data.expiredOrders}`);
```

## Response Format

### Order Details Structure

```typescript
interface OrderDetails {
  orderId: number;                    // Unique order identifier
  tokenOut: string;                   // Target token EVM address
  tokenOutName: string;               // Token symbol (SAUCE, WHBAR, USDC)
  amountIn: string;                   // Input amount in wei
  amountInHBAR: string;               // Input amount in HBAR format
  minAmountOut: string;               // Minimum output amount
  triggerPrice: string;               // Trigger price in wei
  triggerPriceUSDC: string;           // Trigger price in USDC format
  owner: string;                      // Order owner EVM address
  isActive: boolean;                  // Order active status
  expirationTime: number;             // Expiration timestamp
  expirationDate: string;             // Expiration in ISO format
  isExecuted: boolean;                // Execution status
  canExecute: boolean;                // Can be executed now
  canExecuteReason: string;           // Execution status reason
}
```

### Success Response

```json
{
  "success": true,
  "operation": "get_user_orders_with_details",
  "network": "testnet",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "userAccount": "0.0.1234567",
    "userEvmAddress": "0x...",
    "totalOrders": 5,
    "activeOrders": 3,
    "expiredOrders": 1,
    "executedOrders": 1,
    "orders": [
      {
        "orderId": 123,
        "tokenOut": "0x0000000000000000000000000000000000120f46",
        "tokenOutName": "SAUCE",
        "amountIn": "100000000",
        "amountInHBAR": "1 ℏ",
        "minAmountOut": "50000000",
        "triggerPrice": "20000000000",
        "triggerPriceUSDC": "0.2000",
        "owner": "0x...",
        "isActive": true,
        "expirationTime": 1705315800,
        "expirationDate": "2024-01-15T11:30:00.000Z",
        "isExecuted": false,
        "canExecute": true,
        "canExecuteReason": "Order can be executed"
      }
    ],
    "message": "Retrieved 5 of 5 orders with details."
  },
  "contract": {
    "id": "0.0.6506134",
    "address": "0x0000000000000000000000000000000000634696"
  }
}
```

## Configuration

### Environment Variables

```bash
# Network configuration
HEDERA_NETWORK=testnet  # or 'mainnet', 'previewnet'

# Account configuration (for context)
HEDERA_ACCOUNT_ID=0.0.1234567
HEDERA_PRIVATE_KEY=your_private_key
```

### Token Information

The tool automatically recognizes tokens by their EVM addresses:

#### Testnet Tokens
- **SAUCE**: `0.0.1183558` / `0x0000000000000000000000000000000000120f46`
- **WHBAR**: `0.0.1456986` / `0x0000000000000000000000000000000000163a5a`
- **USDC**: `0.0.456858` / `0x000000000000000000000000000000000006f89a`

#### Mainnet Tokens
- **SAUCE**: `0.0.731861` / `0x00000000000000000000000000000000000b2ad5`

## Error Handling

The tool provides comprehensive error handling with detailed messages:

```typescript
// Network errors
{
  "success": false,
  "error": "Network connectivity issues",
  "operation": "get_user_orders_with_details",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "troubleshooting": {
    "issue": "RPC connection failed",
    "possible_causes": [
      "Network connectivity issues",
      "Invalid account ID format",
      "Contract not available on current network"
    ],
    "next_steps": [
      "Check internet connection",
      "Verify account ID format (0.0.1234)",
      "Ensure using correct network"
    ]
  }
}
```

## Common Use Cases

### 1. Order Portfolio Monitoring
```typescript
// Get comprehensive order overview
const portfolio = await ordersQueryTool.invoke({
  operation: 'get_user_orders_with_details'
});

console.log(`Portfolio Summary:
- Total Orders: ${portfolio.data.totalOrders}
- Active Orders: ${portfolio.data.activeOrders}
- Ready to Execute: ${portfolio.data.orders.filter(o => o.canExecute).length}
- Expired Orders: ${portfolio.data.expiredOrders}`);
```

### 2. Order Execution Readiness
```typescript
const orders = await getOrders();
const executableOrders = orders.data.orders.filter(order => 
  order.canExecute && order.isActive && !order.isExecuted
);

console.log(`${executableOrders.length} orders ready for execution`);
```

### 3. Price Monitoring
```typescript
const orders = await getOrders();
const priceAlerts = orders.data.orders.map(order => ({
  orderId: order.orderId,
  token: order.tokenOutName,
  triggerPrice: order.triggerPriceUSDC,
  status: order.canExecuteReason
}));
```

## Integration Tips

### WebSocket Integration
For real-time monitoring, combine this tool with WebSocket connections:

```typescript
// Check orders periodically
setInterval(async () => {
  const orders = await getOrdersWithDetails();
  const executableOrders = orders.data.orders.filter(o => o.canExecute);
  
  if (executableOrders.length > 0) {
    // Notify user or trigger execution
    await notifyExecutableOrders(executableOrders);
  }
}, 30000); // Check every 30 seconds
```

### AI Agent Integration
Use natural language queries with the LangChain tool:

- "Show me my active limit orders"
- "Which of my orders can be executed right now?"
- "How many of my orders have expired?"
- "What's the status of order 123?"

## Security Considerations

1. **Read-Only Operations**: This tool only queries data, no transaction execution
2. **Account Privacy**: Account IDs are converted to EVM addresses for queries
3. **No Private Key Required**: Uses public RPC endpoints for data retrieval
4. **Rate Limiting**: Be mindful of RPC call frequency in production

## Troubleshooting

### Common Issues

1. **"No orders found"**
   - User may not have created any limit orders
   - Check if using correct account ID
   - Verify network configuration

2. **"Invalid account ID format"**
   - Ensure account ID format is `0.0.1234567`
   - Check for typos or missing digits

3. **"Contract not available"**
   - Verify network configuration
   - Check RPC endpoint connectivity
   - Ensure contract is deployed on target network

4. **"RPC connection failed"**
   - Check internet connectivity
   - Try different RPC endpoint
   - Verify network configuration

### Debug Mode

Enable detailed logging:

```typescript
// Set environment variable for verbose logging
process.env.DEBUG = 'autoswap-limit-queries*';
```

## Dependencies

- `@hashgraph/sdk`: Hedera SDK for account operations
- `ethers`: Ethereum library for contract interaction
- `zod`: Schema validation
- `@langchain/core`: LangChain tool integration

## License

This tool is part of the Agentra project and follows the same licensing terms.