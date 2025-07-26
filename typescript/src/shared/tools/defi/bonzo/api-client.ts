import { z } from 'zod';
import type { Context } from '../../../configuration';
import type { Tool } from '../../../tools';
import { PromptGenerator } from '../../../utils/prompt-generator';

// Bonzo Finance API configuration
export const BONZO_API_CONFIG = {
  BASE_URL: 'https://bonzo-data-api-eceac9d8a2aa.herokuapp.com',
  ENDPOINTS: {
    ACCOUNT_DASHBOARD: '/dashboard',
    MARKET_INFO: '/market',
    POOL_STATS: '/pool-stats', 
    PROTOCOL_INFO: '/info',
    BONZO_TOKEN: '/bonzo',
    BONZO_CIRCULATION: '/bonzo/circulation',
  }
} as const;

// Available API operations
export const BONZO_API_OPERATIONS = {
  ACCOUNT_DASHBOARD: 'account_dashboard',
  MARKET_INFO: 'market_info',
  POOL_STATS: 'pool_stats',
  PROTOCOL_INFO: 'protocol_info',
  BONZO_TOKEN: 'bonzo_token',
  BONZO_CIRCULATION: 'bonzo_circulation',
} as const;

export const bonzoApiQueryParameters = (context: Context = {}) => {
  return z.object({
    operation: z.enum([
      BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD,
      BONZO_API_OPERATIONS.MARKET_INFO,
      BONZO_API_OPERATIONS.POOL_STATS,
      BONZO_API_OPERATIONS.PROTOCOL_INFO,
      BONZO_API_OPERATIONS.BONZO_TOKEN,
      BONZO_API_OPERATIONS.BONZO_CIRCULATION,
    ]).describe(
      'The Bonzo API operation to perform: account_dashboard, market_info, pool_stats, protocol_info, bonzo_token, or bonzo_circulation'
    ),
    accountId: z.string().optional().describe(
      'Hedera account ID in format shard.realm.num (required only for account_dashboard operation)'
    ),
  }) as any;
};

const getBonzoApiQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool allows you to query Bonzo Finance DeFi protocol using their official REST API to get real-time lending pool data, account information, and protocol statistics.

Available operations:

1. **Account Dashboard** (account_dashboard):
   - Get detailed account lending/borrowing positions
   - Requires accountId parameter
   - Returns supply/borrow balances, APY rates, collateral info

2. **Market Information** (market_info):
   - Get current market data for all supported tokens
   - Returns supply/borrow APY, utilization rates, available liquidity
   - No additional parameters needed

3. **Pool Statistics** (pool_stats):
   - Get 24-hour protocol statistics
   - Returns transaction counts, fees, liquidations
   - No additional parameters needed

4. **Protocol Information** (protocol_info):
   - Get protocol configuration and contract addresses
   - Returns lending pool, oracle, and configurator addresses
   - No additional parameters needed

5. **BONZO Token Information** (bonzo_token):
   - Get BONZO token details and treasury information
   - Returns total/circulating supply, treasury balances
   - No additional parameters needed

6. **BONZO Circulation Supply** (bonzo_circulation):
   - Get current circulating supply as plain number
   - No additional parameters needed

Parameters:
- operation (required): The API operation to perform
- accountId (optional): Required only for account_dashboard operation

${usageInstructions}

Examples:
- Get market data: operation="market_info"
- Get account info: operation="account_dashboard", accountId="0.0.123456"
- Get protocol info: operation="protocol_info"
`;
};

export const getBonzoApiQuery = async (
  client: any, // Not used for API calls
  context: Context,
  params: z.infer<ReturnType<typeof bonzoApiQueryParameters>>,
) => {
  try {
    console.log('🔍 Bonzo API query started:', params);

    // Validate account ID for dashboard operation
    if (params.operation === BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD && !params.accountId) {
      return {
        error: 'accountId is required for account_dashboard operation',
        suggestion: 'Provide a Hedera account ID in format shard.realm.num (e.g., "0.0.123456")'
      };
    }

    // Build API URL
    let apiUrl = BONZO_API_CONFIG.BASE_URL;
    
    switch (params.operation) {
      case BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD:
        apiUrl += `${BONZO_API_CONFIG.ENDPOINTS.ACCOUNT_DASHBOARD}/${params.accountId}`;
        break;
      case BONZO_API_OPERATIONS.MARKET_INFO:
        apiUrl += BONZO_API_CONFIG.ENDPOINTS.MARKET_INFO;
        break;
      case BONZO_API_OPERATIONS.POOL_STATS:
        apiUrl += BONZO_API_CONFIG.ENDPOINTS.POOL_STATS;
        break;
      case BONZO_API_OPERATIONS.PROTOCOL_INFO:
        apiUrl += BONZO_API_CONFIG.ENDPOINTS.PROTOCOL_INFO;
        break;
      case BONZO_API_OPERATIONS.BONZO_TOKEN:
        apiUrl += BONZO_API_CONFIG.ENDPOINTS.BONZO_TOKEN;
        break;
      case BONZO_API_OPERATIONS.BONZO_CIRCULATION:
        apiUrl += BONZO_API_CONFIG.ENDPOINTS.BONZO_CIRCULATION;
        break;
      default:
        throw new Error(`Unsupported operation: ${params.operation}`);
    }

    console.log(`🌐 Calling Bonzo API: ${apiUrl}`);

    // Make API request
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Hedera-Agent-Kit/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Bonzo API error: ${response.status} ${response.statusText}`);
    }

    // Handle different response types
    let data;
    const contentType = response.headers.get('content-type');
    
    if (params.operation === BONZO_API_OPERATIONS.BONZO_CIRCULATION) {
      // This endpoint returns plain text
      data = await response.text();
    } else if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    console.log('✅ Bonzo API response received');

    // Format response with operation context
    const result = {
      operation: params.operation,
      timestamp: new Date().toISOString(),
      data: data,
      source: 'Bonzo Finance API',
      api_url: apiUrl
    };

    return result;

  } catch (error) {
    console.error('❌ Bonzo API query failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      error: `Error querying Bonzo Finance API: ${errorMessage}`,
      operation: params.operation,
      timestamp: new Date().toISOString(),
      suggestion: 'Check your internet connection and verify the Bonzo Finance API is available',
      api_documentation: 'https://docs.bonzo.finance/hub/developer/bonzo-v1-data-api'
    };
  }
};

export const BONZO_API_QUERY_TOOL = 'bonzo_api_query';

const bonzoApiQueryTool = (context: Context): Tool => ({
  method: BONZO_API_QUERY_TOOL,
  name: 'Query Bonzo Finance API',
  description: getBonzoApiQueryPrompt(context),
  parameters: bonzoApiQueryParameters(context),
  execute: getBonzoApiQuery,
});

export default bonzoApiQueryTool; 