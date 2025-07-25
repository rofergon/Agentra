# Hedera WebSocket Agent

This implementation replaces the console interface with a WebSocket server, enabling bidirectional communication with frontend applications.

## Features

✅ **Real-time Communication** via WebSocket  
✅ **RETURN_BYTES Mode** - Transactions are sent to the frontend for signing  
✅ **Typed Message Types** - Structured communication  
✅ **Robust Error Handling**  
✅ **Multiple Simultaneous Clients**  

## Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│                 │◄────────────────►│                 │
│   Frontend      │   Messages       │  WebSocket      │
│   (React/Vue)   │   Transactions   │    Agent        │
│                 │                  │   (Backend)     │
└─────────────────┘                  └─────────────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │  Hedera Agent   │
                                     │    Toolkit      │
                                     └─────────────────┘
```

## Message Types

### Frontend → Backend Messages

#### 1. USER_MESSAGE
```json
{
  "type": "USER_MESSAGE",
  "message": "What is my HBAR balance?",
  "timestamp": 1640995200000
}
```

#### 2. TRANSACTION_RESULT
```json
{
  "type": "TRANSACTION_RESULT",
  "success": true,
  "transactionId": "0.0.123@1640995200.123456789",
  "status": "SUCCESS",
  "timestamp": 1640995200000
}
```

### Backend → Frontend Messages

#### 1. AGENT_RESPONSE
```json
{
  "type": "AGENT_RESPONSE",
  "message": "Your current balance is 100 HBAR",
  "hasTransaction": false,
  "timestamp": 1640995200000
}
```

#### 2. TRANSACTION_TO_SIGN
```json
{
  "type": "TRANSACTION_TO_SIGN",
  "transactionBytes": [18, 206, 1, 10, ...],
  "originalQuery": "Create a token called MyToken",
  "timestamp": 1640995200000
}
```

#### 3. SYSTEM_MESSAGE
```json
{
  "type": "SYSTEM_MESSAGE",
  "message": "Connected to Hedera Agent",
  "level": "info",
  "timestamp": 1640995200000
}
```

## Usage

### 1. Start the WebSocket Agent

```bash
cd typescript/examples/langchain
npm run start:websocket
```

### 2. Test with Test Client

```bash
node websocket-test-client.js
```

### 3. Connect from Frontend

```javascript
const ws = new WebSocket('ws://localhost:8080');

// Send message to agent
ws.send(JSON.stringify({
  type: 'USER_MESSAGE',
  message: 'What is my balance?',
  timestamp: Date.now()
}));

// Receive messages
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'AGENT_RESPONSE':
      console.log('Agent:', message.message);
      break;
      
    case 'TRANSACTION_TO_SIGN':
      // Sign transaction with HashPack/wallet
      signAndExecuteTransaction(message.transactionBytes);
      break;
      
    case 'SYSTEM_MESSAGE':
      console.log('System:', message.message);
      break;
  }
};
```

## Wallet Integration

### HashPack Integration

```javascript
// Receive transaction from agent
ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'TRANSACTION_TO_SIGN') {
    try {
      // Convert bytes to transaction
      const txBytes = new Uint8Array(message.transactionBytes);
      const transaction = Transaction.fromBytes(txBytes);
      
      // Sign with HashPack
      const signedTx = await hashpack.signTransaction(transaction);
      
      // Execute transaction
      const result = await signedTx.execute(client);
      const receipt = await result.getReceipt(client);
      
      // Send result back
      ws.send(JSON.stringify({
        type: 'TRANSACTION_RESULT',
        success: true,
        transactionId: result.transactionId.toString(),
        status: receipt.status.toString(),
        timestamp: Date.now()
      }));
      
    } catch (error) {
      // Send error
      ws.send(JSON.stringify({
        type: 'TRANSACTION_RESULT',
        success: false,
        error: error.message,
        timestamp: Date.now()
      }));
    }
  }
};
```

## Configuration

### Environment Variables

```bash
ACCOUNT_ID=0.0.xxxxx           # Your testnet Account ID
PRIVATE_KEY=0x...              # Your ECDSA private key
OPENAI_API_KEY=sk-proj-...     # Your OpenAI API key
```

### WebSocket Port

Defaults to port `8080`. To change it:

```javascript
const agent = new HederaWebSocketAgent(8080); // Custom port
```

## Quick Commands (Test Client)

- `balance` → Query HBAR balance
- `create token` → Create fungible token
- `create topic` → Create consensus topic
- `exit` → Exit

## Debugging

### Server Logs
```bash
🚀 Initializing Hedera WebSocket Agent...
✅ Hedera WebSocket Agent initialized successfully
🌐 WebSocket Server started on port 8080
🔗 New WebSocket connection established
👤 User: What is my balance?
🤖 Agent: Your current balance is 100 HBAR
```

### Client Logs
```bash
🔗 Connected to Hedera WebSocket Agent
🔔 System [info]: Connected to Hedera Agent
🤖 Agent: Your current balance is 100 HBAR
```

## Next Steps

1. **Frontend Integration** - Connect with React/Vue app
2. **Wallet Connection** - Integrate HashPack, Blade, etc.
3. **UI Components** - Create components for chat and transactions
4. **Error Handling** - Improve frontend error handling
5. **Security** - Add authentication and rate limiting

## Troubleshooting

### ❌ Error: EADDRINUSE
Port 8080 is already in use. Change the port or kill the process:
```bash
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### ❌ Error: Cannot find module 'ws'
```bash
npm install ws @types/ws
```

### ❌ Error: Private key format
Ensure your `PRIVATE_KEY` is in ECDSA format (0x...) 