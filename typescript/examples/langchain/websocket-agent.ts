import { HederaLangchainToolkit, AgentMode, hederaTools } from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { BufferMemory } from 'langchain/memory';
import { Client, PrivateKey } from '@hashgraph/sdk';
import * as dotenv from 'dotenv';
import WebSocket, { WebSocketServer } from 'ws';

dotenv.config();

// Tipos de mensajes WebSocket
interface BaseMessage {
  id?: string;
  timestamp: number;
}

interface UserMessage extends BaseMessage {
  type: 'USER_MESSAGE';
  message: string;
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

type WSMessage = UserMessage | AgentResponse | TransactionToSign | TransactionResult | SystemMessage;

class HederaWebSocketAgent {
  private wss: WebSocketServer;
  private agentExecutor!: AgentExecutor;
  private memory!: BufferMemory;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    this.setupWebSocketServer();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Hedera WebSocket Agent...');

    // Configuración OpenAI
    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
    });

    const operatorAccountId = process.env.ACCOUNT_ID!;
    const operatorPrivateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!);

    // Cliente Hedera para testnet
    const agentClient = Client.forTestnet();

    // Herramientas disponibles
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

    // Toolkit de Hedera en modo RETURN_BYTES
    const hederaAgentToolkit = new HederaLangchainToolkit({
      client: agentClient,
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
          accountId: operatorAccountId,
        },
      },
    });

    // Prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a helpful Hedera blockchain assistant. You can help users with token creation, topic management, balance queries, and other Hedera operations.'],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    // Obtener herramientas
    const tools = hederaAgentToolkit.getTools();

    // Crear agente
    const agent = createToolCallingAgent({
      llm,
      tools,
      prompt,
    });

    // Memoria para conversación
    this.memory = new BufferMemory({
      memoryKey: 'chat_history',
      inputKey: 'input',
      outputKey: 'output',
      returnMessages: true,
    });

    // Executor del agente
    this.agentExecutor = new AgentExecutor({
      agent,
      tools,
      memory: this.memory,
      returnIntermediateSteps: true,
    });

    console.log('✅ Hedera WebSocket Agent initialized successfully');
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔗 New WebSocket connection established');
      this.clients.add(ws);

      // Send welcome message
      this.sendMessage(ws, {
        type: 'SYSTEM_MESSAGE',
        message: 'Connected to Hedera Agent. You can start asking questions!',
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

      // Manejar desconexión
      ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        this.clients.delete(ws);
      });

      // Manejar errores
      ws.on('error', (error: any) => {
        console.error('❌ WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    console.log(`🌐 WebSocket Server started on port ${this.wss.options.port}`);
  }

  private async handleMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    switch (message.type) {
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

  private async handleUserMessage(ws: WebSocket, message: UserMessage): Promise<void> {
    try {
      console.log('👤 User:', message.message);

      // Procesar mensaje con el agente
      const response = await this.agentExecutor.invoke({ input: message.message });
      
      console.log('🤖 Agent:', response?.output ?? response);

      // Extraer bytes de transacción si existen
      const bytes = this.extractBytesFromAgentResponse(response);
      
      if (bytes !== undefined) {
        // Hay una transacción para firmar
        const realBytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.data);
        
        // Enviar respuesta del agente
        this.sendMessage(ws, {
          type: 'AGENT_RESPONSE',
          message: response?.output ?? response,
          hasTransaction: true,
          timestamp: Date.now(),
        });

        // Enviar transacción para firmar
        this.sendMessage(ws, {
          type: 'TRANSACTION_TO_SIGN',
          transactionBytes: Array.from(realBytes),
          originalQuery: message.message,
          timestamp: Date.now(),
        });
      } else {
        // Solo respuesta del agente, sin transacción
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
    if (message.success) {
      console.log('✅ Transaction confirmed:', message.transactionId);
      console.log('📊 Status:', message.status);
      
      this.sendMessage(ws, {
        type: 'SYSTEM_MESSAGE',
        message: `✅ Transaction executed successfully!\nID: ${message.transactionId}\nStatus: ${message.status}`,
        level: 'info',
        timestamp: Date.now(),
      });
    } else {
      console.log('❌ Transaction failed:', message.error);
      
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
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
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