import { Context, getHederaNetwork, getNetworkSpecificEnvVar } from '../configuration';
import { z } from 'zod';

// Supported tokens for Bonzo deposits
export const BONZO_SUPPORTED_TOKENS = {
  HBAR: 'hbar',
  SAUCE: 'sauce', 
  XSAUCE: 'xsauce',
  USDC: 'usdc',
} as const;

export type BonzoSupportedToken = typeof BONZO_SUPPORTED_TOKENS[keyof typeof BONZO_SUPPORTED_TOKENS];

// Dynamic configuration based on environment
const createBonzoConfig = () => {
  const network = getHederaNetwork();
  
  return {
    LENDING_POOL_ADDRESS: getNetworkSpecificEnvVar(
      'BONZO', 
      'LENDING_POOL', 
      network,
      network === 'mainnet' ? '0x236897c518996163E7b313aD21D1C9fCC7BA1afc' : undefined
    ),
    LENDING_POOL_CONTRACT_ID: getNetworkSpecificEnvVar(
      'BONZO', 
      'LENDING_POOL_CONTRACT_ID', 
      network,
      network === 'mainnet' ? '0.0.7308459' : undefined
    ),
    // WHBAR (wrapped HBAR)
    WHBAR_TOKEN_ID: getNetworkSpecificEnvVar(
      'BONZO', 
      'WHBAR_TOKEN_ID', 
      network,
      network === 'mainnet' ? '0.0.1456986' : undefined
    ),
    WHBAR_ADDRESS: getNetworkSpecificEnvVar(
      'BONZO', 
      'WHBAR_ADDRESS', 
      network,
      network === 'mainnet' ? '0x0000000000000000000000000000000000163b5a' : undefined
    ),
    // SAUCE token
    SAUCE_TOKEN_ID: getNetworkSpecificEnvVar(
      'BONZO', 
      'SAUCE_TOKEN_ID', 
      network,
      network === 'mainnet' ? '0.0.731861' : undefined
    ),
    SAUCE_ADDRESS: getNetworkSpecificEnvVar(
      'BONZO', 
      'SAUCE_ADDRESS', 
      network,
      network === 'mainnet' ? '0x00000000000000000000000000000000000b2ad5' : undefined
    ),
    // xSAUCE token  
    XSAUCE_TOKEN_ID: getNetworkSpecificEnvVar(
      'BONZO', 
      'XSAUCE_TOKEN_ID', 
      network,
      network === 'mainnet' ? '0.0.1460200' : undefined
    ),
    XSAUCE_ADDRESS: getNetworkSpecificEnvVar(
      'BONZO', 
      'XSAUCE_ADDRESS', 
      network,
      network === 'mainnet' ? '0x00000000000000000000000000000000001647e8' : undefined
    ),
    // USDC token
    USDC_TOKEN_ID: getNetworkSpecificEnvVar(
      'BONZO', 
      'USDC_TOKEN_ID', 
      network,
      network === 'mainnet' ? '0.0.456858' : undefined
    ),
    USDC_ADDRESS: getNetworkSpecificEnvVar(
      'BONZO', 
      'USDC_ADDRESS', 
      network,
      network === 'mainnet' ? '0x000000000000000000000000000000000006f89a' : undefined
    ),
    NETWORK: network,
    GAS_LIMIT: 1000000, // Default gas limit for contract calls
  } as const;
};

export const bonzoDepositParameters = (context: Context = {}) =>
  z.object({
    token: z.enum(['hbar', 'sauce', 'xsauce', 'usdc'] as const).default('hbar').describe('Token to deposit: hbar, sauce, xsauce, or usdc'),
    amount: z.number().positive().describe('Amount of tokens to deposit (in token units, e.g., 10.5 HBAR, 100 SAUCE)'),
    userAccountId: z.string().optional().describe('The account making the deposit (defaults to context account)'),
    associateToken: z.boolean().optional().default(true).describe('Whether to associate the token if not already associated'),
    referralCode: z.number().int().min(0).max(65535).optional().default(0).describe('Referral code for the deposit (uint16, 0-65535, default: 0)'),
    transactionMemo: z.string().optional().describe('Optional memo for the transactions'),
  });

export const bonzoDepositParametersNormalised = (context: Context = {}) =>
  bonzoDepositParameters(context).extend({
    userAccountId: z.string().describe('The verified account making the deposit'),
    amountInBaseUnits: z.string().describe('Token amount converted to base units (string for precision)'),
    tokenId: z.string().describe('Token ID in Hedera format'),
    tokenAddress: z.string().describe('Token contract address in EVM format'),
    lendingPoolAddress: z.string().describe('Bonzo LendingPool contract address'),
    isNativeHbar: z.boolean().describe('Whether the token is native HBAR (requires payable amount)'),
  });

// Helper function to get token configuration by token type
export const getTokenConfig = (token: BonzoSupportedToken, config = BONZO_CONFIG) => {
  switch (token) {
    case BONZO_SUPPORTED_TOKENS.HBAR:
      return {
        tokenId: config.WHBAR_TOKEN_ID,
        tokenAddress: config.WHBAR_ADDRESS,
        decimals: 8, // HBAR has 8 decimals (tinybars)
        isNativeHbar: true,
        symbol: 'HBAR',
        wrappedSymbol: 'WHBAR'
      };
    case BONZO_SUPPORTED_TOKENS.SAUCE:
      return {
        tokenId: config.SAUCE_TOKEN_ID,
        tokenAddress: config.SAUCE_ADDRESS,
        decimals: 6, // SAUCE typically has 6 decimals
        isNativeHbar: false,
        symbol: 'SAUCE',
        wrappedSymbol: 'SAUCE'
      };
    case BONZO_SUPPORTED_TOKENS.XSAUCE:
      return {
        tokenId: config.XSAUCE_TOKEN_ID,
        tokenAddress: config.XSAUCE_ADDRESS,
        decimals: 6, // xSAUCE typically has 6 decimals
        isNativeHbar: false,
        symbol: 'xSAUCE',
        wrappedSymbol: 'xSAUCE'
      };
    case BONZO_SUPPORTED_TOKENS.USDC:
      return {
        tokenId: config.USDC_TOKEN_ID,
        tokenAddress: config.USDC_ADDRESS,
        decimals: 6, // USDC has 6 decimals
        isNativeHbar: false,
        symbol: 'USDC',
        wrappedSymbol: 'USDC'
      };
    default:
      throw new Error(`Unsupported token: ${token}`);
  }
};

// Helper function to convert token amount to base units
export const convertToBaseUnits = (amount: number, decimals: number): string => {
  const multiplier = Math.pow(10, decimals);
  const baseUnits = Math.floor(amount * multiplier);
  return baseUnits.toString();
};

// Export the dynamic configuration
export const BONZO_CONFIG = createBonzoConfig();

// Export helper functions for accessing network-specific configs
export const getBonzoConfigForNetwork = (network: 'testnet' | 'mainnet') => {
  return createBonzoConfig(); // Use the same creation function for consistency
};

// Log current configuration on import (for debugging)
console.log(`🌐 Bonzo Finance configured for: ${BONZO_CONFIG.NETWORK.toUpperCase()}`);
console.log(`📍 LendingPool: ${BONZO_CONFIG.LENDING_POOL_ADDRESS}`);
console.log(`🏢 LendingPool Contract ID: ${BONZO_CONFIG.LENDING_POOL_CONTRACT_ID}`);
console.log(`🪙 Supported tokens: HBAR, SAUCE, xSAUCE, USDC`); 