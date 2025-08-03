import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Context } from '../../../configuration';
import { getSaucerSwapApiQuery, SAUCERSWAP_API_QUERY_TOOL, SAUCERSWAP_API_OPERATIONS } from './api-client';

/**
 * Creates a LangChain DynamicStructuredTool for SaucerSwap API queries
 * This tool can be used directly in LangChain agents
 */
export const createSaucerSwapLangchainTool = (client: any, context: Context, userAccountId: string) => {
  return new DynamicStructuredTool({
    name: SAUCERSWAP_API_QUERY_TOOL,
    description: `Query SaucerSwap DEX protocol using their official REST API for real-time trading and liquidity data.

Available operations:
- General Statistics: Get overall protocol stats (TVL, volume, swap totals)
- Single-Sided Staking Stats: Get SSS APY, ratios, and staking amounts
- Active Farms: Get list of all active farms with emissions and staking info
- Account Farms: Get LP token amounts in farms for specific account

This provides access to SaucerSwap's DEX and yield farming data including:
- Total Value Locked (TVL) in USD
- Trading volume and swap statistics  
- SAUCE token circulation and staking ratios
- Farm emissions (SAUCE and HBAR rewards)
- Account-specific farm positions and staking amounts

Supports both Hedera Mainnet and Testnet networks.

User Account: ${userAccountId}`,
    schema: z.object({
      operation: z.enum([
        SAUCERSWAP_API_OPERATIONS.GENERAL_STATS,
        SAUCERSWAP_API_OPERATIONS.SSS_STATS,
        SAUCERSWAP_API_OPERATIONS.FARMS,
        SAUCERSWAP_API_OPERATIONS.ACCOUNT_FARMS,
        SAUCERSWAP_API_OPERATIONS.INFINITY_POOL_POSITION,
      ]).describe(
        'The SaucerSwap API operation: general_stats, sss_stats, farms, account_farms, or infinity_pool_position'
      ),
      accountId: z.string().optional().describe(
        'Hedera account ID in format shard.realm.num (required for account_farms and infinity_pool_position)'
      ),
      network: z.enum(['mainnet', 'testnet']).default(
        (process.env.HEDERA_NETWORK as 'mainnet' | 'testnet') || 'mainnet'
      ).describe(
        'The Hedera network to query (defaults to HEDERA_NETWORK from .env)'
      ),
    }),
    func: async (params: any) => {
      try {
        // Auto-use user account ID for operations that require accountId if not provided
        if ((params.operation === SAUCERSWAP_API_OPERATIONS.ACCOUNT_FARMS || 
             params.operation === SAUCERSWAP_API_OPERATIONS.INFINITY_POOL_POSITION) && 
            !params.accountId) {
          params.accountId = userAccountId;
          console.log(`📋 Using user account ID for ${params.operation}: ${userAccountId}`);
        }

        const result = await getSaucerSwapApiQuery(client, context, params);
        return JSON.stringify(result, null, 2);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          error: `Error querying SaucerSwap Finance API: ${errorMessage}`,
          operation: params.operation,
          network: params.network || 'mainnet',
          timestamp: new Date().toISOString(),
          troubleshooting: {
            issue: 'API request failed',
            possible_causes: [
              'Invalid or missing API key in environment',
              'Network connectivity issues',
              'SaucerSwap API is temporarily unavailable',
              'Invalid account ID format',
              'Rate limiting (too many requests)',
              'Wrong network specified'
            ],
            next_steps: [
              'Check API key configuration in .env file',
              'Verify internet connection',
              'Verify account ID format (shard.realm.num)',
              'Try switching networks (mainnet/testnet)',
              'Wait a few moments before retrying',
              'Check SaucerSwap API status'
            ],
            api_keys_location: {
              mainnet: 'SAUCERSWAP_MAINNET_API_KEY in .env',
              testnet: 'SAUCERSWAP_TESTNET_API_KEY in .env'
            }
          }
        }, null, 2);
      }
    },
  });
};

/**
 * Creates multiple SaucerSwap-related LangChain tools
 * This function can be extended to include more specialized SaucerSwap API tools
 */
export const createSaucerSwapLangchainTools = (client: any, context: Context, userAccountId: string) => {
  return [
    createSaucerSwapLangchainTool(client, context, userAccountId),
    // Future specialized tools can be added here:
    // createSaucerSwapStatsTool(client, context, userAccountId),
    // createSaucerSwapFarmsTool(client, context, userAccountId),
    // createSaucerSwapAccountTool(client, context, userAccountId),
  ];
};