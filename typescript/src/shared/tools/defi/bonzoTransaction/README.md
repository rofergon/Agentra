# Bonzo Finance HBAR Deposit Tool

Esta herramienta permite realizar depósitos de HBAR en el protocolo DeFi de Bonzo Finance en Hedera Mainnet.

## ⚠️ IMPORTANTE: HEDERA MAINNET

**Esta herramienta opera en HEDERA MAINNET con FONDOS REALES**
- Todas las transacciones son irreversibles una vez confirmadas
- Verifica siempre las cantidades antes de confirmar
- Solo usar con cuentas que controles

## Funcionalidad

### 🔗 Asociación de Token WHBAR
- Asocia automáticamente el token WHBAR (0.0.1456986) si es necesario
- Requerido antes del primer depósito

### 💰 Depósito de HBAR
- Deposita HBAR en el contrato LendingPool de Bonzo Finance
- Convierte HBAR → WHBAR → aWHBAR
- Recibe aWHBAR (tokens que devengan interés)

## Direcciones de Contratos (Hedera Mainnet)

- **LendingPool**: `0x236897c518996163E7b313aD21D1C9fCC7BA1afc`
- **WHBAR Token**: `0.0.1456986` (`0x0000000000000000000000000000000000163b5a`)

## Uso

### Parámetros

- `hbarAmount` (number, requerido): Cantidad de HBAR a depositar
- `userAccountId` (string, opcional): Cuenta que hace el depósito
- `associateWhbar` (boolean, opcional): Si asociar WHBAR automáticamente (default: true)
- `referralCode` (number, opcional): Código de referencia (0-65535, default: 0)
- `transactionMemo` (string, opcional): Memo opcional para las transacciones

### Ejemplo de Uso

```typescript
// Depositar 1.5 HBAR en Bonzo Finance
const result = await bonzoDepositFlow(client, context, {
  hbarAmount: 1.5,
  userAccountId: "0.0.123456",
  associateWhbar: true,
  referralCode: 0
});
```

## Flujo de Transacciones

1. **Asociación de Token** (si es necesario):
   - `TokenAssociateTransaction` para WHBAR

2. **Depósito**:
   - `ContractExecuteTransaction` llamando `deposit()` en LendingPool
   - Envía HBAR como `payableAmount`
   - Recibe aWHBAR tokens

## Modo ReturnBytes

Compatible con el modo `RETURN_BYTES` para firmar en el frontend:
- Retorna bytes de transacción para firma externa
- Maneja múltiples transacciones secuenciales
- Flujo completo gestionado automáticamente

## Archivos

- `api-client.ts` - Lógica principal de la API
- `langchain-tools.ts` - Wrappers para LangChain
- `index.ts` - Exportaciones del módulo
- `../../../parameter-schemas/bonzo.zod.ts` - Schemas de validación

## Seguridad

- Validación completa de parámetros
- Manejo de errores robusto
- Logs detallados para debugging
- Verificaciones de saldo antes de transacciones 