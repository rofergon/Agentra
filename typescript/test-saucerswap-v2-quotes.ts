// Test script for SaucerSwap V2 QuoterV2 quotes using JSON-RPC
import * as dotenv from 'dotenv';
dotenv.config({ path: './examples/langchain/.env' });

import { Client } from '@hashgraph/sdk';
import { getSaucerswapRouterSwapQuote, SAUCERSWAP_ROUTER_OPERATIONS } from './src/shared/tools/defi/saucerswap-swap/contract-client';

async function testSaucerSwapV2Quotes() {
  console.log('🧪 Testing SaucerSwap V2 QuoterV2 Quotes via JSON-RPC...\n');

  // Initialize Hedera client (not needed for JSON-RPC but kept for compatibility)
  const client = Client.forTestnet();
  
  // Test configuration (client not actually used since we use JSON-RPC)
  const context = { mode: 'RETURN_BYTES' as any, accountId: '0.0.1234' };

  // Test cases - Updated with correct WHBAR token usage
  const testCases = [
    {
      name: 'HBAR to SAUCE (mainnet) - using WHBAR TOKEN',
      params: {
        operation: SAUCERSWAP_ROUTER_OPERATIONS.GET_AMOUNTS_OUT,
        amount: '100000000', // 1 HBAR (8 decimals)
        tokenPath: ['HBAR', '0.0.731861'], // SAUCE mainnet
        fees: [3000], // 0.30%
        network: 'mainnet' as const
      }
    },
    {
      name: 'SAUCE to HBAR (mainnet) - using WHBAR TOKEN',
      params: {
        operation: SAUCERSWAP_ROUTER_OPERATIONS.GET_AMOUNTS_OUT,
        amount: '1000000', // 1 SAUCE (6 decimals)
        tokenPath: ['0.0.731861', 'HBAR'], // SAUCE to HBAR mainnet
        fees: [3000], // 0.30%
        network: 'mainnet' as const
      }
    },
    {
      name: 'Get amounts IN - HBAR to SAUCE (mainnet)',
      params: {
        operation: SAUCERSWAP_ROUTER_OPERATIONS.GET_AMOUNTS_IN,
        amount: '1000000', // Want 1 SAUCE out
        tokenPath: ['HBAR', '0.0.731861'],
        fees: [3000],
        network: 'mainnet' as const
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📊 Testing: ${testCase.name}`);
    console.log('Parameters:', JSON.stringify(testCase.params, null, 2));
    
    try {
      const result = await getSaucerswapRouterSwapQuote(client, context, testCase.params);
      
      if ('error' in result) {
        console.log('❌ Error:', result.error);
        console.log('🔧 Troubleshooting:', JSON.stringify(result.troubleshooting, null, 2));
      } else {
        console.log('✅ Success!');
        console.log('📈 Quote:', {
          input: `${result.quote.input.formatted} ${result.quote.input.token}`,
          output: `${result.quote.output.formatted} ${result.quote.output.token}`,
          exchangeRate: result.quote.exchangeRate,
          fees: result.quote.fees
        });
        console.log('🏦 Contract:', result.contract);
      }
    } catch (error) {
      console.log('❌ Exception:', error);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }

  client.close();
}

// Run tests
testSaucerSwapV2Quotes().catch(console.error);