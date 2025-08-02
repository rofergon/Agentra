// SaucerSwap Router Swap Quote Tool - Public Exports
// Direct contract interaction for real-time swap quotes

// Core functionality exports
export { default as saucerswapRouterSwapQuoteTool } from './contract-client';

export {
  getSaucerswapRouterSwapQuote,
  saucerswapRouterSwapQuoteParameters,
  SAUCERSWAP_ROUTER_SWAP_QUOTE_TOOL,
  SAUCERSWAP_ROUTER_CONFIG,
  SAUCERSWAP_ROUTER_OPERATIONS,
} from './contract-client';

// LangChain integration exports  
export {
  createSaucerswapRouterSwapQuoteLangchainTool,
  createSaucerswapRouterSwapQuoteLangchainTools,
} from './langchain-tools';

// Tool metadata for easy reference
export const SAUCERSWAP_ROUTER_TOOL_INFO = {
  name: 'SaucerSwap Router V2 Swap Quote Tool',
  version: '1.0.0',
  description: 'Get real-time swap quotes from SaucerSwap V2 Router contract with Uniswap v3 style paths',
  contractId: {
    mainnet: '0.0.3949424',  // QuoterV2
    testnet: '0.0.1390002'   // QuoterV2
  },
  evmAddress: {
    mainnet: '0x000000000000000000000000000000000003c5618',  // QuoterV2
    testnet: '0x0000000000000000000000000000000000153392'   // QuoterV2
  },
  supportedOperations: [
    'get_amounts_out',
    'get_amounts_in'
  ],
  networks: ['mainnet', 'testnet'],
  features: [
    'JSON-RPC QuoterV2 integration (no operator required)',
    'Real-time quotes with embedded fees',
    'Multi-hop routing support',
    'Automatic HBAR to WHBAR conversion',
    'Uniswap v3 style path encoding',
    'Multiple fee tier support',
    'Hashio RPC for reliable connectivity'
  ]
} as const;