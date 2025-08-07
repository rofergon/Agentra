/**
 * HBAR Yield Optimization Workflow - Usage Examples
 * 
 * This file demonstrates how to integrate the yield optimization workflow
 * into your WebSocket agent to provide personalized investment recommendations.
 */

import { Client } from '@hashgraph/sdk';
import { Context } from '../../../src/shared/configuration';
import { 
  HbarYieldOptimizationWorkflow, 
  YieldOptimizationProfile,
  EXAMPLE_SCENARIOS,
  createHbarYieldOptimizationWorkflow
} from './hbar-yield-optimization-workflow';

/**
 * Example 1: New User Scenario
 * User prompt: "I am a new user to the Hedera network, and I have a lot of hbar that I plan on keeping for 6-9 months. I want to find a way to optimize my returns."
 */
export async function handleNewUserYieldOptimization(
  client: Client,
  context: Context,
  userAccountId: string,
  hbarAmount: number
): Promise<string> {
  
  // Create workflow instance
  const workflow = createHbarYieldOptimizationWorkflow(client, context, userAccountId);
  
  // Define user profile based on their message
  const profile: YieldOptimizationProfile = {
    totalHbar: hbarAmount,
    timelineMonths: 8, // Middle of 6-9 month range
    riskTolerance: 'conservative', // New user = conservative
    experienceLevel: 'novice',
    liquidityPreference: 'high', // New users typically want flexibility
    userAccountId: userAccountId
  };

  try {
    // Get personalized recommendations
    const recommendation = await workflow.optimizeYieldStrategy(profile);
    
    // Format response for user
    return formatRecommendationResponse(recommendation, profile);
    
  } catch (error) {
    console.error('❌ Error generating recommendations:', error);
    return `I apologize, but I encountered an error while analyzing yield opportunities. Please ensure you have a valid Hedera account and try again. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Example 2: Experienced User with Specific Requirements
 */
export async function handleExperiencedUserOptimization(
  client: Client,
  context: Context,
  userAccountId: string,
  requirements: {
    hbarAmount: number;
    timelineMonths: number;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    liquidityNeeds: 'high' | 'medium' | 'low';
  }
): Promise<string> {
  
  const workflow = createHbarYieldOptimizationWorkflow(client, context, userAccountId);
  
  const profile: YieldOptimizationProfile = {
    totalHbar: requirements.hbarAmount,
    timelineMonths: requirements.timelineMonths,
    riskTolerance: requirements.riskTolerance,
    experienceLevel: 'intermediate',
    liquidityPreference: requirements.liquidityNeeds,
    userAccountId: userAccountId
  };

  try {
    const recommendation = await workflow.optimizeYieldStrategy(profile);
    return formatDetailedRecommendationResponse(recommendation, profile);
    
  } catch (error) {
    console.error('❌ Error generating recommendations:', error);
    return `I encountered an issue while analyzing the market. Please try again or contact support. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Example 3: Portfolio Rebalancing for Existing DeFi User
 */
export async function handlePortfolioRebalancing(
  client: Client,
  context: Context,
  userAccountId: string,
  currentHoldings: {
    availableHbar: number;
    bonzoDeposits: number;
    infinityPoolStake: number;
    otherPositions: number;
  }
): Promise<string> {
  
  const workflow = createHbarYieldOptimizationWorkflow(client, context, userAccountId);
  
  // Calculate total portfolio value
  const totalValue = currentHoldings.availableHbar + currentHoldings.bonzoDeposits + 
                    currentHoldings.infinityPoolStake + currentHoldings.otherPositions;
  
  const profile: YieldOptimizationProfile = {
    totalHbar: totalValue,
    timelineMonths: 12, // Assume longer timeline for rebalancing
    riskTolerance: 'moderate',
    experienceLevel: 'advanced', // Has existing positions
    liquidityPreference: 'medium',
    userAccountId: userAccountId
  };

  try {
    const recommendation = await workflow.optimizeYieldStrategy(profile);
    
    // Add rebalancing-specific analysis
    const rebalancingAnalysis = analyzeRebalancingNeeds(currentHoldings, recommendation);
    
    return formatRebalancingResponse(recommendation, profile, rebalancingAnalysis);
    
  } catch (error) {
    console.error('❌ Error analyzing portfolio:', error);
    return `I couldn't complete the portfolio analysis. Please verify your account details and try again. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Format basic recommendation response for new users
 */
function formatRecommendationResponse(recommendation: any, profile: YieldOptimizationProfile): string {
  let response = `🎯 **HBAR Yield Optimization Recommendation**\n\n`;
  
  response += `Based on your ${profile.totalHbar} HBAR and ${profile.timelineMonths}-month timeline, here's my analysis:\n\n`;
  
  response += `**🏆 Recommended Strategy: ${recommendation.strategy}**\n`;
  response += `Expected Total APY: ${recommendation.totalExpectedApy.toFixed(2)}%\n`;
  response += `Risk Level: ${recommendation.riskLevel}\n`;
  response += `Estimated Setup Time: ${recommendation.timeToExecute}\n\n`;
  
  response += `**💰 Allocation Breakdown:**\n`;
  
  if (recommendation.allocation.bonzoFinance) {
    const bonzo = recommendation.allocation.bonzoFinance;
    response += `• **Bonzo Finance**: ${bonzo.amount} HBAR (${bonzo.expectedApy.toFixed(2)}% APY)\n`;
    response += `  └─ ${bonzo.reason}\n\n`;
  }
  
  if (recommendation.allocation.infinityPool) {
    const infinity = recommendation.allocation.infinityPool;
    response += `• **SaucerSwap Infinity Pool**: Convert ~${(infinity.amount / 100).toFixed(0)} HBAR to SAUCE (${infinity.expectedApy.toFixed(2)}% APY)\n`;
    response += `  └─ ${infinity.reason}\n\n`;
  }
  
  response += `**📋 Next Steps:**\n`;
  recommendation.nextSteps.forEach((step: string, index: number) => {
    response += `${index + 1}. ${step}\n`;
  });
  
  response += `\n**⚠️ Important Considerations:**\n`;
  recommendation.considerations.forEach((consideration: string) => {
    response += `• ${consideration}\n`;
  });
  
  response += `\n*This recommendation is based on current market conditions and your risk profile. Always do your own research before investing.*`;
  
  return response;
}

/**
 * Format detailed recommendation with technical details
 */
function formatDetailedRecommendationResponse(recommendation: any, profile: YieldOptimizationProfile): string {
  let response = formatRecommendationResponse(recommendation, profile);
  
  response += `\n\n**🔧 Technical Implementation:**\n`;
  
  if (recommendation.allocation.bonzoFinance) {
    response += `\n**Bonzo Finance Setup:**\n`;
    response += `1. Visit Bonzo Finance dApp or use agent tools\n`;
    response += `2. Connect wallet and deposit ${recommendation.allocation.bonzoFinance.amount} HBAR\n`;
    response += `3. Receive aWHBAR tokens that accrue interest\n`;
    response += `4. Monitor yields and withdraw when needed\n`;
  }
  
  if (recommendation.allocation.infinityPool) {
    response += `\n**Infinity Pool Setup:**\n`;
    response += `1. Swap HBAR to SAUCE on SaucerSwap DEX\n`;
    response += `2. Stake SAUCE tokens in Infinity Pool\n`;
    response += `3. Receive xSAUCE representing your staked position\n`;
    response += `4. Earn rewards from trading fees and protocol emissions\n`;
  }
  
  if (recommendation.allocation.autoswapOrders) {
    response += `\n**AutoSwap Limit Orders:**\n`;
    response += `1. Set up automated limit orders for strategic entries\n`;
    response += `2. Use dollar-cost averaging for volatile markets\n`;
    response += `3. Monitor order execution and adjust parameters\n`;
  }
  
  return response;
}

/**
 * Analyze current portfolio and identify rebalancing opportunities
 */
function analyzeRebalancingNeeds(currentHoldings: any, recommendation: any): any {
  const analysis = {
    overAllocated: [] as string[],
    underAllocated: [] as string[],
    rebalanceActions: [] as string[]
  };
  
  // Compare current allocation vs recommended
  const totalValue = Object.values(currentHoldings).reduce((sum: number, val: any) => sum + val, 0);
  
  // Calculate current percentages
  const currentBonzoPercent = (currentHoldings.bonzoDeposits / totalValue) * 100;
  const currentInfinityPercent = (currentHoldings.infinityPoolStake / totalValue) * 100;
  
  // Calculate recommended percentages (simplified)
  const recBonzoAmount = recommendation.allocation.bonzoFinance?.amount || 0;
  const recInfinityAmount = recommendation.allocation.infinityPool?.amount || 0;
  const recTotal = recBonzoAmount + recInfinityAmount;
  
  if (recTotal > 0) {
    const recBonzoPercent = (recBonzoAmount / recTotal) * 100;
    const recInfinityPercent = (recInfinityAmount / recTotal) * 100;
    
    if (Math.abs(currentBonzoPercent - recBonzoPercent) > 10) {
      if (currentBonzoPercent > recBonzoPercent) {
        analysis.overAllocated.push('Bonzo Finance');
        analysis.rebalanceActions.push(`Consider withdrawing ${(currentBonzoPercent - recBonzoPercent).toFixed(1)}% from Bonzo`);
      } else {
        analysis.underAllocated.push('Bonzo Finance');
        analysis.rebalanceActions.push(`Consider increasing Bonzo allocation by ${(recBonzoPercent - currentBonzoPercent).toFixed(1)}%`);
      }
    }
  }
  
  return analysis;
}

/**
 * Format rebalancing-specific response
 */
function formatRebalancingResponse(recommendation: any, profile: YieldOptimizationProfile, rebalanceAnalysis: any): string {
  let response = `🔄 **Portfolio Rebalancing Analysis**\n\n`;
  
  response += `Current Portfolio Value: ${profile.totalHbar} HBAR equivalent\n\n`;
  
  response += formatRecommendationResponse(recommendation, profile);
  
  if (rebalanceAnalysis.rebalanceActions.length > 0) {
    response += `\n\n**🎯 Rebalancing Actions:**\n`;
    rebalanceAnalysis.rebalanceActions.forEach((action: string, index: number) => {
      response += `${index + 1}. ${action}\n`;
    });
  }
  
  if (rebalanceAnalysis.overAllocated.length > 0) {
    response += `\n**📈 Over-allocated positions:**\n`;
    rebalanceAnalysis.overAllocated.forEach((position: string) => {
      response += `• ${position}\n`;
    });
  }
  
  if (rebalanceAnalysis.underAllocated.length > 0) {
    response += `\n**📉 Under-allocated positions:**\n`;
    rebalanceAnalysis.underAllocated.forEach((position: string) => {
      response += `• ${position}\n`;
    });
  }
  
  return response;
}

/**
 * Quick helper to demonstrate all example scenarios
 */
export async function demonstrateAllScenarios(client: Client, context: Context) {
  console.log('🚀 Demonstrating HBAR Yield Optimization Scenarios\n');
  
  // Example 1: Conservative new user
  console.log('📊 Scenario 1: New Conservative User');
  try {
    const result1 = await handleNewUserYieldOptimization(
      client, 
      context, 
      EXAMPLE_SCENARIOS.CONSERVATIVE_NEW_USER.userAccountId,
      EXAMPLE_SCENARIOS.CONSERVATIVE_NEW_USER.totalHbar
    );
    console.log(result1.substring(0, 200) + '...\n');
  } catch (error) {
    console.log(`Error in scenario 1: ${error}\n`);
  }
  
  // Example 2: Balanced experienced user
  console.log('📊 Scenario 2: Balanced Experienced User');
  try {
    const result2 = await handleExperiencedUserOptimization(
      client,
      context,
      EXAMPLE_SCENARIOS.BALANCED_EXPERIENCED.userAccountId,
      {
        hbarAmount: EXAMPLE_SCENARIOS.BALANCED_EXPERIENCED.totalHbar,
        timelineMonths: EXAMPLE_SCENARIOS.BALANCED_EXPERIENCED.timelineMonths,
        riskTolerance: EXAMPLE_SCENARIOS.BALANCED_EXPERIENCED.riskTolerance,
        liquidityNeeds: EXAMPLE_SCENARIOS.BALANCED_EXPERIENCED.liquidityPreference
      }
    );
    console.log(result2.substring(0, 200) + '...\n');
  } catch (error) {
    console.log(`Error in scenario 2: ${error}\n`);
  }
  
  // Example 3: Portfolio rebalancing
  console.log('📊 Scenario 3: Portfolio Rebalancing');
  try {
    const result3 = await handlePortfolioRebalancing(
      client,
      context,
      EXAMPLE_SCENARIOS.AGGRESSIVE_WHALE.userAccountId,
      {
        availableHbar: 5000,
        bonzoDeposits: 8000,
        infinityPoolStake: 5000,
        otherPositions: 2000
      }
    );
    console.log(result3.substring(0, 200) + '...\n');
  } catch (error) {
    console.log(`Error in scenario 3: ${error}\n`);
  }
}

/**
 * Integration example for WebSocket agent
 */
export class YieldOptimizationIntegration {
  private workflow: HbarYieldOptimizationWorkflow;
  
  constructor(client: Client, context: Context, userAccountId: string) {
    this.workflow = createHbarYieldOptimizationWorkflow(client, context, userAccountId);
  }
  
  /**
   * Parse user message and determine if it's requesting yield optimization
   */
  async handleUserMessage(message: string, userAccountId: string): Promise<string | null> {
    const lowerMessage = message.toLowerCase();
    
    // Keywords that indicate yield optimization request
    const yieldKeywords = [
      'optimize returns', 'maximize yield', 'best apy', 'investment strategy',
      'where to stake', 'defi opportunities', 'earn interest', 'passive income',
      'bonzo or saucerswap', 'infinity pool', 'lending vs staking'
    ];
    
    const hasYieldKeywords = yieldKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (!hasYieldKeywords) {
      return null; // Not a yield optimization request
    }
    
    // Extract HBAR amount if mentioned
    const hbarMatch = message.match(/(\d+[\d,]*)\s*hbar/i);
    const hbarAmount = hbarMatch ? parseInt(hbarMatch[1].replace(/,/g, '')) : 1000; // Default to 1000
    
    // Extract timeline if mentioned
    const timelineMatch = message.match(/(\d+)[-\s]*(\d+)?\s*months?/i);
    const timelineMonths = timelineMatch ? parseInt(timelineMatch[1]) : 6; // Default to 6 months
    
    // Determine risk tolerance from message context
    let riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'conservative';
    if (lowerMessage.includes('aggressive') || lowerMessage.includes('high risk') || lowerMessage.includes('maximum')) {
      riskTolerance = 'aggressive';
    } else if (lowerMessage.includes('moderate') || lowerMessage.includes('balanced')) {
      riskTolerance = 'moderate';
    }
    
    // Determine experience level
    let experienceLevel: 'novice' | 'intermediate' | 'advanced' = 'novice';
    if (lowerMessage.includes('new user') || lowerMessage.includes('beginner')) {
      experienceLevel = 'novice';
    } else if (lowerMessage.includes('experienced') || lowerMessage.includes('familiar')) {
      experienceLevel = 'intermediate';
    } else if (lowerMessage.includes('expert') || lowerMessage.includes('advanced')) {
      experienceLevel = 'advanced';
    }
    
    // Generate recommendation
    return await handleNewUserYieldOptimization(
      this.workflow['client'], // Access private client
      this.workflow['context'], // Access private context
      userAccountId,
      hbarAmount
    );
  }
}