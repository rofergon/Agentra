import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Context } from '../../../configuration';
import {
  getSaucerswapRouterSwapQuote,
  saucerswapRouterSwapQuoteParameters,
  SAUCERSWAP_ROUTER_SWAP_QUOTE_TOOL,
  SAUCERSWAP_ROUTER_OPERATIONS,
} from './contract-client';

/**
 * Creates a LangChain tool for SaucerSwap Router swap quotes using direct contract interaction.
 * This tool allows AI agents to get real-time swap quotes from the SaucerSwap V1 Router contract.
 * 
 * @param client - Hedera client (not used for contract calls but kept for consistency)
 * @param context - Context configuration
 * @param userAccountId - User's account ID for context (not used in quotes but helpful for logging)
 * @returns DynamicStructuredTool for LangChain integration
 */
export const createSaucerswapRouterSwapQuoteLangchainTool = (
  client: any, 
  context: Context, 
  userAccountId: string
) => {
  return new DynamicStructuredTool({
    name: SAUCERSWAP_ROUTER_SWAP_QUOTE_TOOL,
    description: `Get real-time token swap quotes from SaucerSwap V2 QuoterV2 contract on Hedera network using JSON-RPC (no operator required).

**🔄 SWAP QUOTE OPERATIONS:**
- **get_amounts_out**: Get output amount quote from exact input amount
- **get_amounts_in**: Get input amount quote from exact output amount

**📊 KEY FEATURES:**
- JSON-RPC integration with SaucerSwap V2 QuoterV2 (no operator/keys needed)
- Real-time quotes with embedded fees (Uniswap v3 style)
- Support for both mainnet and testnet via Hashio RPC
- Automatic HBAR to WHBAR conversion for paths
- Multi-hop routing with custom fee tiers
- Detailed error handling and troubleshooting

**🪙 TOKEN PATH & FEES FORMAT:**
- Use Hedera token IDs: "0.0.123456"
- Use "HBAR" for native HBAR (automatically converts to WHBAR)
- Path array: ["source_token", "destination_token"] or multi-hop routes
- Fees array: [3000] for single hop, [500, 3000] for multi-hop
- Fee values in hundredths of a bip: 500=0.05%, 3000=0.30%, 10000=1.00%

**💡 USAGE EXAMPLES:**
- HBAR to SAUCE: tokenPath: ["HBAR", "0.0.731861"], fees: [3000]
- Token to Token: tokenPath: ["0.0.111111", "0.0.222222"], fees: [3000]
- Multi-hop: tokenPath: ["HBAR", "0.0.111111", "0.0.222222"], fees: [500, 3000]

**⚙️ NETWORKS:**
- testnet (default)
- mainnet

**📍 Contract Details (V2 QuoterV2):**
- Mainnet Contract ID: 0.0.3949424 (QuoterV2)
- Testnet Contract ID: 0.0.1390002 (QuoterV2)  
- Uses official SaucerSwap V2 QuoterV2 via JSON-RPC (no operator required)

**🎯 Available Pool Fees:**
- 100 (0.01%) - Stablecoin pairs
- 500 (0.05%) - Low volatility pairs
- 3000 (0.30%) - Standard pairs (default)
- 10000 (1.00%) - High volatility pairs

Current user: ${userAccountId}`,
    
    schema: z.object({
      operation: z.enum([
        SAUCERSWAP_ROUTER_OPERATIONS.GET_AMOUNTS_OUT,
        SAUCERSWAP_ROUTER_OPERATIONS.GET_AMOUNTS_IN,
      ]).describe('Quote operation: get_amounts_out for output from input, get_amounts_in for input from output'),
      
      amount: z.string().describe('Token amount in smallest unit (e.g., "100000000" for 1 HBAR with 8 decimals)'),
      
      tokenPath: z.array(z.string()).min(2).describe('Array of token IDs representing swap path. Use "HBAR" for native HBAR.'),
      
      fees: z.array(z.number()).optional().describe('Array of pool fees in hundredths of a bip (e.g., [3000] for 0.30%). Length must be tokenPath.length - 1. Defaults to [3000] for all hops if not provided.'),
      
      network: z.enum(['mainnet', 'testnet']).optional().default('testnet').describe('Network to query (defaults to testnet)'),
    }),
    
    func: async (params: any) => {
      try {
        console.log(`🎯 SaucerSwap Router Quote Request:`, {
          operation: params.operation,
          amount: params.amount,
          path: params.tokenPath,
          fees: params.fees,
          network: params.network,
          user: userAccountId
        });

        const result = await getSaucerswapRouterSwapQuote(client, context, params);
        
        // Format response for LangChain with enhanced readability
        if ('error' in result && result.error) {
          return JSON.stringify({
            success: false,
            error: result.error,
            operation: result.operation,
            timestamp: result.timestamp,
            troubleshooting: result.troubleshooting,
            contractInfo: result.contractInfo,
            user: userAccountId,
            helpfulTips: {
              tokenFormat: "Use Hedera token IDs like '0.0.123456' or 'HBAR' for native HBAR",
              amountFormat: "Provide amounts in token's smallest unit (e.g., tinybars for HBAR)",
              pathValidation: "Ensure token path represents valid trading pairs on SaucerSwap",
              networkCheck: "Verify the network (testnet/mainnet) supports the tokens you're querying"
            }
          }, null, 2);
        }

        // Success response with enhanced formatting
        if ('quote' in result && result.quote) {
          return JSON.stringify({
            success: true,
            operation: result.operation,
            network: result.network,
            timestamp: result.timestamp,
            quote: {
              ...result.quote,
              summary: `${result.quote.input.formatted} ${result.quote.input.token} → ${result.quote.output.formatted} ${result.quote.output.token}`,
              exchangeRate: result.quote.output.token !== result.quote.input.token ? 
                `1 ${result.quote.input.token} = ${(Number(result.quote.output.amount) / Number(result.quote.input.amount)).toFixed(6)} ${result.quote.output.token}` : 
                'Same token',
            },
            contract: result.contract,
            source: result.source,
            user: userAccountId,
            metadata: {
              toolVersion: '1.0.0',
              quoteMethod: 'contract_direct',
              gasEstimate: 'Read-only operation (no gas cost)',
              dataFreshness: 'Real-time from blockchain'
            }
          }, null, 2);
        }

        // Fallback for unexpected response format
        return JSON.stringify({
          success: false,
          error: 'Unexpected response format from swap quote function',
          timestamp: new Date().toISOString(),
          user: userAccountId,
          rawResult: result
        }, null, 2);

      } catch (error: any) {
        console.error('❌ LangChain tool error:', error);
        
        return JSON.stringify({
          success: false,
          error: `SaucerSwap Router quote tool error: ${error.message}`,
          operation: params.operation || 'unknown',
          timestamp: new Date().toISOString(),
          user: userAccountId,
          troubleshooting: {
            issue: 'Tool execution failed',
            possibleCauses: [
              'Invalid parameters provided',
              'Network connectivity issues',
              'Contract temporarily unavailable',
              'Token path validation failed',
              'Amount format incorrect'
            ],
            nextSteps: [
              'Verify all parameters are correct',
              'Check token IDs are valid Hedera tokens',
              'Ensure amount is in correct format',
              'Try with a different token pair',
              'Check network connectivity'
            ],
            documentation: 'Refer to SaucerSwap documentation for valid token pairs and trading requirements'
          }
        }, null, 2);
      }
    },
  });
};

/**
 * Helper function to create multiple SaucerSwap Router tools
 * Currently returns a single tool but can be extended for specialized tools
 */
export const createSaucerswapRouterSwapQuoteLangchainTools = (
  client: any, 
  context: Context, 
  userAccountId: string
) => {
  return [
    createSaucerswapRouterSwapQuoteLangchainTool(client, context, userAccountId),
    // Future specialized tools can be added here:
    // createSaucerswapRouterInputQuoteTool(client, context, userAccountId),
    // createSaucerswapRouterOutputQuoteTool(client, context, userAccountId),
  ];
};