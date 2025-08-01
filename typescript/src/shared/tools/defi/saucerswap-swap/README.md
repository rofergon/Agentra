# SaucerSwap Router Swap Quote Tool

Real-time token swap quotes from SaucerSwap V1 Router contract on Hedera network using direct contract interaction.

## Overview

This tool provides real-time swap quotes by interacting directly with the SaucerSwap UniswapV2Router02 contract deployed on Hedera. It supports both input and output quote calculations with automatic token ID to EVM address conversion.

## Features

- 🔄 **Direct Contract Interaction**: No API dependencies, real-time blockchain data
- 💱 **Dual Quote Types**: Get output from input or input from output amounts  
- 🪙 **Token Support**: Automatic conversion from Hedera token IDs to EVM addresses
- 🌐 **Network Support**: Both mainnet and testnet
- 🛣️ **Multi-hop Routing**: Support for complex trading paths
- ⚡ **Real-time**: Direct blockchain queries for current prices
- 🔧 **Error Handling**: Comprehensive error messages and troubleshooting

## Contract Details

- **Mainnet Contract ID**: `0.0.3045981`
- **Testnet Contract ID**: `0.0.3045981`
- **EVM Address**: `0x00000000000000000000000000000000002e7a5d`
- **Contract Type**: UniswapV2Router02

## Operations

### get_amounts_out
Get output token amount from exact input amount.

**Use case**: "How much SAUCE will I get for 100 HBAR?"

### get_amounts_in  
Get input token amount needed for exact output amount.

**Use case**: "How much HBAR do I need to get exactly 1000 SAUCE?"

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `operation` | string | Yes | Either `get_amounts_out` or `get_amounts_in` |
| `amount` | string | Yes | Token amount in smallest unit (e.g., "1000000" for 1 HBAR) |
| `tokenPath` | string[] | Yes | Array of token IDs representing swap path |
| `network` | string | No | Network to query: `mainnet` or `testnet` (default: testnet) |

## Token Path Format

The `tokenPath` array represents the swap route:

- **HBAR**: Use `"HBAR"` (automatically converts to WHBAR)
- **HTS Tokens**: Use Hedera format `"0.0.123456"`
- **Multi-hop**: `["HBAR", "0.0.111111", "0.0.222222"]` for HBAR → Token1 → Token2

## Examples

### Direct Usage

```typescript
import { getSaucerswapRouterSwapQuote } from './contract-client';

// Get SAUCE amount for 100 HBAR
const quote = await getSaucerswapRouterSwapQuote(null, {}, {
  operation: 'get_amounts_out',
  amount: '100000000', // 100 HBAR in tinybars
  tokenPath: ['HBAR', '0.0.123456'], // HBAR to SAUCE
  network: 'testnet'
});

console.log(quote);
```

### LangChain Integration

```typescript
import { createSaucerswapRouterSwapQuoteLangchainTool } from './langchain-tools';

const tool = createSaucerswapRouterSwapQuoteLangchainTool(client, context, userAccountId);

const result = await tool.invoke({
  operation: 'get_amounts_in',
  amount: '1000000000', // 1000 SAUCE
  tokenPath: ['HBAR', '0.0.123456'],
  network: 'mainnet'
});
```

### Agent Integration

The tool automatically responds to natural language queries:

- "How much SAUCE can I get for 50 HBAR?"
- "What's the exchange rate between HBAR and SAUCE?"
- "How much HBAR do I need for 100 SAUCE tokens?"

## Response Format

### Success Response

```json
{
  "success": true,
  "operation": "get_amounts_out",
  "network": "testnet",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "quote": {
    "input": {
      "token": "HBAR",
      "amount": "100000000",
      "formatted": "100"
    },
    "output": {
      "token": "0.0.123456",
      "amount": "2500000000",
      "formatted": "2500"
    },
    "path": ["HBAR", "0.0.123456"],
    "evmPath": ["0x0000000000000000000000000000000000163B5a", "0x000000000000000000000000000000000001e240"],
    "allAmounts": ["100000000", "2500000000"],
    "priceRatio": 25,
    "summary": "100 HBAR → 2500 0.0.123456",
    "exchangeRate": "1 HBAR = 25.000000 0.0.123456"
  },
  "contract": {
    "address": "0x00000000000000000000000000000000002e7a5d",
    "id": "0.0.3045981",
    "network": "testnet"
  },
  "source": "SaucerSwap UniswapV2Router02 Contract"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Insufficient liquidity for this trading pair",
  "operation": "get_amounts_out",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "troubleshooting": {
    "issue": "Contract interaction failed",
    "possibleCauses": [
      "Invalid token path",
      "Insufficient liquidity",
      "Network connectivity issues"
    ],
    "nextSteps": [
      "Verify token IDs are correct",
      "Check if trading pair exists on SaucerSwap",
      "Try a different amount"
    ]
  }
}
```

## Common Use Cases

### 1. Price Discovery
Check current exchange rates between token pairs.

### 2. Trade Planning
Calculate exact amounts needed for trades before execution.

### 3. Arbitrage Detection
Compare prices across different routes and platforms.

### 4. Liquidity Analysis
Understand price impact for different trade sizes.

### 5. Portfolio Valuation
Convert token holdings to equivalent amounts in other tokens.

## Error Handling

The tool provides detailed error information for common issues:

- **Invalid Token Path**: Malformed token IDs or non-existent pairs
- **Insufficient Liquidity**: Trade size too large for available liquidity
- **Network Issues**: Connectivity problems with Hedera JSON-RPC
- **Contract Errors**: Invalid parameters or contract call failures

## Integration Notes

### WebSocket Agent

The tool is automatically included in the WebSocket agent and responds to natural language queries about swap quotes and exchange rates.

### System Prompts

When integrated with AI agents, the tool responds to keywords like:
- "quote", "swap price", "exchange rate"
- "how much", "convert", "trade amount"
- Token names and amounts

### Context Awareness

The tool uses the user's account ID for logging and can be extended to provide personalized recommendations based on user holdings.

## Technical Details

### Dependencies
- `ethers`: JSON-RPC interaction with Hedera
- `@hashgraph/sdk`: Token ID conversion utilities
- `zod`: Parameter validation

### Network Configuration
- **Testnet RPC**: `https://testnet.hashio.io/api`
- **Mainnet RPC**: `https://mainnet.hashio.io/api`

### Performance
- **Read-only operations**: No gas costs
- **Real-time data**: Direct blockchain queries
- **Low latency**: Single contract call per quote

---

For more information about SaucerSwap and the UniswapV2Router02 contract, visit the [SaucerSwap documentation](https://docs.saucerswap.finance/).