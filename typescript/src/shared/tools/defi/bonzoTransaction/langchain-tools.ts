import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Context } from '../../../configuration';
import { Client } from '@hashgraph/sdk';
import {
  bonzoDepositFlow,
  executeBonzoDepositOnly,
  BONZO_DEPOSIT_TOOL,
  BONZO_DEPOSIT_CONFIG,
  BONZO_DEPOSIT_OPERATIONS,
} from './api-client';
import { bonzoDepositParameters, BONZO_CONFIG } from '../../../parameter-schemas/bonzo.zod';

/**
 * Create a LangChain tool for Bonzo Finance HBAR deposits
 */
export const createBonzoDepositLangchainTool = (
  client: Client,
  context: Context,
  userAccountId: string,
) => {
  return new DynamicStructuredTool({
    name: BONZO_DEPOSIT_TOOL,
    description: `Deposit HBAR into Bonzo Finance DeFi protocol on Hedera Mainnet to earn interest.

**🔥 LIVE MAINNET TOOL - REAL FUNDS INVOLVED 🔥**

This tool performs HBAR deposits into Bonzo Finance, a lending protocol on Hedera similar to Aave. 

**Key Features:**
- Automatic WHBAR token association (if needed)
- HBAR deposit to LendingPool contract
- Receive aWHBAR (interest-bearing tokens)
- Full transaction flow management

**How it works:**
1. Associates WHBAR token to your account if not already associated
2. Calls LendingPool.deposit() to convert HBAR → WHBAR → aWHBAR
3. You receive aWHBAR tokens that grow in value over time
4. Can withdraw HBAR + interest later through Bonzo interface

**Contract Details (Hedera Mainnet):**
- LendingPool: ${BONZO_CONFIG.LENDING_POOL_ADDRESS}
- WHBAR Token: ${BONZO_CONFIG.WHBAR_TOKEN_ID}
- Network: Hedera Mainnet

**User Account:** ${userAccountId}

**Returns transaction bytes for frontend signing when in RETURN_BYTES mode.**`,

    schema: z.object({
      hbarAmount: z.number().positive().describe('Amount of HBAR to deposit (e.g., 1.5 for 1.5 HBAR)'),
      userAccountId: z.string().optional().describe('Account making the deposit (optional, defaults to user account)'),
      associateWhbar: z.boolean().optional().default(true).describe('Whether to associate WHBAR token automatically'),
      referralCode: z.number().int().min(0).max(65535).optional().default(0).describe('Referral code (0-65535)'),
      transactionMemo: z.string().optional().describe('Optional transaction memo'),
    }),

    func: async (params: any) => {
      try {
        // Auto-use user account ID if not provided
        if (!params.userAccountId) {
          params.userAccountId = userAccountId;
        }

        console.log(`🚀 Bonzo Finance deposit initiated for ${params.userAccountId}`);
        console.log(`💰 Amount: ${params.hbarAmount} HBAR`);
        console.log(`🔗 WHBAR Association: ${params.associateWhbar ? 'Yes' : 'No'}`);

        const result = await bonzoDepositFlow(client, context, params);

        return JSON.stringify({
          ...result,
          toolInfo: {
            name: BONZO_DEPOSIT_TOOL,
            version: '1.0.0',
            network: 'Hedera Mainnet',
            protocol: 'Bonzo Finance',
            timestamp: new Date().toISOString(),
          },
          userGuidance: {
            nextSteps: result.success ? [
              '✅ Deposit completed successfully!',
              '🏦 Check your account for aWHBAR tokens',
              '📊 Monitor your position on Bonzo Finance dashboard',
              '💡 Your aWHBAR will grow in value as interest accrues',
            ] : [
              '❌ Deposit failed - check error details',
              '🔧 Review troubleshooting suggestions',
              '💬 Contact support if issue persists',
            ],
            importantNotes: [
              'Your HBAR has been deposited into Bonzo Finance lending protocol',
              'You received aWHBAR tokens representing your deposit + interest',
              'Interest starts accruing immediately',
              'Use Bonzo Finance interface to withdraw or monitor positions',
            ],
          },
        }, null, 2);
      } catch (error) {
        console.error('❌ Bonzo LangChain tool error:', error);
        return JSON.stringify({
          success: false,
          error: `Bonzo Finance deposit tool error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          operation: BONZO_DEPOSIT_OPERATIONS.FULL_DEPOSIT_FLOW,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            issue: 'LangChain tool execution failed',
            possibleCauses: [
              'Invalid parameters provided',
              'Network connectivity issues',
              'Insufficient HBAR balance',
              'Account not properly configured',
            ],
            nextSteps: [
              'Verify HBAR balance is sufficient',
              'Check network connection',
              'Ensure account has proper permissions',
              'Try again with valid parameters',
            ],
          },
        }, null, 2);
      }
    },
  });
};

/**
 * Create multiple Bonzo LangChain tools (future expansion)
 */
export const createBonzoDepositLangchainTools = (
  client: Client,
  context: Context,
  userAccountId: string,
) => {
  return [
    createBonzoDepositLangchainTool(client, context, userAccountId),
    // Future tools can be added here:
    // createBonzoWithdrawLangchainTool(client, context, userAccountId),
    // createBonzoBorrowLangchainTool(client, context, userAccountId),
  ];
};

/**
 * Create a LangChain tool for the deposit step only (after token association)
 */
export const createBonzoDepositStepLangchainTool = (
  client: Client,
  context: Context,
  userAccountId: string,
) => {
  return new DynamicStructuredTool({
    name: 'bonzo_deposit_step_tool',
    description: `Complete the HBAR deposit to Bonzo Finance (Step 2 after WHBAR token association).
    Use this tool ONLY after the WHBAR token association has been completed and confirmed.
    
    This will prepare the deposit transaction for signature in the frontend.
    
    Required parameters:
    - hbarAmount: Amount of HBAR to deposit (e.g., 1.5)
    - userAccountId: Your Hedera account ID (optional, defaults to authenticated account)
    - referralCode: Optional referral code (0-65535, default: 0)`,
    
    schema: bonzoDepositParameters(context),

    func: async (params: z.infer<ReturnType<typeof bonzoDepositParameters>>) => {
      try {
        // Auto-use user account ID if not provided
        if (!params.userAccountId) {
          params.userAccountId = userAccountId;
        }

        console.log(`🚀 Bonzo Finance deposit step initiated for ${params.userAccountId}`);
        console.log(`💰 Amount: ${params.hbarAmount} HBAR`);

        // Skip token association for this step
        const paramsWithoutAssociation = { ...params, associateWhbar: false };
        const result = await executeBonzoDepositOnly(client, context, paramsWithoutAssociation);

        return JSON.stringify({
          ...result,
          toolInfo: {
            name: 'bonzo_deposit_step_tool',
            version: '1.0.0',
            network: 'Hedera Mainnet',
            protocol: 'Bonzo Finance',
            step: 'deposit_only',
            timestamp: new Date().toISOString(),
          },
          userGuidance: {
            nextAction: 'Sign the transaction in your wallet to complete the HBAR deposit',
            postTransaction: 'After confirmation, you will receive aWHBAR tokens representing your deposit + interest',
          },
        });
      } catch (error: any) {
        console.error('❌ Bonzo deposit step failed:', error);
        return JSON.stringify({
          success: false,
          error: error.message,
          toolInfo: { name: 'bonzo_deposit_step_tool' },
        });
      }
    },
  });
};

// Export for easy import
export {
  BONZO_DEPOSIT_TOOL,
  BONZO_DEPOSIT_CONFIG,
  BONZO_DEPOSIT_OPERATIONS,
}; 