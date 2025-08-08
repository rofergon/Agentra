import {
  AccountId,
  Client,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Long,
  PrivateKey,
} from "@hashgraph/sdk";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DEFAULT_ORACLE_CONTRACT_ID = process.env.ORACLE_CONTRACT_ID || "0.0.6506125";

const TOKENS: Record<string, string> = {
  // MockPriceOracle constants (testnet)
  HBAR: "0x0000000000000000000000000000000000000000",
  WHBAR: "0x0000000000000000000000000000000000003aD2",
  USDC: "0x00000000000000000000000000000000000014F5",
  SAUCE: "0x0000000000000000000000000000000000120f46",
};

function getEnvOrThrow(names: string[]): string {
  for (const name of names) {
    const val = process.env[name];
    if (val && val.trim().length > 0) return val.trim();
  }
  throw new Error(`Missing required env. Tried: ${names.join(", ")}`);
}

async function createClient(): Promise<Client> {
  const accountId = AccountId.fromString(
    getEnvOrThrow(["HEDERA_ACCOUNT_ID", "ACCOUNT_ID"])
  );
  const privateKey = PrivateKey.fromStringECDSA(
    getEnvOrThrow(["PRIVATE_KEY", "ECDSA_PRIVATE_KEY"])
  );
  const client = Client.forTestnet();
  client.setOperator(accountId, privateKey);
  return client;
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const part = argv[i];
    if (part.startsWith("--")) {
      const key = part.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else if (!args._) {
      args._ = part;
    }
  }
  return args;
}

function resolveTokenAddress(tokenOrAddress: string): string {
  const upper = tokenOrAddress.toUpperCase();
  if (TOKENS[upper]) return TOKENS[upper];
  if (tokenOrAddress.startsWith("0x") && tokenOrAddress.length === 42) return tokenOrAddress;
  throw new Error(
    `Unknown token '${tokenOrAddress}'. Use one of ${Object.keys(TOKENS).join(", ")} or an EVM address.`
  );
}

function usdToScaled8(usd: string): bigint {
  // Convert decimal string to integer with 8 decimals
  const [intPart, fracPartRaw = ""] = usd.split(".");
  const frac = (fracPartRaw + "00000000").slice(0, 8);
  const numStr = `${intPart}${frac}`.replace(/^0+/, "") || "0";
  return BigInt(numStr);
}

function toUint256(value: bigint): Long {
  return Long.fromString(value.toString());
}

async function getOwner(client: Client, oracleId: string): Promise<string> {
  const result = await new ContractCallQuery()
    .setContractId(oracleId)
    .setGas(150_000)
    .setFunction("owner")
    .execute(client);
  // Returns EVM address string like 0x...
  return result.getAddress(0);
}

async function transferOwnership(
  client: Client,
  oracleId: string,
  newOwnerAddress: string
): Promise<void> {
  const tx = new ContractExecuteTransaction()
    .setContractId(oracleId)
    .setGas(300_000)
    .setFunction(
      "transferOwnership",
      new ContractFunctionParameters().addAddress(newOwnerAddress)
    );
  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  console.log(
    `transferOwnership(${newOwnerAddress}) -> ${receipt.status.toString()} txId=${submit.transactionId}`
  );
}

async function updatePrice(
  client: Client,
  oracleId: string,
  tokenAddress: string,
  scaledPrice: bigint
): Promise<void> {
  const tx = new ContractExecuteTransaction()
    .setContractId(oracleId)
    .setGas(300_000)
    .setFunction(
      "updatePrice",
      new ContractFunctionParameters().addAddress(tokenAddress).addUint256(toUint256(scaledPrice))
    );
  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  console.log(
    `updatePrice(${tokenAddress}, ${scaledPrice}) -> ${receipt.status.toString()} txId=${submit.transactionId}`
  );
}

async function updatePricesBatch(
  client: Client,
  oracleId: string,
  pairs: Array<{ token: string; scaled: bigint }>
): Promise<void> {
  const addresses = pairs.map((p) => p.token);
  const prices = pairs.map((p) => toUint256(p.scaled));

  const tx = new ContractExecuteTransaction()
    .setContractId(oracleId)
    .setGas(600_000)
    .setFunction(
      "updatePrices",
      new ContractFunctionParameters().addAddressArray(addresses).addUint256Array(prices)
    );
  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  console.log(`updatePrices(batch size=${pairs.length}) -> ${receipt.status.toString()} txId=${submit.transactionId}`);
}

async function resetPrices(client: Client, oracleId: string): Promise<void> {
  const tx = new ContractExecuteTransaction()
    .setContractId(oracleId)
    .setGas(200_000)
    .setFunction("resetPrices");
  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  console.log(`resetPrices() -> ${receipt.status.toString()} txId=${submit.transactionId}`);
}

async function getPrice(client: Client, oracleId: string, tokenAddress: string): Promise<bigint> {
  const result = await new ContractCallQuery()
    .setContractId(oracleId)
    .setGas(150_000)
    .setFunction("latestPrice", new ContractFunctionParameters().addAddress(tokenAddress))
    .execute(client);
  return BigInt(result.getUint256(0).toString());
}

function showUsage(): void {
  console.log(`\nOracle Price Admin (testnet)
Usage:
  ts-node BotExecutor/oracle-price-admin.ts set --token SAUCE --usd 0.06123
  ts-node BotExecutor/oracle-price-admin.ts set --token 0x... --priceRaw 6123000
  ts-node BotExecutor/oracle-price-admin.ts batch --pairs "SAUCE=0.061,HBAR=0.28"
  ts-node BotExecutor/oracle-price-admin.ts reset
  ts-node BotExecutor/oracle-price-admin.ts info --token SAUCE

Notes:
  - Prices use 8 decimals of precision internally (USDC-style)
  - You must be the oracle contract owner to update prices
  - ORACLE_CONTRACT_ID can be overridden via env
`);
}

async function main() {
  const args = parseArgs(process.argv);
  const cmd = (args._ as string | undefined) || "";
  const oracleId = (args.oracle as string | undefined) || DEFAULT_ORACLE_CONTRACT_ID;

  if (!cmd || ["-h", "--help", "help"].includes(cmd)) {
    showUsage();
    return;
  }

  const client = await createClient();

  if (cmd === "owner") {
    const owner = await getOwner(client, oracleId);
    console.log(`owner(${oracleId}) = ${owner}`);
    return;
  }

  if (cmd === "setOwner" || cmd === "transferOwner") {
    const newOwner = (args.to as string) || (args.new as string) || "";
    if (!newOwner) {
      console.error("Missing --to <0xEvmAddress>");
      process.exit(1);
    }
    console.log(`Transferring ownership to ${newOwner} (oracle=${oracleId})`);
    await transferOwnership(client, oracleId, newOwner);
    const owner = await getOwner(client, oracleId);
    console.log(`owner(${oracleId}) = ${owner}`);
    return;
  }

  if (cmd === "set") {
    const tokenArg = (args.token as string) || "";
    const usd = (args.usd as string) || "";
    const priceRaw = args.priceRaw as string | undefined;
    if (!tokenArg || (!usd && !priceRaw)) {
      console.error("Missing --token and either --usd or --priceRaw");
      showUsage();
      process.exit(1);
    }
    const token = resolveTokenAddress(tokenArg);
    const scaled = priceRaw ? BigInt(priceRaw) : usdToScaled8(usd);
    console.log(`Setting price token=${token} scaled=${scaled.toString()} (oracle=${oracleId})`);
    await updatePrice(client, oracleId, token, scaled);
    const latest = await getPrice(client, oracleId, token);
    console.log(`latestPrice -> ${latest.toString()}`);
    return;
  }

  if (cmd === "batch") {
    const pairsArg = (args.pairs as string) || ""; // e.g. "SAUCE=0.061,HBAR=0.28"
    if (!pairsArg) {
      console.error("Missing --pairs 'TOKEN=usd,...'");
      showUsage();
      process.exit(1);
    }
    const pairs = pairsArg.split(",").map((kv) => kv.trim()).filter(Boolean);
    if (pairs.length === 0) {
      console.error("No pairs parsed from --pairs");
      process.exit(1);
    }
    const parsed = pairs.map((kv) => {
      const [tokenKey, usd] = kv.split("=");
      if (!tokenKey || !usd) throw new Error(`Invalid pair '${kv}', expected TOKEN=usd`);
      return { token: resolveTokenAddress(tokenKey), scaled: usdToScaled8(usd) };
    });
    console.log(`Batch updating ${parsed.length} prices (oracle=${oracleId})`);
    await updatePricesBatch(client, oracleId, parsed);
    return;
  }

  if (cmd === "reset") {
    console.log(`Resetting oracle prices (oracle=${oracleId})`);
    await resetPrices(client, oracleId);
    return;
  }

  if (cmd === "info") {
    const tokenArg = (args.token as string) || "";
    if (!tokenArg) {
      console.error("Missing --token");
      showUsage();
      process.exit(1);
    }
    const token = resolveTokenAddress(tokenArg);
    const price = await getPrice(client, oracleId, token);
    console.log(`latestPrice(${token}) = ${price.toString()}`);
    return;
  }

  console.error(`Unknown command '${cmd}'`);
  showUsage();
  process.exit(1);
}

void main();


