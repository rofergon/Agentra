Oracle Price Admin (MockPriceOracle)

Simple CLI to manage prices in the `MockPriceOracle` contract on Hedera Testnet. It lets you set single prices, batch update multiple prices, reset defaults, and query current prices.

Targets:
- MockPriceOracle (default): `0.0.6506125`

Location: `BotExecutor/oracle-price-admin.ts` (run via npm).

Requirements
- Node.js and npm
- Install deps in `typescript/examples/langchain`: `npm i`
- Environment variables in `.env` (either in `typescript/examples/langchain/.env` or use the parent `.env`):
  - `HEDERA_ACCOUNT_ID` or `ACCOUNT_ID`
  - `PRIVATE_KEY` (ECDSA) or `ECDSA_PRIVATE_KEY`
  - Optional: `ORACLE_CONTRACT_ID` (defaults to `0.0.6506125`)

Run
From `typescript/examples/langchain`:

```powershell
npm run oracle:admin -- <command> [options]
```

Quick examples:
```powershell
# Set SAUCE = 0.06123 USDC
npm run oracle:admin -- set --token SAUCE --usd 0.06123

# Set HBAR = 0.30 USDC
npm run oracle:admin -- set --token HBAR --usd 0.30

# Batch update SAUCE, HBAR, USDC
npm run oracle:admin -- batch --pairs "SAUCE=0.08,HBAR=0.30,USDC=1.00"

# Read SAUCE price
npm run oracle:admin -- info --token SAUCE

# Reset prices to mock defaults
npm run oracle:admin -- reset
```

Notes:
- Override the oracle with `--oracle 0.0.x` or set `ORACLE_CONTRACT_ID` in `.env`.
- On Windows PowerShell, use double quotes in `--pairs`.

Commands

set
Set a token price.

```powershell
npm run oracle:admin -- set --token <TOKEN_OR_ADDRESS> (--usd <price> | --priceRaw <integer>)
```

- `--token`: supported symbol or EVM address `0x...` (42 chars)
  - Symbols: `HBAR`, `WHBAR`, `USDC`, `SAUCE`
- `--usd`: human decimal (internally 8 decimals like USDC)
- `--priceRaw`: integer already scaled to 1e8 (overrides `--usd`)
- Optional: `--oracle 0.0.x`

Examples:
```powershell
npm run oracle:admin -- set --token SAUCE --usd 0.0587
npm run oracle:admin -- set --token 0x0000000000000000000000000000000000120f46 --priceRaw 5870000
```

batch
Batch update multiple prices.

```powershell
npm run oracle:admin -- batch --pairs "TOKEN=usd,TOKEN=usd,..." [--oracle 0.0.x]
```

Example:
```powershell
npm run oracle:admin -- batch --pairs "SAUCE=0.08,HBAR=0.30,USDC=1.00"
```

info
Get the latest price for a token.

```powershell
npm run oracle:admin -- info --token <TOKEN_OR_ADDRESS> [--oracle 0.0.x]
```

reset
Reset all prices to the mock defaults.

```powershell
npm run oracle:admin -- reset [--oracle 0.0.x]
```

Price scale (8 decimals)
The oracle uses 8 decimal places. Examples:
- `1.00 USDC` → `100000000`
- `0.30 USDC` → `30000000`
- `0.06123 USDC` → `6123000`

If you pass `--usd`, the script converts to the 1e8 integer for you. With `--priceRaw`, you provide the 1e8 integer directly.

Permissions & costs
- You must be the oracle contract owner to update prices (`set`, `batch`, `reset`).
- Each transaction consumes HBAR (network fees).

Integration with the AutoSwap executor bot
To test the `auto-swap-executor` without relying on live market prices:
1. Use this tool to move SAUCE/USDC and HBAR/USDC so the AutoSwap order `triggerPrice` is met.
2. Run the executor bot that scans and executes orders:

```powershell
npm run bot:autoswap-executor
```

Useful executor flags (in `.env`):
- `SLIPPAGE_PERCENT` (default `1`)
- `ALLOW_NEAR_TRIGGER_EXECUTION` (`true|false`, default `false`)

Troubleshooting
- `CONTRACT_REVERT_EXECUTED`: you might not be the oracle owner or arguments were invalid.
- `INVALID_SIGNATURE` / `UNAUTHORIZED`: check `PRIVATE_KEY` and `HEDERA_ACCOUNT_ID` in `.env`.
- No effect on the bot: ensure the bot uses the same `ORACLE_CONTRACT_ID` and that prices actually cross the configured thresholds (1e8 scale).

Token shortcuts
- `HBAR`: `0x0000000000000000000000000000000000000000`
- `WHBAR`: `0x0000000000000000000000000000000000003aD2`
- `USDC`: `0x00000000000000000000000000000000000014F5`
- `SAUCE`: `0x0000000000000000000000000000000000120f46`

---
Questions or suggestions? Let me know and I’ll adjust it.


