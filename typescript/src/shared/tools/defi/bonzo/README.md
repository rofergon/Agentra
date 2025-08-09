### Bonzo Finance LangChain Tool

Interact with the Bonzo Finance DeFi protocol via its official REST API using a LangChain DynamicStructuredTool. This tool provides real-time data for markets, pools, protocol information, and account dashboards on Hedera.

Links:
- Bonzo Data API docs: `https://docs.bonzo.finance/hub/developer/bonzo-v1-data-api`

### Features
- Real-time market and pool statistics
- Protocol configuration and contract addresses
- BONZO token info and circulating supply
- Account dashboard (positions, APY, collateral) with optional automatic user account fallback
- Built-in retry, backoff, and lightweight response caching

### Exports
From `hedera-agent-kit` (or this package in a monorepo):
- `createBonzoLangchainTool(client, context, userAccountId)`
- `createBonzoLangchainTools(client, context, userAccountId)`
- `BONZO_API_OPERATIONS`

### Supported operations
- `account_dashboard`: Detailed account lending/borrowing positions. Requires `accountId` unless `userAccountId` is provided to the creator and used as a fallback.
- `market_info`: Current market data (APY, utilization, liquidity) for supported tokens.
- `pool_stats`: 24-hour protocol statistics (transactions, fees, liquidations).
- `protocol_info`: Protocol configuration and contract addresses.
- `bonzo_token`: BONZO token details and treasury info.
- `bonzo_circulation`: Current circulating supply (plain text number from API; returned here inside JSON for consistency).

### Parameters schema
- `operation` (required): One of `account_dashboard`, `market_info`, `pool_stats`, `protocol_info`, `bonzo_token`, `bonzo_circulation`.
- `accountId` (optional): Hedera account ID in format `shard.realm.num`. Required only for `account_dashboard` when no fallback is available.

### Return shape
The LangChain tool returns a stringified JSON object. Typical fields:
- `operation`: Echoes the requested operation
- `timestamp`: ISO timestamp
- `data`: API response (object or string depending on endpoint)
- `source`: "Bonzo Finance API"
- `api_url`: Effective URL used
- `cached`: Whether the result came from the in-memory cache

### Quick start

```ts
import { createBonzoLangchainTool, BONZO_API_OPERATIONS } from 'hedera-agent-kit';

// client is not used for Bonzo API calls but kept for a uniform signature
const client = undefined;
const context = {}; // optional context object used by internal prompt generator
const userAccountId = '0.0.123456'; // optional: used as fallback for account_dashboard

const bonzoTool = createBonzoLangchainTool(client, context, userAccountId);

// Use directly without a full agent:
const market = await bonzoTool.invoke({ operation: BONZO_API_OPERATIONS.MARKET_INFO });
console.log(market); // stringified JSON

const dashboard = await bonzoTool.invoke({ operation: BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD });
// If no accountId provided here, it will fallback to userAccountId passed to the creator
console.log(dashboard);
```

### Using with a LangChain agent

```ts
import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIToolsAgent, AgentExecutor } from 'langchain/agents';
import { createBonzoLangchainTool, BONZO_API_OPERATIONS } from 'hedera-agent-kit';

const llm = new ChatOpenAI({ model: 'gpt-4o-mini' });
const bonzo = createBonzoLangchainTool(undefined, {}, '0.0.123456');

const agent = await createOpenAIToolsAgent({ llm, tools: [bonzo] });
const executor = new AgentExecutor({ agent, tools: [bonzo] });

const result = await executor.invoke({
  input: 'Fetch current Bonzo market info and summarize APYs.'
});

console.log(result.output);
```

### Multiple tools

```ts
import { createBonzoLangchainTools } from 'hedera-agent-kit';
const tools = createBonzoLangchainTools(undefined, {}, '0.0.123456');
// returns an array; can be composed with other Hedera tools
```

### Notes on rate limiting and caching
- The tool enforces a minimum delay between requests and retries on `403`/`429` with exponential backoff.
- Responses are cached in-memory for ~30 seconds to reduce API load.
- If you are making many requests, expect occasional backoff waits.

### Troubleshooting
- `account_dashboard` without `accountId`: Provide `accountId` or set a `userAccountId` when creating the tool.
- HTTP 403/429: Wait and retry; the tool already implements backoff.
- Network errors: Check connectivity and try again.
- Refer to Bonzo API docs: `https://docs.bonzo.finance/hub/developer/bonzo-v1-data-api`

### TypeScript tips
- Prefer `BONZO_API_OPERATIONS` constants over raw strings to avoid typos.
- The tool returns a string (JSON). Parse if you need a typed object: `JSON.parse(result)`.

### License
Apache-2.0 (matches project license)


