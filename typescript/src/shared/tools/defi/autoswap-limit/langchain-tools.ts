// AutoSwapLimit LangChain Tools - LangChain-specific wrappers for AutoSwapLimit contract
// Based on the Bonzo Finance LangChain tool integration pattern

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Client } from '@hashgraph/sdk';
import type { Context } from '../../../configuration';
import { 
  getAutoSwapLimitQuery,
  autoswapLimitParameters,
  AUTOSWAP_LIMIT_TOOL,
  AUTOSWAP_LIMIT_OPERATIONS,
  AUTOSWAP_LIMIT_CONTRACTS,
  AUTOSWAP_LIMIT_CONFIG,
} from './api-client';

/**
 * Create AutoSwapLimit LangChain tool for creating and managing limit orders
 */
export const createAutoSwapLimitLangchainTool = (
  client: Client, 
  context: Context, 
  userAccountId: string
) => {
  return new DynamicStructuredTool({
    name: AUTOSWAP_LIMIT_TOOL,
    description: `Create and manage limit orders on AutoSwapLimit contract for automated token swaps.

Available operations:
- Create Swap Order: Create a new limit order to swap HBAR for tokens at a specific price
- Get Order Details: Retrieve details of a specific order by ID
- Get Contract Config: Get contract configuration (fees, minimum amounts, etc.)
- Get Router Info: Get router and token addresses used by the contract
- Get Contract Balance: Get current HBAR balance of the contract
- Get Next Order ID: Get the next available order ID

Supported tokens: SAUCE, WHBAR, and other Hedera tokens
Network: ${process.env.HEDERA_NETWORK || 'mainnet'}
User Account: ${userAccountId}

Example: Create a limit order to buy SAUCE when price drops to 0.001 HBAR per SAUCE
Parameters: tokenOut="SAUCE", amountIn=0.5, minAmountOut="1", triggerPrice="1000"`,
    
    schema: z.object({
      operation: z.enum([
        AUTOSWAP_LIMIT_OPERATIONS.CREATE_SWAP_ORDER,
        AUTOSWAP_LIMIT_OPERATIONS.GET_ORDER_DETAILS,
        AUTOSWAP_LIMIT_OPERATIONS.GET_CONTRACT_CONFIG,
        AUTOSWAP_LIMIT_OPERATIONS.GET_ROUTER_INFO,
        AUTOSWAP_LIMIT_OPERATIONS.GET_CONTRACT_BALANCE,
        AUTOSWAP_LIMIT_OPERATIONS.GET_NEXT_ORDER_ID,
      ]),
      
      // Order creation parameters
      tokenOut: z.string().optional(),
      amountIn: z.number().optional(),
      minAmountOut: z.string().optional(),
      triggerPrice: z.string().optional(),
      expirationHours: z.number().optional(),
      
      // Query parameters
      orderId: z.number().optional(),
      
      // Network and user parameters
      network: z.enum(['mainnet', 'testnet']).optional(),
      userAccountId: z.string().optional(),
    }),
    
    func: async (params: any) => {
      try {
        // Auto-use user account ID if not provided
        if (!params.userAccountId) {
          params.userAccountId = userAccountId;
        }

        // Auto-use current network if not provided
        if (!params.network) {
          params.network = (process.env.HEDERA_NETWORK as 'mainnet' | 'testnet') || 'mainnet';
        }

        console.log(`🎯 AutoSwapLimit LangChain Tool - ${params.operation}`);
        console.log(`📋 Parameters:`, {
          operation: params.operation,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          minAmountOut: params.minAmountOut,
          triggerPrice: params.triggerPrice,
          expirationHours: params.expirationHours,
          orderId: params.orderId,
          network: params.network,
          userAccountId: params.userAccountId,
        });

        const result = await getAutoSwapLimitQuery(client, context, params);
        
        console.log(`✅ AutoSwapLimit operation completed: ${params.operation}`);
        return JSON.stringify(result, null, 2);
        
      } catch (error: any) {
        console.error(`❌ AutoSwapLimit LangChain Tool error:`, error);
        
        // Fix the type safety issue by properly typing the network access
        const network = (params.network || 'mainnet') as 'mainnet' | 'testnet';
        
        return JSON.stringify({
          success: false,
          error: `Error in AutoSwapLimit operation: ${error.message}`,
          operation: params.operation,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            issue: 'LangChain tool execution failed',
            possible_causes: [
              'Invalid parameters provided',
              'Network connectivity issues',
              'Contract not available on specified network',
              'Insufficient account balance',
              'Invalid token symbols or IDs'
            ],
            next_steps: [
              'Check parameter values and formats',
              'Verify network connectivity',
              'Ensure account has sufficient HBAR balance',
              'Use valid token symbols (SAUCE, WHBAR) or token IDs',
              'Check contract deployment status'
            ]
          },
          contractInfo: {
            contract_id: AUTOSWAP_LIMIT_CONTRACTS[network].CONTRACT_ID,
            network: network,
          }
        }, null, 2);
      }
    },
  });
};

/**
 * Create multiple AutoSwapLimit LangChain tools (for future expansion)
 */
export const createAutoSwapLimitLangchainTools = (
  client: Client, 
  context: Context, 
  userAccountId: string
) => {
  return [
    createAutoSwapLimitLangchainTool(client, context, userAccountId),
    // Future specialized tools can be added here:
    // createAutoSwapLimitOrderQueryTool(client, context, userAccountId),
    // createAutoSwapLimitConfigQueryTool(client, context, userAccountId),
  ];
};

/**
 * Helper function to create a specialized order creation tool
 */
export const createAutoSwapLimitOrderCreationTool = (
  client: Client, 
  context: Context, 
  userAccountId: string
) => {
  return new DynamicStructuredTool({
    name: 'autoswap_limit_order_creation_tool',
    description: `Create limit orders on AutoSwapLimit contract for automated token swaps.

Creates a limit order that will automatically execute when the market price reaches your specified trigger price.
The order will swap HBAR for the specified token using SaucerSwap's liquidity pools.

Supported tokens: SAUCE, WHBAR, and other Hedera tokens
Minimum order amount: ${AUTOSWAP_LIMIT_CONFIG.MIN_ORDER_AMOUNT_HBAR} HBAR
Default expiration: 24 hours

User Account: ${userAccountId}`,
    
    schema: z.object({
      tokenOut: z.string().describe(
        'Token symbol or ID to swap for (e.g., "SAUCE", "0.0.731861")'
      ),
      amountIn: z.number().min(AUTOSWAP_LIMIT_CONFIG.MIN_ORDER_AMOUNT_HBAR).describe(
        `Amount of HBAR to deposit for the limit order (minimum ${AUTOSWAP_LIMIT_CONFIG.MIN_ORDER_AMOUNT_HBAR} HBAR)`
      ),
      minAmountOut: z.string().describe(
        'Minimum amount of tokens to receive (in wei/smallest unit)'
      ),
      triggerPrice: z.string().describe(
        'Trigger price in wei/smallest unit. Order executes when market price reaches this level'
      ),
      expirationHours: z.number().min(1).max(168).default(24).describe(
        'Order expiration time in hours (1-168 hours, default 24)'
      ),
      network: z.enum(['mainnet', 'testnet']).default(
        (process.env.HEDERA_NETWORK as 'mainnet' | 'testnet') || 'mainnet'
      ).describe('Network to execute on'),
    }),
    
    func: async (params: any) => {
      try {
        // Add user account ID and operation
        const fullParams = {
          ...params,
          operation: AUTOSWAP_LIMIT_OPERATIONS.CREATE_SWAP_ORDER,
          userAccountId,
        };

        console.log(`🎯 Creating AutoSwapLimit order: ${params.amountIn} HBAR → ${params.tokenOut}`);
        console.log(`🎯 Trigger price: ${params.triggerPrice} wei`);
        console.log(`⏰ Expiration: ${params.expirationHours} hours`);

        const result = await getAutoSwapLimitQuery(client, context, fullParams);
        
        console.log(`✅ AutoSwapLimit order creation completed`);
        return JSON.stringify(result, null, 2);
        
      } catch (error: any) {
        console.error(`❌ AutoSwapLimit order creation error:`, error);
        
        // Fix the type safety issue by properly typing the network access
        const network = (params.network || 'mainnet') as 'mainnet' | 'testnet';
        
        return JSON.stringify({
          success: false,
          error: `Error creating AutoSwapLimit order: ${error.message}`,
          operation: 'create_swap_order',
          timestamp: new Date().toISOString(),
          troubleshooting: {
            issue: 'Order creation failed',
            possible_causes: [
              'Insufficient HBAR balance',
              'Invalid token symbol or ID',
              'Invalid price parameters',
              'Contract not available on network',
              'Network connectivity issues'
            ],
            next_steps: [
              'Check HBAR balance is sufficient',
              'Use valid token symbols (SAUCE, WHBAR)',
              'Verify price parameters are reasonable',
              'Check network connectivity',
              'Try with different parameters'
            ]
          },
          contractInfo: {
            contract_id: AUTOSWAP_LIMIT_CONTRACTS[network].CONTRACT_ID,
            network: network,
          }
        }, null, 2);
      }
    },
  });
};

/**
 * Helper function to create a specialized order query tool
 */
export const createAutoSwapLimitOrderQueryTool = (
  client: Client, 
  context: Context, 
  userAccountId: string
) => {
  return new DynamicStructuredTool({
    name: 'autoswap_limit_order_query_tool',
    description: `Query AutoSwapLimit contract for order details and configuration.

Get detailed information about specific orders, contract configuration, router settings, and balances.
Useful for monitoring order status and understanding contract parameters.

User Account: ${userAccountId}`,
    
    schema: z.object({
      operation: z.enum([
        AUTOSWAP_LIMIT_OPERATIONS.GET_ORDER_DETAILS,
        AUTOSWAP_LIMIT_OPERATIONS.GET_CONTRACT_CONFIG,
        AUTOSWAP_LIMIT_OPERATIONS.GET_ROUTER_INFO,
        AUTOSWAP_LIMIT_OPERATIONS.GET_CONTRACT_BALANCE,
        AUTOSWAP_LIMIT_OPERATIONS.GET_NEXT_ORDER_ID,
      ]).describe('The query operation to perform'),
      
      orderId: z.number().optional().describe(
        'Order ID to query details for (required for get_order_details operation)'
      ),
      
      network: z.enum(['mainnet', 'testnet']).default(
        (process.env.HEDERA_NETWORK as 'mainnet' | 'testnet') || 'mainnet'
      ).describe('Network to query on'),
    }),
    
    func: async (params: any) => {
      try {
        // Add user account ID
        const fullParams = {
          ...params,
          userAccountId,
        };

        console.log(`📋 Querying AutoSwapLimit: ${params.operation}`);
        if (params.orderId !== undefined) {
          console.log(`📝 Order ID: ${params.orderId}`);
        }

        const result = await getAutoSwapLimitQuery(client, context, fullParams);
        
        console.log(`✅ AutoSwapLimit query completed: ${params.operation}`);
        return JSON.stringify(result, null, 2);
        
      } catch (error: any) {
        console.error(`❌ AutoSwapLimit query error:`, error);
        
        // Fix the type safety issue by properly typing the network access
        const network = (params.network || 'mainnet') as 'mainnet' | 'testnet';
        
        return JSON.stringify({
          success: false,
          error: `Error querying AutoSwapLimit: ${error.message}`,
          operation: params.operation,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            issue: 'Query operation failed',
            possible_causes: [
              'Invalid order ID provided',
              'Contract not available on network',
              'Network connectivity issues',
              'Invalid query parameters'
            ],
            next_steps: [
              'Check order ID is valid',
              'Verify network connectivity',
              'Check contract deployment status',
              'Try with different parameters'
            ]
          },
          contractInfo: {
            contract_id: AUTOSWAP_LIMIT_CONTRACTS[network].CONTRACT_ID,
            network: network,
          }
        }, null, 2);
      }
    },
  });
}; 