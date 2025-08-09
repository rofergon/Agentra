# Bonzo Finance Transaction Tools

This implementation provides tools to interact with the Bonzo Finance DeFi protocol on Hedera Mainnet, with full support for automatic multi-step flows.

## Main Features

- **HBAR Deposit to Bonzo Finance** with automatic 2-step flow
- **Automatic WHBAR token association** when needed
- **Multi-step flow support** in the WebSocket agent
- **RETURN_BYTES mode** for frontend signatures
- **Automatic handling of transitions** between flow steps

## Multi-Step Deposit Flow

### Step 1: WHBAR Token Association (if needed)
```typescript
// User requests a deposit
"Deposit 1 HBAR in Bonzo Finance"

// Agent prepares the association transaction
// -> Returns bytes for signature
// -> Saves the state of the next step (deposit)
```

### Step 2: HBAR Deposit (automatic after confirmation)
```typescript
// When the association transaction is confirmed:
// -> WebSocket agent detects successful confirmation
// -> Automatically executes the next step
// -> Prepares the deposit transaction
// -> Returns bytes for the second signature
```

## Multi-Step Flow Architecture

### 1. UserConnection Extension
```typescript
interface PendingStep {
  tool: string;              // 'bonzo_deposit_tool'
  operation: string;         // 'full_deposit_flow'
  step: string;             // 'deposit'
  originalParams: any;      // Original deposit parameters
  nextStepInstructions?: string;
}

interface UserConnection {
  // ... existing fields
  pendingStep?: PendingStep; // Multi-step flow state
}
```

### 2. Next Step Detection
```typescript
// In handleUserMessage()
const nextStep = this.extractNextStepFromAgentResponse(response);
if (nextStep) {
  currentConnection.pendingStep = nextStep; // Save for later
}
```

### 3. Automatic Execution
```typescript
// In handleTransactionResult()
if (message.success && userConnection?.pendingStep) {
  await this.executeNextStep(ws, userConnection); // Execute automatically
}
```

## Available Tools

### 1. `bonzo_deposit_tool` - Complete Flow
- Handles both association and deposit
- In RETURN_BYTES mode: returns one step at a time
- Automatically saves the state of the next step

### 2. `bonzo_deposit_step_tool` - Deposit Only
- For when association has already been completed
- Used automatically by the WebSocket agent
- No token association required

## Network Configuration

```typescript
// Automatic configuration based on HEDERA_NETWORK
export const BONZO_CONFIG = {
  LENDING_POOL_ADDRESS: '0x236897c518996163E7b313aD21D1C9fCC7BA1afc', // Mainnet
  WHBAR_TOKEN_ID: '0.0.1456986',                                    // Mainnet
  WHBAR_ADDRESS: '0x0000000000000000000000000000000000163b5a',      // Mainnet
  NETWORK: 'mainnet',
  GAS_LIMIT: 1000000
};
```

## Complete Usage Example

### Frontend → Backend
```json
{
  "type": "USER_MESSAGE",
  "message": "Deposit 2.5 HBAR in Bonzo Finance",
  "timestamp": 1640995200000
}
```

### Backend → Frontend (Step 1: Association)
```json
{
  "type": "AGENT_RESPONSE", 
  "message": "Preparing WHBAR token association...",
  "hasTransaction": true
}

{
  "type": "TRANSACTION_TO_SIGN",
  "transactionBytes": [/* association bytes */],
  "originalQuery": "Deposit 2.5 HBAR in Bonzo Finance"
}
```

### Frontend → Backend (Step 1 Confirmation)
```json
{
  "type": "TRANSACTION_RESULT",
  "success": true,
  "transactionId": "0.0.123@1640995200.123456789",
  "status": "SUCCESS"
}
```

### Backend → Frontend (Step 2: Automatic Deposit)
```json
{
  "type": "AGENT_RESPONSE",
  "message": "Preparing HBAR deposit...",
  "hasTransaction": true
}

{
  "type": "TRANSACTION_TO_SIGN", 
  "transactionBytes": [/* deposit bytes */],
  "originalQuery": "Next step: deposit"
}
```

## Advantages of the New System

1. **Complete Automation**: User doesn't need to manually request the second step
2. **Persistent State**: System remembers what to do after each transaction
3. **Improved User Experience**: Smooth flow without interruptions
4. **Error Handling**: If a transaction fails, state is automatically cleaned
5. **Scalability**: The pattern can be extended to other multi-step flows

## Solution to the Original Problem

**Problem**: When the backend received "success" status from the first transaction, it would stop there instead of automatically sending the bytes for the second transaction.

**Solution**: 
1. **Persistent State**: Save next step information in `UserConnection.pendingStep`
2. **Automatic Detection**: Extract next step information from agent responses
3. **Automatic Execution**: When successful confirmation arrives, automatically execute the next step
4. **Specific Tool**: Use `bonzo_deposit_step_tool` for the second step, avoiding repeated association

The system now automatically handles multi-transaction flows without manual user intervention. 