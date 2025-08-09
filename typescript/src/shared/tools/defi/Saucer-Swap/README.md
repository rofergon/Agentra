# SaucerSwap Router V2 Swap Tool

A comprehensive LangChain tool for executing real token swaps on SaucerSwap DEX using the UniswapV2Router02 contract on Hedera network.

## Overview

This tool enables AI agents to execute actual token swaps on SaucerSwap, Hedera's leading decentralized exchange. Unlike quote tools that only provide price information, this tool creates real transactions that can be signed and executed to perform token swaps.

## Features

### 🔄 **Swap Operations**
- **Exact Input Swaps**: Swap exact amount of input token for output tokens
- **Exact Output Swaps**: Swap input tokens to get exact amount of output tokens  
- **HBAR Support**: Native HBAR swaps with automatic WHBAR conversion
- **Multi-token Support**: Any Hedera token with active SaucerSwap liquidity

### 🛡️ **Protection Features**
- **Slippage Protection**: Configurable slippage tolerance (0.01% to 50%)
- **Deadline Protection**: Transaction expires if not mined within timeframe
- **Minimum Output**: Guarantees minimum tokens received for exact input swaps
- **Maximum Input**: Limits maximum tokens spent for exact output swaps

### 🌐 **Network Support**
- **Mainnet**: Production swaps with real value
- **Testnet**: Safe testing environment (default)
- **Automatic RPC**: Uses Hashio RPC endpoints for reliability

## Supported Operations

| Operation | Description | Use Case |
|-----------|-------------|----------|
| `swap_exact_hbar_for_tokens` | Swap exact HBAR for tokens | Most common HBAR→Token swap |
| `swap_exact_tokens_for_hbar` | Swap exact tokens for HBAR | Token→HBAR conversion |
| `swap_exact_tokens_for_tokens` | Swap exact amount of one token for another | Token→Token swaps |
| `swap_hbar_for_exact_tokens` | Swap HBAR to get exact token amount | When you need specific token amount |
| `swap_tokens_for_exact_hbar` | Swap tokens to get exact HBAR amount | When you need specific HBAR amount |
| `swap_tokens_for_exact_tokens` | Swap to get exact amount of output token | Precise token amount requirements |

## Quick Start

### Basic HBAR to SAUCE Swap

```typescript
const swapTool = createSaucerSwapRouterSwapLangchainTool(client, context, userAccountId);

const result = await swapTool.invoke({
  operation: 'swap_exact_hbar_for_tokens',
  amountIn: '100000000',  // 1 HBAR (8 decimals)
  tokenPath: ['HBAR', '0.0.731861'], // HBAR → SAUCE
  slippagePercent: 0.5,   // 0.5% slippage
  network: 'testnet'
});
```

### Token to Token Swap

```typescript
const result = await swapTool.invoke({
  operation: 'swap_exact_tokens_for_tokens',
  amountIn: '1000000000000000000',  // 1 SAUCE (18 decimals)
  tokenPath: ['0.0.731861', '0.0.111111'], // SAUCE → Other Token
  slippagePercent: 2.0,   // 2% slippage for higher volatility
  network: 'mainnet'
});
```

## Parameter Reference

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `operation` | string | Swap operation type (see operations table) |
| `tokenPath` | string[] | Array of token IDs defining swap route |

### Conditional Parameters

| Parameter | Type | Required For | Description |
|-----------|------|--------------|-------------|
| `amountIn` | string | Exact input swaps | Input amount in smallest unit |
| `amountOut` | string | Exact output swaps | Desired output amount in smallest unit |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `slippagePercent` | number | 0.5 | Maximum slippage tolerance (0.01-50) |
| `network` | string | 'testnet' | Network to execute on |
| `recipientAccountId` | string | user account | Account to receive tokens |
| `deadline` | number | +10 minutes | Unix timestamp deadline |

## Token Specifications

### Supported Networks & Tokens

#### Mainnet
- **Router Contract**: `0.0.3045981`
- **HBAR**: Use `"HBAR"` (auto-converts to WHBAR `0.0.1456986`)
- **SAUCE**: `0.0.731861`
- **Other Tokens**: Use Hedera token ID format `0.0.xxxxx`

#### Testnet (Default)
- **Router Contract**: `0.0.1414040`
- **HBAR**: Use `"HBAR"` (auto-converts to WHBAR `0.0.15057`)
- **SAUCE**: `0.0.456858`
- **Other Tokens**: Use Hedera token ID format `0.0.xxxxx`

### Amount Formatting

| Token | Decimals | Example |
|-------|----------|---------|
| HBAR | 8 | `"100000000"` = 1 HBAR |
| SAUCE | 18 | `"1000000000000000000"` = 1 SAUCE |
| Other | Varies | Check token specifications |

**Important**: Always use smallest unit without decimal points.

## Slippage Guidelines

| Token Type | Recommended Slippage | Reasoning |
|------------|---------------------|-----------|
| Stablecoins | 0.1% - 0.5% | Low volatility |
| Major tokens (HBAR, SAUCE) | 0.5% - 2% | Moderate liquidity |
| Volatile tokens | 2% - 5% | Higher price variance |
| Large amounts | 5% - 15% | Price impact |
| Emergency/Illiquid | Up to 50% | Maximum protection |

## Transaction Flow

1. **Parameter Validation**: Tool validates all inputs and requirements
2. **Transaction Preparation**: Creates contract call data with slippage protection
3. **Response Generation**: Returns transaction bytes ready for signing
4. **User Signing**: User reviews and signs transaction in wallet
5. **Execution**: Signed transaction is submitted to Hedera network
6. **Swap Execution**: UniswapV2Router02 executes the token swap
7. **Token Transfer**: Swapped tokens are transferred to recipient account

## Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "amountIn required" | Missing input amount for exact input swap | Provide amountIn parameter |
| "amountOut required" | Missing output amount for exact output swap | Provide amountOut parameter |
| "Invalid token path" | Incorrect token IDs or path format | Verify token IDs exist on network |
| "Insufficient liquidity" | Not enough pool liquidity | Try smaller amount or different route |
| "Slippage too high" | Price moved beyond tolerance | Increase slippage or retry |

### Troubleshooting Steps

1. **Verify Token IDs**: Ensure all tokens exist on selected network
2. **Check Balances**: Confirm sufficient input token balance
3. **Review Slippage**: Adjust tolerance for market conditions
4. **Test Smaller Amounts**: Try with reduced amounts first
5. **Check Network Status**: Verify SaucerSwap and Hedera availability

## Integration Examples

### LangChain Agent Integration

```typescript
// Create tool with user context
const saucerSwapTool = createSaucerSwapRouterSwapLangchainTool(
  client,
  { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
  userAccountId
);

// Add to agent tools
const tools = [
  ...standardHederaTools,
  saucerSwapTool
];

// Agent automatically selects tool based on user queries like:
// "Swap 1 HBAR for SAUCE tokens"
// "Convert my SAUCE to HBAR" 
// "Exchange 100 tokens for another token"
```

### Direct Tool Usage

```typescript
import { createSaucerSwapRouterSwapLangchainTool } from './langchain-tools';

const tool = createSaucerSwapRouterSwapLangchainTool(client, context, userAccountId);

// Execute swap
const result = await tool.invoke({
  operation: 'swap_exact_hbar_for_tokens',
  amountIn: '500000000', // 5 HBAR
  tokenPath: ['HBAR', '0.0.731861'],
  slippagePercent: 1.0,
  network: 'testnet'
});

console.log('Swap transaction ready:', result);
```

## Security Considerations

### ⚠️ **Important Warnings**

1. **Price Volatility**: Cryptocurrency prices can change rapidly
2. **Slippage Risk**: Final amounts may differ from estimates
3. **Smart Contract Risk**: DEX contracts carry inherent risks
4. **Network Fees**: HBAR required for transaction gas fees
5. **Token Association**: Must associate tokens before receiving

### 🔐 **Best Practices**

1. **Start Small**: Test with small amounts first
2. **Verify Addresses**: Double-check all token IDs
3. **Monitor Markets**: Check conditions before large swaps
4. **Backup Plans**: Have alternative routes for important swaps
5. **Keep Records**: Track all swap transactions

## Contract Details

### UniswapV2Router02 Functions Used

- `swapExactETHForTokens`: HBAR → Tokens (exact input)
- `swapTokensForExactETH`: Tokens → HBAR (exact output)
- `swapExactTokensForETH`: Tokens → HBAR (exact input)
- `swapExactTokensForTokens`: Token → Token (exact input)
- `swapTokensForExactTokens`: Token → Token (exact output)

### Network Endpoints

- **Mainnet RPC**: `https://mainnet.hashio.io/api`
- **Testnet RPC**: `https://testnet.hashio.io/api`

## Support & Resources

- **SaucerSwap Docs**: [https://docs.saucerswap.finance/](https://docs.saucerswap.finance/)
- **Hedera Docs**: [https://docs.hedera.com/](https://docs.hedera.com/)
- **Community**: [https://discord.gg/saucerswap](https://discord.gg/saucerswap)
- **Interface**: [https://saucerswap.finance/](https://saucerswap.finance/)

---

## License

This tool is part of the Hedera Agent Kit and follows the same licensing terms.