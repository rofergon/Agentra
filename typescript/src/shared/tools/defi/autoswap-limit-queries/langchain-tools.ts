// AutoSwapLimit Orders Query LangChain Integration
// LangChain wrapper for AutoSwapLimit orders query functionality

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Context } from '../../../configuration';
import { 
  getAutoSwapLimitOrdersQuery,
  autoswapLimitOrdersQueryParameters,
  AUTOSWAP_LIMIT_ORDERS_QUERY_TOOL,
  AUTOSWAP_LIMIT_ORDERS_OPERATIONS 
} from './api-client';

/**
 * Create AutoSwapLimit Orders Query LangChain tool
 * Provides comprehensive querying of user's limit orders on the AutoSwapLimit contract
 */
export const createAutoSwapLimitOrdersQueryLangchainTool = (
  client: any, 
  context: Context, 
  userAccountId: string
) => {
  return new DynamicStructuredTool({
    name: AUTOSWAP_LIMIT_ORDERS_QUERY_TOOL,
    description: `Query AutoSwapLimit contract to get user's limit orders and their detailed information.

**🎯 CRITICAL USAGE - When to Use:**
- When user asks about "my orders", "my limit orders", "my autoswap orders"
- When user wants to check "order status", "pending orders", "active orders"  
- When user asks "what orders do I have?", "show my orders", "check my limit orders"

**Available Operations:**
- **get_user_orders**: Get basic list of order IDs for a user
- **get_order_details**: Get detailed information for a specific order ID
- **get_user_orders_with_details**: Get all user orders with complete details (🔥 RECOMMENDED)

**What This Tool Provides:**
📋 **Order Information**: Order ID, token pair, amounts, prices, status
⏰ **Timing Details**: Creation time, expiration time, remaining time
💰 **Financial Data**: HBAR amount, target token, trigger price, min amount out
✅ **Status Tracking**: Active/inactive, executed/pending, can execute reason
🎯 **Smart Analysis**: Which orders are ready to execute, expired, or waiting

**User Account**: ${userAccountId}

**🚨 IMPORTANT**: This tool automatically converts Account IDs (0.0.1234) to EVM addresses for contract queries.
For comprehensive results, use "get_user_orders_with_details" operation.`,
    
    schema: z.object({
      operation: z.enum([
        AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_USER_ORDERS,
        AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_ORDER_DETAILS,
        AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_USER_ORDERS_WITH_DETAILS,
      ]).describe('Query operation - use get_user_orders_with_details for comprehensive results'),
      
      userAccountId: z.string().optional().describe(
        'User account ID in format 0.0.1234 (optional - will use current user if not provided)'
      ),
      
      orderId: z.number().optional().describe(
        'Specific order ID to query details for (required only for get_order_details operation)'
      ),
    }),
    
    func: async (params: any) => {
      try {
        // Auto-use user account ID if not provided
        if (!params.userAccountId) {
          params.userAccountId = userAccountId;
        }

        console.log(`🔍 AutoSwapLimit Orders Query: ${params.operation} for user: ${params.userAccountId}`);
        
        const result = await getAutoSwapLimitOrdersQuery(client, context, params, userAccountId);
        return JSON.stringify(result, null, 2);
        
      } catch (error: any) {
        console.error('❌ Error in AutoSwapLimit orders query tool:', error);
        
        return JSON.stringify({
          success: false,
          error: `Error querying AutoSwapLimit orders: ${error.message}`,
          operation: params.operation,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            issue: 'LangChain tool execution failed',
            possible_causes: [
              'Network connectivity issues',
              'Invalid account ID format',
              'Contract not available on current network',
              'Insufficient gas for contract query',
              'User has no orders in the system'
            ],
            next_steps: [
              'Check internet connection',
              'Verify account ID format (0.0.1234)',
              'Ensure using correct network (mainnet/testnet)',
              'Try again in a few moments',
              'Check if user has created any limit orders'
            ],
            user_guidance: [
              'This tool queries your existing limit orders on AutoSwapLimit',
              'If you have no orders, the result will be empty',
              'To create orders, use the autoswap_limit_tool with create_swap_order operation'
            ]
          }
        }, null, 2);
      }
    },
  });
};

/**
 * Create multiple AutoSwapLimit Orders Query tools (for future expansion)
 */
export const createAutoSwapLimitOrdersQueryLangchainTools = (
  client: any, 
  context: Context, 
  userAccountId: string
) => {
  return [
    createAutoSwapLimitOrdersQueryLangchainTool(client, context, userAccountId),
    // Future: Could add specialized tools for specific query types
    // createAutoSwapLimitActiveOrdersTool(client, context, userAccountId),
    // createAutoSwapLimitExpiredOrdersTool(client, context, userAccountId),
  ];
};

export default createAutoSwapLimitOrdersQueryLangchainTool;