### SaucerSwap Finance LangChain Tool

Interact with the SaucerSwap DEX on Hedera via its official REST API using a LangChain DynamicStructuredTool. This tool provides real-time protocol statistics, Single-Sided Staking (SSS) metrics, active farms, account farm positions, and a convenience query for the user’s Infinity Pool position (combining Mirror Node data with SaucerSwap API).

Links:
- SaucerSwap REST API docs: `https://docs.saucerswap.finance/v/developer/rest-api`

### Features
- Real-time general protocol stats (TVL, volume, swaps)
- SSS metrics: APY, SAUCE/xSAUCE ratio, staking amounts
- Active farms with emissions and total staked
- Account farm positions by Hedera account ID
- Infinity Pool position: combines xSAUCE balance (Mirror Node) + SAUCE/xSAUCE ratio (API)
- Built-in retry, exponential backoff, lightweight response caching
- Mainnet and Testnet support

### Exports
From `hedera-agent-kit` (or this package in a monorepo):
- `createSaucerSwapLangchainTool(client, context, userAccountId)`
- `createSaucerSwapLangchainTools(client, context, userAccountId)`
- `SAUCERSWAP_API_OPERATIONS`

### Supported operations
- `general_stats`: Overall protocol statistics. No parameters.
- `sss_stats`: Single-Sided Staking (SSS) statistics, including ratio and APY. No parameters.
- `farms`: List of active farms with emissions and staking data. No parameters.
- `account_farms`: Farm positions for a specific account. Requires `accountId`.
- `infinity_pool_position`: User’s Infinity Pool position. Requires `accountId`. Internally fetches xSAUCE balance from Mirror Node and SAUCE/xSAUCE ratio from SaucerSwap API.

### Parameters schema
- `operation` (required): One of `general_stats`, `sss_stats`, `farms`, `account_farms`, `infinity_pool_position`.
- `accountId` (optional): Hedera account ID in format `shard.realm.num`. Required for `account_farms` and `infinity_pool_position`.
- `network` (optional): `mainnet` or `testnet`. Defaults to `process.env.HEDERA_NETWORK || 'mainnet'`.

### Environment configuration
Set these environment variables as needed (example `.env`):

```bash
HEDERA_NETWORK=mainnet
SAUCERSWAP_MAINNET_API_KEY=your_mainnet_api_key
SAUCERSWAP_TESTNET_API_KEY=your_testnet_api_key
```

Notes:
- If API keys are not set, the tool falls back to baked-in demo keys, which may be rate-limited or invalid in production. Provide your own keys for reliability.
- `network` can be overridden per-call via the parameters.

### Return shape
The LangChain tool returns a stringified JSON object. Typical fields:
- `operation`: Echoes the requested operation
- `network`: Mainnet/Testnet used
- `timestamp`: ISO timestamp
- `data`: API response (object). For `infinity_pool_position`, includes both Mirror Node and API-derived fields
- `source`: Data source context
- `api_url` or `saucerswap_api_url`/`mirror_node_url`: Effective URLs used
- `cached`: Whether the result came from the in-memory cache

### Quick start

```ts
import { createSaucerSwapLangchainTool, SAUCERSWAP_API_OPERATIONS } from 'hedera-agent-kit';

// client is not used for direct API calls but kept for a uniform signature
const client = undefined;
const context = {}; // optional context for prompt metadata
const userAccountId = '0.0.123456'; // optional fallback for account-specific operations

const saucerTool = createSaucerSwapLangchainTool(client, context, userAccountId);

// Use directly without a full agent
const stats = await saucerTool.invoke({ operation: SAUCERSWAP_API_OPERATIONS.GENERAL_STATS });
console.log(stats); // stringified JSON

// Account farms: if accountId is omitted, tool will fallback to userAccountId
const farms = await saucerTool.invoke({ operation: SAUCERSWAP_API_OPERATIONS.ACCOUNT_FARMS });
console.log(farms);

// Infinity Pool position (xSAUCE → SAUCE via ratio)
const infinity = await saucerTool.invoke({
  operation: SAUCERSWAP_API_OPERATIONS.INFINITY_POOL_POSITION,
  // accountId: '0.0.123456' // optional; falls back to userAccountId if omitted
});
console.log(infinity);
```

### Using with a LangChain agent

```ts
import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIToolsAgent, AgentExecutor } from 'langchain/agents';
import { createSaucerSwapLangchainTool, SAUCERSWAP_API_OPERATIONS } from 'hedera-agent-kit';

const llm = new ChatOpenAI({ model: 'gpt-4o-mini' });
const saucer = createSaucerSwapLangchainTool(undefined, {}, '0.0.123456');

const agent = await createOpenAIToolsAgent({ llm, tools: [saucer] });
const executor = new AgentExecutor({ agent, tools: [saucer] });

const result = await executor.invoke({
  input: 'Get SaucerSwap general stats and summarize TVL and 24h volume.'
});

console.log(result.output);
```

### Multiple tools

```ts
import { createSaucerSwapLangchainTools } from 'hedera-agent-kit';
const tools = createSaucerSwapLangchainTools(undefined, {}, '0.0.123456');
// returns an array; compose with other Hedera tools
```

### Rate limiting and caching
- Enforces a minimum delay between requests and retries on `403`/`429` with exponential backoff.
- Responses are cached in-memory for ~30 seconds to reduce API load.
- Long-running or bursty workloads may see backoff waits.

### Troubleshooting
- **Missing accountId**: Provide `accountId` for `account_farms`/`infinity_pool_position`, or pass a `userAccountId` when creating the tool.
- **HTTP 403/429**: Check API keys and wait; the tool already retries with backoff.
- **Mirror Node issues** (only affects `infinity_pool_position`): Verify connectivity and account ID format.
- **Network mismatch**: Ensure `network` aligns with the account and API keys.
- **Docs**: `https://docs.saucerswap.finance/v/developer/rest-api`

### TypeScript tips
- Prefer `SAUCERSWAP_API_OPERATIONS` constants over raw strings to avoid typos.
- The tool returns a string (JSON). Parse if you need a typed object: `JSON.parse(result)`.

### License
Apache-2.0 (matches project license)


