import { z } from 'zod';
import { Client } from '@hashgraph/sdk';
import { Context } from './configuration';
import createNonFungibleTokenTool, {
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
} from './tools/non-fungible-token/create-non-fungible-token';
import createFungibleTokenTool, {
  CREATE_FUNGIBLE_TOKEN_TOOL,
} from './tools/fungible-token/create-fungible-token';
import transferHbarTool, { TRANSFER_HBAR_TOOL } from './tools/account/transfer-hbar';
import airdropFungibleToken, {
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
} from './tools/fungible-token/airdrop-fungible-token';
import submitTopicMessageTool, {
  SUBMIT_TOPIC_MESSAGE_TOOL,
} from './tools/consensus/submit-topic-message';
import getHbarBalanceQuery, {
  GET_HBAR_BALANCE_QUERY_TOOL,
} from './tools/queries/get-hbar-balance-query';
import getAccountTokenBalancesQuery, {
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
} from './tools/queries/get-account-token-balances-query';
import getAccountQuery, { GET_ACCOUNT_QUERY_TOOL } from './tools/queries/get-account-query';
import getTopicMessagesQuery, {
  GET_TOPIC_MESSAGES_QUERY_TOOL,
} from './tools/queries/get-topic-messages-query';
import createTopicTool, { CREATE_TOPIC_TOOL } from './tools/consensus/create-topic';
// Import Bonzo tools from new modular structure (API-based)
import { bonzoApiQueryTool, BONZO_API_QUERY_TOOL } from './tools/defi/bonzo';
import { bonzoDepositTool, BONZO_DEPOSIT_TOOL } from './tools/defi/bonzoTransaction';
// Import SaucerSwap tools from new modular structure (API-based)
import { saucerswapApiQueryTool, SAUCERSWAP_API_QUERY_TOOL } from './tools/defi/saucerswap';
// Import SaucerSwap Router tools (contract-based swap quotes)
// TODO: Fix SaucerSwap-Quote tool export issue
// import saucerswapRouterSwapQuoteTool, { SAUCERSWAP_ROUTER_SWAP_QUOTE_TOOL } from './tools/defi/SaucerSwap-Quote';
// Import SaucerSwap Infinity Pool staking tools
import { infinityPoolTool, SAUCERSWAP_INFINITY_POOL_TOOL } from './tools/defi/SaucerSwap-InfinityPool';
import { infinityPoolStepTool, SAUCERSWAP_INFINITY_POOL_STEP_TOOL } from './tools/defi/SaucerSwap-InfinityPool';

export type Tool = {
  method: string;
  name: string;
  description: string;
  parameters: z.ZodObject<any, any>;
  execute: (client: Client, context: Context, params: any) => Promise<any>;
};

const tools = (context: Context): Tool[] => [
  createFungibleTokenTool(context),
  createNonFungibleTokenTool(context),
  transferHbarTool(context),
  airdropFungibleToken(context),
  createTopicTool(context),
  submitTopicMessageTool(context),
  getHbarBalanceQuery(context),
  getAccountQuery(context),
  getAccountTokenBalancesQuery(context),
  getTopicMessagesQuery(context),
  bonzoApiQueryTool(context),
  bonzoDepositTool(context),
  saucerswapApiQueryTool(context),
  // TODO: Add back when SaucerSwap-Quote export is fixed
  // saucerswapRouterSwapQuoteTool(context),
  infinityPoolTool(context),
  infinityPoolStepTool(context),
];

export const hederaTools = {
  CREATE_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  TRANSFER_HBAR_TOOL,
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  CREATE_TOPIC_TOOL,
  SUBMIT_TOPIC_MESSAGE_TOOL,
  GET_HBAR_BALANCE_QUERY_TOOL,
  GET_ACCOUNT_QUERY_TOOL,
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
  GET_TOPIC_MESSAGES_QUERY_TOOL,
  BONZO_API_QUERY_TOOL,
  BONZO_DEPOSIT_TOOL,
  SAUCERSWAP_API_QUERY_TOOL,
  // TODO: Add back when SaucerSwap-Quote export is fixed
  // SAUCERSWAP_ROUTER_SWAP_QUOTE_TOOL,
  SAUCERSWAP_INFINITY_POOL_TOOL,
  SAUCERSWAP_INFINITY_POOL_STEP_TOOL,
};

export default tools;
