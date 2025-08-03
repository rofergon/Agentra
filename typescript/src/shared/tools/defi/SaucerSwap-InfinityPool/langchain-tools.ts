import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Context } from '../../../configuration';
import {
  infinityPoolStakeFlow,
  infinityPoolStakeParameters,
  SAUCERSWAP_INFINITY_POOL_TOOL,
  INFINITY_POOL_OPERATIONS,
  INFINITY_POOL_CONFIG,
} from './api-client';
import {
  executeInfinityPoolStakingStep,
  infinityPoolStepParameters,
  SAUCERSWAP_INFINITY_POOL_STEP_TOOL,
} from './step-api-client';

/**
 * Create the main SaucerSwap Infinity Pool staking tool for LangChain
 */
export const createSaucerswapInfinityPoolLangchainTool = (
  client: any, 
  context: Context, 
  userAccountId: string
) => {
  return new DynamicStructuredTool({
    name: SAUCERSWAP_INFINITY_POOL_TOOL,
    description: `Stake SAUCE tokens in SaucerSwap's Infinity Pool to earn xSAUCE on Hedera Mainnet.

**CORE FUNCTIONALITY:**
🥩 **Staking Operations:**
- Stake SAUCE tokens → Receive xSAUCE (interest-bearing tokens)
- Unstake xSAUCE tokens → Receive SAUCE + rewards
- Token association for SAUCE and xSAUCE
- Token approval for MotherShip contract

**AVAILABLE OPERATIONS:**
- associate_tokens: Associate SAUCE and xSAUCE tokens to account
- approve_sauce: Approve MotherShip contract to spend SAUCE tokens
- stake_sauce: Stake SAUCE tokens to receive xSAUCE
- unstake_xsauce: Unstake xSAUCE tokens to receive SAUCE
- full_stake_flow: Complete staking process (association + approval + stake)
- full_unstake_flow: Complete unstaking process

**STAKING REWARDS:**
- Earn rewards from SaucerSwap trading fees
- xSAUCE tokens represent your share of the pool
- Rewards automatically compound over time
- No lock-up period - unstake anytime

**SECURITY:**
- Only works on Hedera Mainnet with real funds
- All transactions are irreversible
- Verify amounts before confirming

**CONTRACT INFO:**
- MotherShip: ${INFINITY_POOL_CONFIG.MOTHERSHIP_CONTRACT_ID}
- SAUCE Token: ${INFINITY_POOL_CONFIG.SAUCE_TOKEN_ID} (6 decimals)
- xSAUCE Token: ${INFINITY_POOL_CONFIG.XSAUCE_TOKEN_ID} (6 decimals)

User Account: ${userAccountId}`,
    
    schema: infinityPoolStakeParameters(context),
    
    func: async (params: any) => {
      try {
        // Auto-use user account ID if not provided
        if (!params.userAccountId) {
          params.userAccountId = userAccountId;
        }

        console.log('🚨 INFINITY POOL TOOL CALLED:');
        console.log(`📋 Operation: ${params.operation}`);
        console.log(`💰 SAUCE Amount: ${params.sauceAmount}`);
        console.log(`👤 User Account: ${params.userAccountId}`);
        console.log(`🔄 Context Mode: ${context.mode}`);
        console.log('🚨 ==========================================');

        const result = await infinityPoolStakeFlow(client, context, params);
        return JSON.stringify(result, null, 2);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return JSON.stringify({
          error: `Error in SaucerSwap Infinity Pool operation: ${errorMessage}`,
          operation: params.operation,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            issue: 'Infinity Pool operation failed',
            possible_causes: [
              'Network connectivity issues',
              'Insufficient token balance',
              'Tokens not associated to account',
              'Contract approval not granted',
              'Gas limit exceeded',
              'Invalid parameters'
            ],
            next_steps: [
              'Check internet connection',
              'Verify SAUCE/xSAUCE token balances',
              'Ensure tokens are associated to your account',
              'Check if SAUCE is approved for MotherShip contract',
              'Verify operation parameters',
              'Try again with lower amounts'
            ]
          }
        }, null, 2);
      }
    },
  });
};

/**
 * Create the step-by-step SaucerSwap Infinity Pool tool for multi-step flows
 */
export const createSaucerswapInfinityPoolStepLangchainTool = (
  client: any,
  context: Context,
  userAccountId: string
) => {
  return new DynamicStructuredTool({
    name: SAUCERSWAP_INFINITY_POOL_STEP_TOOL,
    description: `Execute individual steps of SaucerSwap Infinity Pool operations. Used for multi-step flows in WebSocket mode.

**PURPOSE:**
This tool is designed for completing individual steps after a previous step has been signed and confirmed.

**WHEN TO USE:**
- After token association transaction is confirmed → Use this to proceed with approval
- After approval transaction is confirmed → Use this to proceed with staking
- For granular control over the staking process

**STEP OPERATIONS:**
- approval: Approve SAUCE for MotherShip contract after token association
- stake: Execute SAUCE staking after approval is confirmed

**PARAMETERS:**
- sauceAmount: Amount of SAUCE to approve/stake
- approveAmount: Specific amount to approve (optional)
- userAccountId: Account performing the operation

User Account: ${userAccountId}`,

    schema: infinityPoolStepParameters(context),

    func: async (params: any) => {
      try {
        console.log('🚨 INFINITY POOL STEP TOOL CALLED:');
        console.log(`💰 SAUCE Amount: ${params.sauceAmount}`);
        console.log(`👤 User Account: ${params.userAccountId || userAccountId}`);
        console.log('🚨 ========================================');
        
        // Auto-use user account ID if not provided
        if (!params.userAccountId) {
          params.userAccountId = userAccountId;
        }

        const result = await executeInfinityPoolStakingStep(client, context, params);
        return JSON.stringify(result, null, 2);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return JSON.stringify({
          error: `Error in Infinity Pool step operation: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          suggestion: 'Ensure previous steps were completed successfully and account has sufficient balances'
        }, null, 2);
      }
    },
  });
};

/**
 * Create both Infinity Pool tools for comprehensive coverage
 */
export const createSaucerswapInfinityPoolLangchainTools = (
  client: any,
  context: Context,
  userAccountId: string
) => {
  return [
    createSaucerswapInfinityPoolLangchainTool(client, context, userAccountId),
    createSaucerswapInfinityPoolStepLangchainTool(client, context, userAccountId),
  ];
};