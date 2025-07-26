import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Context } from '../../../configuration';
import { getBonzoApiQuery, BONZO_API_QUERY_TOOL, BONZO_API_OPERATIONS } from './api-client';

/**
 * Creates a LangChain DynamicStructuredTool for Bonzo API queries
 * This tool can be used directly in LangChain agents
 */
export const createBonzoLangchainTool = (client: any, context: Context, userAccountId: string) => {
  return new DynamicStructuredTool({
    name: BONZO_API_QUERY_TOOL,
    description: `Query Bonzo Finance DeFi protocol using their official REST API for real-time data.

Available operations:
- Account Dashboard: Get detailed account lending/borrowing positions
- Market Information: Get current market data for all supported tokens  
- Pool Statistics: Get 24-hour protocol statistics
- Protocol Information: Get protocol configuration and contract addresses
- BONZO Token: Get BONZO token details and treasury information
- BONZO Circulation: Get current circulating supply

This provides access to Bonzo's DeFi lending protocol data including APY rates, utilization percentages, liquidity info, and account positions.

User Account: ${userAccountId}`,
    schema: z.object({
      operation: z.enum([
        BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD,
        BONZO_API_OPERATIONS.MARKET_INFO,
        BONZO_API_OPERATIONS.POOL_STATS,
        BONZO_API_OPERATIONS.PROTOCOL_INFO,
        BONZO_API_OPERATIONS.BONZO_TOKEN,
        BONZO_API_OPERATIONS.BONZO_CIRCULATION,
      ]).describe(
        'The Bonzo API operation: account_dashboard, market_info, pool_stats, protocol_info, bonzo_token, or bonzo_circulation'
      ),
      accountId: z.string().optional().describe(
        'Hedera account ID in format shard.realm.num (required only for account_dashboard)'
      ),
    }),
    func: async (params: any) => {
      try {
        console.log('🔍 Bonzo API query started with params:', params);
        console.log('👤 User account ID:', userAccountId);

        // If no accountId provided for dashboard and we have user account, use it
        if (params.operation === BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD && !params.accountId) {
          params.accountId = userAccountId;
          console.log(`📋 Using user account ID for dashboard: ${userAccountId}`);
        }

        const result = await getBonzoApiQuery(client, context, params);
        return JSON.stringify(result, null, 2);
      } catch (error) {
        console.error('❌ Bonzo API query failed:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        return JSON.stringify({
          error: `Error querying Bonzo Finance API: ${errorMessage}`,
          operation: params.operation,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            issue: 'API request failed',
            possible_causes: [
              'Network connectivity issues',
              'Bonzo Finance API is temporarily unavailable',
              'Invalid account ID format',
              'Rate limiting'
            ],
            next_steps: [
              'Check internet connection',
              'Verify account ID format (shard.realm.num)',
              'Try again in a few moments',
              'Check Bonzo Finance status page'
            ]
          },
          api_documentation: 'https://docs.bonzo.finance/hub/developer/bonzo-v1-data-api'
        }, null, 2);
      }
    },
  });
};

/**
 * Creates multiple Bonzo-related LangChain tools
 * This function can be extended to include more specialized Bonzo API tools
 */
export const createBonzoLangchainTools = (client: any, context: Context, userAccountId: string) => {
  return [
    createBonzoLangchainTool(client, context, userAccountId),
    // Future specialized tools can be added here:
    // createBonzoAccountTool(client, context, userAccountId),
    // createBonzoMarketTool(client, context, userAccountId),
    // createBonzoProtocolTool(client, context, userAccountId),
  ];
}; 