// SaucerSwap Router V2 Contract Client - Direct contract interaction for swap quotes
// Based on SaucerSwap V2 Router using Uniswap v3 style with embedded fees

import * as ethers from 'ethers';
import { ContractId } from '@hashgraph/sdk';
import type { Context } from '../../../configuration';

// ===== ABI for SaucerSwap V2 QuoterV2 =====
export const SAUCERSWAP_V2_QUOTER_ABI = [
  // QuoterV2 functions (read-only via JSON-RPC)
  "function quoteExactInput(bytes path, uint256 amountIn) external view returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
  "function quoteExactOutput(bytes path, uint256 amountOut) external view returns (uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)"
];

// ===== Network Configuration =====
export type HederaNet = "mainnet" | "testnet";

export const SAUCERSWAP_V2_CONTRACTS = {
  mainnet: {
    QUOTER_V2_ID: "0.0.3949424",
    ROUTER_ID: "0.0.3949434",
    WHBAR_TOKEN_ID: "0.0.1456986",  // ✅ WHBAR TOKEN (not contract)
    RPC_URL: "https://mainnet.hashio.io/api",
  },
  testnet: {
    QUOTER_V2_ID: "0.0.1390002",
    ROUTER_ID: "0.0.1414040", 
    WHBAR_TOKEN_ID: "0.0.15057",   // ✅ WHBAR TOKEN for testnet
    RPC_URL: "https://testnet.hashio.io/api",
  },
} as const;

// ===== Helper Functions =====
export function toEvmAddressFromId(id: string): `0x${string}` {
  return ("0x" + ContractId.fromString(id).toSolidityAddress()) as `0x${string}`;
}

// Encode path with fees (Uniswap v3 style)
export function encodePath(tokens: string[], fees: number[]): string {
  if (tokens.length !== fees.length + 1) {
    throw new Error("path/fee lengths do not match");
  }
  const FEE_SIZE = 3; // bytes
  let encoded = "0x";
  for (let i = 0; i < fees.length; i++) {
    encoded += tokens[i].slice(2); // 20 bytes
    encoded += ethers.toBeHex(fees[i], FEE_SIZE).slice(2); // 3 bytes
  }
  encoded += tokens[tokens.length - 1].slice(2);
  return encoded;
}

// Convert Hedera token ID to EVM address
export function tokenIdToEvmAddress(tokenId: string, network: HederaNet): string {
  if (tokenId === "HBAR") {
    // Use WHBAR TOKEN for HBAR in paths (NOT the contract!)
    const whbarTokenId = SAUCERSWAP_V2_CONTRACTS[network].WHBAR_TOKEN_ID;
    return toEvmAddressFromId(whbarTokenId);
  }
  return toEvmAddressFromId(tokenId);
}

// ===== Tool Configuration =====
export const SAUCERSWAP_ROUTER_SWAP_QUOTE_TOOL = 'saucerswap_router_swap_quote_tool';

export const SAUCERSWAP_ROUTER_OPERATIONS = {
  GET_AMOUNTS_OUT: 'get_amounts_out',
  GET_AMOUNTS_IN: 'get_amounts_in',
} as const;

export const SAUCERSWAP_ROUTER_CONFIG = {
  DEFAULT_FEE: 3000, // 0.30% - most common pool fee
  AVAILABLE_FEES: [100, 500, 3000, 10000], // 0.01%, 0.05%, 0.30%, 1.00%
  GAS_LIMIT: 1_000_000,
  DEADLINE_BUFFER_SECONDS: 600, // 10 minutes
} as const;

// ===== Parameters Schema =====
export const saucerswapRouterSwapQuoteParameters = {
  operation: {
    type: 'string',
    enum: Object.values(SAUCERSWAP_ROUTER_OPERATIONS),
    description: 'Quote operation: get_amounts_out for output from input, get_amounts_in for input from output'
  },
  amount: {
    type: 'string',
    description: 'Token amount in smallest unit (e.g., "1000000" for 1 HBAR with 8 decimals)'
  },
  tokenPath: {
    type: 'array',
    items: { type: 'string' },
    minItems: 2,
    description: 'Array of token IDs representing swap path. Use "HBAR" for native HBAR.'
  },
  fees: {
    type: 'array',
    items: { type: 'number' },
    description: 'Array of pool fees in hundredths of a bip (e.g., [3000] for 0.30%). Length must be tokenPath.length - 1',
    optional: true
  },
  network: {
    type: 'string',
    enum: ['mainnet', 'testnet'],
    default: 'testnet',
    description: 'Network to query (defaults to testnet)'
  }
} as const;

// ===== Quote Result Interfaces =====
interface QuoteSuccess {
  success: true;
  operation: string;
  network: HederaNet;
  timestamp: string;
  quote: {
    input: {
      token: string;
      amount: string;
      formatted: string;
    };
    output: {
      token: string;
      amount: string;
      formatted: string;
    };
    path: string[];
    fees: number[];
    exchangeRate: string;
  };
  contract: {
    id: string;
    evmAddress: string;
  };
  source: string;
  gasEstimate?: string;
}

interface QuoteError {
  error: string;
  operation: string;
  timestamp: string;
  troubleshooting: any;
  contractInfo: any;
}

type QuoteResult = QuoteSuccess | QuoteError;

// ===== Main Quote Function =====
export async function getSaucerswapRouterSwapQuote(
  client: any,
  context: Context,
  params: {
    operation: string;
    amount: string;
    tokenPath: string[];
    fees?: number[];
    network?: HederaNet;
  }
): Promise<QuoteResult> {
  const network = params.network || 'testnet';
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`🎯 SaucerSwap V2 Router Quote Request:`, {
      operation: params.operation,
      amount: params.amount,
      path: params.tokenPath,
      fees: params.fees,
      network: network
    });

    // Validate parameters
    if (!params.tokenPath || params.tokenPath.length < 2) {
      throw new Error('Token path must contain at least 2 tokens');
    }

    // Default fees if not provided (use 0.30% for all hops)
    const fees = params.fees || Array(params.tokenPath.length - 1).fill(SAUCERSWAP_ROUTER_CONFIG.DEFAULT_FEE);
    
    if (fees.length !== params.tokenPath.length - 1) {
      throw new Error(`Fees array length (${fees.length}) must be tokenPath.length - 1 (${params.tokenPath.length - 1})`);
    }

    // Get contract configuration
    const config = SAUCERSWAP_V2_CONTRACTS[network];
    const quoterEvmAddress = toEvmAddressFromId(config.QUOTER_V2_ID);

    // Convert token path to EVM addresses
    const evmTokenPath = params.tokenPath.map(tokenId => {
      const evmAddr = tokenIdToEvmAddress(tokenId, network);
      console.log(`🪙 Token ${tokenId} → EVM: ${evmAddr}`);
      return evmAddr;
    });

    // Encode path with fees
    const encodedPath = encodePath(evmTokenPath, fees);

    console.log(`📊 Token Path: ${params.tokenPath.join(' → ')}`);
    console.log(`🔗 EVM Path: ${evmTokenPath.join(' → ')}`);
    console.log(`📊 Encoded path: ${encodedPath}`);
    console.log(`🏦 QuoterV2: ${config.QUOTER_V2_ID} (${quoterEvmAddress})`);
    console.log(`🌐 RPC URL: ${config.RPC_URL}`);

    // Create JSON-RPC provider (Hashio)
    const provider = new ethers.JsonRpcProvider(config.RPC_URL, undefined, { 
      batchMaxCount: 1 
    });

    // Create contract interface for QuoterV2
    const contractInterface = new ethers.Interface(SAUCERSWAP_V2_QUOTER_ABI);
    
    // Prepare the call data based on operation
    let callData: string;
    let functionName: string;
    
    if (params.operation === SAUCERSWAP_ROUTER_OPERATIONS.GET_AMOUNTS_OUT) {
      // Quote exact input
      callData = contractInterface.encodeFunctionData('quoteExactInput', [
        encodedPath,
        params.amount
      ]);
      functionName = 'quoteExactInput';
    } else if (params.operation === SAUCERSWAP_ROUTER_OPERATIONS.GET_AMOUNTS_IN) {
      // Quote exact output  
      callData = contractInterface.encodeFunctionData('quoteExactOutput', [
        encodedPath,
        params.amount
      ]);
      functionName = 'quoteExactOutput';
    } else {
      throw new Error(`Unsupported operation: ${params.operation}`);
    }

    console.log(`🔍 Calling ${functionName} with path: ${encodedPath}, amount: ${params.amount}`);

    // Execute eth_call via JSON-RPC (no operator needed!)
    const rawResult = await provider.call({
      to: quoterEvmAddress,
      data: callData
    });

    console.log(`📡 Raw result: ${rawResult}`);

    // Decode the result
    const decodedResult = contractInterface.decodeFunctionResult(functionName, rawResult);
    
    // QuoterV2 returns: [amountOut/amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList, gasEstimate]
    const resultAmount = decodedResult[0].toString();
    const gasEstimate = decodedResult[3] ? decodedResult[3].toString() : '0';

    console.log(`✅ Decoded result amount: ${resultAmount}, gas estimate: ${gasEstimate}`);

    const inputAmount = params.operation === SAUCERSWAP_ROUTER_OPERATIONS.GET_AMOUNTS_OUT ? params.amount : resultAmount;
    const outputAmount = params.operation === SAUCERSWAP_ROUTER_OPERATIONS.GET_AMOUNTS_OUT ? resultAmount : params.amount;

    return {
      success: true,
      operation: params.operation,
      network: network,
      timestamp: timestamp,
      quote: {
        input: {
          token: params.tokenPath[0],
          amount: inputAmount,
          formatted: formatTokenAmount(inputAmount, params.tokenPath[0])
        },
        output: {
          token: params.tokenPath[params.tokenPath.length - 1],
          amount: outputAmount,
          formatted: formatTokenAmount(outputAmount, params.tokenPath[params.tokenPath.length - 1])
        },
        path: params.tokenPath,
        fees: fees,
        exchangeRate: calculateExchangeRate(inputAmount, outputAmount)
      },
      contract: {
        id: config.QUOTER_V2_ID,
        evmAddress: quoterEvmAddress
      },
      source: 'SaucerSwap V2 QuoterV2 Contract (JSON-RPC)',
      gasEstimate: gasEstimate
    };

  } catch (error: any) {
    console.error('❌ SaucerSwap Router quote error:', error);
    
    return {
      error: `SaucerSwap Router quote failed: ${error.message}`,
      operation: params.operation,
      timestamp: timestamp,
      troubleshooting: {
        issue: 'Quote request failed',
        possibleCauses: [
          'Invalid token path - tokens may not have trading pairs on SaucerSwap V2',
          'Incorrect fee tiers for the token pair (use 100, 500, 3000, or 10000)',
          'Network connectivity issues with Hashio RPC',
          'QuoterV2 contract call failed or returned empty data',
          'Token IDs not found on selected network',
          'Path encoding issue with embedded fees'
        ],
        nextSteps: [
          'Verify token IDs are valid on the selected network',
          'Check that trading pairs exist for the tokens on SaucerSwap V2',
          'Try with standard fees: [3000] for 0.30%',
          'Ensure path length and fees array match exactly',
          'Test with a simpler 2-token path first',
          'Check network connectivity to Hashio RPC endpoints'
        ],
        pathEncoding: {
          providedPath: params.tokenPath,
          fees: params.fees,
          network: network,
          explanation: 'Path should be encoded as: [token, fee, token, fee, token, ...] with 20 bytes per token and 3 bytes per fee'
        }
      },
      contractInfo: {
        network: network,
        quoterV2Id: SAUCERSWAP_V2_CONTRACTS[network].QUOTER_V2_ID,
        quoterV2Evm: toEvmAddressFromId(SAUCERSWAP_V2_CONTRACTS[network].QUOTER_V2_ID),
        rpcUrl: SAUCERSWAP_V2_CONTRACTS[network].RPC_URL,
        whbarTokenId: SAUCERSWAP_V2_CONTRACTS[network].WHBAR_TOKEN_ID,
        supportedFees: SAUCERSWAP_ROUTER_CONFIG.AVAILABLE_FEES
      }
    };
  }
}

// ===== Helper Functions =====
function formatTokenAmount(amount: string, tokenId: string): string {
  const decimals = getTokenDecimals(tokenId);
  const value = Number(amount) / Math.pow(10, decimals);
  return value.toFixed(decimals > 6 ? 6 : decimals);
}

function getTokenDecimals(tokenId: string): number {
  if (tokenId === "HBAR") return 8;
  // Add more token decimals as needed
  return 6; // Default for most tokens
}

function calculateExchangeRate(inputAmount: string, outputAmount: string): string {
  const rate = Number(outputAmount) / Number(inputAmount);
  return rate.toFixed(8);
}

// Export default
export default {
  getSaucerswapRouterSwapQuote,
  saucerswapRouterSwapQuoteParameters,
  SAUCERSWAP_ROUTER_SWAP_QUOTE_TOOL,
  SAUCERSWAP_ROUTER_CONFIG,
  SAUCERSWAP_ROUTER_OPERATIONS,
};