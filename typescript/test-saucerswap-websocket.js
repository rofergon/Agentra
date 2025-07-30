/**
 * Test script for SaucerSwap integration in WebSocket Agent
 * This script demonstrates how the agent now handles SaucerSwap queries
 */

const WebSocket = require('ws');

// Configuration
const WS_URL = 'ws://localhost:8080';
const USER_ACCOUNT_ID = process.env.ACCOUNT_ID || '0.0.5864846';
const NETWORK = process.env.HEDERA_NETWORK || 'testnet';

class SaucerSwapWebSocketTester {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.responses = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`🔗 Connecting to WebSocket agent at ${WS_URL}...`);
      
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        console.log('✅ Connected to WebSocket agent');
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        reject(error);
      });
      
      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      });
    });
  }

  authenticate() {
    console.log(`🔐 Authenticating with account: ${USER_ACCOUNT_ID}`);
    this.sendMessage({
      type: 'CONNECTION_AUTH',
      userAccountId: USER_ACCOUNT_ID,
      timestamp: Date.now()
    });
  }

  sendMessage(message) {
    message.id = `test_${++this.messageId}`;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log(`📤 Sent: ${message.type} - ${message.message || 'Auth message'}`);
    }
  }

  handleMessage(message) {
    console.log(`📥 Received: ${message.type}`);
    
    switch (message.type) {
      case 'SYSTEM_MESSAGE':
        console.log(`🔔 System: ${message.message}`);
        break;
        
      case 'AGENT_RESPONSE':
        console.log(`🤖 Agent Response:`);
        console.log(message.message);
        console.log(`Transaction required: ${message.hasTransaction || false}`);
        break;
        
      case 'TRANSACTION_TO_SIGN':
        console.log(`✍️ Transaction to sign (${message.transactionBytes.length} bytes)`);
        // For testing, we'll just simulate transaction success
        this.simulateTransactionSuccess();
        break;
        
      default:
        console.log(`📋 Other message type: ${message.type}`);
    }
    
    this.responses.push(message);
  }

  simulateTransactionSuccess() {
    // Simulate a successful transaction for testing
    setTimeout(() => {
      this.sendMessage({
        type: 'TRANSACTION_RESULT',
        success: true,
        transactionId: '0.0.123456@1640000000.123456789',
        status: 'SUCCESS',
        timestamp: Date.now()
      });
    }, 1000);
  }

  async runSaucerSwapTests() {
    console.log(`
🧪 SaucerSwap WebSocket Agent Integration Test
============================================
Network: ${NETWORK}
Account: ${USER_ACCOUNT_ID}
Time: ${new Date().toISOString()}
`);

    const testQueries = [
      // General SaucerSwap queries
      "What's the current TVL on SaucerSwap?",
      "Show me SaucerSwap general statistics",
      
      // Single-Sided Staking queries  
      "What's the current SAUCE staking APY?",
      "Show me single-sided staking stats",
      
      // Farm queries
      "What farms are active on SaucerSwap?",
      "Show me the current farm emissions",
      
      // Account-specific queries
      "Do I have any LP tokens staked in farms?",
      "Show my SaucerSwap farm positions",
      
      // Network-specific queries
      `Get SaucerSwap stats for ${NETWORK}`,
      
      // Comparison queries
      "Compare yields between Bonzo Finance and SaucerSwap farms",
    ];

    let testIndex = 0;
    
    const runNextTest = () => {
      if (testIndex < testQueries.length) {
        setTimeout(() => {
          const query = testQueries[testIndex];
          console.log(`\\n${testIndex + 1}️⃣ Testing: "${query}"`);
          
          this.sendMessage({
            type: 'USER_MESSAGE',
            message: query,
            userAccountId: USER_ACCOUNT_ID,
            timestamp: Date.now()
          });
          
          testIndex++;
          runNextTest();
        }, 5000); // Wait 5 seconds between queries
      } else {
        console.log('\\n✅ All SaucerSwap tests completed!');
        this.disconnect();
      }
    };

    // Start the test sequence after a brief delay
    setTimeout(runNextTest, 2000);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      console.log('🔌 Disconnected from WebSocket agent');
    }
  }
}

// Run the test
async function main() {
  const tester = new SaucerSwapWebSocketTester();
  
  try {
    await tester.connect();
    
    // Wait a moment for connection to stabilize
    setTimeout(() => {
      tester.authenticate();
      
      // Start tests after authentication
      setTimeout(() => {
        tester.runSaucerSwapTests();
      }, 2000);
    }, 1000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\\n🛑 Test interrupted by user');
  process.exit(0);
});

console.log(`
🚀 SaucerSwap WebSocket Integration Tester
=========================================

This script will test the SaucerSwap integration in the WebSocket agent.

Prerequisites:
1. Start the WebSocket agent: npm run websocket-agent
2. Ensure your .env file has the correct SaucerSwap API keys
3. Make sure the agent is running on ws://localhost:8080

Starting test in 3 seconds...
`);

setTimeout(main, 3000);