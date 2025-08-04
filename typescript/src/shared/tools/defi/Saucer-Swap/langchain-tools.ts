import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Context } from '../../../configuration';
import {
  getSaucerswapRouterSwap,
  saucerswapRouterSwapParameters,
  SAUCERSWAP_ROUTER_SWAP_TOOL,
  SAUCERSWAP_ROUTER_SWAP_OPERATIONS,
  SAUCERSWAP_V2_ROUTER_CONTRACTS,
} from './contract-client';

/**
 * Creates a LangChain tool for SaucerSwap Router token swaps using UniswapV2Router02 contract.
 * This tool allows AI agents to execute real token swaps on the SaucerSwap DEX.
 * 
 * @param client - Hedera client for transaction submission
 * @param context - Context configuration with account ID
 * @param userAccountId - User's account ID for transactions
 * @returns DynamicStructuredTool for LangChain integration
 */
export const createSaucerSwapRouterSwapLangchainTool = (
  client: any, 
  context: Context, 
  userAccountId: string
) => {
  return new DynamicStructuredTool({
    name: SAUCERSWAP_ROUTER_SWAP_TOOL,
    description: `Execute real token swaps on SaucerSwap DEX using UniswapV2Router02 contract on Hedera network.

**🔄 SWAP OPERATIONS:**
- **swap_exact_hbar_for_tokens**: Swap exact HBAR amount for tokens (most common)
- **swap_exact_tokens_for_hbar**: Swap exact token amount for HBAR
- **swap_exact_tokens_for_tokens**: Swap exact amount of one token for another
- **swap_hbar_for_exact_tokens**: Swap HBAR to get exact token amount
- **swap_tokens_for_exact_hbar**: Swap tokens to get exact HBAR amount  
- **swap_tokens_for_exact_tokens**: Swap tokens to get exact amount of another token

**🚀 KEY FEATURES:**
- Direct contract interaction with UniswapV2Router02
- Support for HBAR and any Hedera token swaps
- Automatic HBAR to WHBAR conversion for contract compatibility
- Built-in slippage protection (default 2.0% for mainnet safety)
- Configurable deadlines for transaction validity
- Support for both mainnet and testnet
- Real transaction creation ready for signing

**💰 SWAP EXAMPLES:**
1. **HBAR to SAUCE**: 
   - operation: "swap_exact_hbar_for_tokens"
   - amountIn: "100000000" (1 HBAR with 8 decimals)
   - tokenPath: ["HBAR", "0.0.731861"] (mainnet) or ["HBAR", "0.0.1183558"] (testnet)
   
2. **SAUCE to HBAR**:
   - operation: "swap_exact_tokens_for_hbar"  
   - amountIn: "1000000000000000000" (1 SAUCE with 18 decimals)
   - tokenPath: ["0.0.731861", "HBAR"] (mainnet) or ["0.0.1183558", "HBAR"] (testnet)

3. **Token to Token**:
   - operation: "swap_exact_tokens_for_tokens"
   - amountIn: "1000000" (depends on token decimals)
   - tokenPath: ["0.0.111111", "0.0.222222"]

**⚙️ SLIPPAGE & PROTECTION:**
- Default slippage: 2.0% (conservative for mainnet safety)
- Adjustable from 0.01% to 50%
- Higher slippage for volatile tokens or large amounts
- Lower slippage for stablecoins or small amounts

**📍 SUPPORTED NETWORKS:**
- **Mainnet**: Router Contract 0.0.3045981
- **Testnet**: Router Contract 0.0.1414040 (default)

**🪙 TOKEN SPECIFICATIONS:**
- HBAR: Use "HBAR" (automatically converts to WHBAR for swaps)
- SAUCE Token: "0.0.731861" (mainnet) / "0.0.1183558" (testnet)
- Other tokens: Use Hedera token ID format "0.0.xxxxx"
- Path supports multi-hop swaps: ["tokenA", "tokenB", "tokenC"]

**💡 AMOUNT FORMATTING:**
- HBAR: 8 decimals (100000000 = 1 HBAR)
- SAUCE: 18 decimals (1000000000000000000 = 1 SAUCE)
- Other tokens: Check token-specific decimal places
- Always use smallest unit (no decimal points in amounts)

**⏰ TRANSACTION FLOW:**
1. Tool validates parameters and builds transaction
2. Returns transaction bytes for user signing
3. User signs transaction in wallet
4. Transaction executes swap on SaucerSwap DEX
5. Tokens are transferred to recipient account

**🔐 SECURITY FEATURES:**
- Slippage protection prevents excessive loss
- Deadline protection prevents stale transactions
- Minimum output calculation protects against MEV
- All transactions require user signature approval

**⚠️ IMPORTANT NOTES:**
- Requires sufficient token balance and HBAR for gas
- Token association may be required before receiving new tokens
- Check current market conditions for optimal slippage settings
- Large swaps may have higher price impact

Current user: ${userAccountId}
Network contracts: Mainnet Router ${SAUCERSWAP_V2_ROUTER_CONTRACTS.mainnet.ROUTER_ID} | Testnet Router ${SAUCERSWAP_V2_ROUTER_CONTRACTS.testnet.ROUTER_ID}`,
    
    schema: z.object({
      operation: z.enum([
        SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_HBAR_FOR_TOKENS,
        SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_TOKENS_FOR_HBAR,
        SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_TOKENS_FOR_TOKENS,
        SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_HBAR_FOR_EXACT_TOKENS,
        SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_TOKENS_FOR_EXACT_HBAR,
        SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_TOKENS_FOR_EXACT_TOKENS,
      ]).describe('The swap operation to perform'),
      
      amountIn: z.string().optional().describe(
        'Exact input amount in smallest unit (required for exact input swaps). HBAR: 8 decimals, SAUCE: 18 decimals'
      ),
      
      amountOut: z.string().optional().describe(
        'Exact output amount in smallest unit (required for exact output swaps). Check token decimals'
      ),
      
      tokenPath: z.array(z.string()).min(2).describe(
        'Swap path as array of token IDs. Use "HBAR" for HBAR. Example: ["HBAR", "0.0.731861"] for HBAR→SAUCE on mainnet, ["HBAR", "0.0.1183558"] on testnet'
      ),
      
      slippagePercent: z.number().min(0.01).max(50).default(2.0).describe(
        'Maximum slippage tolerance as percentage (2.0 = 2.0%). Conservative default for mainnet safety'
      ),
      
      network: z.enum(['mainnet', 'testnet']).default(
        (process.env.HEDERA_NETWORK as 'mainnet' | 'testnet') || 'mainnet'
      ).describe(
        'Network for swap execution (defaults to HEDERA_NETWORK from .env)'
      ),

      recipientAccountId: z.string().optional().describe(
        'Account to receive swapped tokens (defaults to transaction signer if not provided)'
      ),
    }),
    
    func: async (params: any) => {
      try {
        console.log(`🔄 SaucerSwap Router swap initiated by ${userAccountId}`);
        console.log(`📊 Operation: ${params.operation}`);
        console.log(`🪙 Path: ${params.tokenPath.join(' → ')}`);
        
        // Auto-use user account ID as recipient if not provided
        if (!params.recipientAccountId) {
          params.recipientAccountId = userAccountId;
          console.log(`👤 Using user account as recipient: ${userAccountId}`);
        }
        
        // Ensure network follows HEDERA_NETWORK from .env if not explicitly provided
        if (!params.network || params.network === 'mainnet') {
          const envNetwork = (process.env.HEDERA_NETWORK as 'mainnet' | 'testnet') || 'mainnet';
          if (envNetwork === 'testnet') {
            params.network = 'testnet';
            console.log(`🌐 Overriding network to testnet based on HEDERA_NETWORK=${process.env.HEDERA_NETWORK}`);
          }
        }

        // Execute swap preparation
        const result = await getSaucerswapRouterSwap(
          client, 
          { 
            ...context,
            accountId: userAccountId 
          }, 
          params
        );

        // Enhanced response formatting for LangChain using type guard
        if (result.success) {
          console.log(`✅ SaucerSwap swap prepared successfully`);
          console.log(`💱 ${result.swap.input.formatted} → ${result.swap.output.formatted}`);
          console.log(`⚙️ Slippage: ${result.swap.slippage}, Network: ${result.network}`);
          
          return JSON.stringify({
            ...result,
            user_context: {
              user_account: userAccountId,
              operation_type: 'token_swap',
              platform: 'SaucerSwap',
              ready_to_sign: true,
            },
            next_steps: [
              '1. Review swap details carefully',
              '2. Check slippage tolerance is acceptable', 
              '3. Confirm you have sufficient balance',
              '4. Sign the transaction when prompted',
              '5. Wait for transaction confirmation'
            ],
            risk_warnings: [
              'Cryptocurrency swaps involve price volatility risk',
              'Slippage may result in different final amounts',
              'Ensure you have HBAR for transaction fees',
              'Double-check token addresses before proceeding'
            ]
          }, null, 2);
        } else {
          console.log(`❌ SaucerSwap swap preparation failed: ${result.error}`);
          
          return JSON.stringify({
            ...result,
            user_context: {
              user_account: userAccountId,
              operation_type: 'token_swap',
              platform: 'SaucerSwap',
              status: 'failed'
            },
            helpful_tips: [
              'Verify all token IDs are correct for the selected network',
              'Check that you have sufficient balance for the input amount',
              'Ensure tokens are associated to your account',
              'Try adjusting slippage tolerance if liquidity issues',
              'Consider using smaller amounts for testing'
            ]
          }, null, 2);
        }
      } catch (error: any) {
        console.error(`❌ SaucerSwap Router swap error for ${userAccountId}:`, error);
        
        return JSON.stringify({
          error: `Error executing SaucerSwap Router swap: ${error.message}`,
          operation: params.operation,
          user_account: userAccountId,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            issue: 'Tool execution failed',
            possible_causes: [
              'Network connectivity issues',
              'Invalid parameters provided',
              'SaucerSwap Router contract unavailable',
              'Insufficient token liquidity',
              'Account not properly configured'
            ],
            next_steps: [
              'Check internet connection and try again',
              'Verify token IDs exist on selected network',
              'Ensure account has sufficient balance',
              'Try with different slippage tolerance',
              'Check SaucerSwap status page for issues',
              'Consider using testnet for testing'
            ]
          },
          support: {
            saucerswap_docs: 'https://docs.saucerswap.finance/',
            hedera_docs: 'https://docs.hedera.com/',
            community: 'https://discord.gg/saucerswap'
          }
        }, null, 2);
      }
    },
  });
};

/**
 * Creates multiple SaucerSwap Router LangChain tools (future expansion)
 * Currently returns single swap tool, but can be extended for specialized tools
 */
export const createSaucerSwapRouterSwapLangchainTools = (
  client: any, 
  context: Context, 
  userAccountId: string
) => {
  return [
    createSaucerSwapRouterSwapLangchainTool(client, context, userAccountId),
    // Future specialized tools:
    // createSaucerSwapLiquidityTool(client, context, userAccountId),
    // createSaucerSwapFarmingTool(client, context, userAccountId),
  ];
};