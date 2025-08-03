import { z } from 'zod';
import type { Context } from '../../../configuration';
import { Client } from '@hashgraph/sdk';
import { PromptGenerator } from '../../../utils/prompt-generator';
import {
  approveSauceForMotherShip,
  stakeSauceTokens,
  INFINITY_POOL_CONFIG,
  INFINITY_POOL_OPERATIONS,
  infinityPoolStakeParameters,
} from './api-client';

// Tool name constant for step operations
export const SAUCERSWAP_INFINITY_POOL_STEP_TOOL = 'saucerswap_infinity_pool_step_tool';

/**
 * Parameter schema for step operations
 */
export const infinityPoolStepParameters = (context: Context = {}) => {
  return z.object({
    sauceAmount: z.number().describe('Amount of SAUCE tokens to process (e.g., 100.5 for 100.5 SAUCE)'),
    
    userAccountId: z.string().optional().describe(
      PromptGenerator.getAccountParameterDescription('userAccountId', context)
    ),
    
    referralCode: z.number().optional().describe(
      'Referral code for the operation (optional)'
    ),
    
    transactionMemo: z.string().optional().describe(
      'Optional memo for the transaction'
    ),
  });
};

/**
 * Generate step tool prompt
 */
const infinityPoolStepPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const userAccountDesc = PromptGenerator.getAccountParameterDescription(
    'userAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool completes the SAUCE staking step after token association and approval are completed.

**PURPOSE:**
This is a follow-up tool used after previous steps in the Infinity Pool staking flow have been confirmed.

**WHEN TO USE:**
- After token association transaction is confirmed
- After SAUCE approval transaction is confirmed
- To complete the actual staking of SAUCE tokens

**STAKING OPERATION:**
This tool will call the MotherShip contract's enter() function to stake your SAUCE tokens and receive xSAUCE.

**Parameters:**
- sauceAmount (number, required): Amount of SAUCE to stake (e.g., 100.5 for 100.5 SAUCE)
- ${userAccountDesc}
- referralCode (number, optional): Referral code for the staking operation
- transactionMemo (string, optional): Optional memo for the transaction

**Prerequisites:**
- SAUCE and xSAUCE tokens must be associated to your account
- SAUCE tokens must be approved for MotherShip contract spending
- Sufficient SAUCE balance in your account

**What happens:**
- Your SAUCE tokens are staked in the Infinity Pool
- You receive xSAUCE tokens representing your stake + future rewards
- Rewards automatically compound over time

${usageInstructions}
`;
};

/**
 * Execute the staking step only (after association and approval are complete)
 */
export const executeInfinityPoolStakingStep = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof infinityPoolStepParameters>>,
) => {
  try {
    console.log('🚀 Executing SaucerSwap Infinity Pool staking step...');
    console.log('🥩 STAKING OPERATION - Not approval!');
    console.log(`💰 Staking Amount: ${params.sauceAmount} SAUCE`);
    
    // Create params in the format expected by stakeSauceTokens
    const stakeParams = {
      operation: INFINITY_POOL_OPERATIONS.STAKE_SAUCE,
      sauceAmount: params.sauceAmount,
      userAccountId: params.userAccountId,
      transactionMemo: params.transactionMemo,
      associateTokens: false, // Required field, but we're not associating in step mode
    };
    
    // Skip allowance check since this is a step operation after approval
    const stakeResult = await stakeSauceTokens(client, context, stakeParams, true);
    
    return {
      ...stakeResult,
      message: 'SAUCE staking transaction ready for signature',
      instructions: 'Sign this transaction to complete your SAUCE staking in the Infinity Pool',
    };
  } catch (error: any) {
    console.error('❌ Infinity Pool staking step failed:', error);
    return {
      operation: INFINITY_POOL_OPERATIONS.STAKE_SAUCE,
      step: INFINITY_POOL_CONFIG.STEP_TYPES.STAKE,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// Export the step tool configuration
const infinityPoolStepTool = (context: Context) => ({
  method: SAUCERSWAP_INFINITY_POOL_STEP_TOOL,
  name: 'SaucerSwap Infinity Pool Staking Step',
  description: infinityPoolStepPrompt(context),
  parameters: infinityPoolStepParameters(context),
  execute: executeInfinityPoolStakingStep,
});

export default infinityPoolStepTool;