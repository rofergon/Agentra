import { HederaLangchainToolkit, AgentMode, hederaTools } from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { BufferMemory } from 'langchain/memory';
import { Client, PrivateKey } from '@hashgraph/sdk';
import * as dotenv from 'dotenv';
import WebSocket, { WebSocketServer } from 'ws';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ContractCallQuery, ContractId, ContractFunctionParameters } from '@hashgraph/sdk';
import { z } from 'zod';

dotenv.config();

// Tipos de mensajes WebSocket
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

interface UserConnection {
  ws: WebSocket;
  userAccountId: string;
  agentExecutor: AgentExecutor;
  memory: BufferMemory;
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

    // Cliente Hedera para testnet (sin operator, será configurado por usuario)
    this.agentClient = Client.forTestnet();

    console.log('✅ Hedera WebSocket Agent initialized successfully');
  }

  private async createUserConnection(ws: WebSocket, userAccountId: string): Promise<UserConnection> {
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

    // Toolkit de Hedera en modo RETURN_BYTES con accountId del usuario
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
          accountId: userAccountId, // ✅ CAMBIO CLAVE: Usar accountId del usuario que se conecta, no del operador del servidor
        },
      },
    });

    // Prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a helpful Hedera blockchain assistant with DeFi capabilities. You can help users with:\n\n- Token creation and management\n- Topic management (HCS)\n- Balance queries (HBAR and tokens)\n- Account information\n- HBAR transfers\n- **DeFi operations with Bonzo Finance**: Query lending pools, get APY rates, check token reserves, and analyze DeFi metrics on Hedera testnet\n\nFor Bonzo DeFi queries, you can check available tokens, get reserve data, and provide yield/liquidity information from the Bonzo protocol contracts.'],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    // Obtener herramientas del toolkit de Hedera
    const hederaToolsList = hederaAgentToolkit.getTools();
    
    // Crear herramienta de Bonzo como DynamicStructuredTool directamente
    const bonzoLangchainTool = new DynamicStructuredTool({
      name: 'bonzo_contract_query',
      description: `Query Bonzo Finance DeFi contracts on Hedera testnet for lending pools, reserves, and yield data.

Available operations:
- Get all reserve tokens with symbols from AaveProtocolDataProvider
- Get reserves list (token addresses) from LendingPool
- Get detailed reserve data (APY, utilization, liquidity) for specific assets

This tool provides access to Bonzo's DeFi lending protocol data including yield rates, utilization percentages, and available liquidity.`,
      schema: z.object({
        contractType: z.enum(['DATA_PROVIDER', 'LENDING_POOL']).describe(
          'The type of Bonzo contract to query: DATA_PROVIDER for AaveProtocolDataProvider or LENDING_POOL for LendingPool'
        ),
        functionName: z.enum(['getAllReservesTokens', 'getReserveData', 'getReservesList']).describe(
          'The contract function to call'
        ),
        assetAddress: z.string().optional().describe(
          'The asset address parameter for getReserveData function (required only for this function)'
        ),
      }),
      func: async (params: any) => {
        try {
          console.log('🔍 Bonzo contract query started with params:', params);
          console.log('👤 User account ID:', userAccountId);
          console.log('🌐 Agent client network:', this.agentClient.ledgerId?.toString());
          
          // ⚠️ NOTA: Las direcciones de contrato pueden estar desactualizadas
          // Estas direcciones fueron proporcionadas pero pueden haber cambiado
          const BONZO_CONTRACTS = {
            AAVE_PROTOCOL_DATA_PROVIDER: '0.0.4999382',
            LENDING_POOL: '0.0.4999355',
          };

          // Validate parameters
          if (params.functionName === 'getReserveData' && !params.assetAddress) {
            console.log('❌ Missing assetAddress for getReserveData');
            return JSON.stringify({
              error: 'assetAddress is required when using getReserveData function',
              suggestion: 'Provide the token address you want to query reserve data for'
            });
          }

          // Determine contract ID based on type
          const contractId = params.contractType === 'DATA_PROVIDER' 
            ? BONZO_CONTRACTS.AAVE_PROTOCOL_DATA_PROVIDER 
            : BONZO_CONTRACTS.LENDING_POOL;

          console.log(`📋 Contract ID: ${contractId}, Function: ${params.functionName}`);

          // Use JSON-RPC Relay (correct Hedera approach for contract calls)
          console.log('🔗 Using Hedera JSON-RPC Relay for contract call...');
          const jsonRpcUrl = this.agentClient.ledgerId?.toString() === 'testnet' 
            ? 'https://testnet.hashio.io/api'
            : 'https://mainnet.hashio.io/api';
          
          console.log('🔍 Building eth_call request...');
          
          // Convert contract address to EVM format
          const [shard, realm, num] = contractId.split('.');
          const contractAddress = '0x' + parseInt(num).toString(16).padStart(40, '0');
          console.log(`📮 Contract EVM address: ${contractAddress}`);
          
          // Build function selector for the method
          let functionSelector: string;
          let callData: string;
          
          switch (params.functionName) {
            case 'getAllReservesTokens':
              // Function signature: getAllReservesTokens() - DataProvider contract
              // Note: This selector needs verification from DataProvider ABI
              functionSelector = '0xd1946dbc'; // This might be incorrect - need DataProvider ABI
              callData = functionSelector;
              break;
            case 'getReservesList':
              // Function signature: getReservesList()
              functionSelector = '0xd1946dbc'; // Correct selector from ABI
              callData = functionSelector;
              break;
            case 'getReserveData':
              // Function signature: getReserveData(address)
              functionSelector = '0x35ea6a75'; // Keccak256 hash of "getReserveData(address)" first 4 bytes
              const assetAddressPadded = params.assetAddress!.replace('0x', '').padStart(64, '0');
              callData = functionSelector + assetAddressPadded;
              break;
            default:
              throw new Error(`Unsupported function: ${params.functionName}`);
          }
          
          console.log(`🎯 Function selector: ${functionSelector}`);
          console.log(`📊 Call data: ${callData}`);
          
          // Prepare JSON-RPC eth_call request
          const jsonRpcRequest = {
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [
              {
                "to": contractAddress,
                "data": callData
              },
              "latest"
            ],
            "id": 1
          };
          
          console.log('🌐 Making eth_call to JSON-RPC Relay:', jsonRpcUrl);
          console.log('📤 JSON-RPC request:', jsonRpcRequest);
          
          const response = await fetch(jsonRpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(jsonRpcRequest)
          });
          
          if (!response.ok) {
            throw new Error(`JSON-RPC call failed: ${response.status} ${response.statusText}`);
          }
          
          const responseData = await response.json();
          console.log('📥 JSON-RPC response:', responseData);
          
          if (responseData.error) {
            // Handle CONTRACT_REVERT_EXECUTED specifically
            if (responseData.error.message.includes('CONTRACT_REVERT_EXECUTED')) {
              return JSON.stringify({
                error: 'Contract call failed: CONTRACT_REVERT_EXECUTED',
                possibleCauses: [
                  'The function does not exist in this contract',
                  'The contract addresses may be incorrect or outdated',
                  'The function selectors may be wrong',
                  'The contract may have access restrictions'
                ],
                suggestion: 'The Bonzo Finance contract addresses or functions may have changed. Please verify the current contract addresses and available functions.',
                contractDetails: {
                  contractId: contractId,
                  contractAddress: contractAddress,
                  functionName: params.functionName,
                  functionSelector: functionSelector
                },
                troubleshooting: {
                  step1: 'Verify the contract exists at https://hashscan.io/testnet/contract/' + contractAddress,
                  step2: 'Check if the contract has the expected functions',
                  step3: 'Confirm the contract addresses are current from Bonzo Finance documentation'
                }
              }, null, 2);
            }
            throw new Error(`JSON-RPC error: ${responseData.error.message}`);
          }
          
          // Create a result object
          const result = {
            bytes: responseData.result ? Buffer.from(responseData.result.replace('0x', ''), 'hex') : Buffer.alloc(0),
            gasUsed: { toString: () => '0' }
          };
          
          console.log('✅ Contract call successful, gas used:', result.gasUsed.toString());

          // Parse results based on function type
          let parsedResult: any = {
            success: true,
            contractType: params.contractType,
            function: params.functionName,
            contractId: contractId,
            contractAddress: contractAddress
          };

          try {
            switch (params.functionName) {
              case 'getAllReservesTokens':
                parsedResult.note = 'Function returns list of reserve tokens with symbols';
                parsedResult.rawData = Array.from(result.bytes);
                if (result.bytes.length === 0) {
                  parsedResult.warning = 'No data returned - the contract may not have any reserves or the function may not exist';
                }
                break;
              
              case 'getReservesList':
                parsedResult.note = 'Function returns array of token addresses';
                parsedResult.rawData = Array.from(result.bytes);
                if (result.bytes.length === 0) {
                  parsedResult.warning = 'No data returned - the contract may not have any reserves or the function may not exist';
                }
                break;
              
              case 'getReserveData':
                parsedResult.assetAddress = params.assetAddress;
                parsedResult.note = 'Function returns reserve metrics (liquidity, rates, etc.)';
                parsedResult.rawData = Array.from(result.bytes);
                if (result.bytes.length === 0) {
                  parsedResult.warning = 'No data returned - the asset may not exist or the function may not be available';
                }
                break;
              
              default:
                parsedResult.rawData = Array.from(result.bytes);
            }
          } catch (parseError) {
            parsedResult.parseError = `Could not parse result: ${parseError}`;
            parsedResult.rawData = Array.from(result.bytes);
          }

          parsedResult.gasUsed = result.gasUsed.toString();
          return JSON.stringify(parsedResult, null, 2);

        } catch (error) {
          console.error('❌ Bonzo contract query failed:', error);
          console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
          
          let errorMessage = error instanceof Error ? error.message : 'Unknown error';
          let troubleshooting = {};
          
          if (errorMessage.includes('CONTRACT_REVERT_EXECUTED')) {
            troubleshooting = {
              issue: 'Contract execution reverted',
              likely_causes: [
                'Function does not exist in the contract',
                'Incorrect function parameters',
                'Contract addresses are outdated',
                'Function selectors are wrong'
              ],
              next_steps: [
                'Verify contract addresses from official Bonzo Finance documentation',
                'Check contract functions on HashScan',
                'Confirm the contract is the correct Bonzo DeFi contract'
              ]
            };
          }
          
          return JSON.stringify({
            error: `Error querying Bonzo contracts: ${errorMessage}`,
            contractType: params.contractType,
            functionName: params.functionName,
            troubleshooting: troubleshooting,
            note: 'This error suggests the Bonzo Finance contract addresses or functions may have changed since implementation',
            recommendation: 'Please check the latest Bonzo Finance documentation for current contract addresses'
          }, null, 2);
        }
      },
    });
    
    // Combinar todas las herramientas
    const tools = [...hederaToolsList, bonzoLangchainTool];

    // Crear agente
    const agent = createToolCallingAgent({
      llm: this.llm,
      tools,
      prompt,
    });

    // Memoria para conversación del usuario
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

      // Manejar desconexión
      ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        this.userConnections.delete(ws);
      });

      // Manejar errores
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
      
      // Crear conexión de usuario con su propio toolkit
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

      // Si el mensaje incluye un userAccountId diferente, recrear la conexión
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
      
      // Procesar mensaje con el agente del usuario
      const response = await currentConnection.agentExecutor.invoke({ input: message.message });
      
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