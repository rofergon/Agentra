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
import { createSaucerSwapLangchainTool } from '../../src/shared/tools/defi/saucerswap/langchain-tools';
// Import SaucerSwap Router tools (contract-based swap quotes)
import { createSaucerswapRouterSwapQuoteLangchainTool } from '../../src/shared/tools/defi/saucerswap-swap/langchain-tools';

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

type WSMessage = UserMessage | AgentResponse | TransactionToSign | TransactionResult | SystemMessage | ConnectionAuth;

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
      ['system', `You are a helpful Hedera blockchain assistant with comprehensive DeFi capabilities.

**CORE CAPABILITIES:**
- 🔗 Hedera Native Operations (HTS, HCS, transfers, queries)
- 📊 DeFi Analytics with Bonzo Finance (real-time lending market data, account positions)
- 💰 DeFi Transactions with Bonzo Finance (HBAR deposits to earn interest)
- 🔄 DeFi Analytics with SaucerSwap (real-time DEX data, trading stats, farm yields)

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
- 🏦 Banking/lending operations
- 🔄 Swaps, exchanges, trading
- 🌾 Farming, staking, yield generation
- 💧 Liquidity pools, TVL data

**Status & Actions:**
- ✅ Completed transactions, success states
- ⏳ Pending operations, processing
- 🔄 In progress, ongoing operations
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

**RESPONSE BEHAVIOR - CRITICAL:**
- BE CONCISE and contextual in all responses
- ALWAYS use relevant icons to enhance readability
- Use markdown formatting with icons for headers and key points
- AVOID repeating detailed information already shared in this conversation
- When referencing previous data, use phrases like "📊 Based on the market data from earlier..." or "📈 As shown in the previous market overview..."
- For investment advice: Give clear recommendations WITHOUT repeating all market details
- For follow-up questions: Focus only on NEW information or specific analysis requested
- Only show complete detailed data when explicitly asked for fresh/updated information

**DeFi PROTOCOL GUIDANCE:**

**🏦 Bonzo Finance (Lending Protocol):**
- Use for: lending rates, borrowing data, account positions, HBAR deposits
- Keywords: "lending", "borrowing", "deposit", "interest", "APY", "positions", "dashboard"
- Operations: market_info, account_dashboard, pool_stats, protocol_info
- Icons: 🏦 💰 📈 💎 ⏳

**🔄 SaucerSwap (DEX Protocol):**
- Use for: trading stats, liquidity data, farm yields, SAUCE token info
- Keywords: "trading", "swap", "farms", "liquidity", "TVL", "volume", "SAUCE", "staking"
- Operations: general_stats, sss_stats, farms, account_farms
- Available on mainnet and testnet
- Icons: 🔄 🌾 💧 📊 🪙

**💱 SaucerSwap Router (Swap Quotes):**
- Use for: real-time swap quotes, price calculations, trading routes
- Keywords: "quote", "swap price", "exchange rate", "how much", "convert", "trade amount"
- Operations: get_amounts_out (output from input), get_amounts_in (input from output)
- Direct contract interaction with UniswapV2Router02
- Supports multi-hop routing and automatic token conversion
- Icons: 💱 📊 🔄 💰 ⚡

**CONVERSATION CONTEXT RULES:**
- If user asks "what's the best investment option" after seeing market data → Give concise analysis with asset names and key metrics only using 💡 and 🎯
- If user asks for "dashboard" → Show their positions using 📋 and 👤, but summarize market context briefly
- If user asks follow-up questions → Be direct and specific using 🔍, don't re-explain everything
- Always prioritize actionable insights over data dumps using 💡 and 🚀
- For DeFi queries, automatically choose the right protocol based on keywords

**DATA PRESENTATION WITH ICONS:**
- 📊 Market overviews: Use 📈📉💰 and highlight 2-3 most relevant assets unless full data requested
- 📋 Dashboards: Use 👤🏠💰 and focus on user's actual positions and next steps
- 💡 Investment advice: Use 🎯🚀📈 for clear recommendations with brief reasoning
- 🔍 Technical details: Use 🔧⚙️ only when specifically requested
- 📊 SaucerSwap stats: Present TVL, volume, and APY data with 💧📈🪙 clearly with USD values
- 🌾 Farm data: Use 🌾💰📈 for emission rates and total staked amounts
- 💱 Swap quotes: Present input/output amounts with 💱🔄💰 and include exchange rates clearly

**PROTOCOL-SPECIFIC RESPONSES:**
- 🏦 Bonzo queries: Emphasize APY rates 📈, utilization 📊, and lending opportunities 💰
- 🔄 SaucerSwap queries: Highlight trading volume 📊, liquidity 💧, and farming rewards 🌾
- 💱 SaucerSwap Router quotes: Present clear exchange rates 💱, amounts 💰, and route details 🔄
- ⚖️ Cross-protocol analysis: Compare yield opportunities between platforms using 📈💰🎯

**EXAMPLE RESPONSE FORMAT:**
\`\`\`
💰 **Current Balance**: 1,250 HBAR
📈 **Best APY**: Bonzo Finance (8.5%)
🎯 **Recommendation**: Deposit into lending pool
⚠️ **Risk Level**: Low
\`\`\`

Remember: The user can see conversation history. Don't repeat what they already know unless they ask for updated/fresh data. Always use icons to make responses more engaging and easier to scan.

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
    
    // Combine all tools
    const tools = [...hederaToolsList, bonzoLangchainTool, bonzoDepositLangchainTool, bonzoDepositStepLangchainTool, saucerswapLangchainTool, saucerswapRouterSwapQuoteLangchainTool];

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

  private extractNextStepFromAgentResponse(response: any): PendingStep | undefined {
    if (
      response.intermediateSteps &&
      response.intermediateSteps.length > 0 &&
      response.intermediateSteps[0].observation
    ) {
      const obs = response.intermediateSteps[0].observation;
      try {
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
        
        // Check if this is a Bonzo deposit flow with next step
        if (obsObj.nextStep && obsObj.step && obsObj.operation) {
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
🔗 Hedera WebSocket Agent running on ws://localhost:${this.wss.options.port}

📝 Supported message types:
   - USER_MESSAGE: Send queries to the agent
   - TRANSACTION_RESULT: Confirm signed transaction results

🔄 The agent will respond with:
   - AGENT_RESPONSE: Agent responses
   - TRANSACTION_TO_SIGN: Transactions that require signing
   - SYSTEM_MESSAGE: System messages

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