# SaucerSwap Router V2 Swap Tool

A comprehensive LangChain tool for executing real token swaps on the SaucerSwap V2 Router contract on Hedera network. This tool provides direct contract interaction capabilities for various swap operations with built-in security features.

## Overview

This tool enables AI agents to execute actual token swaps using the SaucerSwap V2 Router (UniswapV2Router02) contract. Unlike the quote tool which only provides price estimates, this tool creates and executes real swap transactions.

## Features

### 🔄 Swap Operations
- **HBAR to Tokens**: Swap native HBAR for any supported token
- **Tokens to HBAR**: Swap tokens back to native HBAR
- **Token to Token**: Direct token-to-token swaps without HBAR intermediary
- **Exact Input/Output**: Support for both exact input and exact output amounts
- **Fee-on-Transfer**: Compatible with tokens that charge fees on transfers

### 🛡️ Security & Risk Management
- **Slippage Protection**: Configurable slippage tolerance (default 3%, max 50%)
- **Deadline Protection**: Automatic transaction deadlines (default 10 minutes)
- **User Approval**: All swaps require transaction signing for security
- **Parameter Validation**: Comprehensive input validation and error handling
- **Balance Checking**: Automatic validation of sufficient balances

### 🌐 Network Support
- **Mainnet**: Production swaps with real assets
- **Testnet**: Development and testing environment

## Supported Tokens

### Mainnet
| Token | Contract ID | Decimals | Symbol |
|-------|-------------|----------|---------|
| HBAR | Native | 8 | HBAR |
| SAUCE | 0.0.731861 | 6 | SAUCE |
| USDC | 0.0.456858 | 6 | USDC |
| USDT | 0.0.749738 | 6 | USDT |

### Testnet
| Token | Contract ID | Decimals | Symbol |
|-------|-------------|----------|---------|
| HBAR | Native | 8 | HBAR |
| SAUCE | 0.0.3187119 | 6 | SAUCE |

## Contract Details

### Router Contracts
- **Mainnet**: `0.0.3045981` (UniswapV2Router02)
- **Testnet**: `0.0.1414040` (UniswapV2Router02)

### EVM Addresses
- **Mainnet**: `0x00000000000000000000000000000000002e7a5d`
- **Testnet**: `0x0000000000000000000000000000000000159228`

## Usage Examples

### Basic HBAR to SAUCE Swap
```typescript
// Swap 10 HBAR for SAUCE with 3% slippage
{
  operation: "swap_exact_hbar_for_tokens",
  amountIn: "1000000000", // 10 HBAR (8 decimals)
  tokenPath: ["HBAR", "0.0.731861"],
  slippagePercent: 3,
  network: "mainnet"
}
```

### SAUCE to HBAR Swap
```typescript
// Swap 100 SAUCE for HBAR
{
  operation: "swap_exact_tokens_for_hbar", 
  amountIn: "100000000", // 100 SAUCE (6 decimals)
  tokenPath: ["0.0.731861", "HBAR"],
  slippagePercent: 5, // Higher slippage for volatile tokens
  network: "mainnet"
}
```

### Token to Token Direct Swap
```typescript
// Swap USDC for SAUCE directly
{
  operation: "swap_exact_tokens_for_tokens",
  amountIn: "50000000", // 50 USDC (6 decimals) 
  tokenPath: ["0.0.456858", "0.0.731861"],
  slippagePercent: 3,
  network: "mainnet"
}
```

### Exact Output Swap
```typescript
// Get exactly 1000 SAUCE, paying variable HBAR
{
  operation: "swap_hbar_for_exact_tokens",
  amountOut: "1000000000", // 1000 SAUCE (6 decimals)
  amountIn: "5000000000", // Max 50 HBAR to spend
  tokenPath: ["HBAR", "0.0.731861"],
  slippagePercent: 5,
  network: "mainnet"
}
```

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `operation` | enum | Type of swap operation to execute |
| `tokenPath` | string[] | Array of token IDs for swap route |

### Conditional Parameters

| Parameter | Type | Required For | Description |
|-----------|------|--------------|-------------|
| `amountIn` | string | Exact input operations | Input amount in smallest unit |
| `amountOut` | string | Exact output operations | Output amount in smallest unit |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `slippagePercent` | number | 3 | Slippage tolerance (0.1-50%) |
| `recipient` | string | Current user | Recipient account ID |
| `network` | enum | testnet | Hedera network |
| `deadline` | number | +10 minutes | Transaction deadline |
| `supportFeeOnTransfer` | boolean | false | Use fee-compatible functions |

## Operations Reference

### HBAR Operations
- `swap_exact_hbar_for_tokens`: Swap exact HBAR → minimum tokens
- `swap_hbar_for_exact_tokens`: Swap maximum HBAR → exact tokens

### Token to HBAR Operations  
- `swap_exact_tokens_for_hbar`: Swap exact tokens → minimum HBAR
- `swap_tokens_for_exact_hbar`: Swap maximum tokens → exact HBAR

### Token to Token Operations
- `swap_exact_tokens_for_tokens`: Swap exact tokens → minimum other tokens
- `swap_tokens_for_exact_tokens`: Swap maximum tokens → exact other tokens

## Amount Formatting

### Decimal Handling
All amounts must be provided in the smallest unit (no decimals):

| Token | Decimals | 1 Unit | Smallest Unit Input |
|-------|----------|--------|-------------------|
| HBAR | 8 | 1 HBAR | "100000000" |
| SAUCE | 6 | 1 SAUCE | "1000000" |
| USDC | 6 | 1 USDC | "1000000" |
| USDT | 6 | 1 USDT | "1000000" |

### Example Calculations
```typescript
// 10 HBAR = 10 * 10^8 = 1000000000
amountIn: "1000000000"

// 50.5 SAUCE = 50.5 * 10^6 = 50500000  
amountIn: "50500000"

// 0.1 USDC = 0.1 * 10^6 = 100000
amountIn: "100000"
```

## Error Handling

### Common Errors and Solutions

#### Insufficient Balance
```
Error: Insufficient balance for swap
Solution: Check account balance and reduce swap amount
```

#### Token Not Associated
```
Error: Token not associated with account
Solution: Associate target token with account before swapping
```

#### Slippage Too Low
```
Error: Slippage tolerance too low
Solution: Increase slippagePercent parameter (try 5-10%)
```

#### Invalid Token Path
```
Error: Invalid token path
Solution: Verify token IDs are correct and path is valid
```

### Error Response Structure
```typescript
{
  error: "Error description",
  operation: "swap_operation_name", 
  timestamp: "2024-01-08T10:30:00.000Z",
  troubleshooting: {
    possible_causes: [...],
    next_steps: [...],
    helpful_commands: [...]
  },
  token_info: {
    // Token reference information
  }
}
```

## Integration Examples

### WebSocket Agent Integration
```typescript
// In websocket-agent.ts
import { createSaucerswapRouterSwapLangchainTool } from './path/to/SaucerSwap-Swap';

const saucerswapSwapTool = createSaucerswapRouterSwapLangchainTool(
  this.agentClient,
  { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
  userAccountId
);

const tools = [...hederaToolsList, saucerswapSwapTool];
```

### Direct Tool Usage
```typescript
import { getSaucerswapRouterSwap } from './SaucerSwap-Swap';

const result = await getSaucerswapRouterSwap(client, context, {
  operation: 'swap_exact_hbar_for_tokens',
  amountIn: '1000000000',
  tokenPath: ['HBAR', '0.0.731861'],
  slippagePercent: 3,
  network: 'mainnet'
});
```

## Security Considerations

### Transaction Signing
- All swaps require user signature approval
- No automatic execution without explicit user consent
- Private keys never exposed to the tool

### Slippage Protection
- Default 3% slippage balances execution success with price protection
- Higher slippage may be needed for:
  - Volatile tokens
  - Low liquidity pairs
  - Large swap amounts
  - High network congestion

### Deadline Protection
- Default 10-minute deadline prevents stuck transactions
- Configurable for different use cases
- Automatic calculation from current time

### Amount Validation
- Automatic validation of sufficient balances
- Parameter validation prevents invalid transactions
- Clear error messages for troubleshooting

## Best Practices

### Before Swapping
1. **Check Balances**: Verify sufficient balance for swap
2. **Associate Tokens**: Ensure target tokens are associated
3. **Get Quote**: Use quote tool to estimate amounts
4. **Check Liquidity**: Verify sufficient liquidity exists

### Slippage Guidelines
- **Stablecoins**: 0.5-1% slippage usually sufficient
- **Major Tokens**: 1-3% slippage recommended  
- **Volatile Tokens**: 3-10% slippage may be needed
- **Low Liquidity**: Higher slippage required

### Amount Guidelines
- **Start Small**: Test with small amounts first
- **Check Decimals**: Verify decimal formatting
- **Leave Buffer**: Don't use entire balance for swaps
- **Consider Fees**: Account for transaction fees

## Troubleshooting

### Transaction Failures
1. Check account balance and token associations
2. Verify token IDs are correct for the network
3. Increase slippage tolerance
4. Try smaller amounts
5. Check SaucerSwap pool liquidity

### Network Issues  
1. Verify network parameter matches intended network
2. Check Hedera network status
3. Ensure client has network connectivity
4. Retry with fresh transaction

### Parameter Errors
1. Verify amount formatting (no decimals, string type)
2. Check token path contains valid IDs
3. Ensure operation matches token path (HBAR operations need "HBAR")
4. Validate slippage is within 0.1-50% range

## Development

### Adding New Tokens
1. Add token info to `POPULAR_TOKENS` in contract-client.ts
2. Update documentation with new token details
3. Test swap functionality on testnet first

### Extending Operations
1. Add new operation to `SAUCERSWAP_SWAP_OPERATIONS`
2. Implement in `buildSwapTransaction` function
3. Add validation in `validateSwapParameters`
4. Update documentation and examples

## API Reference

### Main Function
```typescript
getSaucerswapRouterSwap(
  client: Client,
  context: Context, 
  params: SwapParameters
): Promise<SwapResult>
```

### LangChain Tool Creation
```typescript
createSaucerswapRouterSwapLangchainTool(
  client: any,
  context: Context,
  userAccountId: string
): DynamicStructuredTool
```

### Utility Functions
```typescript
calculateDeadline(bufferSeconds?: number): number
calculateMinAmountOut(amountOut: string, slippagePercent: number): string  
calculateMaxAmountIn(amountIn: string, slippagePercent: number): string
tokenIdToEvmAddress(tokenId: string, network: HederaNet): string
```

---

## Related Tools

- **SaucerSwap Quote Tool**: Get price estimates before swapping
- **Bonzo Finance Tools**: DeFi lending and borrowing 
- **Hedera Tools**: Native HBAR transfers and token operations

For support and updates, refer to the main SaucerSwap documentation and Hedera developer resources.