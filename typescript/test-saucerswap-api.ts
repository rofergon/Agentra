import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';
import { getSaucerSwapApiQuery, SAUCERSWAP_API_OPERATIONS } from './src/shared/tools/defi/saucerswap/api-client';
import { createSaucerSwapLangchainTool } from './src/shared/tools/defi/saucerswap/langchain-tools';
import { AgentMode } from './src/shared/configuration';

// Configuración de red
const network = process.env.HEDERA_NETWORK || 'testnet';
const isMainnet = network === 'mainnet';

console.log(`🚀 Testing SaucerSwap API integration on ${network.toUpperCase()}`);

// Configurar cliente de Hedera
const client = Client.forName(network);
const privateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY);
const accountId = AccountId.fromString(process.env.ACCOUNT_ID);
client.setOperator(accountId, privateKey);

const context = { mode: AgentMode.AUTONOMOUS };

async function testSaucerSwapAPI() {
  console.log('\n📊 Testing SaucerSwap API endpoints...\n');

  try {
    // Test 1: General Statistics
    console.log('1️⃣ Testing General Statistics...');
    const generalStats = await getSaucerSwapApiQuery(client, context, {
      operation: SAUCERSWAP_API_OPERATIONS.GENERAL_STATS,
      network: network as 'mainnet' | 'testnet'
    });
    console.log('✅ General Stats Result:', JSON.stringify(generalStats, null, 2));

    // Test 2: Single-Sided Staking Statistics
    console.log('\n2️⃣ Testing Single-Sided Staking Statistics...');
    const sssStats = await getSaucerSwapApiQuery(client, context, {
      operation: SAUCERSWAP_API_OPERATIONS.SSS_STATS,
      network: network as 'mainnet' | 'testnet'
    });
    console.log('✅ SSS Stats Result:', JSON.stringify(sssStats, null, 2));

    // Test 3: Active Farms
    console.log('\n3️⃣ Testing Active Farms...');
    const farms = await getSaucerSwapApiQuery(client, context, {
      operation: SAUCERSWAP_API_OPERATIONS.FARMS,
      network: network as 'mainnet' | 'testnet'
    });
    console.log('✅ Farms Result:', JSON.stringify(farms, null, 2));

    // Test 4: Account Farms (with user account)
    console.log('\n4️⃣ Testing Account Farms...');
    const accountFarms = await getSaucerSwapApiQuery(client, context, {
      operation: SAUCERSWAP_API_OPERATIONS.ACCOUNT_FARMS,
      accountId: accountId.toString(),
      network: network as 'mainnet' | 'testnet'
    });
    console.log('✅ Account Farms Result:', JSON.stringify(accountFarms, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testLangChainTool() {
  console.log('\n🤖 Testing LangChain Tool Integration...\n');

  try {
    // Create LangChain tool
    const saucerswapTool = createSaucerSwapLangchainTool(client, context, accountId.toString());

    console.log('📋 Tool Info:');
    console.log('- Name:', saucerswapTool.name);
    console.log('- Description preview:', saucerswapTool.description.substring(0, 100) + '...');

    // Test tool invocation for general stats
    console.log('\n5️⃣ Testing LangChain Tool - General Stats...');
    const toolResult = await saucerswapTool.invoke({
      operation: 'general_stats',
      network: network
    });
    console.log('✅ LangChain Tool Result:', toolResult);

  } catch (error) {
    console.error('❌ LangChain Tool test failed:', error);
  }
}

// Ejecutar tests
async function runTests() {
  console.log(`
🧪 SaucerSwap API Integration Test Suite
========================================
Network: ${network.toUpperCase()}
Account: ${accountId.toString()}
Time: ${new Date().toISOString()}
`);

  await testSaucerSwapAPI();
  await testLangChainTool();

  console.log('\n✨ Test suite completed!');
  process.exit(0);
}

runTests().catch(console.error);