# Bonzo Finance Transaction Tools

Esta implementación proporciona herramientas para interactuar con el protocolo DeFi Bonzo Finance en Hedera Mainnet, con soporte completo para flujos multi-paso automáticos.

## Características Principales

- **Depósito HBAR a Bonzo Finance** con flujo automático de 2 pasos
- **Asociación automática de tokens WHBAR** cuando es necesario
- **Soporte para flujos multi-paso** en el WebSocket agent
- **Modo RETURN_BYTES** para firmas frontend
- **Manejo automático de transiciones** entre pasos del flujo

## Flujo de Depósito Multi-Paso

### Paso 1: Asociación de Token WHBAR (si es necesario)
```typescript
// El usuario solicita un depósito
"Depositar 1 HBAR en Bonzo Finance"

// El agente prepara la transacción de asociación
// -> Retorna bytes para firma
// -> Guarda el estado del siguiente paso (deposit)
```

### Paso 2: Depósito HBAR (automático después de confirmación)
```typescript
// Cuando la transacción de asociación es confirmada:
// -> El WebSocket agent detecta la confirmación exitosa
// -> Automáticamente ejecuta el siguiente paso
// -> Prepara la transacción de depósito
// -> Retorna bytes para la segunda firma
```

## Arquitectura del Flujo Multi-Paso

### 1. Extensión de UserConnection
```typescript
interface PendingStep {
  tool: string;              // 'bonzo_deposit_tool'
  operation: string;         // 'full_deposit_flow'
  step: string;             // 'deposit'
  originalParams: any;      // Parámetros del depósito original
  nextStepInstructions?: string;
}

interface UserConnection {
  // ... campos existentes
  pendingStep?: PendingStep; // Estado del flujo multi-paso
}
```

### 2. Detección de Siguiente Paso
```typescript
// En handleUserMessage()
const nextStep = this.extractNextStepFromAgentResponse(response);
if (nextStep) {
  currentConnection.pendingStep = nextStep; // Guardar para después
}
```

### 3. Ejecución Automática
```typescript
// En handleTransactionResult()
if (message.success && userConnection?.pendingStep) {
  await this.executeNextStep(ws, userConnection); // Ejecutar automáticamente
}
```

## Herramientas Disponibles

### 1. `bonzo_deposit_tool` - Flujo Completo
- Maneja tanto asociación como depósito
- En modo RETURN_BYTES: retorna un paso a la vez
- Guarda el estado del siguiente paso automáticamente

### 2. `bonzo_deposit_step_tool` - Solo Depósito
- Para cuando la asociación ya fue completada
- Usado automáticamente por el WebSocket agent
- No requiere asociación de token

## Configuración de Red

```typescript
// Configuración automática basada en HEDERA_NETWORK
export const BONZO_CONFIG = {
  LENDING_POOL_ADDRESS: '0x236897c518996163E7b313aD21D1C9fCC7BA1afc', // Mainnet
  WHBAR_TOKEN_ID: '0.0.1456986',                                    // Mainnet
  WHBAR_ADDRESS: '0x0000000000000000000000000000000000163b5a',      // Mainnet
  NETWORK: 'mainnet',
  GAS_LIMIT: 1000000
};
```

## Ejemplo de Uso Completo

### Frontend → Backend
```json
{
  "type": "USER_MESSAGE",
  "message": "Depositar 2.5 HBAR en Bonzo Finance",
  "timestamp": 1640995200000
}
```

### Backend → Frontend (Paso 1: Asociación)
```json
{
  "type": "AGENT_RESPONSE", 
  "message": "Preparando asociación de token WHBAR...",
  "hasTransaction": true
}

{
  "type": "TRANSACTION_TO_SIGN",
  "transactionBytes": [/* bytes de asociación */],
  "originalQuery": "Depositar 2.5 HBAR en Bonzo Finance"
}
```

### Frontend → Backend (Confirmación Paso 1)
```json
{
  "type": "TRANSACTION_RESULT",
  "success": true,
  "transactionId": "0.0.123@1640995200.123456789",
  "status": "SUCCESS"
}
```

### Backend → Frontend (Paso 2: Depósito Automático)
```json
{
  "type": "AGENT_RESPONSE",
  "message": "Preparando depósito de HBAR...",
  "hasTransaction": true
}

{
  "type": "TRANSACTION_TO_SIGN", 
  "transactionBytes": [/* bytes de depósito */],
  "originalQuery": "Next step: deposit"
}
```

## Ventajas del Nuevo Sistema

1. **Automatización Completa**: El usuario no necesita solicitar manualmente el segundo paso
2. **Estado Persistente**: El sistema recuerda qué hacer después de cada transacción
3. **Experiencia de Usuario Mejorada**: Flujo fluido sin interrupciones
4. **Manejo de Errores**: Si una transacción falla, se limpia el estado automáticamente
5. **Escalabilidad**: El patrón se puede extender a otros flujos multi-paso

## Solución al Problema Original

**Problema**: Cuando el backend recibía estado "success" de la primera transacción, se quedaba ahí en lugar de enviar automáticamente los bytes de la segunda transacción.

**Solución**: 
1. **Estado Persistente**: Guardar información del siguiente paso en `UserConnection.pendingStep`
2. **Detección Automática**: Extraer información de siguiente paso de las respuestas del agente
3. **Ejecución Automática**: Cuando llega confirmación exitosa, ejecutar automáticamente el siguiente paso
4. **Herramienta Específica**: Usar `bonzo_deposit_step_tool` para el segundo paso, evitando repetir la asociación

El sistema ahora maneja automáticamente flujos de múltiples transacciones sin intervención manual del usuario. 