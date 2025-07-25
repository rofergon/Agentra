const WebSocket = require('ws');

// Test client for the WebSocket Agent
class TestClient {
  constructor(url = 'ws://localhost:8080') {
    this.ws = new WebSocket(url);
    this.authenticated = false;
    this.userAccountId = '0.0.48'; // Default test account ID
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.ws.on('open', () => {
      console.log('🔗 Connected to Hedera WebSocket Agent');
      // Authenticate immediately after connection
      this.authenticate();
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });

    this.ws.on('close', () => {
      console.log('🔌 Connection closed');
      process.exit(0);
    });

    this.ws.on('error', (error) => {
      console.error('❌ Connection error:', error.message);
      process.exit(1);
    });
  }

  authenticate() {
    console.log(`🔐 Authenticating with account: ${this.userAccountId}`);
    const authMessage = {
      type: 'CONNECTION_AUTH',
      userAccountId: this.userAccountId,
      timestamp: Date.now()
    };
    
    this.ws.send(JSON.stringify(authMessage));
  }

  handleMessage(message) {
    switch (message.type) {
      case 'SYSTEM_MESSAGE':
        console.log(`\n🔔 System [${message.level}]: ${message.message}\n`);
        
        // Check if this is authentication success message
        if (message.message.includes('Authenticated successfully')) {
          this.authenticated = true;
          console.log('✅ Authentication completed! You can now interact with the agent.');
          this.showMenu();
        }
        break;
      
      case 'AGENT_RESPONSE':
        console.log(`\n🤖 Agent: ${message.message}`);
        if (message.hasTransaction) {
          console.log('💰 This response includes a transaction to sign...');
        }
        console.log('');
        this.showMenu();
        break;
      
      case 'TRANSACTION_TO_SIGN':
        console.log(`\n🔏 Transaction received for signing:`);
        console.log(`📝 Original query: ${message.originalQuery}`);
        console.log(`📊 Transaction bytes: ${message.transactionBytes.length} bytes`);
        
        const hexBytes = Buffer.from(message.transactionBytes).toString('hex');
        console.log(`🔗 Bytes (hex): ${hexBytes}`);
        
        // Also show bytes in a more readable format (chunked)
        console.log(`📋 Bytes (chunked):`);
        for (let i = 0; i < hexBytes.length; i += 64) {
          console.log(`   ${hexBytes.substring(i, i + 64)}`);
        }
        
        // Simulate signing and successful execution
        setTimeout(() => {
          this.simulateTransactionSuccess();
        }, 2000);
        break;
      
      default:
        console.log('⚠️  Unknown message:', message);
        if (this.authenticated) {
          this.showMenu();
        }
    }
  }

  simulateTransactionSuccess() {
    console.log('\n🔄 Simulating transaction signing and execution...');
    
    const result = {
      type: 'TRANSACTION_RESULT',
      success: true,
      transactionId: '0.0.5864846@1234567890.123456789',
      status: 'SUCCESS',
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(result));
    console.log('✅ Transaction result sent');
  }

  sendUserMessage(message) {
    const userMessage = {
      type: 'USER_MESSAGE',
      message: message,
      userAccountId: this.userAccountId, // Include user account ID
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(userMessage));
    console.log(`\n👤 You (${this.userAccountId}): ${message}`);
    console.log('⏳ Waiting for agent response...\n');
  }

  changeAccount(newAccountId) {
    this.userAccountId = newAccountId;
    console.log(`🔄 Switching to account: ${newAccountId}`);
    this.authenticated = false;
    this.authenticate();
  }

  showMenu() {
    if (!this.authenticated) {
      console.log('⏳ Please wait for authentication to complete...');
      return;
    }
    
    console.log('────────────────────────────────────');
    console.log(`💬 Available commands (Account: ${this.userAccountId}):`);
    console.log('1. balance - Check HBAR balance');
    console.log('2. create token - Create a fungible token');
    console.log('3. create topic - Create a consensus topic');
    console.log('4. switch account - Change to different account');
    console.log('5. exit - Exit');
    console.log('Or type any message for the agent...');
    console.log('────────────────────────────────────');
  }

  start() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    rl.on('line', (input) => {
      const message = input.trim();
      
      if (message.toLowerCase() === 'exit') {
        console.log('👋 See you later!');
        this.ws.close();
        rl.close();
        return;
      }

      if (message.toLowerCase() === 'switch account') {
        rl.question('Enter new account ID (e.g., 0.0.123): ', (accountId) => {
          if (accountId.trim()) {
            this.changeAccount(accountId.trim());
          }
          rl.prompt();
        });
        return;
      }
      
      if (message && this.authenticated) {
        // Map quick commands
        const quickCommands = {
          'balance': 'What is my HBAR balance?',
          'create token': 'Create a fungible token called "MyToken" with symbol "MTK"',
          'create topic': 'Create a new consensus topic for messages'
        };

        const finalMessage = quickCommands[message.toLowerCase()] || message;
        this.sendUserMessage(finalMessage);
      } else if (message && !this.authenticated) {
        console.log('⚠️  Please wait for authentication to complete before sending messages.');
      }
      
      setTimeout(() => rl.prompt(), 100);
    });

    rl.on('close', () => {
      console.log('\n👋 Client closed');
      process.exit(0);
    });

    rl.prompt();
  }
}

// Run the test client
console.log('🚀 Starting WebSocket test client...');
console.log('📡 Connecting to ws://localhost:8080...');
console.log('🔐 Will authenticate with default account: 0.0.48');
console.log('💡 You can switch accounts using the "switch account" command\n');

const client = new TestClient();

// Wait for connection before showing the prompt
setTimeout(() => {
  client.start();
}, 1000); 