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
    try {
      const steps: any[] = Array.isArray(response?.intermediateSteps)
        ? response.intermediateSteps
        : [];

      const candidates: Array<{ bytes: any; op?: string; step?: string }> = [];

      for (const s of steps) {
        if (!s?.observation) continue;
        const obs = s.observation;
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
        if (obsObj?.bytes) {
          candidates.push({ bytes: obsObj.bytes, op: obsObj.operation, step: obsObj.step });
        }
      }

      if (candidates.length === 0) return undefined;

      // Priority: associate_tokens -> approve_sauce -> others (e.g., stake)
      const byAssociation = candidates.find(
        (c) => c.op === 'associate_tokens' || c.step === 'token_association',
      );
      if (byAssociation) return byAssociation.bytes;

      const byApproval = candidates.find(
        (c) => c.op === 'approve_sauce' || c.step === 'token_approval',
      );
      if (byApproval) return byApproval.bytes;

      // Fallback: first captured
      return candidates[0].bytes;
    } catch (e) {
      console.error('Error parsing observation for bytes:', e);
    }
    return undefined;
  }

  /**
   * Extract the selected prepared transaction info (bytes + operation metadata)
   * respecting the same prioritization used for bytes selection.
   */
  static extractPreparedTxInfo(response: any): {
    bytes: any;
    operation?: string;
    step?: string;
    originalParams?: any;
  } | undefined {
    try {
      const steps: any[] = Array.isArray(response?.intermediateSteps)
        ? response.intermediateSteps
        : [];

      type Candidate = { bytes: any; op?: string; step?: string; originalParams?: any };
      const candidates: Candidate[] = [];

      for (const s of steps) {
        if (!s?.observation) continue;
        const obs = s.observation;
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
        if (obsObj?.bytes) {
          candidates.push({
            bytes: obsObj.bytes,
            op: obsObj.operation,
            step: obsObj.step,
            originalParams: obsObj.originalParams,
          });
        }
      }

      if (candidates.length === 0) return undefined;

      const assoc = candidates.find((c) => c.op === 'associate_tokens' || c.step === 'token_association');
      if (assoc) return { bytes: assoc.bytes, operation: assoc.op, step: assoc.step, originalParams: assoc.originalParams };

      const approval = candidates.find((c) => c.op === 'approve_sauce' || c.step === 'token_approval');
      if (approval) return { bytes: approval.bytes, operation: approval.op, step: approval.step, originalParams: approval.originalParams };

      const first = candidates[0];
      return { bytes: first.bytes, operation: first.op, step: first.step, originalParams: first.originalParams };
    } catch (e) {
      console.error('Error extracting prepared tx info:', e);
      return undefined;
    }
  }

  /**
   * Extract swap quote from agent response
   */
  static extractSwapQuoteFromAgentResponse(response: any): SwapQuote | undefined {
    try {
      const steps: any[] = Array.isArray(response?.intermediateSteps)
        ? response.intermediateSteps
        : [];

      for (const step of steps) {
        if (!step?.observation) continue;
        const obs = step.observation;
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;

        if (
          obsObj?.success &&
          obsObj?.quote &&
          obsObj?.operation &&
          (obsObj.operation === 'get_amounts_out' || obsObj.operation === 'get_amounts_in')
        ) {
          console.log('💱 DETECTED SWAP QUOTE:', obsObj.operation);

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
                formatted: obsObj.quote.input.formatted,
              },
              output: {
                token: outputToken,
                tokenId: obsObj.quote.output.token,
                amount: obsObj.quote.output.amount,
                formatted: obsObj.quote.output.formatted,
              },
              path: obsObj.quote.path || [],
              fees: obsObj.quote.fees || [],
              exchangeRate: obsObj.quote.exchangeRate || '0',
              gasEstimate: obsObj.gasEstimate,
            },
            originalMessage: response?.output || 'Swap quote available',
          };
        }
      }
    } catch (e) {
      console.error('Error parsing swap quote:', e);
    }
    return undefined;
  }

  /**
   * Extract next step information from agent response
   */
  static extractNextStepFromAgentResponse(response: any): PendingStep | undefined {
    try {
      const steps: any[] = Array.isArray(response?.intermediateSteps)
        ? response.intermediateSteps
        : [];

      // Iterate over ALL steps and capture the most relevant nextStep
      let detected: PendingStep | undefined;

      for (const step of steps) {
        if (!step?.observation) continue;
        const obs = step.observation;
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;

        console.log('🔍 EXTRACTING NEXT STEP - RAW OBSERVATION:');
        console.log('   obsObj.nextStep:', obsObj?.nextStep);
        console.log('   obsObj.step:', obsObj?.step);
        console.log('   obsObj.operation:', obsObj?.operation);
        console.log('   obsObj.originalParams:', obsObj?.originalParams);

        // Infinity Pool next-step detection (supports inference when nextStep is missing)
        const isInfinityPoolContext =
          obsObj?.toolType === 'infinity_pool' ||
          obsObj?.protocol === 'saucerswap' ||
          obsObj?.operation?.includes('infinity_pool') ||
          obsObj?.operation?.includes('sauce') ||
          obsObj?.operation?.includes('associate_tokens') ||
          obsObj?.operation?.includes('approve_sauce') ||
          obsObj?.operation?.includes('stake_sauce') ||
          ['associate_tokens', 'approve_sauce', 'stake_sauce'].includes(obsObj?.operation);

        if (isInfinityPoolContext) {
          // If tool provides explicit nextStep, use it
          if (obsObj?.nextStep) {
            detected = {
              tool: obsObj.toolInfo?.name || 'saucerswap_infinity_pool_tool',
              operation: obsObj.operation || 'infinity_pool_operation',
              step: obsObj.nextStep,
              originalParams: obsObj.originalParams || {},
              nextStepInstructions: obsObj.instructions || obsObj.message,
            };
            continue;
          }

          // Infer next step when missing:
          // After association → approval
          if (
            obsObj?.step === 'token_association' &&
            obsObj?.operation === 'associate_tokens'
          ) {
            detected = {
              tool: obsObj.toolInfo?.name || 'saucerswap_infinity_pool_tool',
              operation: obsObj.operation,
              step: 'approval',
              originalParams: obsObj.originalParams || {},
              nextStepInstructions:
                obsObj.instructions ||
                'Token association complete. Proceed to approve SAUCE for MotherShip contract.',
            };
            continue;
          }

          // After approval → stake
          if (
            obsObj?.step === 'token_approval' &&
            obsObj?.operation === 'approve_sauce'
          ) {
            detected = {
              tool: obsObj.toolInfo?.name || 'saucerswap_infinity_pool_tool',
              operation: obsObj.operation,
              step: 'stake',
              originalParams: obsObj.originalParams || {},
              nextStepInstructions:
                obsObj.instructions ||
                'Approval confirmed. Proceed to stake SAUCE into the Infinity Pool.',
            };
            continue;
          }
        }

        // Bonzo deposit next-step detection
        if (
          obsObj?.nextStep &&
          obsObj?.step &&
          obsObj?.operation &&
          (
            obsObj.operation.includes('bonzo') ||
            obsObj.operation.includes('whbar') ||
            obsObj.operation === 'associate_whbar' ||
            obsObj.operation === 'associate_token' ||
            obsObj.operation === 'approve_token' ||
            obsObj.operation.includes('deposit') ||
            obsObj.step === 'deposit' ||
            obsObj.step === 'token_approval' ||
            obsObj.nextStep === 'approval' ||
            obsObj.nextStep === 'deposit'
          )
        ) {
          detected = {
            tool: obsObj.toolInfo?.name || 'bonzo_deposit_tool',
            operation: obsObj.operation,
            step: obsObj.nextStep,
            originalParams: obsObj.originalParams || {},
            nextStepInstructions: obsObj.instructions || obsObj.message,
          };
          continue;
        }
      }

      return detected;
    } catch (e) {
      console.error('Error parsing next step:', e);
      return undefined;
    }
  }

  /**
   * Get token name from token ID
   */
  private static getTokenName(tokenId: string): string {
    return TOKEN_NAMES[tokenId] || tokenId;
  }
  /**
   * Extract a concise context of the last prepared operation from agent response
   * to enable sending a final summary when no further steps remain.
   */
  static extractOperationContext(response: any): {
    tool?: string;
    protocol?: string;
    operation?: string;
    step?: string;
    originalParams?: any;
    amountLabel?: string;
    tokenIds?: string[];
  } | undefined {
    try {
      const steps: any[] = Array.isArray(response?.intermediateSteps)
        ? response.intermediateSteps
        : [];
      let ctx: any | undefined;

      for (const step of steps) {
        const obs = step?.observation;
        if (!obs) continue;
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;

        // Capture SaucerSwap Infinity Pool contexts
        if (
          obsObj?.protocol === 'saucerswap' ||
          obsObj?.toolType === 'infinity_pool' ||
          ['associate_tokens', 'approve_sauce', 'stake_sauce', 'unstake_xsauce'].includes(
            obsObj?.operation,
          )
        ) {
          const amountLabel =
            obsObj?.stakeAmount !== undefined
              ? `${obsObj.stakeAmount} SAUCE`
              : obsObj?.approvedAmount
              ? `${(Number(obsObj.approvedAmount) / 1_000_000).toString()} SAUCE`
              : undefined;

          ctx = {
            tool: obsObj?.toolInfo?.name || 'saucerswap_infinity_pool_tool',
            protocol: 'saucerswap',
            operation: obsObj?.operation,
            step: obsObj?.step,
            originalParams: obsObj?.originalParams,
            amountLabel,
            tokenIds: obsObj?.tokenIds,
          };
        }

        // Capture Bonzo contexts (optional extension)
        if (
          obsObj?.operation?.includes('bonzo') ||
          obsObj?.operation?.includes('deposit')
        ) {
          ctx = {
            tool: obsObj?.toolInfo?.name || 'bonzo_deposit_tool',
            protocol: 'bonzo',
            operation: obsObj?.operation,
            step: obsObj?.step,
            originalParams: obsObj?.originalParams,
          };
        }
      }

      return ctx;
    } catch (e) {
      console.error('Error extracting operation context:', e);
      return undefined;
    }
  }
}