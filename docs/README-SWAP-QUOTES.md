# 💱 Structured Swap Quotes WebSocket Integration

This document explains how to integrate the new structured swap quote responses in the frontend.

## 🎯 New Message Type: `SWAP_QUOTE`

When the user requests a swap quote (for example: "quote swap 10 HBAR to SAUCE"), the WebSocket agent now sends **two messages**:

1. **`SWAP_QUOTE`** - Structured data for the trading component
2. **`AGENT_RESPONSE`** - Traditional formatted response (optional for display)

## 📊 Structure of the `SWAP_QUOTE` Message

```typescript
interface SwapQuote extends BaseMessage {
  type: 'SWAP_QUOTE';
  quote: {
    operation: 'get_amounts_out' | 'get_amounts_in';
    network: 'mainnet' | 'testnet';
    input: {
      token: string;        // Readable name (e.g., "HBAR", "SAUCE")
      tokenId: string;      // Hedera ID (e.g., "0.0.731861")
      amount: string;       // Amount in wei/tinybars
      formatted: string;    // Formatted readable amount
    };
    output: {
      token: string;
      tokenId: string;
      amount: string;
      formatted: string;
    };
    path: string[];         // Token path for the swap
    fees: number[];         // Fees in hundredths of bip (3000 = 0.30%)
    exchangeRate: string;   // Exchange rate
    gasEstimate?: string;   // Gas estimate (optional)
  };
  originalMessage: string;  // Formatted original message
}
```

## 🎨 Frontend Implementation Example

### React/TypeScript

```typescript
// WebSocket message types
type WSMessage = 
  | AgentResponse 
  | SwapQuote 
  | TransactionToSign 
  | SystemMessage
  | ConnectionAuth;

// Component to handle messages
const WebSocketHandler = () => {
  const [swapQuotes, setSwapQuotes] = useState<SwapQuote[]>([]);
  
  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'SWAP_QUOTE':
        // 🎯 Display in specialized trading component
        setSwapQuotes(prev => [...prev, message]);
        break;
        
      case 'AGENT_RESPONSE':
        // Normal agent response
        setMessages(prev => [...prev, message]);
        break;
        
      // ... other cases
    }
  }, []);

  return (
    <div>
      {/* Specialized component for quotes */}
      <SwapQuoteCard quotes={swapQuotes} />
      
      {/* Normal chat */}
      <ChatMessages messages={messages} />
    </div>
  );
};

// Specialized component to display quotes
const SwapQuoteCard = ({ quotes }: { quotes: SwapQuote[] }) => {
  const latestQuote = quotes[quotes.length - 1];
  
  if (!latestQuote) return null;
  
  const { quote } = latestQuote;
  
  return (
    <div className="swap-quote-card">
      <div className="quote-header">
        <h3>💱 Swap Quote</h3>
        <span className="network">{quote.network}</span>
      </div>
      
      <div className="quote-details">
        <div className="input-section">
          <span className="label">You pay:</span>
          <div className="token-amount">
            <span className="amount">{quote.input.formatted}</span>
            <span className="token">{quote.input.token}</span>
          </div>
        </div>
        
        <div className="arrow">↓</div>
        
        <div className="output-section">
          <span className="label">You receive:</span>
          <div className="token-amount">
            <span className="amount">{quote.output.formatted}</span>
            <span className="token">{quote.output.token}</span>
          </div>
        </div>
        
        <div className="quote-metadata">
          <div className="exchange-rate">
            Rate: 1 {quote.input.token} = {quote.exchangeRate} {quote.output.token}
          </div>
          <div className="fees">
            Fees: {quote.fees.map(fee => `${fee/10000}%`).join(', ')}
          </div>
          {quote.gasEstimate && (
            <div className="gas">
              Gas Estimate: {quote.gasEstimate}
            </div>
          )}
        </div>
        
        <button className="execute-swap-btn">
          Execute Swap
        </button>
      </div>
    </div>
  );
};
```

### Vue.js

```vue
<template>
  <div class="trading-interface">
    <!-- Specialized component for quotes -->
    <SwapQuoteCard 
      v-if="latestSwapQuote" 
      :quote="latestSwapQuote" 
      @execute="handleExecuteSwap"
    />
    
    <!-- Normal chat -->
    <ChatMessages :messages="messages" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const swapQuotes = ref<SwapQuote[]>([]);
const messages = ref<Message[]>([]);

const latestSwapQuote = computed(() => 
  swapQuotes.value[swapQuotes.value.length - 1]
);

const handleWebSocketMessage = (message: WSMessage) => {
  switch (message.type) {
    case 'SWAP_QUOTE':
      swapQuotes.value.push(message);
      break;
    case 'AGENT_RESPONSE':
      messages.value.push(message);
      break;
  }
};

const handleExecuteSwap = (quote: SwapQuote) => {
  // Send message to execute the swap
  const swapMessage = `Execute swap: ${quote.quote.input.formatted} ${quote.quote.input.token} to ${quote.quote.output.token}`;
  sendMessage(swapMessage);
};
</script>
```

## 🚀 Benefits

### ✅ For Frontend:
- **Specialized components**: Create specific UI for trading
- **Structured data**: Easy access to all necessary fields
- **Improved UX**: Display quotes in attractive card/modal format
- **Direct integration**: "Execute Swap" buttons with already parsed data

### ✅ For User:
- **Clear visualization**: Dedicated component for quotes
- **Complete information**: Fees, rates, gas estimates visible
- **Quick action**: Direct button to execute the swap
- **History**: Keep previous quotes if necessary

## 🎨 UI Suggestions

1. **Card Layout**: Display quote in a highlighted card
2. **Color Coding**: Green for gains, red for losses
3. **Animation**: Smooth transition when new quote arrives
4. **Price Impact**: Display price impact if available
5. **Refresh**: Button to request updated quote

## 📱 Responsive Design

```css
.swap-quote-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px;
  margin: 16px 0;
  color: white;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}

.token-amount {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.5rem;
  font-weight: bold;
}

.execute-swap-btn {
  width: 100%;
  background: #4CAF50;
  color: white;
  border: none;
  padding: 16px;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.3s ease;
}

.execute-swap-btn:hover {
  background: #45a049;
}
```

## 🔧 Detect Keywords

The system automatically detects these patterns to generate `SWAP_QUOTE`:

- "quote swap X to Y"
- "how much Y for X"
- "exchange rate X Y"
- "price of X in Y"
- "swap quote"

The structured data will make your trading frontend much more professional and easier to use! 🚀