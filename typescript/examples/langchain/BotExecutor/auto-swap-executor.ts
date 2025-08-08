import {
  AccountId,
  Client,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  HbarUnit,
  Long,
  PrivateKey,
} from "@hashgraph/sdk";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

type SwapOrder = {
  orderId: number;
  tokenOut: string;
  amountInTinybar: bigint;
  minAmountOut: bigint;
  triggerPrice: bigint;
  owner: string;
  isActive: boolean;
  expirationTime: bigint;
  isExecuted: boolean;
};

const DEFAULT_AUTOSWAP_CONTRACT_ID = "0.0.6506134";
const DEFAULT_ORACLE_CONTRACT_ID = "0.0.6506125";

const SAUCE_EVM_ADDRESS =
  process.env.BONZO_TESTNET_SAUCE_ADDRESS?.toLowerCase() ||
  "0x0000000000000000000000000000000000120f46";
const HBAR_EVM_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const SLIPPAGE_PERCENT = Number(process.env.SLIPPAGE_PERCENT || 1); // 1–2 recommended
const ALLOW_NEAR_TRIGGER_EXECUTION =
  (process.env.ALLOW_NEAR_TRIGGER_EXECUTION || "false").toLowerCase() ===
  "true";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 30_000);
const MAX_GAS_FOR_EXECUTE = Number(process.env.MAX_GAS_FOR_EXECUTE || 5_000_000);

function getEnvOrThrow(names: string[]): string {
  for (const name of names) {
    const val = process.env[name];
    if (val && val.trim().length > 0) return val.trim();
  }
  throw new Error(`Missing required env. Tried: ${names.join(", ")}`);
}

function toLongFromBigInt(value: bigint): Long {
  return Long.fromString(value.toString());
}

async function createHederaClient(): Promise<Client> {
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

async function queryNextOrderId(client: Client, autoSwapContractId: string): Promise<bigint> {
  const result = await new ContractCallQuery()
    .setContractId(autoSwapContractId)
    .setGas(150_000)
    .setFunction("nextOrderId")
    .execute(client);
  return BigInt(result.getUint256(0).toString());
}

async function queryOrderDetails(
  client: Client,
  autoSwapContractId: string,
  orderId: number
): Promise<SwapOrder> {
  const result = await new ContractCallQuery()
    .setContractId(autoSwapContractId)
    .setGas(300_000)
    .setFunction(
      "getOrderDetails",
      new ContractFunctionParameters().addUint256(orderId)
    )
    .execute(client);

  const tokenOut = result.getAddress(0);
  const amountInTinybar = BigInt(result.getUint256(1).toString());
  const minAmountOut = BigInt(result.getUint256(2).toString());
  const triggerPrice = BigInt(result.getUint256(3).toString());
  const owner = result.getAddress(4);
  const isActive = result.getBool(5);
  const expirationTime = BigInt(result.getUint256(6).toString());
  const isExecuted = result.getBool(7);

  return {
    orderId,
    tokenOut: tokenOut.startsWith("0x") ? tokenOut.toLowerCase() : `0x${tokenOut}`.toLowerCase(),
    amountInTinybar,
    minAmountOut,
    triggerPrice,
    owner,
    isActive,
    expirationTime,
    isExecuted,
  };
}

async function queryCanExecute(
  client: Client,
  autoSwapContractId: string,
  orderId: number
): Promise<{ can: boolean; reason: string }> {
  const result = await new ContractCallQuery()
    .setContractId(autoSwapContractId)
    .setGas(200_000)
    .setFunction(
      "canExecuteOrder",
      new ContractFunctionParameters().addUint256(orderId)
    )
    .execute(client);
  return {
    can: result.getBool(0),
    reason: result.getString(1),
  };
}

async function queryOracleLatestPrice(
  client: Client,
  oracleContractId: string,
  tokenEvmAddress: string
): Promise<bigint> {
  const result = await new ContractCallQuery()
    .setContractId(oracleContractId)
    .setGas(150_000)
    .setFunction(
      "latestPrice",
      new ContractFunctionParameters().addAddress(tokenEvmAddress)
    )
    .execute(client);
  return BigInt(result.getUint256(0).toString());
}

function formatScaled8(value: bigint): string {
  const SCALE = 100000000n;
  const integer = value / SCALE;
  const frac = (value % SCALE).toString().padStart(8, "0");
  return `${integer.toString()}.${frac}`;
}

function formatUsdc(value: bigint): string {
  // 8 decimals; present as $x.yyyyyyyy USDC
  return `$${formatScaled8(value)} USDC`;
}

async function getOraclePrices(
  client: Client,
  oracleContractId: string
): Promise<{ sauceUsdc: bigint; hbarUsdc: bigint; sauceInHbarScaled: bigint }> {
  const sauceUsdc = await queryOracleLatestPrice(
    client,
    oracleContractId,
    SAUCE_EVM_ADDRESS
  );
  const hbarUsdc = await queryOracleLatestPrice(
    client,
    oracleContractId,
    HBAR_EVM_ZERO_ADDRESS
  );

  if (hbarUsdc === 0n) throw new Error("HBAR price from oracle is zero");

  const SCALE = 100000000n; // 1e8
  const sauceInHbarScaled = (sauceUsdc * SCALE) / hbarUsdc;
  return { sauceUsdc, hbarUsdc, sauceInHbarScaled };
}

function isWithinSlippageTolerance(
  currentPrice: bigint,
  triggerPrice: bigint,
  slippagePercent: number
): boolean {
  if (slippagePercent <= 0) return currentPrice >= triggerPrice;
  const SCALE = 10000n; // basis points *100
  const bps = BigInt(Math.round(slippagePercent * 100));
  const threshold = (triggerPrice * (SCALE - bps)) / SCALE;
  return currentPrice >= threshold;
}

async function executeSwapOrder(
  client: Client,
  autoSwapContractId: string,
  orderId: number,
  currentPriceScaled: bigint
): Promise<void> {
  const tx = new ContractExecuteTransaction()
    .setContractId(autoSwapContractId)
    .setGas(MAX_GAS_FOR_EXECUTE)
    .setFunction(
      "executeSwapOrder",
      new ContractFunctionParameters()
        .addUint256(orderId)
        .addUint256(toLongFromBigInt(currentPriceScaled))
    );

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  const status = receipt.status.toString();
  console.log(
    `Order #${orderId}: executeSwapOrder status=${status} txId=${submit.transactionId}`
  );
}

async function scanAndExecute(): Promise<void> {
  const client = await createHederaClient();

  const autoSwapContractId =
    process.env.AUTOSWAP_CONTRACT_ID || DEFAULT_AUTOSWAP_CONTRACT_ID;
  const oracleContractId =
    process.env.ORACLE_CONTRACT_ID || DEFAULT_ORACLE_CONTRACT_ID;

  console.log("AutoSwap Executor starting...");
  console.log(`AutoSwapLimit: ${autoSwapContractId}`);
  console.log(`Oracle: ${oracleContractId}`);
  console.log(`SAUCE: ${SAUCE_EVM_ADDRESS}`);
  console.log(`Slippage tolerance: ${SLIPPAGE_PERCENT}%`);
  console.log(
    `Attempt execution when near-trigger: ${ALLOW_NEAR_TRIGGER_EXECUTION}`
  );

  while (true) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const nextOrderId = await queryNextOrderId(client, autoSwapContractId);
      const lastId = Number(nextOrderId - 1n);

      if (lastId < 1) {
        console.log("No orders yet; sleeping...");
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      const { sauceUsdc, hbarUsdc, sauceInHbarScaled } = await getOraclePrices(
        client,
        oracleContractId
      );
      // Logs en crudo y en formato humano
      console.log(
        `Oracle price SAUCE in HBAR (1e8 scale): ${sauceInHbarScaled.toString()}`
      );
      console.log(
        `Oracle price SAUCE in HBAR: ${formatScaled8(sauceInHbarScaled)} HBAR`
      );
      console.log(
        `Oracle price SAUCE in USDC (1e8 scale): ${sauceUsdc.toString()}`
      );
      console.log(`Oracle price SAUCE in USDC: ${formatUsdc(sauceUsdc)}`);
      console.log(
        `Oracle price HBAR in USDC (1e8 scale): ${hbarUsdc.toString()} => ${formatUsdc(hbarUsdc)}`
      );

      for (let orderId = 1; orderId <= lastId; orderId++) {
        try {
          const order = await queryOrderDetails(
            client,
            autoSwapContractId,
            orderId
          );

          if (!order.isActive || order.isExecuted) continue;
          if (Number(order.expirationTime) <= now) continue;
          if (order.tokenOut !== SAUCE_EVM_ADDRESS) continue;

          const { can, reason } = await queryCanExecute(
            client,
            autoSwapContractId,
            orderId
          );
          if (!can) {
            console.log(`Order #${orderId} not executable: ${reason}`);
            continue;
          }

          const meetsTrigger = sauceInHbarScaled >= order.triggerPrice;
          const nearTrigger = isWithinSlippageTolerance(
            sauceInHbarScaled,
            order.triggerPrice,
            SLIPPAGE_PERCENT
          );

          console.log(
            `Order #${orderId}: trigger=${order.triggerPrice.toString()} current=${sauceInHbarScaled.toString()} meets=${meetsTrigger} nearWithin${SLIPPAGE_PERCENT}%=${nearTrigger}`
          );

          if (meetsTrigger || (ALLOW_NEAR_TRIGGER_EXECUTION && nearTrigger)) {
            await executeSwapOrder(
              client,
              autoSwapContractId,
              orderId,
            sauceInHbarScaled
            );
          }
        } catch (orderErr: any) {
          console.error(`Order #${orderId} processing error:`, orderErr?.message || orderErr);
        }
      }
    } catch (err: any) {
      console.error("Scan loop error:", err?.message || err);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function main() {
  try {
    await scanAndExecute();
  } catch (err: any) {
    console.error("Fatal error:", err?.message || err);
    process.exit(1);
  }
}

void main();


