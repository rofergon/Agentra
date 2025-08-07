import { SwapQuote, PendingStep, TOKEN_NAMES } from '../types/websocket-types';

/**
 * Utilities for extracting information from agent responses
 */
export class AgentResponseUtils {
  private static network: 'mainnet' | 'testnet';

  static setNetwork(network: 'mainnet' | 'testnet'): void {
    this.network = network;
  }

  static getNetwork(): 'mainnet' | 'testnet' {
    return this.network || 'mainnet';
  }

  /**
   * Extract transaction bytes from agent response
   */
  static extractBytesFromAgentResponse(response: any): any {
    if (
      response.intermediateSteps &&
      response.intermediateSteps.length > 0 &&
      response.intermediateSteps[0].observation
    ) {
      const obs = response.intermediateSteps[0].observation;
      try {
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
        if (obsObj.bytes) {
          return obsObj.bytes;
        }
      } catch (e) {
        console.error('Error parsing observation:', e);
      }
    }
    return undefined;
  }

  /**
   * Extract swap quote from agent response
   */
  static extractSwapQuoteFromAgentResponse(response: any): SwapQuote | undefined {
    if (
      response.intermediateSteps &&
      response.intermediateSteps.length > 0 &&
      response.intermediateSteps[0].observation
    ) {
      const obs = response.intermediateSteps[0].observation;
      try {
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
        
        // Check if this is a SaucerSwap quote response
        if (obsObj.success && obsObj.quote && obsObj.operation && 
            (obsObj.operation === 'get_amounts_out' || obsObj.operation === 'get_amounts_in')) {
          console.log('💱 DETECTED SWAP QUOTE:', obsObj.operation);
          
          // Extract token names from token IDs
          const inputToken = this.getTokenName(obsObj.quote.input.token);
          const outputToken = this.getTokenName(obsObj.quote.output.token);
          
          return {
            type: 'SWAP_QUOTE',
            timestamp: Date.now(),
            quote: {
              operation: obsObj.operation,
              network: obsObj.network || this.getNetwork(),
              input: {
                token: inputToken,
                tokenId: obsObj.quote.input.token,
                amount: obsObj.quote.input.amount,
                formatted: obsObj.quote.input.formatted
              },
              output: {
                token: outputToken,
                tokenId: obsObj.quote.output.token,
                amount: obsObj.quote.output.amount,
                formatted: obsObj.quote.output.formatted
              },
              path: obsObj.quote.path || [],
              fees: obsObj.quote.fees || [],
              exchangeRate: obsObj.quote.exchangeRate || '0',
              gasEstimate: obsObj.gasEstimate
            },
            originalMessage: response?.output || 'Swap quote available'
          };
        }
      } catch (e) {
        console.error('Error parsing swap quote:', e);
      }
    }
    return undefined;
  }

  /**
   * Extract next step information from agent response
   */
  static extractNextStepFromAgentResponse(response: any): PendingStep | undefined {
    if (
      response.intermediateSteps &&
      response.intermediateSteps.length > 0 &&
      response.intermediateSteps[0].observation
    ) {
      const obs = response.intermediateSteps[0].observation;
      try {
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
        
        console.log('🔍 EXTRACTING NEXT STEP - RAW OBSERVATION:');
        console.log('   obsObj.nextStep:', obsObj.nextStep);
        console.log('   obsObj.step:', obsObj.step);
        console.log('   obsObj.operation:', obsObj.operation);
        console.log('   obsObj.originalParams:', obsObj.originalParams);
        
        // Check if this is a SaucerSwap Infinity Pool flow with next step (CHECK FIRST - MOST SPECIFIC)
        if (obsObj.nextStep && (
          obsObj.toolType === 'infinity_pool' ||
          obsObj.protocol === 'saucerswap' ||
          (obsObj.step === 'token_association' && obsObj.operation === 'associate_tokens' && obsObj.originalParams?.operation === 'full_stake_flow') ||
          (obsObj.step === 'token_association' && obsObj.operation?.includes('sauce')) || 
          obsObj.step === 'token_approval' || 
          obsObj.step === 'stake' || 
          obsObj.operation?.includes('infinity_pool') || 
          obsObj.operation?.includes('sauce') ||
          obsObj.operation?.includes('associate_tokens') ||
          obsObj.operation?.includes('approve_sauce') ||
          obsObj.operation?.includes('stake_sauce') ||
          (obsObj.operation && (obsObj.operation === 'associate_tokens' || obsObj.operation === 'approve_sauce' || obsObj.operation === 'stake_sauce')) ||
          (obsObj.originalParams?.operation === 'full_stake_flow') ||
          (obsObj.originalParams?.sauceAmount !== undefined)
        )) {
          console.log('🎯 DETECTED INFINITY POOL NEXT STEP:');
          console.log(`   Tool Type: ${obsObj.toolType}`);
          console.log(`   Protocol: ${obsObj.protocol}`);
          console.log(`   Step: ${obsObj.step}`);
          console.log(`   Operation: ${obsObj.operation}`);
          console.log(`   NextStep: ${obsObj.nextStep}`);
          console.log('🎯 =====================================');
          return {
            tool: obsObj.toolInfo?.name || 'saucerswap_infinity_pool_tool',
            operation: obsObj.operation || 'infinity_pool_operation',
            step: obsObj.nextStep,
            originalParams: obsObj.originalParams || {},
            nextStepInstructions: obsObj.instructions || obsObj.message
          };
        }
        
        // Check if this is a Bonzo deposit flow with next step (CHECK SECOND - LESS SPECIFIC)
        if (obsObj.nextStep && obsObj.step && obsObj.operation && 
            (obsObj.operation.includes('bonzo') || 
             obsObj.operation.includes('whbar') || 
             obsObj.operation === 'associate_whbar' ||
             obsObj.operation === 'associate_token' ||
             obsObj.operation === 'approve_token' ||
             obsObj.operation.includes('deposit') || 
             obsObj.step === 'deposit' ||
             obsObj.step === 'token_approval' ||
             obsObj.nextStep === 'approval' ||
             obsObj.nextStep === 'deposit')) {
          console.log('🎯 DETECTED BONZO NEXT STEP:');
          console.log(`   Step: ${obsObj.step}`);
          console.log(`   Operation: ${obsObj.operation}`);
          console.log(`   NextStep: ${obsObj.nextStep}`);
          console.log(`   OriginalParams:`, obsObj.originalParams);
          return {
            tool: obsObj.toolInfo?.name || 'bonzo_deposit_tool',
            operation: obsObj.operation,
            step: obsObj.nextStep,
            originalParams: obsObj.originalParams || {},
            nextStepInstructions: obsObj.instructions || obsObj.message
          };
        }
        
      } catch (e) {
        console.error('Error parsing next step:', e);
      }
    }
    return undefined;
  }

  /**
   * Get token name from token ID
   */
  private static getTokenName(tokenId: string): string {
    return TOKEN_NAMES[tokenId] || tokenId;
  }
}