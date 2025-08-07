// AutoSwapLimit Orders Query Client - usando ethers.js con RPC público
// Consulta las órdenes activas sin necesidad de operador Hedera

import { AccountId, Hbar } from '@hashgraph/sdk';
import { ethers } from 'ethers';
import type { Context } from '../../../configuration';
import type { Tool } from '../../../tools';
import { z } from 'zod';

// ===== RPC Configuration =====
const HEDERA_RPC_ENDPOINTS = {
  mainnet: 'https://mainnet.hashio.io/api',
  testnet: 'https://testnet.hashio.io/api',
  previewnet: 'https://previewnet.hashio.io/api'
} as const;

// ===== Contract Configuration =====
export const AUTOSWAP_LIMIT_CONTRACTS = {
  mainnet: {
    CONTRACT_ID: "0.0.6506134",
    CONTRACT_EVM: "0x0000000000000000000000000000000000634696",
  },
  testnet: {
    CONTRACT_ID: "0.0.6506134",
    CONTRACT_EVM: "0x0000000000000000000000000000000000634696",
  },
} as const;

// ===== Contract ABI =====
const AUTOSWAP_LIMIT_ABI = [
  "function getUserOrders(address user) view returns (uint256[])",
  "function getOrderDetails(uint256 orderId) view returns (tuple(address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 triggerPrice, address owner, bool isActive, uint256 expirationTime, bool isExecuted))"
];

// ===== Token Information =====
const TOKEN_INFO = {
  testnet: {
    SAUCE: {
      id: "0.0.1183558",
      evm: "0x0000000000000000000000000000000000120f46",
      symbol: "SAUCE",
      name: "SaucerSwap",
      decimals: 6
    },
    WHBAR: {
      id: "0.0.1456986", 
      evm: "0x0000000000000000000000000000000000163a5a",
      symbol: "WHBAR",
      name: "Wrapped HBAR",
      decimals: 8
    },
    USDC: {
      id: "0.0.456858",
      evm: "0x000000000000000000000000000000000006f89a",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6
    }
  },
  mainnet: {
    SAUCE: {
      id: "0.0.731861",
      evm: "0x00000000000000000000000000000000000b2ad5",
      symbol: "SAUCE", 
      name: "SaucerSwap",
      decimals: 6
    }
  }
} as const;

// ===== Utility Functions =====
function accountIdToEvmAddress(accountId: string): string {
  try {
    const account = AccountId.fromString(accountId);
    return account.toSolidityAddress();
  } catch (error) {
    throw new Error(`Invalid account ID format: ${accountId}`);
  }
}

function getRpcEndpoint(): string {
  const network = process.env.HEDERA_NETWORK || 'testnet';
  return HEDERA_RPC_ENDPOINTS[network as keyof typeof HEDERA_RPC_ENDPOINTS] || HEDERA_RPC_ENDPOINTS.testnet;
}

function getNetworkConfig() {
  const network = process.env.HEDERA_NETWORK || 'testnet';
  return AUTOSWAP_LIMIT_CONTRACTS[network as keyof typeof AUTOSWAP_LIMIT_CONTRACTS] || AUTOSWAP_LIMIT_CONTRACTS.testnet;
}

function identifyTokenByEvmAddress(evmAddress: string): string {
  const network = process.env.HEDERA_NETWORK || 'testnet';
  const tokenInfo = TOKEN_INFO[network as keyof typeof TOKEN_INFO] || TOKEN_INFO.testnet;
  
  const lowerEvmAddress = evmAddress.toLowerCase();
  
  for (const [tokenName, info] of Object.entries(tokenInfo)) {
    if ((info as any).evm.toLowerCase() === lowerEvmAddress) {
      return tokenName;
    }
  }
  
  return `Unknown (${evmAddress})`;
}

function createProvider(): ethers.JsonRpcProvider {
  const rpcEndpoint = getRpcEndpoint();
  const network = process.env.HEDERA_NETWORK || 'testnet';
  
  // Configure network for Hedera 
  // Testnet: chainId 296, Mainnet: chainId 295
  const networkConfig = {
    name: `hedera-${network}`,
    chainId: network === 'mainnet' ? 295 : 296
    // ENS is automatically disabled when ensAddress is not provided
  };
  
  return new ethers.JsonRpcProvider(rpcEndpoint, networkConfig);
}

function createContract(): ethers.Contract {
  const networkConfig = getNetworkConfig();
  const provider = createProvider();
  
  // Ensure the contract address is explicitly a valid hex address to avoid ENS resolution
  const contractAddress = ethers.getAddress(networkConfig.CONTRACT_EVM);
  
  return new ethers.Contract(contractAddress, AUTOSWAP_LIMIT_ABI, provider);
}

// ===== Parameters Schema =====
export const autoswapLimitOrdersQueryParameters = (context: Context = {}) => {
  return z.object({
    operation: z.enum([
      AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_USER_ORDERS,
      AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_ORDER_DETAILS, 
      AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_USER_ORDERS_WITH_DETAILS,
    ]).describe('Query operation to perform'),
    
    userAccountId: z.string().optional().describe(
      'User account ID in format 0.0.1234 (optional - will use current user if not provided)'
    ),
    
    orderId: z.number().optional().describe(
      'Specific order ID to query details for (required only for get_order_details operation)'
    ),
  });
};

// ===== Response Types =====
interface OrderDetails {
  orderId: number;
  tokenOut: string;
  tokenOutName: string;
  amountIn: string;
  amountInHBAR: string;
  minAmountOut: string;
  triggerPrice: string;
  triggerPriceUSDC: string;
  owner: string;
  isActive: boolean;
  expirationTime: number;
  expirationDate: string;
  isExecuted: boolean;
  canExecute?: boolean;
  canExecuteReason?: string;
}

interface QuerySuccess {
  success: true;
  operation: string;
  network: string;
  timestamp: string;
  data: {
    userAccount: string;
    userEvmAddress: string;
    totalOrders?: number;
    activeOrders?: number;
    expiredOrders?: number;
    executedOrders?: number;
    orders?: OrderDetails[];
    orderDetails?: OrderDetails;
    message?: string;
    note?: string;
  };
  contract: {
    id: string;
    address: string;
  };
}

interface QueryError {
  success: false;
  error: string;
  operation: string;
  timestamp: string;
}

type QueryResponse = QuerySuccess | QueryError;

// ===== Operations =====
export const AUTOSWAP_LIMIT_ORDERS_OPERATIONS = {
  GET_USER_ORDERS: 'get_user_orders',
  GET_ORDER_DETAILS: 'get_order_details', 
  GET_USER_ORDERS_WITH_DETAILS: 'get_user_orders_with_details',
} as const;

export const AUTOSWAP_LIMIT_ORDERS_CONFIG = {
  TOOL_NAME: 'AutoSwapLimit Orders Query',
  DESCRIPTION: 'Query user limit orders and their details on AutoSwapLimit contract',
  OPERATIONS: AUTOSWAP_LIMIT_ORDERS_OPERATIONS,
} as const;

export const AUTOSWAP_LIMIT_ORDERS_QUERY_TOOL = 'autoswap_limit_orders_query_tool';

// ===== Core Query Functions =====

async function getUserOrdersViaRPC(
  userAccountId: string,
  networkConfig: any
): Promise<QuerySuccess> {
  console.log(`📋 Getting orders via RPC for user: ${userAccountId}`);
  
  const userEvmAddress = accountIdToEvmAddress(userAccountId);
  console.log(`🔄 Converted to EVM address: ${userEvmAddress}`);
  // Ensure address is valid and normalized to avoid ENS resolution issues
  const validUserAddress = ethers.getAddress(userEvmAddress);
  
  try {
    const contract = createContract();
    const orderIds: bigint[] = await contract.getUserOrders(validUserAddress);
    
    console.log(`✅ Found ${orderIds.length} orders for user`);
    
    return {
      success: true,
      operation: AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_USER_ORDERS,
      network: process.env.HEDERA_NETWORK || 'testnet',
      timestamp: new Date().toISOString(),
      data: {
        userAccount: userAccountId,
        userEvmAddress: userEvmAddress,
        totalOrders: orderIds.length,
        activeOrders: orderIds.length,
        orders: orderIds.map(id => ({
                      orderId: Number(id),
          tokenOut: '',
          tokenOutName: '',
          amountIn: '',
          amountInHBAR: '',
          minAmountOut: '',
          triggerPrice: '',
          triggerPriceUSDC: '0.0000',
          owner: userEvmAddress,
          isActive: true,
          expirationTime: 0,
          expirationDate: '',
          isExecuted: false
        })),
        note: `Found ${orderIds.length} order IDs via RPC. Use get_user_orders_with_details for complete information.`
      },
      contract: {
        id: networkConfig.CONTRACT_ID,
        address: networkConfig.CONTRACT_EVM,
      },
    };
  } catch (error: any) {
    console.error(`❌ Error in getUserOrdersViaRPC: ${error.message}`);
    throw error;
  }
}

async function getOrderDetailsViaRPC(
  orderId: number,
  userAccountId: string,
  networkConfig: any
): Promise<QuerySuccess> {
  console.log(`🔍 Getting details via RPC for order: ${orderId}`);
  
  try {
    const contract = createContract();
    
    const result = await contract.getOrderDetails(orderId);
    const [tokenOut, amountIn, minAmountOut, triggerPrice, owner, isActive, expirationTime, isExecuted] = result;
    
    console.log(`✅ Retrieved order details for order ${orderId}`);
    
    let canExecute = false;
    let canExecuteReason = 'Unknown execution status';
    
    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const expired = Number(expirationTime) < currentTime;
      const [canExec, reason] = expired 
        ? [false, 'Order has expired']
        : isActive && !isExecuted 
          ? [true, 'Order can be executed']
          : [false, 'Order is not active or already executed'];
      
      canExecute = canExec;
      canExecuteReason = reason;
    } catch (error) {
      canExecuteReason = 'Unable to check execution status';
    }

    const orderDetails: OrderDetails = {
      orderId,
      tokenOut,
      tokenOutName: identifyTokenByEvmAddress(tokenOut),
      amountIn: amountIn.toString(),
      amountInHBAR: Hbar.fromTinybars(amountIn.toString()).toString(),
      minAmountOut: minAmountOut.toString(),
      triggerPrice: triggerPrice.toString(),
      triggerPriceUSDC: (Number(triggerPrice) / 1e10).toFixed(4), // Convert from wei to USDC (correct decimals)
      owner,
      isActive,
              expirationTime: Number(expirationTime),
        expirationDate: new Date(Number(expirationTime) * 1000).toISOString(),
      isExecuted,
      canExecute,
      canExecuteReason,
    };

    return {
      success: true,
      operation: AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_ORDER_DETAILS,
      network: process.env.HEDERA_NETWORK || 'testnet',
      timestamp: new Date().toISOString(),
      data: {
        userAccount: userAccountId,
        userEvmAddress: accountIdToEvmAddress(userAccountId),
        orderDetails
      },
      contract: {
        id: networkConfig.CONTRACT_ID,
        address: networkConfig.CONTRACT_EVM,
      },
    };
  } catch (error: any) {
    console.error(`❌ Error in getOrderDetailsViaRPC: ${error.message}`);
    throw error;
  }
}

async function getUserOrdersWithDetailsViaRPC(
  userAccountId: string,
  networkConfig: any
): Promise<QuerySuccess> {
  console.log(`📋 Getting user orders with details via RPC for: ${userAccountId}`);
  
  const userEvmAddress = accountIdToEvmAddress(userAccountId);
  // Ensure address is valid and normalized to avoid ENS resolution issues
  const validUserAddress = ethers.getAddress(userEvmAddress);
  
  try {
    const contract = createContract();
    const orderIds: bigint[] = await contract.getUserOrders(validUserAddress);
    
    console.log(`✅ Found ${orderIds.length} orders for user`);
    
    if (orderIds.length === 0) {
      return {
        success: true,
        operation: AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_USER_ORDERS_WITH_DETAILS,
        network: process.env.HEDERA_NETWORK || 'testnet',
        timestamp: new Date().toISOString(),
        data: {
          userAccount: userAccountId,
          userEvmAddress: validUserAddress,
          totalOrders: 0,
          activeOrders: 0,
          expiredOrders: 0,
          executedOrders: 0,
          orders: [],
          message: 'No limit orders found for this user.'
        },
        contract: {
          id: networkConfig.CONTRACT_ID,
          address: networkConfig.CONTRACT_EVM,
        },
      };
    }

    const orders: OrderDetails[] = [];
    let activeOrders = 0;
    let expiredOrders = 0;
    let executedOrders = 0;

    for (let i = 0; i < orderIds.length; i++) {
      try {
        const orderId = Number(orderIds[i]);
        console.log(`🔍 Getting details for order ID: ${orderId}`);
        
        const result = await contract.getOrderDetails(orderId);
        const [tokenOut, amountIn, minAmountOut, triggerPrice, owner, isActive, expirationTime, isExecuted] = result;
        
        const currentTime = Math.floor(Date.now() / 1000);
        const expired = Number(expirationTime) < currentTime;
        
        let canExecute = false;
        let canExecuteReason = 'Unknown execution status';
        
        if (expired) {
          expiredOrders++;
          canExecute = false;
          canExecuteReason = 'Order has expired';
        } else if (isExecuted) {
          executedOrders++;
          canExecute = false;
          canExecuteReason = 'Order already executed';
        } else if (isActive) {
          activeOrders++;
          canExecute = true;
          canExecuteReason = 'Order can be executed';
        } else {
          canExecute = false;
          canExecuteReason = 'Order is not active';
        }

        const orderDetails: OrderDetails = {
          orderId,
          tokenOut,
          tokenOutName: identifyTokenByEvmAddress(tokenOut),
          amountIn: amountIn.toString(),
          amountInHBAR: Hbar.fromTinybars(amountIn.toString()).toString(),
          minAmountOut: minAmountOut.toString(),
          triggerPrice: triggerPrice.toString(),
        triggerPriceUSDC: (Number(triggerPrice) / 1e10).toFixed(4), // Convert from wei to USDC (correct decimals)
          owner,
          isActive,
                  expirationTime: Number(expirationTime),
        expirationDate: new Date(Number(expirationTime) * 1000).toISOString(),
          isExecuted,
          canExecute,
          canExecuteReason,
        };

        orders.push(orderDetails);
      } catch (error) {
        console.log(`⏭️ Error getting details for order ${Number(orderIds[i])}: ${(error as any).message}`);
        continue;
      }
    }

    return {
      success: true,
      operation: AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_USER_ORDERS_WITH_DETAILS,
      network: process.env.HEDERA_NETWORK || 'testnet',
      timestamp: new Date().toISOString(),
      data: {
        userAccount: userAccountId,
        userEvmAddress: validUserAddress,
        totalOrders: orderIds.length,
        activeOrders,
        expiredOrders,
        executedOrders,
        orders,
        message: `Retrieved ${orders.length} of ${orderIds.length} orders with details.`
      },
      contract: {
        id: networkConfig.CONTRACT_ID,
        address: networkConfig.CONTRACT_EVM,
      },
    };
  } catch (error: any) {
    console.error(`❌ Error in getUserOrdersWithDetailsViaRPC: ${error.message}`);
    throw error;
  }
}

// ===== Main Query Function =====
export async function getAutoSwapLimitOrdersQuery(
  client: any,
  context: Context,
  params: any,
  userAccountId: string
): Promise<QueryResponse> {
  const { operation, orderId } = params;
  const targetAccountId = params.userAccountId || userAccountId;
  
  console.log(`🔍 AutoSwapLimit Orders Query via ethers.js RPC: ${operation}`);
  
  try {
    const networkConfig = getNetworkConfig();
    
    switch (operation) {
      case AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_USER_ORDERS:
        return await getUserOrdersViaRPC(targetAccountId, networkConfig);
        
      case AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_ORDER_DETAILS:
        if (!orderId) {
          throw new Error('orderId is required for get_order_details operation');
        }
        return await getOrderDetailsViaRPC(orderId, targetAccountId, networkConfig);
        
      case AUTOSWAP_LIMIT_ORDERS_OPERATIONS.GET_USER_ORDERS_WITH_DETAILS:
        return await getUserOrdersWithDetailsViaRPC(targetAccountId, networkConfig);
        
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  } catch (error: any) {
    console.error(`❌ Error in AutoSwapLimit orders query: ${error.message}`);
    
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      operation,
      timestamp: new Date().toISOString(),
    };
  }
}

// ===== Tool Export =====
const autoswapLimitOrdersQueryTool = (context: Context): Tool => ({
  name: AUTOSWAP_LIMIT_ORDERS_QUERY_TOOL,
  method: AUTOSWAP_LIMIT_ORDERS_QUERY_TOOL,
  description: `Query AutoSwapLimit contract to get user's limit orders and their details.

Available operations:
- get_user_orders: Get list of order IDs for a user (basic query)
- get_order_details: Get detailed information for a specific order ID
- get_user_orders_with_details: Get all user orders with complete details (recommended)

This tool automatically converts Account IDs (0.0.1234) to EVM addresses for contract queries.
Returns comprehensive order information including status, expiration, and execution ability.`,
  parameters: autoswapLimitOrdersQueryParameters(context),
  execute: async (client: any, context: Context, params: any) => {
    // Get userAccountId from context if available, otherwise use a default
    const userAccountId = context.accountId || params.userAccountId || '';
    return await getAutoSwapLimitOrdersQuery(client, context, params, userAccountId);
  },
});

export default autoswapLimitOrdersQueryTool;