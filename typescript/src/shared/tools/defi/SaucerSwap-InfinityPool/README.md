### SaucerSwap Infinity Pool LangChain Tool

Stake SAUCE to earn xSAUCE on Hedera using SaucerSwap’s Infinity Pool (MotherShip) contract. This directory provides:

- A high-level LangChain tool for full staking/unstaking flows
- A granular step tool for multi-step workflows (e.g., WebSocket agents)
- A direct API client exposing the underlying operations

Links:
- SaucerSwap docs: `https://docs.saucerswap.finance/`
- Hedera docs: `https://docs.hedera.com/`

---

### What this tool does

- Associate SAUCE and xSAUCE tokens to an account (HTS association)
- Approve SAUCE allowance for the MotherShip contract
- Stake SAUCE → receive xSAUCE (interest-bearing)
- Unstake xSAUCE → receive SAUCE + rewards
- Return either ready-to-sign transaction bytes (RETURN_BYTES mode) or execute directly

Rewards are sourced from SaucerSwap protocol fees; xSAUCE represents your share and compounds over time. SAUCE and xSAUCE both use 6 decimals.

---

### Exports

From `index.ts` in this folder:

- Main tool and API
  - `infinityPoolTool`
  - `SAUCERSWAP_INFINITY_POOL_TOOL`
  - `INFINITY_POOL_CONFIG`
  - `INFINITY_POOL_OPERATIONS`
  - `infinityPoolStakeParameters`
  - `infinityPoolStakeFlow`
  - `associateInfinityPoolTokens`
  - `approveSauceForMotherShip`
  - `stakeSauceTokens`
  - `unstakeXSauceTokens`
  - `executeInfinityPoolStepOnly`

- Step tool
  - `infinityPoolStepTool`
  - `SAUCERSWAP_INFINITY_POOL_STEP_TOOL`
  - `infinityPoolStepParameters`
  - `executeInfinityPoolStakingStep`

- LangChain helpers
  - `createSaucerswapInfinityPoolLangchainTool`
  - `createSaucerswapInfinityPoolStepLangchainTool`
  - `createSaucerswapInfinityPoolLangchainTools`

---

### Supported operations (main tool)

`INFINITY_POOL_OPERATIONS`:

- `associate_tokens`: Associate SAUCE and xSAUCE to the account
- `approve_sauce`: Approve the MotherShip contract to spend SAUCE
- `stake_sauce`: Stake SAUCE to receive xSAUCE
- `unstake_xsauce`: Unstake xSAUCE to receive SAUCE
- `full_stake_flow`: Complete staking flow (association → approval → stake)
- `full_unstake_flow`: Complete unstaking flow

The step tool focuses on granular follow-ups:

- approval step (after association)
- stake step (after approval)

---

### Network and contracts

The tool auto-detects network from `HEDERA_NETWORK` (`mainnet` | `testnet`). Contract IDs and addresses are provided via `getInfinityPoolConfig()`.

- Mainnet
  - MotherShip: `0.0.1460199` (EVM `0x00000000000000000000000000000000001647e7`)
  - SAUCE: `0.0.731861` (EVM `0x00000000000000000000000000000000000b2ad5`)
  - xSAUCE: `0.0.1460200` (EVM `0x00000000000000000000000000000000001647e8`)
  - Chain ID: `295`

- Testnet
  - MotherShip: `0.0.1418650` (EVM `0x00000000000000000000000000000000001599ea`)
  - SAUCE: `0.0.1183558` (EVM `0x0000000000000000000000000000000000120f46`)
  - xSAUCE: `0.0.1418651` (EVM `0x00000000000000000000000000000000001599eb`)
  - Chain ID: `296`

All token amounts are 6-decimal tokens. The tool converts human numbers to smallest units internally.

---

### Environment configuration

Required for Hedera SDK usage (operator for direct execution mode):

```bash
HEDERA_NETWORK=mainnet # or testnet
HEDERA_ACCOUNT_ID=0.0.xxxxxxx
PRIVATE_KEY=302e0201...    # ED25519 or ECDSA private key for Hedera SDK
```

Additional (only for direct EVM transaction signing path used by this tool):

```bash
ECDSA_PRIVATE_KEY=0xabc123... # needed when not using RETURN_BYTES mode for contract calls
```

Notes:
- In RETURN_BYTES mode, the tool prepares `ContractExecuteTransaction` for signing and does not require `ECDSA_PRIVATE_KEY`.
- In direct execution mode, the tool signs an EVM transaction for `enter/leave` and wraps it in `EthereumTransaction` with `maxGasAllowanceHbar`.

---

### Parameters

Main tool schema: `infinityPoolStakeParameters(context)`

- `operation` (enum, required): one of the Supported operations
- `userAccountId` (string, optional): Hedera account ID; falls back to `context.accountId`
- `sauceAmount` (number, optional): SAUCE to stake; required for staking
- `xSauceAmount` (number, optional): xSAUCE to unstake; required for unstaking
- `approveAmount` (number, optional): SAUCE amount to approve; defaults to `sauceAmount`
- `associateTokens` (boolean, default `true`): whether to associate tokens if not already
- `transactionMemo` (string, optional): memo applied to transactions

Step tool schema: `infinityPoolStepParameters(context)`

- `sauceAmount` (number, required): amount of SAUCE for the step
- `userAccountId` (string, optional): account performing the step
- `referralCode` (number, optional)
- `transactionMemo` (string, optional)

---

### RETURN_BYTES vs direct execution

- RETURN_BYTES (`context.mode === 'returnBytes'`)
  - Only one transaction is prepared at a time in full flows
  - Responses include `{ bytes, step, operation, message, ... }`
  - Sign externally (e.g., in a WebSocket agent) before proceeding to the next step

- Direct execution (default)
  - Executes transactions immediately via Hedera SDK / EthereumTransaction
  - Requires operator credentials (and `ECDSA_PRIVATE_KEY` for contract calls)

Gas handling:
- Automatic gas estimation with 30% buffer and reasonable caps
- `EthereumTransaction` uses `maxGasAllowanceHbar` to cover HTS system contract costs; excess gas is refunded by Hedera

---

### Quick start (LangChain)

```ts
import { Client } from '@hashgraph/sdk';
import { AgentMode } from '../../../shared/types'; // or your context type
import { 
  createSaucerswapInfinityPoolLangchainTool,
  createSaucerswapInfinityPoolStepLangchainTool,
  createSaucerswapInfinityPoolLangchainTools,
  INFINITY_POOL_OPERATIONS
} from './index';

const client = Client.forName(process.env.HEDERA_NETWORK || 'testnet');
client.setOperator(process.env.HEDERA_ACCOUNT_ID!, process.env.PRIVATE_KEY!);

const userAccountId = process.env.HEDERA_ACCOUNT_ID!;
const context = { mode: AgentMode.RETURN_BYTES, accountId: userAccountId } as any;

// Single main tool
const poolTool = createSaucerswapInfinityPoolLangchainTool(client, context, userAccountId);

// Step tool (for multi-step signing)
const stepTool = createSaucerswapInfinityPoolStepLangchainTool(client, context, userAccountId);

// Both tools at once
const tools = createSaucerswapInfinityPoolLangchainTools(client, context, userAccountId);

// Example: full staking flow (RETURN_BYTES mode prepares association first)
const firstTx = await poolTool.invoke({
  operation: INFINITY_POOL_OPERATIONS.FULL_STAKE_FLOW,
  sauceAmount: 100.5,           // 100.5 SAUCE
  approveAmount: 100.5,
  associateTokens: true
});
// -> returns { bytes, step: 'token_association', nextStep: 'approval', ... }

// After association is signed and confirmed, continue with approval → stake steps
```

---

### Direct API usage

```ts
import { Client } from '@hashgraph/sdk';
import {
  infinityPoolStakeFlow,
  INFINITY_POOL_OPERATIONS
} from './api-client';

const client = Client.forName(process.env.HEDERA_NETWORK || 'testnet');
client.setOperator(process.env.HEDERA_ACCOUNT_ID!, process.env.PRIVATE_KEY!);

const context = { accountId: process.env.HEDERA_ACCOUNT_ID } as any;

// Associate tokens
await infinityPoolStakeFlow(client, context, {
  operation: INFINITY_POOL_OPERATIONS.ASSOCIATE_TOKENS,
  userAccountId: context.accountId
});

// Approve SAUCE (amount defaults to sauceAmount if not provided)
await infinityPoolStakeFlow(client, context, {
  operation: INFINITY_POOL_OPERATIONS.APPROVE_SAUCE,
  userAccountId: context.accountId,
  approveAmount: 50
});

// Stake SAUCE
await infinityPoolStakeFlow(client, context, {
  operation: INFINITY_POOL_OPERATIONS.STAKE_SAUCE,
  userAccountId: context.accountId,
  sauceAmount: 50
});

// Unstake xSAUCE
await infinityPoolStakeFlow(client, context, {
  operation: INFINITY_POOL_OPERATIONS.UNSTAKE_XSAUCE,
  userAccountId: context.accountId,
  xSauceAmount: 10
});
```

---

### Step tool usage

Use after the previous transaction is confirmed, for granular control:

```ts
import { executeInfinityPoolStakingStep } from './step-api-client';

// After approval is confirmed, stake the approved amount
await executeInfinityPoolStakingStep(client, context, {
  sauceAmount: 100.5,          // required
  userAccountId: context.accountId,
  transactionMemo: 'Stake step'
});
```

---

### Responses

- Success (RETURN_BYTES mode):

```json
{
  "step": "stake",
  "operation": "stake_sauce",
  "success": true,
  "message": "SAUCE staking transaction ready for signature (100.5 SAUCE)",
  "bytes": "0x...",
  "result": { "bytes": "0x...", "txId": "0.0.x@..." }
}
```

- Error:

```json
{
  "operation": "stake_sauce",
  "success": false,
  "error": "Insufficient SAUCE allowance...",
  "troubleshooting": {
    "commonIssues": [
      "Insufficient balance",
      "Tokens not associated",
      "Allowance not granted",
      "Gas limit too low"
    ],
    "solutions": [
      "Check SAUCE/xSAUCE balances",
      "Run token association",
      "Approve SAUCE for MotherShip",
      "Use default gas limits"
    ]
  }
}
```

---

### Security considerations

- Operates on real networks; transactions are irreversible
- Double-check amounts and addresses before signing
- Never share private keys; use RETURN_BYTES mode with external signing where possible
- Ensure sufficient HBAR for network fees and `maxGasAllowanceHbar`

---

### Troubleshooting

- Missing `userAccountId`: Provide in params or set `context.accountId`
- Token not associated: Run `associate_tokens` first
- Allowance insufficient: Run `approve_sauce` with adequate `approveAmount`
- Mirror Node allowance check failed: retry; ensure correct `HEDERA_NETWORK`
- Decimals: SAUCE/xSAUCE use 6 decimals; pass human numbers (the tool scales internally)
- Network mismatch: Verify env and client network match

---

### License

This tool is part of the Agentra project and follows the repository license.


