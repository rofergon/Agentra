import * as dotenv from 'dotenv';
// Configure dotenv FIRST before any other imports that depend on environment variables
dotenv.config();

import { HederaLangchainToolkit, AgentMode, hederaTools } from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { BufferMemory } from 'langchain/memory';
import { Client } from '@hashgraph/sdk';
import WebSocket, { WebSocketServer } from 'ws';
import * as http from 'http';
// Import Bonzo tools from the new modular structure (API-based)
import { createBonzoLangchainTool } from '../../src/shared/tools/defi/bonzo/langchain-tools';
import { createBonzoDepositLangchainTool, createBonzoDepositStepLangchainTool, createBonzoApproveStepLangchainTool } from '../../src/shared/tools/defi/bonzoTransaction/langchain-tools';
// Import SaucerSwap tools from the new modular structure (API-based)
import { createSaucerSwapLangchainTool } from '../../src/shared/tools/defi/saucerswap-api/langchain-tools';
// Import SaucerSwap Router tools (contract-based swap quotes)
import { createSaucerswapRouterSwapQuoteLangchainTool } from '../../src/shared/tools/defi/SaucerSwap-Quote/langchain-tools';
// Import SaucerSwap Router swap execution tools
import { createSaucerSwapRouterSwapLangchainTool } from '../../src/shared/tools/defi/Saucer-Swap/langchain-tools';
// Import SaucerSwap Infinity Pool staking tools
import { createSaucerswapInfinityPoolLangchainTool, createSaucerswapInfinityPoolStepLangchainTool } from '../../src/shared/tools/defi/SaucerSwap-InfinityPool/langchain-tools';
// Import AutoSwapLimit limit order tools
import { createAutoSwapLimitLangchainTool } from '../../src/shared/tools/defi/autoswap-limit/langchain-tools';

// WebSocket message types
interface BaseMessage {
  id?: string;
  timestamp: number;
}

interface UserMessage extends BaseMessage {
  type: 'USER_MESSAGE';
  message: string;
  userAccountId?: string; // Account ID del usuario
}

interface AgentResponse extends BaseMessage {
  type: 'AGENT_RESPONSE';
  message: string;
  hasTransaction?: boolean;
}

interface TransactionToSign extends BaseMessage {
  type: 'TRANSACTION_TO_SIGN';
  transactionBytes: number[];
  originalQuery: string;
}

interface TransactionResult extends BaseMessage {
  type: 'TRANSACTION_RESULT';
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: string;
}

interface SystemMessage extends BaseMessage {
  type: 'SYSTEM_MESSAGE';
  message: string;
  level: 'info' | 'error' | 'warning';
}

interface ConnectionAuth extends BaseMessage {
  type: 'CONNECTION_AUTH';
  userAccountId: string;
}

interface SwapQuote extends BaseMessage {
  type: 'SWAP_QUOTE';
  quote: {
    operation: string;
    network: string;
    input: {
      token: string;
      tokenId: string;
      amount: string;
      formatted: string;
    };
    output: {
      token: string;
      tokenId: string;
      amount: string;
      formatted: string;
    };
    path: string[];
    fees: number[];
    exchangeRate: string;
    gasEstimate?: string;
  };
  originalMessage: string; // Preserve the original formatted response
}

type WSMessage = UserMessage | AgentResponse | TransactionToSign | TransactionResult | SystemMessage | ConnectionAuth | SwapQuote;

// Extended interface to support multi-step flows
interface PendingStep {
  tool: string;
  operation: string;
  step: string;
  originalParams: any;
  nextStepInstructions?: string;
}

interface UserConnection {
  ws: WebSocket;
  userAccountId: string;
  agentExecutor: AgentExecutor;
  memory: BufferMemory;
  pendingStep?: PendingStep; // Track multi-step flows
}

class HederaWebSocketAgent {
  private wss: WebSocketServer;
  private httpServer: http.Server;
  private llm!: ChatOpenAI;
  private agentClient!: Client;
  private userConnections: Map<WebSocket, UserConnection> = new Map();
  
  // 🧠 MVP: Debug flag to force memory clear on each message (for debugging in production)
  private readonly FORCE_CLEAR_MEMORY_ON_MESSAGE = process.env.FORCE_CLEAR_MEMORY === 'true';

  constructor(port: number = 8080) {
    // Create HTTP server for health checks
    this.httpServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          service: 'hedera-websocket-agent',
          timestamp: new Date().toISOString(),
          connections: this.userConnections.size
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('WebSocket Agent - Use WebSocket connection on port ' + port);
      }
    });

    // Create WebSocket server on the same HTTP server
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.httpServer.listen(port);
    this.setupWebSocketServer();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Hedera WebSocket Agent...');
    console.log(`🧠 MVP Memory Debug Mode: ${this.FORCE_CLEAR_MEMORY_ON_MESSAGE ? 'ENABLED' : 'DISABLED'}`);
    console.log(`📊 Memory will be cleared ${this.FORCE_CLEAR_MEMORY_ON_MESSAGE ? 'on every message' : 'only on new connections'}`);

    // Configuración OpenAI
    this.llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
    });

    // Hedera client for testnet (without operator, will be configured by user)
    this.agentClient = Client.forTestnet();

    console.log('✅ Hedera WebSocket Agent initialized successfully');
  }

  private async createUserConnection(ws: WebSocket, userAccountId: string): Promise<UserConnection> {
    console.log(`🆕 Creating NEW user connection for account: ${userAccountId}`);
    
    // Available tools
    const {
      CREATE_FUNGIBLE_TOKEN_TOOL,
      CREATE_TOPIC_TOOL,
      SUBMIT_TOPIC_MESSAGE_TOOL,
      GET_HBAR_BALANCE_QUERY_TOOL,
      TRANSFER_HBAR_TOOL,
      GET_ACCOUNT_QUERY_TOOL,
      GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
      GET_TOPIC_MESSAGES_QUERY_TOOL,
    } = hederaTools;

    // Hedera toolkit with RETURN_BYTES mode and user account ID
    const hederaAgentToolkit = new HederaLangchainToolkit({
      client: this.agentClient,
      configuration: {
        tools: [
          CREATE_TOPIC_TOOL,
          SUBMIT_TOPIC_MESSAGE_TOOL,
          CREATE_FUNGIBLE_TOKEN_TOOL,
          GET_HBAR_BALANCE_QUERY_TOOL,
          TRANSFER_HBAR_TOOL,
          GET_ACCOUNT_QUERY_TOOL,
          GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
          GET_TOPIC_MESSAGES_QUERY_TOOL,
        ],
        context: {
          mode: AgentMode.RETURN_BYTES,
          accountId: userAccountId, // ✅ KEY CHANGE: Use user account ID, not operator account ID
        },
      },
    });

    // Prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', `You are a helpful ::HEDERA:: blockchain assistant with comprehensive DeFi capabilities.

**CORE CAPABILITIES:**
- ::HEDERA:: Hedera Native Operations (HTS, HCS, transfers, queries)
- ::BONZO:: DeFi Analytics with Bonzo Finance (real-time lending market data, account positions)
- ::BONZO:: DeFi Transactions with Bonzo Finance (HBAR deposits to earn interest)
- ::SAUCERSWAP:: DeFi Analytics with SaucerSwap (real-time DEX data, trading stats, farm yields)
- 🥩 DeFi Staking with SaucerSwap Infinity Pool (SAUCE staking to earn xSAUCE rewards)
- 🎯 DeFi Limit Orders with AutoSwapLimit (automated token swaps at specific prices)

**RESPONSE FORMATTING - USE ICONS CONSISTENTLY:**
- 💡 Use icons to make responses more visual and intuitive
- 📈 Financial data: Use charts, money, and trending icons
- ⚠️ Warnings/risks: Use warning and alert icons
- ✅ Success/confirmation: Use checkmarks and positive icons
- 🔍 Analysis/insights: Use magnifying glass and analytics icons
- 🚀 Opportunities/growth: Use rocket and upward trending icons
- 📋 Dashboards/summaries: Use clipboard and list icons

**ICON USAGE GUIDE:**
**Financial Operations:**
- 💰 Money amounts, balances, deposits
- 📈 Positive trends, APY rates, gains
- 📉 Negative trends, losses, risks
- 💎 High-value assets, premium opportunities
- 💼 Banking/lending operations
- 🔄 Swaps, exchanges, trading
- 🌾 Farming, staking, yield generation
- 💧 Liquidity pools, TVL data

**Status & Actions:**
- ✅ Completed transactions, success states
- ⏳ Pending operations, processing
- ⏳ In progress, ongoing operations
- ❌ Failed operations, errors
- ⚠️ Important warnings, risks
- 💡 Tips, recommendations, insights
- 🎯 Targets, goals, objectives
- 🔍 Analysis, detailed breakdowns

**Account & Assets:**
- 👤 User account information
- 🏠 Portfolio/dashboard views
- 🪙 Token information, balances
- 📊 Statistics, performance metrics
- 📈 Growth opportunities
- 🔐 Security, private keys, authentication

**PLATFORM MARKERS - CRITICAL:**
Use these exact markers for platform branding (frontend will replace with real logos):
- ::HEDERA:: **Hedera** for Hedera native operations (HTS, HCS, transfers, queries)
- ::BONZO:: **Bonzo Finance** for lending/borrowing operations  
- ::SAUCERSWAP:: **SaucerSwap** for DEX trading/farming operations
- ALWAYS include the platform name in markdown after the marker
- Keep other functional icons (🥩🌾💱💰📈📊🎯✅etc) unchanged

**PLATFORM NAMING EXAMPLES:**
- ::HEDERA:: **Hedera Operations:** or ::HEDERA:: **Hedera Network:**
- ::BONZO:: **Bonzo Finance** (Lending Protocol): 
- ::SAUCERSWAP:: **SaucerSwap** (DEX & Farming):

**RESPONSE BEHAVIOR - CRITICAL:**
- EXECUTE TOOLS IMMEDIATELY without status messages like "Fetching data..." or "Please hold on"
- NEVER provide intermediary status updates - call tools and respond with results directly
- BE CONCISE and contextual in all responses
- ALWAYS use relevant icons to enhance readability
- Use markdown formatting with icons for headers and key points
- AVOID repeating detailed information already shared in this conversation
- When referencing previous data, use phrases like "📊 Based on the market data from earlier..." or "📈 As shown in the previous market overview..."
- For investment advice: Give clear recommendations WITHOUT repeating all market details
- For follow-up questions: Focus only on NEW information or specific analysis requested
- Only show complete detailed data when explicitly asked for fresh/updated information
- RESPOND IN SINGLE MESSAGE: Call the appropriate tool and present results immediately

**MARKDOWN FORMATTING RULES:**
Use this hierarchical structure for organized responses:

# Main Section Title:
Use H1 (single #) for main sections like "Operations:", "Analytics & Insights:", "Market Overview:"

## ::PLATFORM:: Platform Name (Description):
Use H2 (double ##) for platform-specific sections with markers

### Subsection Title:
Use H3 (triple ###) for detailed breakdowns when needed

**Operation/Feature Lists:**
• **Operation Name**: Clear description of what it does
• **Feature Name**: Brief explanation with key benefits
• **Action Item**: Direct instruction or recommendation

**Visual Separation:**
- Use blank lines between major sections
- Group related operations under platform headers
- Add horizontal breaks (---) for major section divisions when needed

**Example Structure:**
Use H1 (#) for main sections and H2 (##) for platforms with bullets for features.

**DeFi PROTOCOL GUIDANCE:**

**::BONZO:: Bonzo Finance (Lending Protocol):**
- Use for: lending rates, borrowing data, account positions, HBAR deposits
- Keywords: "lending", "borrowing", "deposit", "interest", "APY", "positions", "dashboard", "rates", "statistics", "market"
- Operations: market_info, account_dashboard, pool_stats, protocol_info
- IMMEDIATE EXECUTION: For lending rates/statistics requests, call bonzo_tool with market_info operation directly
- Always include platform name: ::BONZO:: **Bonzo Finance**

**::SAUCERSWAP:: SaucerSwap (DEX Protocol):**
- Use for: trading stats, liquidity data, farm yields, SAUCE token info
- Keywords: "trading", "swap", "farms", "liquidity", "TVL", "volume"
- Operations: general_stats, farms, account_farms
- Available on mainnet and testnet
- Always include platform name: ::SAUCERSWAP:: **SaucerSwap**

**::SAUCERSWAP:: SaucerSwap Infinity Pool Analytics:**
- Use for: Both individual positions AND global market statistics
- Keywords: "my infinity pool", "my SAUCE staking", "infinity pool position", "xSAUCE balance", "staking rewards"
- Operations: 
  - infinity_pool_position (user's actual staking position - xSAUCE balance + claimable SAUCE)
  - sss_stats (global market statistics only - total staked, ratio, APY)
- Shows: xSAUCE balance, claimable SAUCE, current ratio, position value, market context
- ✅ IMPORTANT: Use infinity_pool_position for individual user positions
- Icons: 🥩 📊 📈 💰

**::SAUCERSWAP:: SaucerSwap Router (Swap Quotes):**
- Use for: real-time swap quotes, price calculations, trading routes
- Keywords: "quote", "swap price", "exchange rate", "how much", "convert", "trade amount"
- Operations: get_amounts_out (output from input), get_amounts_in (input from output)
- Direct contract interaction with UniswapV2Router02
- Supports multi-hop routing and automatic token conversion
- Icons: 💱 📊 🔄 💰 ⚡

**🚨 CRITICAL SWAP WORKFLOW - MANDATORY:**
When user requests ANY swap operation, ALWAYS follow this exact sequence:
1. **FIRST**: Show swap quote using saucerswap_router_swap_quote_tool (NEVER skip this step)
2. **SECOND**: Wait for explicit confirmation from user ("execute swap", "confirm", "proceed", "yes")
3. **THIRD**: Only then execute the actual swap using saucerswap_router_swap_tool

**SWAP REQUEST DETECTION:**
- Keywords that trigger QUOTE FIRST: "swap", "exchange", "trade", "buy", "sell", "convert"
- Example: "swap 100 HBAR for SAUCE" → ALWAYS show quote first, then wait for confirmation
- Example: "trade HBAR to SAUCE" → ALWAYS show quote first, then wait for confirmation
- ⚠️ NEVER execute swap directly without showing quote first

**🎯 CRITICAL LIMIT ORDER DETECTION - MANDATORY:**
When user requests limit orders, use AutoSwapLimit (NOT immediate swaps):
- **Keywords that trigger LIMIT ORDER**: "buy [TOKEN] at [PRICE]", "buy [TOKEN] when price reaches [PRICE]", "set limit", "program order", "order at"
- **Examples that should use AutoSwapLimit**:
  - "buy SAUCE at 0.040 USDC" → Use autoswap_limit_tool with create_swap_order
  - "buy SAUCE when price drops to 0.001 HBAR" → Use autoswap_limit_tool with create_swap_order
  - "set up a limit order for SAUCE at 0.05 HBAR" → Use autoswap_limit_tool with create_swap_order
- **Examples that should use immediate swap**:
  - "swap 100 HBAR for SAUCE" → Use saucerswap_router_swap_quote_tool (immediate)
  - "buy SAUCE now" → Use saucerswap_router_swap_quote_tool (immediate)
- ⚠️ NEVER use immediate swap tools when user mentions a specific price point

**::SAUCERSWAP:: SaucerSwap Router (Token Swaps):**
- Use for: executing real token swaps ONLY after quote confirmation
- Keywords for EXECUTION: "execute swap", "confirm swap", "proceed with swap", "yes proceed", "confirm trade"
- Operations: swap_exact_hbar_for_tokens, swap_exact_tokens_for_hbar, swap_exact_tokens_for_tokens
- Real transaction creation using UniswapV2Router02 contract
- Built-in slippage protection and deadline management
- IMPORTANT: Use correct token IDs for current network:
  - Current network: ${process.env.HEDERA_NETWORK || 'mainnet'}
  - SAUCE testnet: 0.0.1183558 | SAUCE mainnet: 0.0.731861  
  - WHBAR testnet: 0.0.15058 | WHBAR mainnet: 0.0.1456986
- Icons: 🔄 💱 💰 🚀 ⚡

**::SAUCERSWAP:: SaucerSwap Infinity Pool (SAUCE Staking):**
- Use for: staking SAUCE tokens to earn xSAUCE, unstaking xSAUCE for SAUCE + rewards
- Keywords: "stake", "staking", "SAUCE staking", "xSAUCE", "Infinity Pool", "stake SAUCE", "unstake"
- Operations: associate_tokens, approve_sauce, stake_sauce, unstake_xsauce, full_stake_flow, full_unstake_flow
- **CRITICAL**: For new staking requests, ALWAYS use "full_stake_flow" operation ONLY
- **NEVER** execute multiple operations simultaneously - the flow handles steps automatically
- Multi-step flow: Token association → SAUCE approval → Staking (earn xSAUCE)
- Staking rewards from SaucerSwap trading fees automatically compound
- No lock-up period - unstake anytime to receive SAUCE + rewards
- MotherShip contract (0.0.1460199) handles SAUCE → xSAUCE conversions
- Icons: 🥩 💰 📈 🎯 ⏳

**::AUTOSWAPLIMIT:: AutoSwapLimit (Limit Orders):**
- Use for: creating automated limit orders to swap HBAR for tokens at specific prices
- Keywords: "limit order", "buy order", "automated swap", "price trigger", "when price drops", "when price reaches", "at price", "buy at", "order at", "set limit", "program order"
- **CRITICAL DETECTION**: When user says "buy [TOKEN] at [PRICE]" or "buy [TOKEN] when price reaches [PRICE]" → Use AutoSwapLimit
- **CRITICAL DETECTION**: When user mentions a specific price point for buying → Use AutoSwapLimit
- **CRITICAL DETECTION**: When user wants to "set up" or "program" an order → Use AutoSwapLimit
- Operations: create_swap_order, get_order_details, get_contract_config, get_router_info, get_contract_balance, get_next_order_id
- **CRITICAL**: For limit order creation, use "create_swap_order" operation
- **REQUIRED PARAMETERS**: tokenOut (e.g., "SAUCE"), amountIn (HBAR amount), minAmountOut (wei), triggerPrice (wei)
- **PRICE CONVERSION**: When user mentions price in USDC, convert to HBAR equivalent for triggerPrice
- **PRICE CONVERSION**: When user mentions price in USD, convert to HBAR equivalent for triggerPrice
- **PRICE CONVERSION**: When user mentions price in HBAR, use directly for triggerPrice
- **PARAMETER CALCULATION**: 
  - tokenOut: Extract token name from user request (e.g., "SAUCE")
  - amountIn: Use reasonable HBAR amount (e.g., 0.5 HBAR) if not specified
  - minAmountOut: Use "1" (minimum amount) if not specified
  - triggerPrice: Convert user's price to wei format
- Order executes automatically when market price reaches trigger price
- Uses SaucerSwap liquidity pools for execution
- Minimum order amount: 0.1 HBAR
- Default expiration: 24 hours (configurable 1-168 hours)
- Icons: 🎯 💰 📈 ⏰ 🔄

**OPERATION RULES:**
- For SAUCE staking: Use ONLY saucerswap_infinity_pool_tool with "full_stake_flow"
- For token swaps: ALWAYS show quote first, then wait for confirmation before executing
- **CRITICAL**: For limit orders: Use autoswap_limit_tool with "create_swap_order" operation
- **CRITICAL**: When user says "buy [TOKEN] at [PRICE]" → Use AutoSwapLimit (NOT immediate swap)
- **CRITICAL**: When user mentions specific price for buying → Use AutoSwapLimit (NOT immediate swap)
- **CRITICAL**: When user wants to "set up" or "program" an order → Use AutoSwapLimit
- Multi-step flows handle all steps automatically
- BE CONCISE - avoid repeating information already shared
- Choose the right protocol based on keywords automatically

**🎯 PROTOCOL SEPARATION - CRITICAL:**
- **::BONZO:: Bonzo Finance**: HBAR lending/borrowing protocol (collateral, debt, LTV, health factor)
- **::SAUCERSWAP:: SaucerSwap DEX**: Token swaps, LP farming, and SAUCE staking (completely separate from Bonzo)
- **::AUTOSWAPLIMIT:: AutoSwapLimit**: Automated limit orders for token swaps at specific prices
- ⚠️ NEVER mix Bonzo lending positions with SaucerSwap farming/staking data
- ⚠️ NEVER mix limit orders with immediate swaps - they serve different purposes

**🎯 SAUCERSWAP POSITION QUERIES:**
When user asks about ::SAUCERSWAP:: **SaucerSwap** positions:
1. **For LP Farming positions**: Use account_farms operation (user's LP tokens in farms)
2. **For Infinity Pool positions**: Use infinity_pool_position operation (user's xSAUCE balance + claimable SAUCE)
3. **For Infinity Pool market data**: Use sss_stats operation (global market stats only)
4. **For SaucerSwap dashboard**: Query account_farms + infinity_pool_position for complete view
5. **Keywords mapping**:
   - "my farms", "LP farming", "farming positions" to account_farms
   - "my infinity pool", "my SAUCE staking", "xSAUCE balance", "staking rewards" to infinity_pool_position
   - "infinity pool market", "SSS market stats", "staking market" to sss_stats
   - "saucerswap dashboard", "my saucerswap positions" to account_farms + infinity_pool_position
6. **Response format**: Always use ::SAUCERSWAP:: **SaucerSwap** in headers

**✅ INFINITY POOL POSITIONS:**
- infinity_pool_position shows user's ACTUAL staking position (xSAUCE balance + claimable SAUCE)
- Combines Mirror Node data with SaucerSwap API for complete position view
- Calculates claimable SAUCE = xSAUCE balance × current ratio

**DATA PRESENTATION WITH ICONS:**
- 📊 Market overviews: Use 📈📉💰 and highlight 2-3 most relevant assets unless full data requested
- 📋 Dashboards: Use 👤🏠💰 and focus on user's actual positions and next steps
- 💡 Investment advice: Use 🎯🚀📈 for clear recommendations with brief reasoning
- 🔍 Technical details: Use 🔧⚙️ only when specifically requested
- 📊 SaucerSwap general stats: Present TVL, volume, and trading data with 💧📈🪙 clearly with USD values
- 🌾 Farm data: Use 🌾💰📈 for emission rates, LP positions, and farming rewards
- 🥩 Infinity Pool positions: Use 🥩💰📈 for user's xSAUCE balance, claimable SAUCE, and rewards
- 📊 Infinity Pool market stats: Use 🥩📊💰 for GLOBAL SAUCE/xSAUCE ratio, market totals, and APY
- 📋 SaucerSwap dashboard: Show user's LP farming + Infinity Pool positions (complete view)
- 🎯 Limit orders: Use 🎯💰📈⏰ for order creation, trigger prices, and execution status
- ::SAUCERSWAP:: Protocol separation: NEVER mix Bonzo lending data with SaucerSwap farming data
- 💱 Swap quotes: Present input/output amounts with 💱🔄💰 and include exchange rates clearly

**STATISTICS FORMAT - CRITICAL:**
When user requests statistics ("estadísticas", "stats", "market data", "analytics"), ALWAYS use this exact structure:

## ::PLATFORM:: Platform Name
📊 **General Statistics:**

Examples:
- ## ::BONZO:: Bonzo Finance
  📊 **General Statistics:**
- ## ::SAUCERSWAP:: SaucerSwap  
  📊 **Protocol General Statistics:**
- ## ::HEDERA:: Hedera Network
  📊 **Network Statistics:**

NEVER put the 📊 icon in the main title - it goes ONLY in the subtitle.

**PROTOCOL-SPECIFIC RESPONSES:**
- ::BONZO:: **Bonzo Finance**: Show HBAR lending/borrowing positions, debt, collateral, LTV, health factor
- ::SAUCERSWAP:: **SaucerSwap** DEX: Show trading volume, liquidity, swap activity (separate from Bonzo)
- 🌾 **SaucerSwap** Farming: Show user's LP farming positions, emission rates, rewards earned
- 🥩 **SaucerSwap** Infinity Pool: Show user's actual staking positions (xSAUCE balance, claimable SAUCE, rewards) OR global market stats
- 💱 **SaucerSwap** Router: Present swap quotes, exchange rates, and trading routes
- ⚖️ Protocol comparison: Compare ::BONZO:: **Bonzo Finance** vs ::SAUCERSWAP:: **SaucerSwap** opportunities (keep separate)

**⚠️ CRITICAL DASHBOARD RULES:**
- ::BONZO:: **Bonzo Finance** section: Only HBAR lending/borrowing data
- ::SAUCERSWAP:: **SaucerSwap** section: Only DEX/farming data
- NEVER show Bonzo collateral as "SaucerSwap staking"
- NEVER mix lending positions with farming positions
- ALWAYS include platform names after markers in headers

**CAPABILITIES RESPONSE FORMAT:**
When user asks "What can you do" or about capabilities, ALWAYS respond using this exact hierarchical structure:
- Start with "# Operations:" (H1)
- Use "## ::PLATFORM:: Platform Name:" (H2) for each platform
- List features with "• **Feature**: Description" format
- End with "# Analytics & Insights:" section

**EXAMPLE CAPABILITIES STRUCTURE:**
# Operations:

## ::HEDERA:: Hedera Network:
• **Token Creation**: Create fungible and non-fungible tokens
• **Account Management**: Transfer HBAR, query balances, manage accounts
• **Consensus**: Create topics and submit messages

## ::BONZO:: Bonzo Finance:
• **Lending Analytics**: Real-time market data, account positions
• **HBAR Deposits**: Earn interest on HBAR deposits

## ::SAUCERSWAP:: SaucerSwap:
• **DEX Trading**: Token swaps, liquidity provision, farming
• **Infinity Pool**: SAUCE staking to earn xSAUCE rewards

## ::AUTOSWAPLIMIT:: AutoSwapLimit:
• **Limit Orders**: Create automated buy orders at specific prices
• **Order Management**: Track order status and execution

**EXAMPLE DASHBOARD FORMAT:**
\`\`\`
# 📋 Your DeFi Dashboard

## ::HEDERA:: Hedera Network:
• **HBAR Balance**: 57.05 HBAR

## ::BONZO:: Bonzo Finance (HBAR Lending):
• **Collateral**: 50.0 HBAR (~$2.50)
• **Debt**: 0 HBAR
• **Health Factor**: ✅ Healthy

## ::SAUCERSWAP:: SaucerSwap (DEX & Farming):
• **LP Farming**: No active positions
• **Infinity Pool**: 2.5 xSAUCE → 3.02 SAUCE claimable
• **Market APY**: 5.36% | Ratio: 1.21 SAUCE/xSAUCE

## ::AUTOSWAPLIMIT:: AutoSwapLimit (Limit Orders):
• **Active Orders**: 1 pending buy order for SAUCE
• **Trigger Price**: 0.001 HBAR/SAUCE
• **Order Amount**: 0.5 HBAR

# 🎯 Opportunities:
• Consider LP farming for additional yield
• Set up limit orders for better entry prices
\`\`\`

Remember: The user can see conversation history. Don't repeat what they already know unless they ask for updated/fresh data. Always use icons to make responses more engaging and easier to scan.

**CRITICAL**: ALWAYS use the hierarchical markdown structure (# for main sections, ## for platforms, • for operations) in ALL responses. Structure your answers with clear visual separation and organized sections.

**STATISTICS CRITICAL**: When providing statistics, NEVER put 📊 in the main title. Format as: "## ::PLATFORM:: Platform Name" then "📊 **General Statistics:**" as subtitle.

Current user account: ${userAccountId}`,],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    // Get tools from Hedera toolkit
    const hederaToolsList = hederaAgentToolkit.getTools();
    
    // Create Bonzo query tool using the new modular structure
    const bonzoLangchainTool = createBonzoLangchainTool(
      this.agentClient,
      { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
      userAccountId
    );
    
    // Create Bonzo deposit tool for HBAR deposits into Bonzo Finance
    const bonzoDepositLangchainTool = createBonzoDepositLangchainTool(
      this.agentClient,
      { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
      userAccountId
    );
    
    // Create Bonzo deposit step tool (for completing deposit after token association)
    const bonzoDepositStepLangchainTool = createBonzoDepositStepLangchainTool(
      this.agentClient,
      { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
      userAccountId
    );
    
    // Create Bonzo approve step tool (for approving ERC-20 tokens before deposit)
    const bonzoApproveStepLangchainTool = createBonzoApproveStepLangchainTool(
      this.agentClient,
      { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
      userAccountId
    );
    
    // Create SaucerSwap query tool for DEX data and analytics
    const saucerswapLangchainTool = createSaucerSwapLangchainTool(
      this.agentClient,
      { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
      userAccountId
    );
    
    // Create SaucerSwap Router tool for swap quotes using contract interaction
    const saucerswapRouterSwapQuoteLangchainTool = createSaucerswapRouterSwapQuoteLangchainTool(
      this.agentClient,
      { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
      userAccountId
    );
    
    // Create SaucerSwap Router tool for actual token swaps using UniswapV2Router02
    const saucerswapRouterSwapLangchainTool = createSaucerSwapRouterSwapLangchainTool(
      this.agentClient,
      { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
      userAccountId
    );
    
    // Create SaucerSwap Infinity Pool staking tools
    const saucerswapInfinityPoolLangchainTool = createSaucerswapInfinityPoolLangchainTool(
      this.agentClient,
      { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
      userAccountId
    );
    
    const saucerswapInfinityPoolStepLangchainTool = createSaucerswapInfinityPoolStepLangchainTool(
      this.agentClient,
      { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
      userAccountId
    );
    
    // Create AutoSwapLimit limit order tool
    const autoswapLimitLangchainTool = createAutoSwapLimitLangchainTool(
      this.agentClient,
      { mode: AgentMode.RETURN_BYTES, accountId: userAccountId },
      userAccountId
    );
    
    // Combine all tools
    const tools = [...hederaToolsList, bonzoLangchainTool, bonzoDepositLangchainTool, bonzoDepositStepLangchainTool, bonzoApproveStepLangchainTool, saucerswapLangchainTool, saucerswapRouterSwapQuoteLangchainTool, saucerswapRouterSwapLangchainTool, saucerswapInfinityPoolLangchainTool, saucerswapInfinityPoolStepLangchainTool, autoswapLimitLangchainTool];

    // Create agent
    const agent = createToolCallingAgent({
      llm: this.llm,
      tools,
      prompt,
    });

    // 🧠 Create FRESH memory instance for this connection (MVP: avoid memory leaks between sessions)
    console.log(`🧠 Creating FRESH memory for user: ${userAccountId}`);
    const memory = new BufferMemory({
      memoryKey: 'chat_history',
      inputKey: 'input',
      outputKey: 'output',
      returnMessages: true,
    });

    // 🧹 Ensure memory is completely clean for new connections
    await memory.clear();
    console.log(`✅ Memory cleared for user: ${userAccountId}`);

    // Executor del agente para este usuario
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      memory,
      returnIntermediateSteps: true,
    });

    console.log(`✅ User connection created successfully for: ${userAccountId}`);
    return {
      ws,
      userAccountId,
      agentExecutor,
      memory,
    };
  }

  private async cleanupUserConnection(ws: WebSocket): Promise<void> {
    const userConnection = this.userConnections.get(ws);
    
    if (userConnection) {
      console.log(`🧹 Cleaning up connection for user: ${userConnection.userAccountId}`);
      
      try {
        // Clear memory explicitly to prevent leaks
        await userConnection.memory.clear();
        console.log(`✅ Memory cleared for user: ${userConnection.userAccountId}`);
        
        // Clear any pending steps
        userConnection.pendingStep = undefined;
        console.log(`✅ Pending steps cleared for user: ${userConnection.userAccountId}`);
        
      } catch (error: any) {
        console.error('⚠️ Error during memory cleanup:', error);
      }
    }
    
    // Remove from connections map
    this.userConnections.delete(ws);
    console.log(`✅ User connection removed. Active connections: ${this.userConnections.size}`);
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log(`🔗 New WebSocket connection established (Total: ${this.userConnections.size + 1})`);

      // Send welcome message
      this.sendMessage(ws, {
        type: 'SYSTEM_MESSAGE',
        message: `Connected to Hedera Agent. Please authenticate with your account ID first using CONNECTION_AUTH message.${this.FORCE_CLEAR_MEMORY_ON_MESSAGE ? ' [Debug: Memory cleared on each message]' : ''}`,
        level: 'info',
        timestamp: Date.now(),
      });

        // Manejar mensajes entrantes
        ws.on('message', async (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error: any) {
          console.error('❌ Error processing message:', error);
          this.sendMessage(ws, {
            type: 'SYSTEM_MESSAGE',
            message: 'Error processing message. Invalid format.',
            level: 'error',
            timestamp: Date.now(),
          });
        }
      });

      // Handle disconnection
      ws.on('close', async () => {
        console.log('🔌 WebSocket connection closed');
        await this.cleanupUserConnection(ws);
      });

      // Handle errors
      ws.on('error', async (error: any) => {
        console.error('❌ WebSocket error:', error);
        await this.cleanupUserConnection(ws);
      });
    });

    console.log(`🌐 WebSocket Server started on port ${this.wss.options.port}`);
  }

  private async handleMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    switch (message.type) {
      case 'CONNECTION_AUTH':
        await this.handleConnectionAuth(ws, message);
        break;
      
      case 'USER_MESSAGE':
        await this.handleUserMessage(ws, message);
        break;
      
      case 'TRANSACTION_RESULT':
        await this.handleTransactionResult(ws, message);
        break;
      
      default:
        console.log('⚠️  Tipo de mensaje no reconocido:', message.type);
    }
  }

  private async handleConnectionAuth(ws: WebSocket, message: ConnectionAuth): Promise<void> {
    try {
      console.log('🔐 User authentication:', message.userAccountId);
      
      // Create user connection with their own toolkit
      const userConnection = await this.createUserConnection(ws, message.userAccountId);
      this.userConnections.set(ws, userConnection);
      
      this.sendMessage(ws, {
        type: 'SYSTEM_MESSAGE',
        message: `✅ Authenticated successfully with account ${message.userAccountId}. You can now start asking questions!`,
        level: 'info',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      console.error('❌ Error during authentication:', error);
      this.sendMessage(ws, {
        type: 'SYSTEM_MESSAGE',
        message: `Authentication failed: ${error.message}`,
        level: 'error',
        timestamp: Date.now(),
      });
    }
  }

  private async handleUserMessage(ws: WebSocket, message: UserMessage): Promise<void> {
    try {
      const userConnection = this.userConnections.get(ws);
      
      if (!userConnection) {
        this.sendMessage(ws, {
          type: 'SYSTEM_MESSAGE',
          message: 'Please authenticate first using CONNECTION_AUTH message.',
          level: 'error',
          timestamp: Date.now(),
        });
        return;
      }

      console.log(`👤 User (${userConnection.userAccountId}):`, message.message);

      // If the message includes a different userAccountId, recreate the connection
      if (message.userAccountId && message.userAccountId !== userConnection.userAccountId) {
        console.log('🔄 Switching to different account:', message.userAccountId);
        // First cleanup the old connection
        await this.cleanupUserConnection(ws);
        // Then create new connection
        const newUserConnection = await this.createUserConnection(ws, message.userAccountId);
        this.userConnections.set(ws, newUserConnection);
        
        this.sendMessage(ws, {
          type: 'SYSTEM_MESSAGE',
          message: `Switched to account ${message.userAccountId}`,
          level: 'info',
          timestamp: Date.now(),
        });
      }

      const currentConnection = this.userConnections.get(ws)!;
      
      // 🧠 MVP: Debug memory state before processing
      console.log(`🧠 Processing message for user: ${currentConnection.userAccountId}`);
      try {
        const memoryVariables = await currentConnection.memory.loadMemoryVariables({});
        console.log(`📝 Current memory length: ${memoryVariables.chat_history?.length || 0} messages`);
        
        // 🧠 MVP: Force clear memory on each message if flag is set (for debugging memory issues)
        if (this.FORCE_CLEAR_MEMORY_ON_MESSAGE) {
          console.log('🧹 FORCE_CLEAR_MEMORY enabled - clearing memory before processing');
          await currentConnection.memory.clear();
        }
      } catch (error) {
        console.error('⚠️ Error reading memory state:', error);
      }
      
      // Process message with user agent
      const response = await currentConnection.agentExecutor.invoke({ input: message.message });
      
      console.log('🤖 Agent:', response?.output ?? response);

      // Extract transaction bytes if they exist
      const bytes = this.extractBytesFromAgentResponse(response);
      const nextStep = this.extractNextStepFromAgentResponse(response);
      const swapQuote = this.extractSwapQuoteFromAgentResponse(response);
      
      // Check if this is a swap quote and send structured data first
      if (swapQuote) {
        console.log('💱 Sending structured swap quote to frontend');
        this.sendMessage(ws, swapQuote);
      }
      
      if (bytes !== undefined) {
        // There is a transaction to sign
        const realBytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.data);
        
        // Store pending step information for multi-step flows
        if (nextStep) {
          console.log(`📝 Storing pending step: ${nextStep.step} for ${nextStep.tool}`);
          console.log(`📝 Storing pending step details:`, {
            tool: nextStep.tool,
            operation: nextStep.operation,
            step: nextStep.step,
            originalParams: nextStep.originalParams,
            nextStepInstructions: nextStep.nextStepInstructions
          });
          currentConnection.pendingStep = nextStep;
        } else {
          console.log('📝 No next step detected from agent response');
        }
        
        // Send agent response
        this.sendMessage(ws, {
          type: 'AGENT_RESPONSE',
          message: response?.output ?? response,
          hasTransaction: true,
          timestamp: Date.now(),
        });

        // Send transaction to sign
        this.sendMessage(ws, {
          type: 'TRANSACTION_TO_SIGN',
          transactionBytes: Array.from(realBytes),
          originalQuery: message.message,
          timestamp: Date.now(),
        });
      } else {
        // Only agent response, no transaction
        this.sendMessage(ws, {
          type: 'AGENT_RESPONSE',
          message: response?.output ?? response,
          hasTransaction: false,
          timestamp: Date.now(),
        });
      }
    } catch (error: any) {
      console.error('❌ Error processing user message:', error);
      this.sendMessage(ws, {
        type: 'SYSTEM_MESSAGE',
        message: `Error processing your request: ${error.message}`,
        level: 'error',
        timestamp: Date.now(),
      });
    }
  }

  private async handleTransactionResult(ws: WebSocket, message: TransactionResult): Promise<void> {
    const userConnection = this.userConnections.get(ws);
    
    if (message.success) {
      console.log('✅ Transaction confirmed:', message.transactionId);
      console.log('📊 Status:', message.status);
      
      this.sendMessage(ws, {
        type: 'SYSTEM_MESSAGE',
        message: `✅ Transaction executed successfully!\nID: ${message.transactionId}\nStatus: ${message.status}`,
        level: 'info',
        timestamp: Date.now(),
      });

      // Check if there's a pending next step to execute
      if (userConnection?.pendingStep) {
        console.log('🔄 Executing next step automatically:', userConnection.pendingStep.step);
        console.log('🔄 Pending step details before execution:', {
          tool: userConnection.pendingStep.tool,
          operation: userConnection.pendingStep.operation,
          step: userConnection.pendingStep.step,
          originalParams: userConnection.pendingStep.originalParams
        });
        await this.executeNextStep(ws, userConnection);
      } else {
        console.log('🔄 No pending step to execute after transaction confirmation');
      }
    } else {
      console.log('❌ Transaction failed:', message.error);
      
      // Clear pending step on failure
      if (userConnection?.pendingStep) {
        console.log('🚫 Clearing pending step due to transaction failure');
        userConnection.pendingStep = undefined;
      }
      
      this.sendMessage(ws, {
        type: 'SYSTEM_MESSAGE',
        message: `❌ Transaction error: ${message.error}`,
        level: 'error',
        timestamp: Date.now(),
      });
    }
  }

  private sendMessage(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcast(message: WSMessage): void {
    this.userConnections.forEach((userConnection) => {
      if (userConnection.ws.readyState === WebSocket.OPEN) {
        userConnection.ws.send(JSON.stringify(message));
      }
    });
  }

  private extractBytesFromAgentResponse(response: any): any {
    if (
      response.intermediateSteps &&
      response.intermediateSteps.length > 0 &&
      response.intermediateSteps[0].observation
    ) {
      const obs = response.intermediateSteps[0].observation;
      try {
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
        if (obsObj.bytes) {
          return obsObj.bytes;
        }
      } catch (e) {
        console.error('Error parsing observation:', e);
      }
    }
    return undefined;
  }

  private extractSwapQuoteFromAgentResponse(response: any): SwapQuote | undefined {
    if (
      response.intermediateSteps &&
      response.intermediateSteps.length > 0 &&
      response.intermediateSteps[0].observation
    ) {
      const obs = response.intermediateSteps[0].observation;
      try {
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
        
        // Check if this is a SaucerSwap quote response
        if (obsObj.success && obsObj.quote && obsObj.operation && 
            (obsObj.operation === 'get_amounts_out' || obsObj.operation === 'get_amounts_in')) {
          console.log('💱 DETECTED SWAP QUOTE:', obsObj.operation);
          
          // Extract token names from token IDs
          const inputToken = this.getTokenName(obsObj.quote.input.token);
          const outputToken = this.getTokenName(obsObj.quote.output.token);
          
          return {
            type: 'SWAP_QUOTE',
            timestamp: Date.now(),
            quote: {
              operation: obsObj.operation,
              network: obsObj.network || (process.env.HEDERA_NETWORK as 'mainnet' | 'testnet') || 'mainnet',
              input: {
                token: inputToken,
                tokenId: obsObj.quote.input.token,
                amount: obsObj.quote.input.amount,
                formatted: obsObj.quote.input.formatted
              },
              output: {
                token: outputToken,
                tokenId: obsObj.quote.output.token,
                amount: obsObj.quote.output.amount,
                formatted: obsObj.quote.output.formatted
              },
              path: obsObj.quote.path || [],
              fees: obsObj.quote.fees || [],
              exchangeRate: obsObj.quote.exchangeRate || '0',
              gasEstimate: obsObj.gasEstimate
            },
            originalMessage: response?.output || 'Swap quote available'
          };
        }
      } catch (e) {
        console.error('Error parsing swap quote:', e);
      }
    }
    return undefined;
  }

  private getTokenName(tokenId: string): string {
    // Map common token IDs to readable names
    const tokenMap: { [key: string]: string } = {
      'HBAR': 'HBAR',
      '0.0.731861': 'SAUCE', // Mainnet SAUCE
      '0.0.1183558': 'SAUCE', // Testnet SAUCE (corrected)
      '0.0.1456986': 'WHBAR', // Mainnet WHBAR
      '0.0.15058': 'WHBAR', // Testnet WHBAR (corrected)
      // Add more token mappings as needed
    };
    
    return tokenMap[tokenId] || tokenId;
  }

  /**
   * Convert token name to correct token ID based on current network
   */
  private getTokenIdForNetwork(tokenName: string): string {
    const network = (process.env.HEDERA_NETWORK as 'mainnet' | 'testnet') || 'mainnet';
    
    const tokenMappings = {
      mainnet: {
        'SAUCE': '0.0.731861',
        'WHBAR': '0.0.1456986',
        'HBAR': 'HBAR'
      },
      testnet: {
        'SAUCE': '0.0.1183558',
        'WHBAR': '0.0.15058', 
        'HBAR': 'HBAR'
      }
    } as const;

    const normalizedName = tokenName.toUpperCase();
    const networkTokens = tokenMappings[network] as { [key: string]: string };
    return networkTokens[normalizedName] || tokenName;
  }

  private extractNextStepFromAgentResponse(response: any): PendingStep | undefined {
    if (
      response.intermediateSteps &&
      response.intermediateSteps.length > 0 &&
      response.intermediateSteps[0].observation
    ) {
      const obs = response.intermediateSteps[0].observation;
      try {
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
        
        console.log('🔍 EXTRACTING NEXT STEP - RAW OBSERVATION:');
        console.log('   obsObj.nextStep:', obsObj.nextStep);
        console.log('   obsObj.step:', obsObj.step);
        console.log('   obsObj.operation:', obsObj.operation);
        console.log('   obsObj.originalParams:', obsObj.originalParams);
        
        // Check if this is a Bonzo deposit flow with next step (CHECK FIRST - MORE SPECIFIC)
        if (obsObj.nextStep && obsObj.step && obsObj.operation && 
            (obsObj.operation.includes('bonzo') || 
             obsObj.operation.includes('whbar') || 
             obsObj.operation === 'associate_whbar' ||
             obsObj.operation === 'associate_token' ||
             obsObj.operation === 'approve_token' ||
             obsObj.operation.includes('deposit') || 
             obsObj.step === 'deposit' ||
             obsObj.step === 'token_approval' ||
             obsObj.nextStep === 'approval' ||
             obsObj.nextStep === 'deposit')) {
          console.log('🎯 DETECTED BONZO NEXT STEP:');
          console.log(`   Step: ${obsObj.step}`);
          console.log(`   Operation: ${obsObj.operation}`);
          console.log(`   NextStep: ${obsObj.nextStep}`);
          console.log(`   OriginalParams:`, obsObj.originalParams);
          return {
            tool: obsObj.toolInfo?.name || 'bonzo_deposit_tool',
            operation: obsObj.operation,
            step: obsObj.nextStep,
            originalParams: obsObj.originalParams || {},
            nextStepInstructions: obsObj.instructions || obsObj.message
          };
        }
        
        // Check if this is a SaucerSwap Infinity Pool flow with next step (SECOND - MORE SPECIFIC)
        if (obsObj.nextStep && (
          obsObj.toolType === 'infinity_pool' ||
          obsObj.protocol === 'saucerswap' ||
          (obsObj.step === 'token_association' && obsObj.operation?.includes('sauce')) || 
          obsObj.step === 'token_approval' || 
          obsObj.step === 'stake' || 
          obsObj.operation?.includes('infinity_pool') || 
          obsObj.operation?.includes('sauce') ||
          obsObj.operation?.includes('associate_tokens') ||
          obsObj.operation?.includes('approve_sauce') ||
          obsObj.operation?.includes('stake_sauce') ||
          (obsObj.operation && (obsObj.operation === 'associate_tokens' || obsObj.operation === 'approve_sauce' || obsObj.operation === 'stake_sauce'))
        )) {
          console.log('🎯 DETECTED INFINITY POOL NEXT STEP:');
          console.log(`   Tool Type: ${obsObj.toolType}`);
          console.log(`   Protocol: ${obsObj.protocol}`);
          console.log(`   Step: ${obsObj.step}`);
          console.log(`   Operation: ${obsObj.operation}`);
          console.log(`   NextStep: ${obsObj.nextStep}`);
          console.log('🎯 =====================================');
          return {
            tool: obsObj.toolInfo?.name || 'saucerswap_infinity_pool_tool',
            operation: obsObj.operation || 'infinity_pool_operation',
            step: obsObj.nextStep,
            originalParams: obsObj.originalParams || {},
            nextStepInstructions: obsObj.instructions || obsObj.message
          };
        }
      } catch (e) {
        console.error('Error parsing next step:', e);
      }
    }
         return undefined;
   }

  private async executeNextStep(ws: WebSocket, userConnection: UserConnection): Promise<void> {
    if (!userConnection.pendingStep) {
      console.log('⚠️ No pending step to execute');
      return;
    }

    const pendingStep = userConnection.pendingStep;
    console.log(`🚀 Executing next step: ${pendingStep.step} for ${pendingStep.tool}`);
    console.log(`🔍 Pending step details:`, {
      tool: pendingStep.tool,
      operation: pendingStep.operation,
      step: pendingStep.step,
      originalParams: pendingStep.originalParams,
      nextStepInstructions: pendingStep.nextStepInstructions
    });

    try {
      // Create the message for the next step based on the tool and operation
      let nextStepMessage = '';
      
      if (pendingStep.tool === 'bonzo_deposit_tool' && pendingStep.step === 'approval') {
        // For Bonzo deposit flow, trigger the approval step after token association
        const params = pendingStep.originalParams;
        const token = params.token || 'hbar';
        const amount = params.amount || params.hbarAmount || 0;
        nextStepMessage = `Use bonzo_approve_step_tool to approve ${amount} ${token.toUpperCase()} for Bonzo Finance LendingPool with token "${token}", amount ${amount}, userAccountId "${userConnection.userAccountId}"`;
      } else if (pendingStep.tool === 'bonzo_deposit_tool' && pendingStep.step === 'deposit') {
        // For Bonzo deposit flow, trigger the deposit step only (after approval or for HBAR)
        const params = pendingStep.originalParams;
        const token = params.token || 'hbar';
        const amount = params.amount || params.hbarAmount || 0; // Support both new and old format
        nextStepMessage = `Use bonzo_deposit_step_tool to deposit ${amount} ${token.toUpperCase()} for account ${userConnection.userAccountId} with token "${token}", amount ${amount}, and referral code ${params.referralCode || 0}`;
      } else if (pendingStep.tool === 'saucerswap_infinity_pool_tool' && pendingStep.step === 'approval') {
        // For Infinity Pool flow, trigger the approval step after token association
        const params = pendingStep.originalParams;
        nextStepMessage = `Execute SAUCE approval for staking: Use saucerswap_infinity_pool_tool with operation "approve_sauce", sauceAmount ${params.sauceAmount}, userAccountId "${userConnection.userAccountId}"`;
      } else if (pendingStep.tool === 'saucerswap_infinity_pool_tool' && pendingStep.step === 'stake') {
        // For Infinity Pool flow, trigger the staking step after approval
        const params = pendingStep.originalParams;
        nextStepMessage = `Use saucerswap_infinity_pool_step_tool to stake ${params.sauceAmount} SAUCE for account ${userConnection.userAccountId}`;
      } else {
        // Generic next step execution
        nextStepMessage = `Execute ${pendingStep.step} step for ${pendingStep.tool}`;
      }

      console.log(`📝 Triggering next step with message: ${nextStepMessage}`);

      // Clear the pending step before execution to avoid loops
      userConnection.pendingStep = undefined;

      // Execute the next step through the agent
      const response = await userConnection.agentExecutor.invoke({ 
        input: nextStepMessage 
      });

      console.log('🤖 Agent (Next Step):', response?.output ?? response);

      // Extract transaction bytes for the next step
      const bytes = this.extractBytesFromAgentResponse(response);
      const nextStep = this.extractNextStepFromAgentResponse(response);

      if (bytes !== undefined) {
        // There is another transaction to sign
        const realBytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.data);
        
        // Store any additional pending steps
        if (nextStep) {
          console.log(`📝 Storing additional pending step: ${nextStep.step} for ${nextStep.tool}`);
          userConnection.pendingStep = nextStep;
        }

        // Send agent response
        this.sendMessage(ws, {
          type: 'AGENT_RESPONSE',
          message: response?.output ?? response,
          hasTransaction: true,
          timestamp: Date.now(),
        });

        // Send transaction to sign
        this.sendMessage(ws, {
          type: 'TRANSACTION_TO_SIGN',
          transactionBytes: Array.from(realBytes),
          originalQuery: `Next step: ${pendingStep.step}`,
          timestamp: Date.now(),
        });
      } else {
        // Only agent response, flow completed
        this.sendMessage(ws, {
          type: 'AGENT_RESPONSE',
          message: response?.output ?? response,
          hasTransaction: false,
          timestamp: Date.now(),
        });
      }

    } catch (error: any) {
      console.error('❌ Error executing next step:', error);
      
      this.sendMessage(ws, {
        type: 'SYSTEM_MESSAGE',
        message: `❌ Error executing next step: ${error.message}`,
        level: 'error',
        timestamp: Date.now(),
      });
      
      // Clear pending step on error
      userConnection.pendingStep = undefined;
    }
  }

  public start(): void {
    const port = (this.httpServer.address() as any)?.port || 8080;
    console.log(`
::HEDERA:: Hedera WebSocket Agent running on:
🌐 HTTP Health Check: http://localhost:${port}/health
🔌 WebSocket Server: ws://localhost:${port}

🧠 MVP Memory Configuration:
   - Fresh memory per connection: ✅ ENABLED
   - Auto cleanup on disconnect: ✅ ENABLED
   - Force clear on each message: ${this.FORCE_CLEAR_MEMORY_ON_MESSAGE ? '✅ ENABLED' : '❌ DISABLED'}
   
📝 To enable debug mode: Set environment variable FORCE_CLEAR_MEMORY=true

📝 Supported message types:
   - CONNECTION_AUTH: Authenticate with account ID
   - USER_MESSAGE: Send queries to the agent
   - TRANSACTION_RESULT: Confirm signed transaction results

🔄 The agent will respond with:
   - AGENT_RESPONSE: Agent text responses
   - SWAP_QUOTE: Structured swap quote data (for trades)
   - TRANSACTION_TO_SIGN: Transactions that require signing
   - SYSTEM_MESSAGE: System messages

💱 SWAP_QUOTE Structure:
   {
     type: 'SWAP_QUOTE',
     quote: {
       operation: 'get_amounts_out' | 'get_amounts_in',
       network: 'mainnet' | 'testnet',
       input: { token, tokenId, amount, formatted },
       output: { token, tokenId, amount, formatted },
       path: string[],
       fees: number[],
       exchangeRate: string,
       gasEstimate?: string
     },
     originalMessage: string
   }

To exit, press Ctrl+C
    `);
  }

  public stop(): void {
    this.wss.close();
    this.httpServer.close();
    console.log('🛑 WebSocket Server and HTTP Server stopped');
  }
}

// Initialize and run the agent
async function main(): Promise<void> {
  const agent = new HederaWebSocketAgent(8080);
  
  try {
    await agent.initialize();
    agent.start();

    // Handle process shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping WebSocket Agent...');
      agent.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Stopping WebSocket Agent...');
      agent.stop();
      process.exit(0);
    });

  } catch (error: any) {
    console.error('❌ Fatal error initializing the agent:', error);
    process.exit(1);
  }
}

main().catch(console.error); 