import { Context, getHederaNetwork, getNetworkSpecificEnvVar } from '../configuration';
import { z } from 'zod';

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
    NETWORK: network,
    GAS_LIMIT: 1000000, // Default gas limit for contract calls
  } as const;
};

export const bonzoDepositParameters = (context: Context = {}) =>
  z.object({
    hbarAmount: z.number().positive().describe('Amount of HBAR to deposit (in HBAR units, not tinybars)'),
    userAccountId: z.string().optional().describe('The account making the deposit (defaults to context account)'),
    associateWhbar: z.boolean().optional().default(true).describe('Whether to associate WHBAR token if not already associated'),
    referralCode: z.number().int().min(0).max(65535).optional().default(0).describe('Referral code for the deposit (uint16, 0-65535, default: 0)'),
    transactionMemo: z.string().optional().describe('Optional memo for the transactions'),
  });

export const bonzoDepositParametersNormalised = (context: Context = {}) =>
  bonzoDepositParameters(context).extend({
    userAccountId: z.string().describe('The verified account making the deposit'),
    hbarAmountInTinybars: z.string().describe('HBAR amount converted to tinybars (string for precision)'),
    whbarTokenId: z.string().describe('WHBAR token ID in Hedera format (0.0.1456986)'),
    whbarAddress: z.string().describe('WHBAR contract address in EVM format'),
    lendingPoolAddress: z.string().describe('Bonzo LendingPool contract address'),
  });

// Export the dynamic configuration
export const BONZO_CONFIG = createBonzoConfig();

// Export helper functions for accessing network-specific configs
export const getBonzoConfigForNetwork = (network: 'testnet' | 'mainnet') => {
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
    NETWORK: network,
    GAS_LIMIT: 1000000,
  };
};

// Log current configuration on import (for debugging)
console.log(`🌐 Bonzo Finance configured for: ${BONZO_CONFIG.NETWORK.toUpperCase()}`);
console.log(`📍 LendingPool: ${BONZO_CONFIG.LENDING_POOL_ADDRESS}`);
console.log(`🏢 LendingPool Contract ID: ${BONZO_CONFIG.LENDING_POOL_CONTRACT_ID}`);
console.log(`🪙 WHBAR Token: ${BONZO_CONFIG.WHBAR_TOKEN_ID}`); 