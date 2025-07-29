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
    POOL_STATS: '/stats', 
    PROTOCOL_INFO: '/info',
    BONZO_TOKEN: '/bonzo',
    BONZO_CIRCULATION: '/bonzo/circulation',
  },
  // Rate limiting configuration
  RATE_LIMIT: {
    DELAY_MS: 1000,     // 1 second between requests
    MAX_RETRIES: 3,     // Maximum retry attempts
    BACKOFF_MS: 2000,   // Initial backoff delay
    CACHE_TTL_MS: 30000 // Cache responses for 30 seconds
  }
} as const;

// Simple cache to avoid duplicate requests
const apiCache = new Map<string, { data: any; timestamp: number }>();

// Track last request time for rate limiting
let lastRequestTime = 0;

// Sleep utility function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Clear expired cache entries
const clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of apiCache.entries()) {
    if (now - value.timestamp > BONZO_API_CONFIG.RATE_LIMIT.CACHE_TTL_MS) {
      apiCache.delete(key);
    }
  }
};

// Generate cache key
const getCacheKey = (operation: string, accountId?: string) => {
  return accountId ? `${operation}_${accountId}` : operation;
};

// Enhanced fetch with rate limiting and retry logic
const fetchWithRetry = async (url: string, maxRetries = BONZO_API_CONFIG.RATE_LIMIT.MAX_RETRIES): Promise<Response> => {
  // Rate limiting: ensure minimum delay between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const minDelay = BONZO_API_CONFIG.RATE_LIMIT.DELAY_MS;
  
  if (timeSinceLastRequest < minDelay) {
    const sleepTime = minDelay - timeSinceLastRequest;
    console.log(`⏱️ Rate limiting: waiting ${sleepTime}ms before request`);
    await sleep(sleepTime);
  }
  
  lastRequestTime = Date.now();

  // Enhanced headers to appear more legitimate
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://app.bonzo.finance/',
    'Origin': 'https://app.bonzo.finance',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site'
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🌐 Bonzo API request (attempt ${attempt + 1}/${maxRetries + 1}): ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      // If successful, return response
      if (response.ok) {
        console.log(`✅ Bonzo API request successful on attempt ${attempt + 1}`);
        return response;
      }

      // Handle specific error codes
      if (response.status === 403) {
        console.log(`🚫 403 Forbidden (attempt ${attempt + 1}). Rate limited.`);
        if (attempt < maxRetries) {
          const backoffDelay = BONZO_API_CONFIG.RATE_LIMIT.BACKOFF_MS * Math.pow(2, attempt);
          console.log(`⏰ Backing off for ${backoffDelay}ms before retry...`);
          await sleep(backoffDelay);
          continue;
        }
      }

      if (response.status === 429) {
        console.log(`⏳ 429 Too Many Requests (attempt ${attempt + 1})`);
        if (attempt < maxRetries) {
          const backoffDelay = BONZO_API_CONFIG.RATE_LIMIT.BACKOFF_MS * Math.pow(2, attempt);
          console.log(`⏰ Backing off for ${backoffDelay}ms before retry...`);
          await sleep(backoffDelay);
          continue;
        }
      }

      // For other errors, throw immediately
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    } catch (error) {
      console.log(`❌ Request failed (attempt ${attempt + 1}):`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      const backoffDelay = BONZO_API_CONFIG.RATE_LIMIT.BACKOFF_MS * Math.pow(2, attempt);
      console.log(`⏰ Retrying in ${backoffDelay}ms...`);
      await sleep(backoffDelay);
    }
  }

  throw new Error('Max retries exceeded');
};

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

    // Clean expired cache entries
    clearExpiredCache();

    // Check cache first
    const cacheKey = getCacheKey(params.operation, params.accountId);
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      console.log('💾 Returning cached result for:', cacheKey);
      return {
        ...cached.data,
        cached: true,
        cache_age_ms: Date.now() - cached.timestamp
      };
    }

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

    // Make API request with retry logic
    const response = await fetchWithRetry(apiUrl);

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

    console.log('✅ Bonzo API response received and cached');

    // Format response with operation context
    const result = {
      operation: params.operation,
      timestamp: new Date().toISOString(),
      data: data,
      source: 'Bonzo Finance API',
      api_url: apiUrl,
      cached: false
    };

    // Cache the result
    apiCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;

  } catch (error) {
    console.error('❌ Bonzo API query failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      error: `Error querying Bonzo Finance API: ${errorMessage}`,
      operation: params.operation,
      timestamp: new Date().toISOString(),
      suggestion: 'The API may be rate limiting requests. Try waiting a few seconds between requests.',
      troubleshooting: {
        common_causes: [
          'Rate limiting (403 Forbidden after initial requests)',
          'Too many requests in short time period', 
          'Network connectivity issues',
          'API temporarily unavailable'
        ],
        solutions: [
          'Wait 30-60 seconds before making another request',
          'Use fewer requests by caching results',
          'Check if account ID format is correct',
          'Verify internet connection'
        ]
      },
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