import { z } from 'zod';
import type { Context } from '../../../configuration';
import { Client, TokenAssociateTransaction, ContractExecuteTransaction, ContractFunctionParameters, Hbar, AccountId, ContractId, AccountInfoQuery } from '@hashgraph/sdk';
import { handleTransaction } from '../../../strategies/tx-mode-strategy';
import Long from 'long';
import { bonzoDepositParameters, BONZO_CONFIG, getTokenConfig, convertToBaseUnits, BonzoSupportedToken } from '../../../parameter-schemas/bonzo.zod';
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
  ASSOCIATE_TOKEN: 'associate_token',
  DEPOSIT_TOKEN: 'deposit_token',
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
 * Comprehensive parameter normalizer for Bonzo deposits with multi-token support
 */
const normalizeBonzoDepositParams = (
  params: z.infer<ReturnType<typeof bonzoDepositParameters>>,
  context: Context,
) => {
  const userAccountId = params.userAccountId || context.accountId;
  if (!userAccountId) {
    throw new Error('User account ID is required either in params or context');
  }

  // Get token configuration based on token type
  const tokenConfig = getTokenConfig(params.token as BonzoSupportedToken);
  
  // Convert amount to base units (tinybars for HBAR, smallest unit for other tokens)
  const amountInBaseUnits = convertToBaseUnits(params.amount, tokenConfig.decimals);
  
  return {
    ...params,
    userAccountId,
    amountInBaseUnits,
    tokenId: tokenConfig.tokenId,
    tokenAddress: tokenConfig.tokenAddress,
    lendingPoolAddress: BONZO_CONFIG.LENDING_POOL_ADDRESS,
    isNativeHbar: tokenConfig.isNativeHbar,
    symbol: tokenConfig.symbol,
    wrappedSymbol: tokenConfig.wrappedSymbol,
    decimals: tokenConfig.decimals,
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

This tool enables multi-token deposits into Bonzo Finance DeFi protocol on Hedera (${BONZO_CONFIG.NETWORK.toUpperCase()}).

**IMPORTANT SECURITY NOTES:**
- This tool operates on HEDERA ${BONZO_CONFIG.NETWORK.toUpperCase()} with REAL FUNDS
- All transactions are irreversible once confirmed
- Double-check token type and amounts before confirming transactions
- Only use with accounts you control

**Supported Tokens:**
- **HBAR** (Native Hedera token) → receives aWHBAR
- **SAUCE** (SaucerSwap governance token) → receives aSAUCE  
- **xSAUCE** (Staked SAUCE token) → receives axSAUCE
- **USDC** (USD Coin stablecoin) → receives aUSDC

**Deposit Process:**
1. Token Association (if needed) - Associates your account with the selected token
2. Token Deposit - Calls LendingPool.deposit() with your tokens to receive interest-bearing aTokens

**Parameters:**
- token (string, required): Token to deposit - 'hbar', 'sauce', 'xsauce', or 'usdc' (default: 'hbar')
- amount (number, required): Amount of tokens to deposit (e.g., 10.5 HBAR, 100 SAUCE)
- ${userAccountDesc}
- associateToken (boolean, optional): Whether to associate the token if not already associated (default: true)
- referralCode (number, optional): Referral code for the deposit (defaults to 0)
- transactionMemo (string, optional): Optional memo for the transactions

**Contract Addresses (${BONZO_CONFIG.NETWORK.toUpperCase()}):**
- LendingPool: ${BONZO_CONFIG.LENDING_POOL_ADDRESS}
- LendingPool Contract ID: ${BONZO_CONFIG.LENDING_POOL_CONTRACT_ID}

**What you'll receive:**
- aToken (interest-bearing tokens) representing your deposit + accumulated interest
- Ability to withdraw your tokens plus interest later
- Participation in Bonzo Finance lending protocol

**Examples:**
- Deposit HBAR: token="hbar", amount=10.5
- Deposit SAUCE: token="sauce", amount=1000
- Deposit USDC: token="usdc", amount=50

${usageInstructions}
`;
};

/**
 * Execute token association transaction for any supported token
 */
export const associateToken = async (
  client: Client,
  context: Context,
  params: { userAccountId: string; tokenIds: string[]; tokenSymbol: string },
) => {
  try {
    console.log(`🔗 Associating ${params.tokenSymbol} token for account ${params.userAccountId}...`);
    
    const tx = new TokenAssociateTransaction()
      .setAccountId(params.userAccountId)
      .setTokenIds(params.tokenIds);
    
    const result = await handleTransaction(tx, client, context);
    
    // In RETURN_BYTES mode, log preparation instead of completion
    if (context.mode === 'returnBytes') {
      console.log(`🔗 ${params.tokenSymbol} token association transaction prepared for signature`);
    } else {
      console.log(`✅ ${params.tokenSymbol} token association completed`);
    }
    
    // If result contains bytes, return them at the top level for the websocket agent
    if (result && typeof result === 'object' && 'bytes' in result) {
      return {
        step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.TOKEN_ASSOCIATION,
        operation: BONZO_DEPOSIT_OPERATIONS.ASSOCIATE_TOKEN,
        success: true,
        tokenIds: params.tokenIds,
        tokenSymbol: params.tokenSymbol,
        message: context.mode === 'returnBytes' 
          ? `${params.tokenSymbol} token association transaction ready for signature`
          : `${params.tokenSymbol} token association completed successfully`,
        bytes: result.bytes, // Put bytes at top level
        result,
      };
    }
    
    return {
      step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.TOKEN_ASSOCIATION,
      operation: BONZO_DEPOSIT_OPERATIONS.ASSOCIATE_TOKEN,
      success: true,
      tokenIds: params.tokenIds,
      tokenSymbol: params.tokenSymbol,
      message: `${params.tokenSymbol} token association completed successfully`,
      result,
    };
  } catch (error) {
    console.error(`❌ ${params.tokenSymbol} token association failed:`, error);
    return {
      step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.TOKEN_ASSOCIATION,
      operation: BONZO_DEPOSIT_OPERATIONS.ASSOCIATE_TOKEN,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during token association',
      suggestion: 'Ensure the account has sufficient HBAR for transaction fees and the account key is valid',
    };
  }
};

/**
 * Execute multi-token deposit to Bonzo Finance
 */
export const executeBonzoDeposit = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof bonzoDepositParameters>>,
) => {
  try {
    const normalisedParams = normalizeBonzoDepositParams(params, context);

    console.log(`💰 Depositing ${params.amount} ${normalisedParams.symbol} to Bonzo Finance...`);
    console.log(`📍 LendingPool: ${normalisedParams.lendingPoolAddress}`);
    console.log(`🏢 LendingPool Contract ID: ${BONZO_CONFIG.LENDING_POOL_CONTRACT_ID}`);
    console.log(`🏦 Account: ${normalisedParams.userAccountId}`);
    console.log(`🪙 Token: ${normalisedParams.symbol} (${normalisedParams.tokenId})`);

    // Get the real EVM address for the user (not just account number alias)
    const onBehalfOfAddress = await getUserEvmAddress(client, normalisedParams.userAccountId);
    console.log(`🔄 User EVM Address (onBehalfOf): ${onBehalfOfAddress}`);
    
    const functionParameters = new ContractFunctionParameters()
      .addAddress(normalisedParams.tokenAddress)
      .addUint256(Long.fromString(normalisedParams.amountInBaseUnits))
      .addAddress(onBehalfOfAddress)
      .addUint16(params.referralCode || 0);

    // Use the Contract ID directly from configuration
    const contractId = ContractId.fromString(BONZO_CONFIG.LENDING_POOL_CONTRACT_ID);
    
    const tx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(BONZO_CONFIG.GAS_LIMIT)
      .setFunction('deposit', functionParameters);

    // Only set payable amount for native HBAR (wrapped to WHBAR)
    if (normalisedParams.isNativeHbar) {
      tx.setPayableAmount(Hbar.fromTinybars(Long.fromString(normalisedParams.amountInBaseUnits)));
      console.log(`💸 Setting payable amount: ${params.amount} HBAR (native token)`);
    } else {
      console.log(`🔗 ERC-20 token transfer: ${params.amount} ${normalisedParams.symbol}`);
    }

    const result = await handleTransaction(tx, client, context);

    // In RETURN_BYTES mode, log preparation instead of completion
    if (context.mode === 'returnBytes') {
      console.log(`🔗 ${normalisedParams.symbol} deposit transaction prepared for signature`);
    } else {
      console.log(`✅ Bonzo ${normalisedParams.symbol} deposit completed successfully`);
    }

    // If result contains bytes, return them at the top level for the websocket agent
    if (result && typeof result === 'object' && 'bytes' in result) {
      return {
        step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.DEPOSIT,
        operation: BONZO_DEPOSIT_OPERATIONS.DEPOSIT_TOKEN,
        success: true,
        depositAmount: params.amount,
        depositAmountBaseUnits: normalisedParams.amountInBaseUnits,
        token: normalisedParams.symbol,
        tokenId: normalisedParams.tokenId,
        userAccount: normalisedParams.userAccountId,
        lendingPool: normalisedParams.lendingPoolAddress,
        isNativeHbar: normalisedParams.isNativeHbar,
        message: context.mode === 'returnBytes' 
          ? `${normalisedParams.symbol} deposit transaction ready for signature (${params.amount} ${normalisedParams.symbol})`
          : `Successfully deposited ${params.amount} ${normalisedParams.symbol} to Bonzo Finance`,
        bytes: result.bytes, // Put bytes at top level
        result,
      };
    }

    return {
      step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.DEPOSIT,
      operation: BONZO_DEPOSIT_OPERATIONS.DEPOSIT_TOKEN,
      success: true,
      depositAmount: params.amount,
      depositAmountBaseUnits: normalisedParams.amountInBaseUnits,
      token: normalisedParams.symbol,
      tokenId: normalisedParams.tokenId,
      userAccount: normalisedParams.userAccountId,
      lendingPool: normalisedParams.lendingPoolAddress,
      isNativeHbar: normalisedParams.isNativeHbar,
      message: `Successfully deposited ${params.amount} ${normalisedParams.symbol} to Bonzo Finance`,
      nextSteps: [
        `Your ${normalisedParams.symbol} has been deposited to Bonzo Finance`,
        `You will receive a${normalisedParams.wrappedSymbol} tokens representing your deposit + interest`,
        `Check your account balance to see the a${normalisedParams.wrappedSymbol} tokens`,
        'Use Bonzo Finance interface to track your lending position',
      ],
      result,
    };
  } catch (error) {
    console.error(`❌ Bonzo ${params.token} deposit failed:`, error);
    return {
      step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.DEPOSIT,
      operation: BONZO_DEPOSIT_OPERATIONS.DEPOSIT_TOKEN,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during deposit',
      suggestion: `Ensure sufficient ${params.token.toUpperCase()} balance and that ${params.token.toUpperCase()} token is associated to your account`,
      troubleshooting: {
        commonIssues: [
          `Insufficient ${params.token.toUpperCase()} balance for deposit + gas fees`,
          `${params.token.toUpperCase()} token not associated to account`,
          'Invalid contract address or network mismatch',
          'Gas limit too low for contract execution',
        ],
        solutions: [
          `Check ${params.token.toUpperCase()} balance and ensure you have HBAR for gas fees`,
          `Run ${params.token.toUpperCase()} token association first`,
          `Verify you are connected to Hedera ${BONZO_CONFIG.NETWORK.toUpperCase()}`,
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

    
    const normalisedParams = normalizeBonzoDepositParams(params, context);
    
    // If in RETURN_BYTES mode, only process one transaction at a time
    if (context.mode === 'returnBytes') {
      // Step 1: Associate token if requested
      if (params.associateToken) {
        console.log('🚀 Starting Bonzo Finance deposit flow (RETURN_BYTES mode)...');
        console.log(`Step 1: ${normalisedParams.symbol} Token Association - Preparing transaction for signature...`);
        
        const associationResult = await associateToken(client, context, {
          userAccountId: params.userAccountId || context.accountId || '',
          tokenIds: [normalisedParams.tokenId],
          tokenSymbol: normalisedParams.symbol,
        });
        
        // In RETURN_BYTES mode, return immediately after first transaction
        return {
          ...associationResult,
          nextStep: 'deposit',
          originalParams: params, // Include original parameters for next step
          message: `${normalisedParams.symbol} token association transaction ready for signature`,
          instructions: `Sign this transaction to associate ${normalisedParams.symbol} token, then initiate the deposit step`,
        };
      } else {
        // Skip association, go directly to deposit
        console.log('🚀 Starting Bonzo Finance deposit flow (RETURN_BYTES mode)...');
        console.log(`Step 1: ${normalisedParams.symbol} Deposit - Preparing transaction for signature...`);
        
        const depositResult = await executeBonzoDeposit(client, context, params);
        
        return {
          ...depositResult,
          originalParams: params, // Include original parameters for context
          message: `${normalisedParams.symbol} deposit transaction ready for signature`,
          instructions: `Sign this transaction to deposit your ${normalisedParams.symbol} to Bonzo Finance`,
        };
      }
    }
    
    // Legacy mode: Execute both transactions sequentially (for direct execution)
    const results = [];
    
    // Step 1: Associate token if requested
    if (params.associateToken) {
      console.log('🚀 Starting Bonzo Finance deposit flow...');
      console.log(`Step 1: ${normalisedParams.symbol} Token Association`);
      
      const associationResult = await associateToken(client, context, {
        userAccountId: params.userAccountId || context.accountId || '',
        tokenIds: [normalisedParams.tokenId],
        tokenSymbol: normalisedParams.symbol,
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
      
      console.log(`✅ Step 1 completed: ${normalisedParams.symbol} token associated`);
    }
    
    // Step 2: Execute deposit
    console.log(`Step 2: ${normalisedParams.symbol} Deposit to Bonzo Finance`);
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
    
    console.log(`✅ Step 2 completed: ${normalisedParams.symbol} deposited to Bonzo Finance`);
    console.log('🎉 Bonzo Finance deposit flow completed successfully!');
    
    return {
      operation: BONZO_DEPOSIT_OPERATIONS.FULL_DEPOSIT_FLOW,
      success: true,
      steps: results,
      summary: {
        totalSteps: results.length,
        depositAmount: params.amount,
        token: normalisedParams.symbol,
        userAccount: params.userAccountId || context.accountId,
        timestamp: new Date().toISOString(),
      },
      message: `Successfully completed Bonzo Finance deposit of ${params.amount} ${normalisedParams.symbol}`,
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
    const normalisedParams = normalizeBonzoDepositParams(params, context);
    console.log(`🚀 Executing Bonzo Finance ${normalisedParams.symbol} deposit step only...`);
    
    const depositResult = await executeBonzoDeposit(client, context, params);
    
    return {
      ...depositResult,
      message: `${normalisedParams.symbol} deposit transaction ready for signature`,
      instructions: `Sign this transaction to complete your ${normalisedParams.symbol} deposit to Bonzo Finance`,
    };
  } catch (error: any) {
    console.error('❌ Bonzo deposit step failed:', error);
    return {
      operation: BONZO_DEPOSIT_OPERATIONS.DEPOSIT_TOKEN,
      step: BONZO_DEPOSIT_CONFIG.STEP_TYPES.DEPOSIT,
      success: false,
      error: error.message,
    };
  }
};

// Export the tool configuration
const bonzoDepositTool = (context: Context) => ({
  method: BONZO_DEPOSIT_TOOL,
  name: 'Bonzo Finance Multi-Token Deposit',
  description: bonzoDepositPrompt(context),
  parameters: bonzoDepositParameters(context),
  execute: bonzoDepositFlow,
});

export default bonzoDepositTool; 