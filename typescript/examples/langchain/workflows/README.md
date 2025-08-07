# HBAR Yield Optimization Workflow

Un flujo de trabajo inteligente para optimizar los retornos de HBAR en el ecosistema DeFi de Hedera, proporcionando recomendaciones personalizadas basadas en el perfil del usuario, tolerancia al riesgo y condiciones del mercado.

## 🎯 Características Principales

### Análisis Multi-Plataforma
- **Bonzo Finance**: Préstamos y lending con APY estables
- **SaucerSwap Infinity Pool**: Staking de SAUCE con altos rendimientos  
- **SaucerSwap Liquidity Pools**: Provisión de liquidez con rewards
- **AutoSwapLimit**: Órdenes límite automatizadas para trading estratégico

### Perfiles de Usuario Personalizados
- **Nivel de experiencia**: Novato, Intermedio, Avanzado
- **Tolerancia al riesgo**: Conservador, Moderado, Agresivo
- **Preferencia de liquidez**: Alta, Media, Baja
- **Timeline de inversión**: 1-24 meses

### Estrategias Inteligentes
- **Conservador**: Focus en lending estable en Bonzo Finance
- **Balanceado**: Diversificación entre lending y staking
- **Agresivo**: Maximización de rendimientos con múltiples protocolos

## 🚀 Casos de Uso

### Caso 1: Usuario Nuevo con HBAR
**Prompt del usuario**: 
> "I am a new user to the Hedera network, and I have a lot of hbar that I plan on keeping for 6-9 months. I want to find a way to optimize my returns."

**Respuesta del agente**:
```
🎯 HBAR Yield Optimization Recommendation

Based on your 1000 HBAR and 8-month timeline, here's my analysis:

🏆 Recommended Strategy: Conservative Lending Focus
Expected Total APY: 5.2%
Risk Level: low
Estimated Setup Time: 4-6 minutes

💰 Allocation Breakdown:
• Bonzo Finance: 800 HBAR (5.2% APY)
  └─ Stable lending yield with high liquidity and low risk

📋 Next Steps:
1. Review the recommended allocation and adjust based on your comfort level
2. Deposit 800 HBAR into Bonzo Finance for 5.20% APY
3. Monitor your positions and rebalance quarterly based on market conditions
4. Consider gradual implementation over 1-2 weeks to minimize timing risk
```

### Caso 2: Usuario Experimentado con Diversificación
**Configuración**:
- 5000 HBAR disponibles
- Timeline: 12 meses
- Tolerancia: Moderada
- Experiencia: Intermedia

**Recomendación**:
- 50% en Bonzo Finance (2500 HBAR)
- 30% en Infinity Pool (convertir 1500 HBAR a SAUCE)
- 20% líquido para oportunidades

### Caso 3: Whale con Estrategia Agresiva
**Configuración**:
- 20000 HBAR
- Timeline: 24 meses
- Tolerancia: Agresiva
- Experiencia: Avanzada

**Recomendación**:
- 40% Bonzo Finance (8000 HBAR)
- 30% Infinity Pool (6000 HBAR → SAUCE)
- 20% Liquidity Pools (4000 HBAR)
- 10% AutoSwap Limit Orders (2000 HBAR)

## 📊 Herramientas Disponibles

### 1. Bonzo Finance Tools
```typescript
// Consultar información de mercado
await bonzoTool.func({ operation: 'market_info' });

// Ver posiciones del usuario
await bonzoTool.func({ 
  operation: 'account_dashboard', 
  accountId: userAccountId 
});

// Depositar HBAR
await bonzoDepositTool.func({
  operation: 'full_deposit_flow',
  hbar_amount: 1000,
  userAccountId: userAccountId
});
```

### 2. SaucerSwap Infinity Pool
```typescript
// Ver estadísticas del pool
await saucerswapApiTool.func({ 
  operation: 'single_sided_staking_stats' 
});

// Stakear SAUCE tokens
await infinityPoolTool.func({
  operation: 'full_stake_flow',
  sauce_amount: 1000,
  userAccountId: userAccountId
});
```

### 3. AutoSwapLimit Orders
```typescript
// Crear orden límite
await autoswapLimitTool.func({
  operation: 'create_swap_order',
  tokenOut: 'SAUCE',
  amountIn: 0.2,
  minAmountOut: '1',
  triggerPrice: '1',
  expirationHours: 24
});
```

### 4. SaucerSwap DEX
```typescript
// Obtener quote de swap
await swapQuoteTool.func({
  operation: 'get_amounts_out',
  amountIn: '100000000', // 1 HBAR
  tokenPath: ['HBAR', '0.0.731861'], // HBAR to SAUCE
  fees: [3000] // 0.3% fee
});

// Ejecutar swap
await swapTool.func({
  operation: 'swap_exact_hbar_for_tokens',
  amountIn: '100000000',
  tokenPath: ['HBAR', '0.0.731861'],
  slippage: 2.0
});
```

## 🔧 Integración con WebSocket Agent

### Implementación en Connection Manager

```typescript
import { YieldOptimizationIntegration } from './workflows/usage-examples';

export class ConnectionManager {
  private yieldOptimizer: Map<string, YieldOptimizationIntegration> = new Map();

  async handleUserMessage(message: UserMessageType): Promise<void> {
    const userConnection = this.connections.get(message.userId);
    if (!userConnection) return;

    // Check if message is requesting yield optimization
    const optimizer = this.getOrCreateYieldOptimizer(userConnection);
    const yieldResponse = await optimizer.handleUserMessage(
      message.content, 
      userConnection.accountId
    );

    if (yieldResponse) {
      // Send yield optimization response
      await this.sendMessage(userConnection.ws, {
        type: 'AGENT_RESPONSE',
        userId: message.userId,
        content: yieldResponse,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Continue with regular agent processing...
  }

  private getOrCreateYieldOptimizer(connection: UserConnection): YieldOptimizationIntegration {
    if (!this.yieldOptimizer.has(connection.accountId)) {
      this.yieldOptimizer.set(
        connection.accountId,
        new YieldOptimizationIntegration(
          this.client,
          this.context,
          connection.accountId
        )
      );
    }
    return this.yieldOptimizer.get(connection.accountId)!;
  }
}
```

### Detección de Palabras Clave

El sistema detecta automáticamente solicitudes de optimización basándose en palabras clave:

- `optimize returns`, `maximize yield`, `best apy`
- `investment strategy`, `where to stake`, `defi opportunities`
- `earn interest`, `passive income`
- `bonzo or saucerswap`, `infinity pool`, `lending vs staking`

### Extracción de Parámetros

Extrae automáticamente del mensaje del usuario:
- **Cantidad de HBAR**: regex `(\d+[\d,]*)\s*hbar`
- **Timeline**: regex `(\d+)[-\s]*(\d+)?\s*months?`
- **Tolerancia al riesgo**: keywords como 'aggressive', 'conservative', 'moderate'
- **Nivel de experiencia**: keywords como 'new user', 'experienced', 'expert'

## 📈 Métricas y Análisis

### APY Tracking
```typescript
interface PlatformYields {
  bonzo: {
    hbarSupplyApy: number;
    sauceSupplyApy: number;
    usdcSupplyApy: number;
    totalValueLocked: number;
  };
  saucerswapInfinityPool: {
    xSauceApy: number;
    totalSauceStaked: number;
    conversionRatio: number;
  };
}
```

### Risk Assessment
- **Bajo Riesgo**: Solo lending en Bonzo Finance
- **Riesgo Medio**: Combinación de lending y staking
- **Alto Riesgo**: Múltiples protocolos + trading automatizado

### Portfolio Balance
- Análisis de allocación actual vs recomendada
- Identificación de posiciones sobre/sub-allocadas
- Sugerencias de rebalancing

## 🛡️ Consideraciones de Seguridad

### Validaciones
1. **Parámetros**: Validación de montos mínimos y máximos
2. **Accounts**: Verificación de IDs de cuenta válidos
3. **Networks**: Confirmación de red (mainnet/testnet)
4. **Balances**: Verificación de fondos suficientes

### Gestión de Riesgos
1. **Slippage Protection**: Protección automática contra deslizamiento excesivo
2. **Timeouts**: Límites de tiempo para transacciones
3. **Error Handling**: Manejo robusto de errores de red y contratos
4. **User Confirmation**: Todas las transacciones requieren firma del usuario

## 🎨 Personalización

### Estrategias Customizadas
```typescript
// Crear estrategia personalizada
const customStrategy = {
  name: 'DCA + Yield Farming',
  allocation: {
    bonzo: 0.4,        // 40% lending
    infinityPool: 0.3, // 30% staking
    autoswap: 0.2,     // 20% DCA
    liquid: 0.1        // 10% liquid
  },
  riskLevel: 'medium',
  rebalanceFrequency: 'monthly'
};
```

### Parámetros Ajustables
- **Minimum order amounts**: AutoSwapLimit
- **Slippage tolerance**: DEX swaps
- **Rebalancing thresholds**: Portfolio management
- **APY update frequency**: Market data refresh

## 📚 Recursos Adicionales

### APIs Utilizadas
- **Bonzo Finance API**: `https://bonzo-data-api-eceac9d8a2aa.herokuapp.com`
- **SaucerSwap API**: Mirror Node + SaucerSwap Finance API
- **Hedera Mirror Node**: Account balances y token data
- **Smart Contracts**: Direct contract interactions

### Contratos Inteligentes
- **Bonzo LendingPool**: `0.0.X` (mainnet)
- **SaucerSwap Router**: `0.0.3045981` (mainnet)
- **Infinity Pool MotherShip**: `0.0.X` (mainnet)
- **AutoSwapLimit**: `0.0.X` (mainnet)

### Documentación Técnica
- [Bonzo Finance Docs](./docs/BONZO_LANGCHAIN_TOOL_GUIDE.md)
- [SaucerSwap Integration](./docs/UniswapV2Router02%20README.md)
- [AutoSwapLimit Guide](./typescript/src/shared/tools/defi/autoswap-limit/)

## 🎯 Próximos Pasos

1. **Implementar en Connection Manager**: Integrar el workflow en el agente WebSocket
2. **Testing**: Probar con diferentes perfiles de usuario
3. **Monitoring**: Implementar métricas de rendimiento y éxito
4. **Optimización**: Ajustar recomendaciones basadas en feedback
5. **Expansión**: Agregar más protocolos DeFi según disponibilidad

---

*Este workflow está diseñado para maximizar los retornos de HBAR mientras gestiona el riesgo de manera inteligente, proporcionando recomendaciones personalizadas que se adaptan a las necesidades y experiencia de cada usuario.*