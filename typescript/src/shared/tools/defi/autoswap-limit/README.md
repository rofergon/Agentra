## AutoSwapLimit LangChain Tool

Create and manage on-chain limit orders for HBAR→Token swaps on Hedera using the AutoSwapLimit smart contract. This tool provides LangChain-ready wrappers and a direct API client for creating orders and querying contract state. Swaps are routed via SaucerSwap liquidity.

### What this tool does
- Create HBAR→Token limit orders that execute when the market reaches a trigger price
- Inspect contract configuration, router info and balances
- Fetch order details and the next available order ID

### Contracts and networks
- **Mainnet/Testnet Contract ID**: `0.0.6506134`
- **EVM address**: `0x0000000000000000000000000000000000634696`
- **Supported tokens (built-in mappings):**
  - Mainnet: `SAUCE → 0.0.731861`, `WHBAR → 0.0.1456986`, `HBAR`
  - Testnet: `SAUCE → 0.0.1183558`, `WHBAR → 0.0.15058`, `HBAR`

### Available operations
- **create_swap_order**: Create a limit order (HBAR→Token)
- **get_order_details**: Get order details by `orderId`
- **get_contract_config**: Get execution fee, min order amount, backend executor, next order ID
- **get_router_info**: Get router, WHBAR, factory addresses and thresholds
- **get_contract_balance**: Get contract HBAR balance
- **get_next_order_id**: Get the next available order ID

### Parameters
- **tokenOut**: Token symbol or Hedera token ID (e.g., `"SAUCE"`, `"0.0.731861"`)
- **amountIn**: HBAR amount in decimal (e.g., `0.2`)
- **minAmountOut**: Minimum output amount in smallest unit (wei-like string)
- **triggerPrice**: Trigger price in smallest unit (wei-like string)
- **expirationHours**: Order expiration in hours (1–168, default 24)
- **orderId**: Order ID for order queries
- **network**: `mainnet` | `testnet` (defaults to `HEDERA_NETWORK` or `mainnet`)
- **userAccountId**: Hedera account ID of the user (e.g., `0.0.1234567`)

Notes:
- Minimum order amount enforced by config: `0.1 HBAR`.
- For testing with limited liquidity, conservative values work best, e.g. `minAmountOut="1"`, `triggerPrice="1"`.

### Environment
Set the network and operator credentials as usual for Hedera SDK usage.

```bash
HEDERA_NETWORK=testnet # or mainnet
HEDERA_ACCOUNT_ID=0.0.xxxxxxx
PRIVATE_KEY=302e0201... # ECDSA private key
```

### Installation
This tool is part of the Agentra monorepo. Ensure dependencies are installed where you consume it:

```bash
pnpm install @hashgraph/sdk zod @langchain/core
# or
npm install @hashgraph/sdk zod @langchain/core
```

---

## LangChain usage

Use the high-level tool factory to create a single structured tool or specialized tools.

```ts
import { Client } from "@hashgraph/sdk";
import { createAutoSwapLimitLangchainTool, createAutoSwapLimitOrderCreationTool, createAutoSwapLimitOrderQueryTool } from "./langchain-tools";
import type { Context } from "../../../configuration";

const client = Client.forName(process.env.HEDERA_NETWORK || "testnet");
client.setOperator(process.env.HEDERA_ACCOUNT_ID!, process.env.PRIVATE_KEY!);

const context: Context = { accountId: process.env.HEDERA_ACCOUNT_ID };
const userAccountId = process.env.HEDERA_ACCOUNT_ID!;

// Single all-in-one tool
const autoswapTool = createAutoSwapLimitLangchainTool(client, context, userAccountId);

// Create order
const createOrderResult = await autoswapTool.invoke({
  operation: "create_swap_order",
  tokenOut: "SAUCE",           // or token ID like "0.0.1183558"
  amountIn: 0.2,                // HBAR amount
  minAmountOut: "1",           // conservative test value
  triggerPrice: "1",           // conservative test value
  expirationHours: 24,
  network: "testnet"
});

// Query order details
const details = await autoswapTool.invoke({
  operation: "get_order_details",
  orderId: 123,
  network: "testnet"
});

// Specialized helpers
const createTool = createAutoSwapLimitOrderCreationTool(client, context, userAccountId);
const queryTool = createAutoSwapLimitOrderQueryTool(client, context, userAccountId);

await createTool.invoke({
  tokenOut: "SAUCE",
  amountIn: 0.2,
  minAmountOut: "1",
  triggerPrice: "1",
  expirationHours: 24,
  network: "testnet"
});

await queryTool.invoke({
  operation: "get_next_order_id",
  network: "testnet"
});
```

---

## Direct API usage

You can call the contract operations directly via the API client.

```ts
import { Client } from "@hashgraph/sdk";
import { getAutoSwapLimitQuery, AUTOSWAP_LIMIT_OPERATIONS } from "./api-client";
import type { Context } from "../../../configuration";

const client = Client.forName(process.env.HEDERA_NETWORK || "testnet");
client.setOperator(process.env.HEDERA_ACCOUNT_ID!, process.env.PRIVATE_KEY!);

const context: Context = { accountId: process.env.HEDERA_ACCOUNT_ID };

const result = await getAutoSwapLimitQuery(client, context, {
  operation: AUTOSWAP_LIMIT_OPERATIONS.CREATE_SWAP_ORDER,
  tokenOut: "SAUCE",
  amountIn: 0.2,
  minAmountOut: "1",
  triggerPrice: "1",
  expirationHours: 24,
  network: "testnet",
  userAccountId: process.env.HEDERA_ACCOUNT_ID!
});
```

---

## Responses

Order creation success (shape):

```json
{
  "success": true,
  "operation": "create_swap_order",
  "network": "testnet",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "order": {
    "orderId": 123,
    "tokenOut": "0.0.1183558",
    "tokenOutSymbol": "SAUCE",
    "amountIn": "0.2",
    "minAmountOut": "1",
    "triggerPrice": "1",
    "expirationTime": 1700000000,
    "owner": "0.0.1234567",
    "isActive": true,
    "isExecuted": false
  },
  "contract": {
    "id": "0.0.6506134",
    "evmAddress": "0x0000000000000000000000000000000000634696"
  },
  "source": "AutoSwapLimit Contract"
}
```

Query success (shape):

```json
{
  "success": true,
  "operation": "get_order_details",
  "network": "testnet",
  "timestamp": "...",
  "data": { "...": "..." },
  "contract": { "id": "0.0.6506134", "evmAddress": "0x..." },
  "source": "AutoSwapLimit Contract"
}
```

Error (shape):

```json
{
  "success": false,
  "error": "Error in AutoSwapLimit operation: ...",
  "operation": "create_swap_order",
  "timestamp": "...",
  "troubleshooting": {
    "issue": "...",
    "possible_causes": ["..."],
    "next_steps": ["..."]
  },
  "contractInfo": { "contract_id": "0.0.6506134", "network": "testnet" }
}
```

### RETURN_BYTES mode
When `context.mode` is `returnBytes`, contract read queries are not executed; the tool returns placeholder data for query operations. Use this mode when you need transaction bytes for external signing (e.g., WebSocket agents). For direct contract reads, use normal execution mode.

---

## Tips and troubleshooting
- Use conservative parameters on testnet due to limited liquidity: `minAmountOut="1"`, `triggerPrice="1"`, small `amountIn` like `0.2` HBAR
- Ensure `userAccountId` is provided (in params or `context.accountId`)
- Verify `HEDERA_NETWORK` matches your `Client` configuration
- Common error reasons include: invalid token identifiers, insufficient HBAR balance, contract not available on the selected network

## License
This tool is part of the Agentra project and follows the repository license.


