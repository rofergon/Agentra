import { z } from 'zod';
import type { Context } from '../../../configuration';
import { Client, TokenAssociateTransaction, ContractExecuteTransaction, ContractFunctionParameters, Hbar, AccountId, ContractId, AccountInfoQuery } from '@hashgraph/sdk';
import { handleTransaction } from '../../../strategies/tx-mode-strategy';
import Long from 'long';
import { bonzoDepositParameters, BONZO_CONFIG } from '../../../parameter-schemas/bonzo.zod';
import { PromptGenerator } from '../../../utils/prompt-generator';

// Tool name constant
export const BONZO_DEPOSIT_TOOL = 'bonzo_deposit_tool';

// Configuration constants
export const BONZO_DEPOSIT_CONFIG = {
  ...BONZO_CONFIG,
  STEP_TYPES: {
    TOKEN_ASSOCIATION: 'token_association',
    DEPOSIT: 'deposit',
  },
} as const;

// Available operations enum
export const BONZO_DEPOSIT_OPERATIONS = {
  ASSOCIATE_WHBAR: 'associate_whbar',
  DEPOSIT_HBAR: 'deposit_hbar',
  FULL_DEPOSIT_FLOW: 'full_deposit_flow',
} as const;

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
    
    // Check if there's an alias field that contains the EVM address
    if (accountData.alias && accountData.alias.length > 0) {
      // Try to convert alias bytes to EVM address format
      const aliasHex = accountData.alias;
      if (aliasHex.length === 42 && aliasHex.startsWith('0x')) {
        console.log(`✅ Found EVM Address from alias: ${aliasHex}`);
        return aliasHex;
      }
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

/**
 * Simple parameter normalizer for Bonzo deposits
 */
const normalizeBonzoDepositParams = (
  params: z.infer<ReturnType<typeof bonzoDepositParameters>>,
  context: Context,
) => {
  const userAccountId = params.userAccountId || context.accountId;
  if (!userAccountId) {
    throw new Error('User account ID is required either in params or context');
  }

  // Convert HBAR to tinybars (maintaining precision with string)
  const hbarAmountInTinybars = Math.floor(params.hbarAmount * 100_000_000).toString();
  
  return {
    ...params,
    userAccountId,
    hbarAmountInTinybars,
    whbarTokenId: BONZO_CONFIG.WHBAR_TOKEN_ID,
    whbarAddress: BONZO_CONFIG.WHBAR_ADDRESS,
    lendingPoolAddress: BONZO_CONFIG.LENDING_POOL_ADDRESS,
  };
};

/**
 * Generate tool prompt with context information
 */
const bonzoDepositPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const userAccountDesc = PromptGenerator.getAccountParameterDescription(
    'userAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool enables HBAR deposits into Bonzo Finance DeFi protocol on Hedera Mainnet.

**IMPORTANT SECURITY NOTES:**
- This tool operates on HEDERA MAINNET with REAL FUNDS
- All transactions are irreversible once confirmed
- Double-check amounts before confirming transactions
- Only use with accounts you control

**Deposit Process:**
1. WHBAR Token Association (if needed) - Associates your account with WHBAR token (0.0.1456986)
2. HBAR Deposit - Calls LendingPool.deposit() with your HBAR to receive aWHBAR (interest-bearing tokens)

**Parameters:**
- hbarAmount (number, required): Amount of HBAR to deposit (e.g., 1.5 for 1.5 HBAR)
- ${userAccountDesc}
- associateWhbar (boolean, optional): Whether to associate WHBAR token if not already associated (default: true)
- referralCode (number, optional): Referral code for the deposit (defaults to official Bonzo frontend value)
- transactionMemo (string, optional): Optional memo for the transactions

**Contract Addresses (Hedera Mainnet):**
- LendingPool: ${BONZO_CONFIG.LENDING_POOL_ADDRESS}
- LendingPool Contract ID: ${BONZO_CONFIG.LENDING_POOL_CONTRACT_ID}
- WHBAR Token: ${BONZO_CONFIG.WHBAR_TOKEN_ID} (${BONZO_CONFIG.WHBAR_ADDRESS})

**What you'll receive:**
- aWHBAR tokens representing your deposit + accumulated interest
- Ability to withdraw your HBAR plus interest later
- Participation in Bonzo Finance lending protocol

${usageInstructions}
`;
};

/**
 * Execute WHBAR token association transaction
 */
export const associateWhbarToken = async (
  client: Client,
  context: Context,
  params: { userAccountId: string; tokenIds: string[] },
) => {
  try {
    console.log(`🔗 Associating WHBAR token for account ${params.userAccountId}...`);
    
    const tx = new TokenAssociateTransaction()
      .setAccountId(params.userAccountId)
      .setTokenIds(params.tokenIds);
    
    const result = await handleTransaction(tx, client, context);
    
    // In RETURN_BYTES mode, log preparation instead of completion
    if (context.mode === 'returnBytes') {
      console.log(`🔗 WHBAR token association transaction prepared for signature`);
    } else {
      console.log(`✅ WHBAR token association completed`);
    }
    
    // If result contains bytes, return them at the top level for the websocket agent
    if (result && typeof result === 'object' && 'bytes' in result) {
      return {
        step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.TOKEN_ASSOCIATION,
        operation: BONZO_DEPOSIT_OPERATIONS.ASSOCIATE_WHBAR,
        success: true,
        tokenIds: params.tokenIds,
        message: context.mode === 'returnBytes' 
          ? 'WHBAR token association transaction ready for signature'
          : 'WHBAR token association completed successfully',
        bytes: result.bytes, // Put bytes at top level
        result,
      };
    }
    
    return {
      step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.TOKEN_ASSOCIATION,
      operation: BONZO_DEPOSIT_OPERATIONS.ASSOCIATE_WHBAR,
      success: true,
      tokenIds: params.tokenIds,
      message: 'WHBAR token association completed successfully',
      result,
    };
  } catch (error) {
    console.error('❌ WHBAR token association failed:', error);
    return {
      step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.TOKEN_ASSOCIATION,
      operation: BONZO_DEPOSIT_OPERATIONS.ASSOCIATE_WHBAR,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during token association',
      suggestion: 'Ensure the account has sufficient HBAR for transaction fees and the account key is valid',
    };
  }
};

/**
 * Execute HBAR deposit to Bonzo Finance
 */
export const executeBonzoDeposit = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof bonzoDepositParameters>>,
) => {
  try {

    
    const normalisedParams = normalizeBonzoDepositParams(params, context);

    console.log(`💰 Depositing ${params.hbarAmount} HBAR to Bonzo Finance...`);
    console.log(`📍 LendingPool: ${normalisedParams.lendingPoolAddress}`);
    console.log(`🏢 LendingPool Contract ID: ${BONZO_CONFIG.LENDING_POOL_CONTRACT_ID}`);
    console.log(`🏦 Account: ${normalisedParams.userAccountId}`);

    // Get the real EVM address for the user (not just account number alias)
    // This should be the actual EVM address that Bonzo Finance recognizes
    const onBehalfOfAddress = await getUserEvmAddress(client, normalisedParams.userAccountId);
    console.log(`🔄 User EVM Address (onBehalfOf): ${onBehalfOfAddress}`);
    
    const functionParameters = new ContractFunctionParameters()
      .addAddress(normalisedParams.whbarAddress)
      .addUint256(Long.fromString(normalisedParams.hbarAmountInTinybars))
      .addAddress(onBehalfOfAddress)
      .addUint16(params.referralCode || 0); // Use uint16 with default value 0

    // Use the Contract ID directly from configuration instead of converting EVM address
    const contractId = ContractId.fromString(BONZO_CONFIG.LENDING_POOL_CONTRACT_ID);
    
    const tx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(BONZO_CONFIG.GAS_LIMIT)
      .setPayableAmount(Hbar.fromTinybars(Long.fromString(normalisedParams.hbarAmountInTinybars)))
      .setFunction('deposit', functionParameters);


    const result = await handleTransaction(tx, client, context);

    // In RETURN_BYTES mode, log preparation instead of completion
    if (context.mode === 'returnBytes') {
      console.log(`🔗 HBAR deposit transaction prepared for signature`);
    } else {
      console.log(`✅ Bonzo deposit completed successfully`);
    }

    // If result contains bytes, return them at the top level for the websocket agent
    if (result && typeof result === 'object' && 'bytes' in result) {
      return {
        step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.DEPOSIT,
        operation: BONZO_DEPOSIT_OPERATIONS.DEPOSIT_HBAR,
        success: true,
        depositAmount: params.hbarAmount,
        depositAmountTinybars: normalisedParams.hbarAmountInTinybars,
        userAccount: normalisedParams.userAccountId,
        lendingPool: normalisedParams.lendingPoolAddress,
        whbarToken: normalisedParams.whbarTokenId,
        message: context.mode === 'returnBytes' 
          ? `HBAR deposit transaction ready for signature (${params.hbarAmount} HBAR)`
          : `Successfully deposited ${params.hbarAmount} HBAR to Bonzo Finance`,
        bytes: result.bytes, // Put bytes at top level
        result,
      };
    }

    return {
      step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.DEPOSIT,
      operation: BONZO_DEPOSIT_OPERATIONS.DEPOSIT_HBAR,
      success: true,
      depositAmount: params.hbarAmount,
      depositAmountTinybars: normalisedParams.hbarAmountInTinybars,
      userAccount: normalisedParams.userAccountId,
      lendingPool: normalisedParams.lendingPoolAddress,
      whbarToken: normalisedParams.whbarTokenId,
      message: `Successfully deposited ${params.hbarAmount} HBAR to Bonzo Finance`,
      nextSteps: [
        'Your HBAR has been converted to WHBAR and deposited',
        'You will receive aWHBAR tokens representing your deposit + interest',
        'Check your account balance to see the aWHBAR tokens',
        'Use Bonzo Finance interface to track your lending position',
      ],
      result,
    };
  } catch (error) {
    console.error('❌ Bonzo deposit failed:', error);
    return {
      step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.DEPOSIT,
      operation: BONZO_DEPOSIT_OPERATIONS.DEPOSIT_HBAR,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during deposit',
      suggestion: 'Ensure sufficient HBAR balance and that WHBAR token is associated to your account',
      troubleshooting: {
        commonIssues: [
          'Insufficient HBAR balance for deposit + gas fees',
          'WHBAR token not associated to account',
          'Invalid contract address or network mismatch',
          'Gas limit too low for contract execution',
        ],
        solutions: [
          'Check HBAR balance and ensure you have extra for gas fees',
          'Run WHBAR token association first',
          'Verify you are connected to Hedera Mainnet',
          'Try again with default gas limit',
        ],
      },
    };
  }
};

/**
 * Main function that handles the full deposit flow
 */
export const bonzoDepositFlow = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof bonzoDepositParameters>>,
) => {
  try {

    
    // If in RETURN_BYTES mode, only process one transaction at a time
    if (context.mode === 'returnBytes') {
      // Step 1: Associate WHBAR token if requested
      if (params.associateWhbar) {
        console.log('🚀 Starting Bonzo Finance deposit flow (RETURN_BYTES mode)...');
        console.log('Step 1: WHBAR Token Association - Preparing transaction for signature...');
        
        const associationResult = await associateWhbarToken(client, context, {
          userAccountId: params.userAccountId || context.accountId || '',
          tokenIds: [BONZO_CONFIG.WHBAR_TOKEN_ID],
        });
        
        // In RETURN_BYTES mode, return immediately after first transaction
        return {
          ...associationResult,
          nextStep: 'deposit',
          originalParams: params, // Include original parameters for next step
          message: 'WHBAR token association transaction ready for signature',
          instructions: 'Sign this transaction to associate WHBAR token, then initiate the deposit step',
        };
      } else {
        // Skip association, go directly to deposit
        console.log('🚀 Starting Bonzo Finance deposit flow (RETURN_BYTES mode)...');
        console.log('Step 1: HBAR Deposit - Preparing transaction for signature...');
        
        const depositResult = await executeBonzoDeposit(client, context, params);
        
        return {
          ...depositResult,
          originalParams: params, // Include original parameters for context
          message: 'HBAR deposit transaction ready for signature',
          instructions: 'Sign this transaction to deposit your HBAR to Bonzo Finance',
        };
      }
    }
    
    // Legacy mode: Execute both transactions sequentially (for direct execution)
    const results = [];
    
    // Step 1: Associate WHBAR token if requested
    if (params.associateWhbar) {
      console.log('🚀 Starting Bonzo Finance deposit flow...');
      console.log('Step 1: WHBAR Token Association');
      
      const associationResult = await associateWhbarToken(client, context, {
        userAccountId: params.userAccountId || context.accountId || '',
        tokenIds: [BONZO_CONFIG.WHBAR_TOKEN_ID],
      });
      
      results.push(associationResult);
      
      if (!associationResult.success) {
        return {
          operation: BONZO_DEPOSIT_OPERATIONS.FULL_DEPOSIT_FLOW,
          success: false,
          error: 'Token association failed',
          steps: results,
        };
      }
      
      console.log('✅ Step 1 completed: WHBAR token associated');
    }
    
    // Step 2: Execute deposit
    console.log('Step 2: HBAR Deposit to Bonzo Finance');
    const depositResult = await executeBonzoDeposit(client, context, params);
    results.push(depositResult);
    
    if (!depositResult.success) {
      return {
        operation: BONZO_DEPOSIT_OPERATIONS.FULL_DEPOSIT_FLOW,
        success: false,
        error: 'Deposit failed',
        steps: results,
      };
    }
    
    console.log('✅ Step 2 completed: HBAR deposited to Bonzo Finance');
    console.log('🎉 Bonzo Finance deposit flow completed successfully!');
    
    return {
      operation: BONZO_DEPOSIT_OPERATIONS.FULL_DEPOSIT_FLOW,
      success: true,
      steps: results,
      summary: {
        totalSteps: results.length,
        depositAmount: params.hbarAmount,
        userAccount: params.userAccountId || context.accountId,
        timestamp: new Date().toISOString(),
      },
      message: `Successfully completed Bonzo Finance deposit of ${params.hbarAmount} HBAR`,
    };
  } catch (error) {
    console.error('❌ Bonzo deposit flow failed:', error);
    return {
      operation: BONZO_DEPOSIT_OPERATIONS.FULL_DEPOSIT_FLOW,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in deposit flow',
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Execute only the deposit step (for use after token association is completed)
 */
export const executeBonzoDepositOnly = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof bonzoDepositParameters>>,
) => {
  try {
    console.log('🚀 Executing Bonzo Finance deposit step only...');
    
    const depositResult = await executeBonzoDeposit(client, context, params);
    
    return {
      ...depositResult,
      message: 'HBAR deposit transaction ready for signature',
      instructions: 'Sign this transaction to complete your HBAR deposit to Bonzo Finance',
    };
  } catch (error: any) {
    console.error('❌ Bonzo deposit step failed:', error);
    return {
      operation: BONZO_DEPOSIT_OPERATIONS.DEPOSIT_HBAR,
      step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.DEPOSIT,
      success: false,
      error: error.message,
    };
  }
};

// Export the tool configuration
const bonzoDepositTool = (context: Context) => ({
  method: BONZO_DEPOSIT_TOOL,
  name: 'Bonzo Finance HBAR Deposit',
  description: bonzoDepositPrompt(context),
  parameters: bonzoDepositParameters(context),
  execute: bonzoDepositFlow,
});

export default bonzoDepositTool; 