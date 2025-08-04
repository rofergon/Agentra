// SaucerSwap Router V2 Contract Client - Direct contract interaction for token swaps
// Based on UniswapV2Router02 with HBAR/WHBAR support for actual trading

import * as ethers from 'ethers';
import { ContractId, ContractExecuteTransaction, ContractFunctionParameters, Hbar, AccountId, Client } from '@hashgraph/sdk';
import type { Context } from '../../../configuration';
import { handleTransaction } from '../../../strategies/tx-mode-strategy';
import { z } from 'zod';
import Long from 'long';

// Import QuoterV2 functionality for getting real quotes
import { 
  SAUCERSWAP_V2_CONTRACTS, 
  SAUCERSWAP_V2_QUOTER_ABI,
  encodePath,
  toEvmAddressFromId,
  tokenIdToEvmAddress
} from '../SaucerSwap-Quote/contract-client';

// ===== ABI for UniswapV2Router02 =====
export const UNISWAP_V2_ROUTER02_ABI = [
  // Core swap functions
  "function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[] amounts)",
  "function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] path, address to, uint deadline) external returns (uint[] amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[] amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[] amounts)",
  "function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] path, address to, uint deadline) external returns (uint[] amounts)",
  
  // Add liquidity functions (for future use)
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  
  // Utility functions
  "function getAmountsOut(uint amountIn, address[] path) external view returns (uint[] amounts)",
  "function getAmountsIn(uint amountOut, address[] path) external view returns (uint[] amounts)",
  "function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB)",
  
  // Factory and WETH addresses
  "function factory() external pure returns (address)",
  "function WETH() external pure returns (address)"
];

// ===== Network Configuration =====
export type HederaNet = "mainnet" | "testnet";

export const SAUCERSWAP_V2_ROUTER_CONTRACTS = {
  mainnet: {
    ROUTER_ID: "0.0.3045981",           // UniswapV2Router02 
    ROUTER_EVM: "0x00000000000000000000000000000000002e7a5d",
    WHBAR_TOKEN_ID: "0.0.1456986",     // WHBAR TOKEN 
    SAUCE_TOKEN_ID: "0.0.731861",      // SAUCE TOKEN mainnet
    SAUCE_EVM: "0x00000000000000000000000000000000000b2ad5",
    RPC_URL: "https://mainnet.hashio.io/api",
  },
  testnet: {
    ROUTER_ID: "0.0.19264",           // UniswapV2Router02 testnet (proxy)
    ROUTER_EVM: "0x0000000000000000000000000000000000004b40", 
    WHBAR_TOKEN_ID: "0.0.15058",       // WHBAR TOKEN testnet (from official docs)
    SAUCE_TOKEN_ID: "0.0.1183558",     // SAUCE TOKEN testnet (correct from official docs)
    SAUCE_EVM: "0x0000000000000000000000000000000000120f46",
    RPC_URL: "https://testnet.hashio.io/api",
  },
} as const;

// ===== Helper Functions =====
// Note: toEvmAddressFromId and tokenIdToEvmAddress are imported from SaucerSwap-Quote

// ===== Tool Configuration =====
export const SAUCERSWAP_ROUTER_SWAP_TOOL = 'saucerswap_router_swap_tool';

export const SAUCERSWAP_ROUTER_SWAP_OPERATIONS = {
  SWAP_EXACT_HBAR_FOR_TOKENS: 'swap_exact_hbar_for_tokens',
  SWAP_EXACT_TOKENS_FOR_HBAR: 'swap_exact_tokens_for_hbar', 
  SWAP_EXACT_TOKENS_FOR_TOKENS: 'swap_exact_tokens_for_tokens',
  SWAP_HBAR_FOR_EXACT_TOKENS: 'swap_hbar_for_exact_tokens',
  SWAP_TOKENS_FOR_EXACT_HBAR: 'swap_tokens_for_exact_hbar',
  SWAP_TOKENS_FOR_EXACT_TOKENS: 'swap_tokens_for_exact_tokens',
} as const;

export const SAUCERSWAP_ROUTER_SWAP_CONFIG = {
  DEFAULT_SLIPPAGE_PERCENT: 2.0, // 2.0% default slippage (more realistic for mainnet)
  MAX_SLIPPAGE_PERCENT: 50,       // 50% max slippage allowed
  DEADLINE_BUFFER_SECONDS: 600,   // 10 minutes deadline
  GAS_LIMIT: 2_000_000,          // 2M gas limit for swaps
} as const;

// ===== Parameters Schema =====
export const saucerswapRouterSwapParameters = (context: Context = {}) => {
  return z.object({
    operation: z.enum([
      SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_HBAR_FOR_TOKENS,
      SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_TOKENS_FOR_HBAR,
      SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_TOKENS_FOR_TOKENS,
      SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_HBAR_FOR_EXACT_TOKENS,
      SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_TOKENS_FOR_EXACT_HBAR,
      SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_TOKENS_FOR_EXACT_TOKENS,
    ]).describe('The swap operation to perform'),
    
    amountIn: z.string().optional().describe(
      'Exact input amount in smallest unit (required for exact input swaps). For HBAR: use 8 decimals (e.g., "100000000" = 1 HBAR)'
    ),
    
    amountOut: z.string().optional().describe(
      'Exact output amount in smallest unit (required for exact output swaps). For tokens: check token decimals'
    ),
    
    tokenPath: z.array(z.string()).min(2).describe(
      'Array of token IDs representing swap path. Use "HBAR" for native HBAR. Example: ["HBAR", "0.0.731861"] for HBAR to SAUCE'
    ),
    
    slippagePercent: z.number().min(0.01).max(50).default(2.0).describe(
      'Maximum acceptable slippage as percentage (2.0 = 2.0%). Used to calculate minimum output or maximum input'
    ),
    
    deadline: z.number().optional().describe(
      'Unix timestamp deadline for the swap. If not provided, defaults to current time + 10 minutes'
    ),
    
    network: z.enum(['mainnet', 'testnet']).default(
      (process.env.HEDERA_NETWORK as 'mainnet' | 'testnet') || 'mainnet'
    ).describe(
      'Network to execute swap on (defaults to HEDERA_NETWORK from .env)'
    ),

    recipientAccountId: z.string().optional().describe(
      'Account ID to receive the swapped tokens. If not provided, uses the transaction signer account'
    ),
  });
};

// ===== Swap Result Interfaces =====
interface SwapSuccess {
  success: true;
  operation: string;
  network: HederaNet;
  timestamp: string;
  swap: {
    input: {
      token: string;
      amount: string;
      formatted: string;
    };
    output: {
      token: string;
      estimatedAmount: string;
      minimumAmount: string;
      formatted: string;
    };
    path: string[];
    slippage: string;
    deadline: number;
    gasLimit: number;
  };
  transaction: {
    to: string;
    value?: string;
    data: string;
    gasLimit: number;
  };
  contract: {
    id: string;
    evmAddress: string;
  };
  source: string;
  bytes?: any; // For WebSocket agent transaction bytes
  result?: any; // For transaction result
  message?: string; // For user feedback
}

interface SwapError {
  success: false;
  error: string;
  operation: string;
  timestamp: string;
  troubleshooting: {
    issue: string;
    possible_causes: string[];
    next_steps: string[];
  };
  contractInfo: {
    router_contract: string;
    network: string;
    rpc_endpoint: string;
  };
}

type SwapResult = SwapSuccess | SwapError;

/**
 * Get real-time quote from QuoterV2 for accurate amountOut calculation
 */
async function getRealTimeQuote(
  tokenPath: string[],
  amountIn: string,
  network: HederaNet
): Promise<string> {
  try {
    const config = SAUCERSWAP_V2_CONTRACTS[network];
    const quoterEvmAddress = toEvmAddressFromId(config.QUOTER_V2_ID);

    // Convert token path to EVM addresses and encode
    const pathAddresses = tokenPath.map(tokenId => tokenIdToEvmAddress(tokenId, network));
    const fees = [3000]; // Use 0.3% fee tier (most common)
    const encodedPath = encodePath(pathAddresses, fees);

    console.log(`🔍 Getting real-time quote for ${amountIn} of ${tokenPath[0]} → ${tokenPath[1]}`);

    // Create JSON-RPC provider
    const provider = new ethers.JsonRpcProvider(config.RPC_URL, undefined, { 
      batchMaxCount: 1 
    });

    // Create contract interface for QuoterV2
    const contractInterface = new ethers.Interface(SAUCERSWAP_V2_QUOTER_ABI);
    
    // Prepare call data for exact input quote
    const callData = contractInterface.encodeFunctionData('quoteExactInput', [
      encodedPath,
      amountIn
    ]);

    // Execute eth_call
    const rawResult = await provider.call({
      to: quoterEvmAddress,
      data: callData
    });

    // Decode the result
    const decodedResult = contractInterface.decodeFunctionResult('quoteExactInput', rawResult);
    const amountOut = decodedResult[0].toString();

    console.log(`💱 Real-time quote: ${amountIn} ${tokenPath[0]} → ${amountOut} ${tokenPath[1]}`);
    return amountOut;

  } catch (error: any) {
    console.error('❌ Error getting real-time quote:', error);
    // Fallback to conservative estimate if quote fails
    console.log('⚠️ Using conservative fallback estimate');
    return Math.floor(Number(amountIn) * 0.95).toString(); // 5% conservative estimate
  }
}

/**
 * Get the real EVM address for a Hedera account using Mirror Node API
 * Returns the EVM Address Alias if available, otherwise falls back to Account Number Alias
 */
const getUserEvmAddress = async (
  client: Client,
  accountId: string,
): Promise<string> => {
  try {
    console.log(`🔍 Querying Mirror Node for account ${accountId}...`);
    
    // Use Mirror Node API to get the real EVM address
    const mirrorNodeUrl = process.env.HEDERA_NETWORK === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
    
    const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}`);
    
    if (!response.ok) {
      throw new Error(`Mirror Node API error: ${response.status} ${response.statusText}`);
    }
    
    const accountData = await response.json();
    
    // Check if the account has a real EVM address
    if (accountData.evm_address && accountData.evm_address !== '0x0000000000000000000000000000000000000000') {
      const evmAddress = accountData.evm_address;
      console.log(`✅ Found real EVM Address from Mirror Node: ${evmAddress}`);
      return evmAddress;
    }
    
    console.log(`🔄 Mirror Node response:`, {
      account: accountData.account,
      evm_address: accountData.evm_address,
      alias: accountData.alias
    });
    
  } catch (error) {
    console.error(`❌ Error querying Mirror Node for ${accountId}:`, error);
  }
  
  // Fallback to account number alias
  const fallbackAddress = AccountId.fromString(accountId).toSolidityAddress();
  console.log(`⚠️ Fallback to Account Number Alias: 0x${fallbackAddress}`);
  
  return `0x${fallbackAddress}`;
};

// ===== Main Swap Function =====
export async function getSaucerswapRouterSwap(
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof saucerswapRouterSwapParameters>>
): Promise<SwapResult> {
  try {
    console.log(`🔄 SaucerSwap Router swap - ${params.operation} on ${params.network}`);
    
    // Parameter validation
    const validation = validateSwapParameters(params);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error!,
        operation: params.operation,
        timestamp: new Date().toISOString(),
        troubleshooting: {
          issue: 'Invalid parameters',
          possible_causes: ['Missing required parameters', 'Invalid token format', 'Invalid amounts'],
          next_steps: [
            'Check that amountIn is provided for exact input swaps',
            'Check that amountOut is provided for exact output swaps', 
            'Verify token IDs are in correct format (0.0.xxxxx or HBAR)',
            'Ensure amounts are in smallest unit (8 decimals for HBAR)'
          ]
        },
        contractInfo: {
          router_contract: SAUCERSWAP_V2_ROUTER_CONTRACTS[params.network].ROUTER_ID,
          network: params.network,
          rpc_endpoint: SAUCERSWAP_V2_ROUTER_CONTRACTS[params.network].RPC_URL
        }
      };
    }

    // Get network configuration
    const networkConfig = SAUCERSWAP_V2_ROUTER_CONTRACTS[params.network];
    const userAccountId = params.recipientAccountId || context.accountId;
    
    if (!userAccountId) {
      throw new Error('User account ID is required either in params or context');
    }

    console.log(`📍 Swap path: ${params.tokenPath.join(' → ')}`);
    console.log(`🏦 Account: ${userAccountId}`);
    console.log(`🏢 Router Contract: ${networkConfig.ROUTER_ID}`);

    // Get the real EVM address for the user
    const recipientAddress = await getUserEvmAddress(client, userAccountId);
    console.log(`🔄 User EVM Address (recipient): ${recipientAddress}`);

    // Calculate deadline (current time + buffer)
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + SAUCERSWAP_ROUTER_SWAP_CONFIG.DEADLINE_BUFFER_SECONDS;
    
    // Create the actual Hedera transaction based on operation
    const result = await createSwapTransaction(
      client,
      context,
      params,
      networkConfig,
      recipientAddress,
      deadline
    );

    return result;

  } catch (error: any) {
    console.error('❌ SaucerSwap Router swap error:', error);
    
    return {
      success: false,
      error: `Error preparing SaucerSwap Router swap: ${error.message}`,
      operation: params.operation,
      timestamp: new Date().toISOString(),
      troubleshooting: {
        issue: 'Contract interaction failed',
        possible_causes: [
          'Network connectivity issues',
          'Invalid token addresses in path',
          'Insufficient liquidity in pools',
          'Router contract not available',
          'Account not properly configured'
        ],
        next_steps: [
          'Check internet connection',
          'Verify token IDs exist on the network',
          'Try with different slippage tolerance',
          'Check SaucerSwap interface for pool availability',
          'Ensure account has sufficient balance'
        ]
      },
      contractInfo: {
        router_contract: SAUCERSWAP_V2_ROUTER_CONTRACTS[params.network].ROUTER_ID,
        network: params.network,
        rpc_endpoint: SAUCERSWAP_V2_ROUTER_CONTRACTS[params.network].RPC_URL
      }
    };
  }
}

// ===== Helper Functions =====
function validateSwapParameters(params: any): { valid: boolean; error?: string } {
  // Check operation-specific parameter requirements
  const exactInputOps = [
    SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_HBAR_FOR_TOKENS,
    SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_TOKENS_FOR_HBAR,
    SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_TOKENS_FOR_TOKENS,
  ];
  
  const exactOutputOps = [
    SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_HBAR_FOR_EXACT_TOKENS,
    SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_TOKENS_FOR_EXACT_HBAR,
    SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_TOKENS_FOR_EXACT_TOKENS,
  ];

  if (exactInputOps.includes(params.operation) && !params.amountIn) {
    return { valid: false, error: 'amountIn is required for exact input swap operations' };
  }
  
  if (exactOutputOps.includes(params.operation) && !params.amountOut) {
    return { valid: false, error: 'amountOut is required for exact output swap operations' };
  }

  // Validate token path
  if (!params.tokenPath || params.tokenPath.length < 2) {
    return { valid: false, error: 'tokenPath must contain at least 2 tokens' };
  }

  return { valid: true };
}

/**
 * Create actual Hedera transaction for token swap
 */
async function createSwapTransaction(
  client: Client,
  context: Context,
  params: any,
  networkConfig: any,
  recipientAddress: string,
  deadline: number
): Promise<SwapResult> {
  try {
    // Calculate slippage protection
    const slippageMultiplier = (100 - params.slippagePercent) / 100;
    
    // Convert token path to EVM addresses for contract call
    const path = params.tokenPath.map((tokenId: string) => tokenIdToEvmAddress(tokenId, params.network));
    console.log(`📍 EVM path: ${path.join(' → ')}`);

    // Prepare function parameters based on operation type
    let functionName: string;
    let functionParameters: ContractFunctionParameters;
    let payableAmount: Hbar = new Hbar(0);

    // Get real-time quote for accurate amountOutMin calculation
    const expectedAmountOut = await getRealTimeQuote(params.tokenPath, params.amountIn, params.network);
    const amountOutMin = Long.fromString(Math.floor(Number(expectedAmountOut) * slippageMultiplier).toString());
    
    console.log(`📊 Expected output: ${expectedAmountOut} ${params.tokenPath[1]}`);
    console.log(`📊 Minimum output (${params.slippagePercent}% slippage): ${amountOutMin.toString()} ${params.tokenPath[1]}`);

    switch (params.operation) {
      case SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_HBAR_FOR_TOKENS:
        {
          const amountIn = Long.fromString(params.amountIn);
          
          functionName = 'swapExactETHForTokens';
          functionParameters = new ContractFunctionParameters()
            .addUint256(amountOutMin) // amountOutMin (calculated from real quote + slippage)
            .addAddressArray(path)     // path
            .addAddress(recipientAddress) // to
            .addUint256(Long.fromNumber(deadline)); // deadline
            
          payableAmount = Hbar.fromTinybars(amountIn);
          console.log(`💰 Swapping ${Hbar.fromTinybars(amountIn).toString()} HBAR for min ${amountOutMin.toString()} tokens`);
        }
        break;

      case SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_TOKENS_FOR_HBAR:
        {
          const amountIn = Long.fromString(params.amountIn);
          
          functionName = 'swapExactTokensForETH';
          functionParameters = new ContractFunctionParameters()
            .addUint256(amountIn)      // amountIn
            .addUint256(amountOutMin)  // amountOutMin (calculated from real quote + slippage)
            .addAddressArray(path)     // path
            .addAddress(recipientAddress) // to
            .addUint256(Long.fromNumber(deadline)); // deadline
            
          console.log(`🪙 Swapping ${params.amountIn} tokens for min ${amountOutMin.toString()} HBAR`);
        }
        break;

      case SAUCERSWAP_ROUTER_SWAP_OPERATIONS.SWAP_EXACT_TOKENS_FOR_TOKENS:
        {
          const amountIn = Long.fromString(params.amountIn);
          
          functionName = 'swapExactTokensForTokens';
          functionParameters = new ContractFunctionParameters()
            .addUint256(amountIn)      // amountIn
            .addUint256(amountOutMin)  // amountOutMin (calculated from real quote + slippage)
            .addAddressArray(path)     // path
            .addAddress(recipientAddress) // to
            .addUint256(Long.fromNumber(deadline)); // deadline
            
          console.log(`🔄 Swapping ${params.amountIn} tokens for min ${amountOutMin.toString()} tokens`);
        }
        break;

      default:
        throw new Error(`Unsupported swap operation: ${params.operation}`);
    }

    // Create the contract execute transaction
    const contractId = ContractId.fromString(networkConfig.ROUTER_ID);
    
    const tx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(SAUCERSWAP_ROUTER_SWAP_CONFIG.GAS_LIMIT)
      .setFunction(functionName, functionParameters);

    // Add payable amount for HBAR swaps
    if (payableAmount.toTinybars().gt(0)) {
      tx.setPayableAmount(payableAmount);
    }

    console.log(`🔗 Contract call: ${functionName} on ${networkConfig.ROUTER_ID}`);
    console.log(`⛽ Gas limit: ${SAUCERSWAP_ROUTER_SWAP_CONFIG.GAS_LIMIT}`);
    console.log(`💰 Payable amount: ${payableAmount.toString()}`);

    // Execute transaction using handleTransaction (supports RETURN_BYTES mode)
    const result = await handleTransaction(tx, client, context);

    // In RETURN_BYTES mode, log preparation instead of completion
    if (context.mode === 'returnBytes') {
      console.log(`🔗 SaucerSwap swap transaction prepared for signature`);
    } else {
      console.log(`✅ SaucerSwap swap completed successfully`);
    }

    // Build successful response with real values
    const swapResult: SwapSuccess = {
      success: true,
      operation: params.operation,
      network: params.network,
      timestamp: new Date().toISOString(),
      swap: {
        input: {
          token: params.tokenPath[0],
          amount: params.amountIn,
          formatted: `${params.amountIn} ${params.tokenPath[0]}`,
        },
        output: {
          token: params.tokenPath[params.tokenPath.length - 1],
          estimatedAmount: expectedAmountOut,
          minimumAmount: amountOutMin.toString(),
          formatted: `~${expectedAmountOut} ${params.tokenPath[params.tokenPath.length - 1]} (min: ${amountOutMin.toString()})`,
        },
        path: params.tokenPath,
        slippage: `${params.slippagePercent}%`,
        deadline,
        gasLimit: SAUCERSWAP_ROUTER_SWAP_CONFIG.GAS_LIMIT,
      },
      transaction: {
        to: networkConfig.ROUTER_EVM,
        value: payableAmount.toTinybars().gt(0) ? payableAmount.toString() : '0',
        data: functionName,
        gasLimit: SAUCERSWAP_ROUTER_SWAP_CONFIG.GAS_LIMIT,
      },
      contract: {
        id: networkConfig.ROUTER_ID,
        evmAddress: networkConfig.ROUTER_EVM,
      },
      source: 'SaucerSwap V2 Router (UniswapV2Router02)',
    };

    // If result contains bytes, add them to the response for WebSocket agent
    if (result && typeof result === 'object' && 'bytes' in result) {
      return {
        ...swapResult,
        bytes: result.bytes, // Put bytes at top level for WebSocket agent
        result,
        message: context.mode === 'returnBytes' 
          ? `SaucerSwap swap transaction ready for signature (${params.tokenPath.join(' → ')})`
          : `Successfully executed SaucerSwap swap: ${params.tokenPath.join(' → ')}`,
      };
    }

    return {
      ...swapResult,
      result,
      message: `Successfully prepared SaucerSwap swap: ${params.tokenPath.join(' → ')}`,
    };

  } catch (error: any) {
    console.error('❌ Error creating swap transaction:', error);
    throw error;
  }
}

// Default tool function for toolkit integration
export default function saucerswapRouterSwapTool(client: Client, context: Context = {}) {
  return {
    name: SAUCERSWAP_ROUTER_SWAP_TOOL,
    description: 'Execute token swaps on SaucerSwap using UniswapV2Router02 contract',
    parameters: saucerswapRouterSwapParameters(context),
    func: async (params: z.infer<ReturnType<typeof saucerswapRouterSwapParameters>>) => {
      const result = await getSaucerswapRouterSwap(client, context, params);
      return JSON.stringify(result, null, 2);
    },
  };
}