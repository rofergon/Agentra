import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Context } from '../../../configuration';
import { Client } from '@hashgraph/sdk';
import {
  bonzoDepositFlow,
  executeBonzoDepositOnly,
  approveTokenForLendingPool,
  BONZO_DEPOSIT_TOOL,
  BONZO_DEPOSIT_CONFIG,
  BONZO_DEPOSIT_OPERATIONS,
} from './api-client';
import { bonzoDepositParameters, BONZO_CONFIG, getTokenConfig, convertToBaseUnits } from '../../../parameter-schemas/bonzo.zod';

/**
 * Create a LangChain tool for Bonzo Finance multi-token deposits
 */
export const createBonzoDepositLangchainTool = (
  client: Client,
  context: Context,
  userAccountId: string,
) => {
  return new DynamicStructuredTool({
    name: BONZO_DEPOSIT_TOOL,
    description: `Deposit multiple tokens (HBAR, SAUCE, xSAUCE, USDC) into Bonzo Finance DeFi protocol on Hedera ${BONZO_CONFIG.NETWORK.toUpperCase()} to earn interest.

**🔥 LIVE ${BONZO_CONFIG.NETWORK.toUpperCase()} TOOL - REAL FUNDS INVOLVED 🔥**

This tool performs multi-token deposits into Bonzo Finance, a lending protocol on Hedera similar to Aave. 

**Supported Tokens:**
- **HBAR** (Native Hedera token) → receives aWHBAR
- **SAUCE** (SaucerSwap governance token) → receives aSAUCE  
- **xSAUCE** (Staked SAUCE token) → receives axSAUCE
- **USDC** (USD Coin stablecoin) → receives aUSDC

**Key Features:**
- Automatic token association (if needed)
- Multi-token deposit to LendingPool contract
- Receive interest-bearing aTokens
- Full transaction flow management

**How it works:**
1. Associates the selected token to your account if not already associated
2. Calls LendingPool.deposit() to deposit your tokens
3. You receive aTokens that grow in value over time
4. Can withdraw tokens + interest later through Bonzo interface

**Contract Details (Hedera ${BONZO_CONFIG.NETWORK.toUpperCase()}):**
- LendingPool: ${BONZO_CONFIG.LENDING_POOL_ADDRESS}
- LendingPool Contract ID: ${BONZO_CONFIG.LENDING_POOL_CONTRACT_ID}
- Network: Hedera ${BONZO_CONFIG.NETWORK.toUpperCase()}

**User Account:** ${userAccountId}

**Returns transaction bytes for frontend signing when in RETURN_BYTES mode.**`,

    schema: bonzoDepositParameters(context),

    func: async (params: any) => {
      try {
        // Auto-use user account ID if not provided
        if (!params.userAccountId) {
          params.userAccountId = userAccountId;
        }

        console.log(`🚀 Bonzo Finance deposit initiated for ${params.userAccountId}`);
        console.log(`💰 Amount: ${params.amount} ${(params.token || 'hbar').toUpperCase()}`);
        console.log(`🔗 Token Association: ${params.associateToken ? 'Yes' : 'No'}`);

        const result = await bonzoDepositFlow(client, context, params);

        return JSON.stringify({
          ...result,
          toolInfo: {
            name: BONZO_DEPOSIT_TOOL,
            version: '1.0.0',
            network: `Hedera ${BONZO_CONFIG.NETWORK.toUpperCase()}`,
            protocol: 'Bonzo Finance',
            timestamp: new Date().toISOString(),
          },
          userGuidance: {
            nextSteps: result.success ? [
              '✅ Deposit completed successfully!',
              `🏦 Check your account for a${(params.token || 'hbar').toUpperCase()} tokens`,
              '📊 Monitor your position on Bonzo Finance dashboard',
              `💡 Your a${(params.token || 'hbar').toUpperCase()} will grow in value as interest accrues`,
            ] : [
              '❌ Deposit failed - check error details',
              '🔧 Review troubleshooting suggestions',
              '💬 Contact support if issue persists',
            ],
            importantNotes: [
              `Your ${(params.token || 'hbar').toUpperCase()} has been deposited into Bonzo Finance lending protocol`,
              `You received a${(params.token || 'hbar').toUpperCase()} tokens representing your deposit + interest`,
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
              `Insufficient ${(params.token || 'hbar').toUpperCase()} balance`,
              'Account not properly configured',
            ],
            nextSteps: [
              `Verify ${(params.token || 'hbar').toUpperCase()} balance is sufficient`,
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
 * Create a LangChain tool for token approval step (before deposit)
 */
const createBonzoApproveStepLangchainTool = (
  client: Client,
  context: Context,
  userAccountId: string,
) => {
  return new DynamicStructuredTool({
    name: 'bonzo_approve_step_tool',
    description: `Approve ERC-20 tokens for Bonzo Finance LendingPool contract (Step 2 after token association).
    Use this tool ONLY for ERC-20 tokens (SAUCE, xSAUCE, USDC) after token association has been completed.
    
    This will prepare the token approval transaction for signature in the frontend.
    HBAR deposits do not require approval as they use payable amount directly.
    
    Required parameters:
    - token: Token to approve ('sauce', 'xsauce', 'usdc') - NOT for 'hbar'
    - amount: Amount of tokens to approve (e.g., 100)
    - userAccountId: Your Hedera account ID (optional, defaults to authenticated account)`,
    
    schema: bonzoDepositParameters(context),

    func: async (params: z.infer<ReturnType<typeof bonzoDepositParameters>>) => {
      try {
        // Auto-use user account ID if not provided
        if (!params.userAccountId) {
          params.userAccountId = userAccountId;
        }

        console.log(`🚀 Bonzo Finance token approval initiated for ${params.userAccountId}`);
        console.log(`💰 Amount: ${params.amount} ${(params.token || 'hbar').toUpperCase()}`);

        // Check if token is HBAR (doesn't need approval)
        if (params.token === 'hbar') {
          return JSON.stringify({
            success: false,
            error: 'HBAR deposits do not require approval - proceed directly to deposit',
            suggestion: 'Use bonzo_deposit_step_tool for HBAR deposits',
            toolInfo: { name: 'bonzo_approve_step_tool' },
          });
        }

        // Get token configuration and calculate amount in base units
        const tokenConfig = getTokenConfig(params.token as any);
        const amountInBaseUnits = convertToBaseUnits(params.amount, tokenConfig.decimals);

        const result = await approveTokenForLendingPool(client, context, {
          userAccountId: params.userAccountId,
          tokenId: tokenConfig.tokenId,
          amount: amountInBaseUnits,
          tokenSymbol: tokenConfig.symbol,
          originalParams: params,
        });

        return JSON.stringify({
          ...result,
          toolInfo: {
            name: 'bonzo_approve_step_tool',
            version: '1.0.0',
            network: `Hedera ${BONZO_CONFIG.NETWORK.toUpperCase()}`,
            protocol: 'Bonzo Finance',
            step: 'token_approval',
            timestamp: new Date().toISOString(),
          },
          userGuidance: {
            nextAction: `Sign the transaction in your wallet to approve ${(params.token || '').toUpperCase()} for Bonzo Finance`,
            postTransaction: `After approval confirmation, proceed to deposit your ${(params.token || '').toUpperCase()} tokens`,
          },
        });
      } catch (error: any) {
        console.error('❌ Bonzo token approval failed:', error);
        return JSON.stringify({
          success: false,
          error: error.message,
          toolInfo: { name: 'bonzo_approve_step_tool' },
        });
      }
    },
  });
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
    description: `Complete the token deposit to Bonzo Finance (Step 2 after token association).
    Use this tool ONLY after the token association has been completed and confirmed.
    
    This will prepare the deposit transaction for signature in the frontend.
    
    Required parameters:
    - token: Token to deposit ('hbar', 'sauce', 'xsauce', 'usdc')
    - amount: Amount of tokens to deposit (e.g., 1.5)
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
        console.log(`💰 Amount: ${params.amount} ${(params.token || 'hbar').toUpperCase()}`);

        // Skip token association for this step
        const paramsWithoutAssociation = { ...params, associateToken: false };
        const result = await executeBonzoDepositOnly(client, context, paramsWithoutAssociation);

        return JSON.stringify({
          ...result,
          toolInfo: {
            name: 'bonzo_deposit_step_tool',
            version: '1.0.0',
            network: `Hedera ${BONZO_CONFIG.NETWORK.toUpperCase()}`,
            protocol: 'Bonzo Finance',
            step: 'deposit_only',
            timestamp: new Date().toISOString(),
          },
          userGuidance: {
            nextAction: `Sign the transaction in your wallet to complete the ${(params.token || 'hbar').toUpperCase()} deposit`,
            postTransaction: `After confirmation, you will receive a${(params.token || 'hbar').toUpperCase()} tokens representing your deposit + interest`,
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
  createBonzoApproveStepLangchainTool,
}; 