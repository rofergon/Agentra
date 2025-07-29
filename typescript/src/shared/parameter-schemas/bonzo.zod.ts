import { Context } from '../configuration';
import { z } from 'zod';

export const bonzoDepositParameters = (context: Context = {}) =>
  z.object({
    hbarAmount: z.number().positive().describe('Amount of HBAR to deposit (in HBAR units, not tinybars)'),
    userAccountId: z.string().optional().describe('The account making the deposit (defaults to context account)'),
    associateWhbar: z.boolean().optional().default(true).describe('Whether to associate WHBAR token if not already associated'),
    referralCode: z.number().int().min(0).max(65535).optional().default(0).describe('Referral code for the deposit (0-65535)'),
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

// Constants for Bonzo Finance on Hedera Mainnet
export const BONZO_CONFIG = {
  LENDING_POOL_ADDRESS: '0x236897c518996163E7b313aD21D1C9fCC7BA1afc',
  WHBAR_TOKEN_ID: '0.0.1456986',
  WHBAR_ADDRESS: '0x0000000000000000000000000000000000163b5a',
  NETWORK: 'mainnet',
  GAS_LIMIT: 1000000, // Default gas limit for contract calls
} as const; 