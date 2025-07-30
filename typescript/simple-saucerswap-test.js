/**
 * Simple SaucerSwap WebSocket test client
 */

const WebSocket = require('ws');

const USER_ACCOUNT_ID = '0.0.5864846'; // Tu account ID
const WS_URL = 'ws://localhost:8080';

console.log('🔗 Connecting to WebSocket agent...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected! Authenticating...');
  
  // Step 1: Authenticate
  ws.send(JSON.stringify({
    type: 'CONNECTION_AUTH',
    userAccountId: USER_ACCOUNT_ID,
    timestamp: Date.now()
  }));
  
  // Step 2: Test SaucerSwap query after a short delay
  setTimeout(() => {
    console.log('📤 Sending SaucerSwap test query...');
    ws.send(JSON.stringify({
      type: 'USER_MESSAGE',
      message: 'What is the current TVL on SaucerSwap?',
      userAccountId: USER_ACCOUNT_ID,
      timestamp: Date.now()
    }));
  }, 2000);
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log(`📥 Received: ${message.type}`);
  
  switch (message.type) {
    case 'SYSTEM_MESSAGE':
      console.log(`🔔 System: ${message.message}`);
      break;
      
    case 'AGENT_RESPONSE':
      console.log(`🤖 Agent Response:`);
      console.log(message.message);
      break;
      
    default:
      console.log(`📋 Message: ${JSON.stringify(message, null, 2)}`);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
  process.exit(0);
});

// Close after 30 seconds
setTimeout(() => {
  console.log('⏰ Test timeout reached, closing...');
  ws.close();
}, 30000);

console.log('🧪 SaucerSwap test client started. Will test for 30 seconds...');