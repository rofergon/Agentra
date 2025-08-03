# 💱 Structured Swap Quotes WebSocket Integration

Este documento explica cómo integrar las nuevas respuestas estructuradas de swap quotes en el frontend.

## 🎯 Nuevo Tipo de Mensaje: `SWAP_QUOTE`

Cuando el usuario solicita un quote de swap (por ejemplo: "quote swap 10 HBAR to SAUCE"), el WebSocket agent ahora envía **dos mensajes**:

1. **`SWAP_QUOTE`** - Datos estructurados para el componente de trading
2. **`AGENT_RESPONSE`** - Respuesta formateada tradicional (opcional para mostrar)

## 📊 Estructura del Mensaje `SWAP_QUOTE`

```typescript
interface SwapQuote extends BaseMessage {
  type: 'SWAP_QUOTE';
  quote: {
    operation: 'get_amounts_out' | 'get_amounts_in';
    network: 'mainnet' | 'testnet';
    input: {
      token: string;        // Nombre legible (ej: "HBAR", "SAUCE")
      tokenId: string;      // ID de Hedera (ej: "0.0.731861")
      amount: string;       // Cantidad en wei/tinybars
      formatted: string;    // Cantidad formateada legible
    };
    output: {
      token: string;
      tokenId: string;
      amount: string;
      formatted: string;
    };
    path: string[];         // Ruta de tokens para el swap
    fees: number[];         // Fees en hundredths of bip (3000 = 0.30%)
    exchangeRate: string;   // Tasa de cambio
    gasEstimate?: string;   // Estimación de gas (opcional)
  };
  originalMessage: string;  // Mensaje original formateado
}
```

## 🎨 Ejemplo de Implementación Frontend

### React/TypeScript

```typescript
// Tipos de mensajes WebSocket
type WSMessage = 
  | AgentResponse 
  | SwapQuote 
  | TransactionToSign 
  | SystemMessage
  | ConnectionAuth;

// Componente para manejar mensajes
const WebSocketHandler = () => {
  const [swapQuotes, setSwapQuotes] = useState<SwapQuote[]>([]);
  
  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'SWAP_QUOTE':
        // 🎯 Mostrar en componente de trading especializado
        setSwapQuotes(prev => [...prev, message]);
        break;
        
      case 'AGENT_RESPONSE':
        // Respuesta normal del agente
        setMessages(prev => [...prev, message]);
        break;
        
      // ... otros casos
    }
  }, []);

  return (
    <div>
      {/* Componente especializado para quotes */}
      <SwapQuoteCard quotes={swapQuotes} />
      
      {/* Chat normal */}
      <ChatMessages messages={messages} />
    </div>
  );
};

// Componente especializado para mostrar quotes
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
    <!-- Componente especializado para quotes -->
    <SwapQuoteCard 
      v-if="latestSwapQuote" 
      :quote="latestSwapQuote" 
      @execute="handleExecuteSwap"
    />
    
    <!-- Chat normal -->
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
  // Enviar mensaje para ejecutar el swap
  const swapMessage = `Execute swap: ${quote.quote.input.formatted} ${quote.quote.input.token} to ${quote.quote.output.token}`;
  sendMessage(swapMessage);
};
</script>
```

## 🚀 Beneficios

### ✅ Para el Frontend:
- **Componentes especializados**: Crear UI específica para trading
- **Datos estructurados**: Fácil acceso a todos los campos necesarios
- **UX mejorada**: Mostrar quotes en formato card/modal atractivo
- **Integración directa**: Botones "Execute Swap" con datos ya parseados

### ✅ Para el Usuario:
- **Visualización clara**: Componente dedicado para quotes
- **Información completa**: Fees, rates, gas estimates visibles
- **Acción rápida**: Botón directo para ejecutar el swap
- **Historial**: Mantener quotes anteriores si es necesario

## 🎨 Sugerencias de UI

1. **Card Layout**: Mostrar quote en una tarjeta destacada
2. **Color Coding**: Verde para ganancias, rojo para pérdidas
3. **Animation**: Transición suave cuando llega nuevo quote
4. **Price Impact**: Mostrar impacto del precio si está disponible
5. **Refresh**: Botón para solicitar quote actualizado

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

## 🔧 Detectar Palabras Clave

El sistema detecta automáticamente estos patrones para generar `SWAP_QUOTE`:

- "quote swap X to Y"
- "how much Y for X"
- "exchange rate X Y"
- "price of X in Y"
- "swap quote"

¡Los datos estructurados harán que tu frontend de trading sea mucho más profesional y fácil de usar! 🚀