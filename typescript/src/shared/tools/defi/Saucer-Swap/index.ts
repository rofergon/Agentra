// SaucerSwap Router Swap Tool - Public Exports
// Direct contract interaction for real token swaps using UniswapV2Router02

// Core functionality exports
export { default as saucerswapRouterSwapTool } from './contract-client';

export {
  getSaucerswapRouterSwap,
  saucerswapRouterSwapParameters,
  SAUCERSWAP_ROUTER_SWAP_TOOL,
  SAUCERSWAP_V2_ROUTER_CONTRACTS,
  SAUCERSWAP_ROUTER_SWAP_OPERATIONS,
  SAUCERSWAP_ROUTER_SWAP_CONFIG,
  UNISWAP_V2_ROUTER02_ABI,
  tokenIdToEvmAddress,
  toEvmAddressFromId,
} from './contract-client';

// LangChain integration exports  
export {
  createSaucerSwapRouterSwapLangchainTool,
  createSaucerSwapRouterSwapLangchainTools,
} from './langchain-tools';

// Tool metadata for easy reference
export const SAUCERSWAP_ROUTER_SWAP_TOOL_INFO = {
  name: 'SaucerSwap Router V2 Swap Tool',
  version: '1.0.0',
  description: 'Execute real token swaps on SaucerSwap DEX using UniswapV2Router02 contract',
  contractId: {
    mainnet: '0.0.3045981',  // UniswapV2Router02
    testnet: '0.0.19264'     // UniswapV2Router02 (proxy)
  },
  evmAddress: {
    mainnet: '0x00000000000000000000000000000000002e7a5d',  // UniswapV2Router02
    testnet: '0x0000000000000000000000000000000000004b40'   // UniswapV2Router02 (proxy)
  },
  supportedOperations: [
    'swap_exact_hbar_for_tokens',
    'swap_exact_tokens_for_hbar', 
    'swap_exact_tokens_for_tokens',
    'swap_hbar_for_exact_tokens',
    'swap_tokens_for_exact_hbar',
    'swap_tokens_for_exact_tokens'
  ],
  networks: ['mainnet', 'testnet'],
  features: [
    'Direct UniswapV2Router02 contract interaction',
    'Real token swaps with transaction creation', 
    'HBAR to WHBAR automatic conversion',
    'Slippage protection (0.01% to 50%)',
    'Configurable deadlines',
    'Multi-hop routing support',
    'Both exact input and exact output swaps',
    'Mainnet and testnet support'
  ],
  supportedTokens: {
    mainnet: {
      HBAR: 'Native HBAR (auto-converts to WHBAR)',
      SAUCE: '0.0.731861',
      WHBAR: '0.0.1456986'
    },
    testnet: {
      HBAR: 'Native HBAR (auto-converts to WHBAR)', 
      SAUCE: '0.0.1183558',  // Corrected from official docs
      WHBAR: '0.0.15058'     // Corrected from official docs
    }
  },
  riskWarnings: [
    'Cryptocurrency swaps involve price volatility risk',
    'Slippage may result in different final amounts than expected',
    'Large swaps may have significant price impact',
    'Always verify token addresses before swapping',
    'Ensure sufficient HBAR balance for gas fees'
  ],
  usageGuidelines: {
    slippage: {
      stablecoins: '0.1% - 0.5%',
      major_tokens: '0.5% - 2%', 
      volatile_tokens: '2% - 5%',
      large_amounts: '5% - 15%',
      emergency: 'up to 50%'
    },
    amounts: {
      hbar_decimals: 8,
      sauce_decimals: 18,
      check_token_decimals: 'Always verify token decimal places'
    },
    best_practices: [
      'Start with small test amounts',
      'Check market conditions before large swaps',
      'Use appropriate slippage for token volatility',
      'Verify recipient address is correct',
      'Ensure token association before swapping'
    ]
  }
} as const;