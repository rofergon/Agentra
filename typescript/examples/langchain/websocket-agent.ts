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
// Import Bonzo tools from the new modular structure (API-based)
import { createBonzoLangchainTool } from '../../src/shared/tools/defi/bonzo/langchain-tools';
import { createBonzoDepositLangchainTool, createBonzoDepositStepLangchainTool } from '../../src/shared/tools/defi/bonzoTransaction/langchain-tools';
// Import SaucerSwap tools from the new modular structure (API-based)
import { createSaucerSwapLangchainTool } from '../../src/shared/tools/defi/saucerswap-api/langchain-tools';
// Import SaucerSwap Router tools (contract-based swap quotes)
import { createSaucerswapRouterSwapQuoteLangchainTool } from '../../src/shared/tools/defi/SaucerSwap-Quote/langchain-tools';
// Import SaucerSwap Router swap execution tools
import { createSaucerSwapRouterSwapLangchainTool } from '../../src/shared/tools/defi/Saucer-Swap/langchain-tools';
// Import SaucerSwap Infinity Pool staking tools
import { createSaucerswapInfinityPoolLangchainTool, createSaucerswapInfinityPoolStepLangchainTool } from '../../src/shared/tools/defi/SaucerSwap-InfinityPool/langchain-tools';

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
  private llm!: ChatOpenAI;
  private agentClient!: Client;
  private userConnections: Map<WebSocket, UserConnection> = new Map();

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    this.setupWebSocketServer();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Hedera WebSocket Agent...');

    // Configuración OpenAI
    this.llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
    });

    // Hedera client for testnet (without operator, will be configured by user)
    this.agentClient = Client.forTestnet();

    console.log('✅ Hedera WebSocket Agent initialized successfully');
  }

  private async createUserConnection(ws: WebSocket, userAccountId: string): Promise<UserConnection> {
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
- BE CONCISE and contextual in all responses
- ALWAYS use relevant icons to enhance readability
- Use markdown formatting with icons for headers and key points
- AVOID repeating detailed information already shared in this conversation
- When referencing previous data, use phrases like "📊 Based on the market data from earlier..." or "📈 As shown in the previous market overview..."
- For investment advice: Give clear recommendations WITHOUT repeating all market details
- For follow-up questions: Focus only on NEW information or specific analysis requested
- Only show complete detailed data when explicitly asked for fresh/updated information

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
- Keywords: "lending", "borrowing", "deposit", "interest", "APY", "positions", "dashboard"
- Operations: market_info, account_dashboard, pool_stats, protocol_info
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

**::SAUCERSWAP:: SaucerSwap Router (Token Swaps):**
- Use for: executing real token swaps ONLY after quote confirmation
- Keywords for EXECUTION: "execute swap", "confirm swap", "proceed with swap", "yes proceed", "confirm trade"
- Operations: swap_exact_hbar_for_tokens, swap_exact_tokens_for_hbar, swap_exact_tokens_for_tokens
- Real transaction creation using UniswapV2Router02 contract
- Built-in slippage protection and deadline management
- Supports SAUCE token (0.0.731861 mainnet / 0.0.456858 testnet)
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

**OPERATION RULES:**
- For SAUCE staking: Use ONLY saucerswap_infinity_pool_tool with "full_stake_flow"
- For token swaps: ALWAYS show quote first, then wait for confirmation before executing
- Multi-step flows handle all steps automatically
- BE CONCISE - avoid repeating information already shared
- Choose the right protocol based on keywords automatically

**🎯 PROTOCOL SEPARATION - CRITICAL:**
- **::BONZO:: Bonzo Finance**: HBAR lending/borrowing protocol (collateral, debt, LTV, health factor)
- **::SAUCERSWAP:: SaucerSwap DEX**: Token swaps, LP farming, and SAUCE staking (completely separate from Bonzo)
- ⚠️ NEVER mix Bonzo lending positions with SaucerSwap farming/staking data

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

# 🎯 Opportunities:
• Consider LP farming for additional yield
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
    
    // Combine all tools
    const tools = [...hederaToolsList, bonzoLangchainTool, bonzoDepositLangchainTool, bonzoDepositStepLangchainTool, saucerswapLangchainTool, saucerswapRouterSwapQuoteLangchainTool, saucerswapRouterSwapLangchainTool, saucerswapInfinityPoolLangchainTool, saucerswapInfinityPoolStepLangchainTool];

    // Create agent
    const agent = createToolCallingAgent({
      llm: this.llm,
      tools,
      prompt,
    });

    // User conversation memory
    const memory = new BufferMemory({
      memoryKey: 'chat_history',
      inputKey: 'input',
      outputKey: 'output',
      returnMessages: true,
    });

    // Executor del agente para este usuario
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      memory,
      returnIntermediateSteps: true,
    });

    return {
      ws,
      userAccountId,
      agentExecutor,
      memory,
    };
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔗 New WebSocket connection established');

      // Send welcome message
      this.sendMessage(ws, {
        type: 'SYSTEM_MESSAGE',
        message: 'Connected to Hedera Agent. Please authenticate with your account ID first using CONNECTION_AUTH message.',
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
      ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        this.userConnections.delete(ws);
      });

      // Handle errors
      ws.on('error', (error: any) => {
        console.error('❌ WebSocket error:', error);
        this.userConnections.delete(ws);
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
          currentConnection.pendingStep = nextStep;
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
        await this.executeNextStep(ws, userConnection);
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
              network: obsObj.network || 'mainnet',
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
      '0.0.456858': 'SAUCE', // Testnet SAUCE
      '0.0.1456986': 'WHBAR', // Mainnet WHBAR
      '0.0.15057': 'WHBAR', // Testnet WHBAR
      // Add more token mappings as needed
    };
    
    return tokenMap[tokenId] || tokenId;
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
        
        // Check if this is a SaucerSwap Infinity Pool flow with next step (CHECK FIRST!)
        if (obsObj.nextStep && (
          obsObj.toolType === 'infinity_pool' ||
          obsObj.protocol === 'saucerswap' ||
          obsObj.step === 'token_association' || 
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
        
        // Check if this is a Bonzo deposit flow with next step (MORE SPECIFIC NOW)
        if (obsObj.nextStep && obsObj.step && obsObj.operation && 
            (obsObj.operation.includes('bonzo') || obsObj.operation.includes('deposit') || obsObj.step === 'deposit')) {
          console.log('🎯 DETECTED BONZO NEXT STEP:');
          console.log(`   Step: ${obsObj.step}`);
          console.log(`   Operation: ${obsObj.operation}`);
          console.log(`   NextStep: ${obsObj.nextStep}`);
          return {
            tool: obsObj.toolInfo?.name || 'bonzo_deposit_tool',
            operation: obsObj.operation,
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

    try {
      // Create the message for the next step based on the tool and operation
      let nextStepMessage = '';
      
      if (pendingStep.tool === 'bonzo_deposit_tool' && pendingStep.step === 'deposit') {
        // For Bonzo deposit flow, trigger the deposit step only
        const params = pendingStep.originalParams;
        nextStepMessage = `Use bonzo_deposit_step_tool to deposit ${params.hbarAmount} HBAR for account ${userConnection.userAccountId} with referral code ${params.referralCode || 0}`;
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
    console.log(`
::HEDERA:: Hedera WebSocket Agent running on ws://localhost:${this.wss.options.port}

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
    console.log('🛑 WebSocket Server stopped');
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