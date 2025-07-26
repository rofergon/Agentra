# Bonzo Finance LangChain Tool Integration Guide

A comprehensive guide to implementing custom LangChain tools using the Bonzo Finance API integration as a reference implementation.

## Overview

This guide demonstrates how to create, modular custom LangChain tool that integrates external APIs into AI agents. Using the Bonzo Finance DeFi protocol integration as a practical example, you'll learn the patterns and best practices for building production-ready LangChain tools.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Implementation Structure](#implementation-structure)
3. [Core Components](#core-components)
4. [LangChain Integration](#langchain-integration)
5. [Tool Registration](#tool-registration)
6. [Agent Integration](#agent-integration)
7. [Best Practices](#best-practices)
8. [Usage Examples](#usage-examples)

## Architecture Overview

The Bonzo Finance tool follows a **modular architecture** that separates concerns and ensures maintainability:

```
📁 tools/defi/bonzo/
├── api-client.ts          # Core API logic & parameters
├── langchain-tools.ts     # LangChain-specific wrappers
├── index.ts              # Public exports


```

### Key Design Principles

- **Separation of Concerns**: API logic separate from LangChain-specific code
- **Type Safety**: Full TypeScript support with Zod schemas
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Modularity**: Easy to extend and maintain
- **Reusability**: Core logic can be reused outside LangChain

## Implementation Structure

### 1. Core API Client (`api-client.ts`)

The foundation layer handles the actual API interaction:

```typescript
// Configuration constants
export const BONZO_API_CONFIG = {
  BASE_URL: 'https://bonzo-data-api-eceac9d8a2aa.herokuapp.com',
  ENDPOINTS: {
    ACCOUNT_DASHBOARD: '/dashboard',
    MARKET_INFO: '/market',
    POOL_STATS: '/pool-stats',
    PROTOCOL_INFO: '/info',
    BONZO_TOKEN: '/bonzo',
    BONZO_CIRCULATION: '/bonzo/circulation',
  }
} as const;

// Available operations enum
export const BONZO_API_OPERATIONS = {
  ACCOUNT_DASHBOARD: 'account_dashboard',
  MARKET_INFO: 'market_info',
  POOL_STATS: 'pool_stats',
  PROTOCOL_INFO: 'protocol_info',
  BONZO_TOKEN: 'bonzo_token',
  BONZO_CIRCULATION: 'bonzo_circulation',
} as const;
```

#### Parameter Schema Definition

Uses Zod for robust parameter validation:

```typescript
export const bonzoApiQueryParameters = (context: Context = {}) => {
  return z.object({
    operation: z.enum([
      BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD,
      BONZO_API_OPERATIONS.MARKET_INFO,
      // ... other operations
    ]).describe('The Bonzo API operation to perform'),
    accountId: z.string().optional().describe(
      'Hedera account ID in format shard.realm.num (required only for account_dashboard operation)'
    ),
  });
};
```

#### Core Execution Function

```typescript
export const getBonzoApiQuery = async (
  client: any, // Hedera client (not used for API calls)
  context: Context,
  params: z.infer<ReturnType<typeof bonzoApiQueryParameters>>,
) => {
  try {
    // Parameter validation
    if (params.operation === BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD && !params.accountId) {
      return {
        error: 'accountId is required for account_dashboard operation',
        suggestion: 'Provide a Hedera account ID in format shard.realm.num'
      };
    }

    // API URL construction
    let apiUrl = BONZO_API_CONFIG.BASE_URL;
    switch (params.operation) {
      case BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD:
        apiUrl += `${BONZO_API_CONFIG.ENDPOINTS.ACCOUNT_DASHBOARD}/${params.accountId}`;
        break;
      // ... other cases
    }

    // HTTP request with proper headers
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Hedera-Agent-Kit/1.0'
      }
    });

    // Error handling
    if (!response.ok) {
      throw new Error(`Bonzo API error: ${response.status} ${response.statusText}`);
    }

    // Response processing
    let data;
    const contentType = response.headers.get('content-type');
    
    if (params.operation === BONZO_API_OPERATIONS.BONZO_CIRCULATION) {
      data = await response.text(); // Plain text response
    } else if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Structured response
    return {
      operation: params.operation,
      timestamp: new Date().toISOString(),
      data: data,
      source: 'Bonzo Finance API',
      api_url: apiUrl
    };

  } catch (error) {
    // Comprehensive error handling
    return {
      error: `Error querying Bonzo Finance API: ${error.message}`,
      operation: params.operation,
      timestamp: new Date().toISOString(),
      suggestion: 'Check your internet connection and verify the Bonzo Finance API is available',
      api_documentation: 'https://docs.bonzo.finance/hub/developer/bonzo-v1-data-api'
    };
  }
};
```

### 2. LangChain Integration (`langchain-tools.ts`)

This layer wraps the core functionality for LangChain compatibility:

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const createBonzoLangchainTool = (client: any, context: Context, userAccountId: string) => {
  return new DynamicStructuredTool({
    name: BONZO_API_QUERY_TOOL,
    description: `Query Bonzo Finance DeFi protocol using their official REST API for real-time data.

Available operations:
- Account Dashboard: Get detailed account lending/borrowing positions
- Market Information: Get current market data for all supported tokens  
- Pool Statistics: Get 24-hour protocol statistics
- Protocol Information: Get protocol configuration and contract addresses
- BONZO Token: Get BONZO token details and treasury information
- BONZO Circulation: Get current circulating supply

User Account: ${userAccountId}`,
    
    schema: z.object({
      operation: z.enum([
        BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD,
        BONZO_API_OPERATIONS.MARKET_INFO,
        // ... other operations
      ]),
      accountId: z.string().optional(),
    }),
    
    func: async (params: any) => {
      try {
        // Auto-use user account ID for dashboard queries if not provided
        if (params.operation === BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD && !params.accountId) {
          params.accountId = userAccountId;
        }

        const result = await getBonzoApiQuery(client, context, params);
        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify({
          error: `Error querying Bonzo Finance API: ${error.message}`,
          operation: params.operation,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            issue: 'API request failed',
            possible_causes: [
              'Network connectivity issues',
              'Bonzo Finance API is temporarily unavailable',
              'Invalid account ID format',
              'Rate limiting'
            ],
            next_steps: [
              'Check internet connection',
              'Verify account ID format (shard.realm.num)',
              'Try again in a few moments',
              'Check Bonzo Finance status page'
            ]
          }
        }, null, 2);
      }
    },
  });
};
```

## Core Components

### DynamicStructuredTool Features

The `DynamicStructuredTool` from LangChain provides several key capabilities:

1. **Schema Validation**: Automatic parameter validation using Zod schemas
2. **Type Safety**: Full TypeScript support for parameters and return types
3. **Error Handling**: Built-in error catching and response formatting
4. **Tool Calling**: Compatible with LangChain's tool-calling agents
5. **Async Support**: Native async/await support for API calls

### Key Implementation Details

#### Parameter Schema Definition

```typescript
schema: z.object({
  operation: z.enum([...operations]).describe('Operation description'),
  accountId: z.string().optional().describe('Parameter description'),
})
```

#### Function Implementation

```typescript
func: async (params: any) => {
  // 1. Parameter preprocessing
  // 2. Core logic execution
  // 3. Response formatting
  // 4. Error handling
}
```

#### User Context Integration

```typescript
// Automatically use user's account ID when appropriate
if (params.operation === ACCOUNT_DASHBOARD && !params.accountId) {
  params.accountId = userAccountId;
}
```

## Tool Registration

### 1. Export in Main Tools File

```typescript
// tools.ts
import { bonzoApiQueryTool, BONZO_API_QUERY_TOOL } from './tools/defi/bonzo';

const tools = (context: Context): Tool[] => [
  // ... other tools
  bonzoApiQueryTool(context),
];

export const hederaTools = {
  // ... other tool constants
  BONZO_API_QUERY_TOOL,
};
```

### 2. Modular Export Structure

```typescript
// defi/index.ts
export * from './bonzo';

// bonzo/index.ts
export { default as bonzoApiQueryTool } from './api-client';
export { 
  BONZO_API_QUERY_TOOL,
  BONZO_API_CONFIG,
  BONZO_API_OPERATIONS,
} from './api-client';
export { 
  createBonzoLangchainTool,
  createBonzoLangchainTools,
} from './langchain-tools';
```

## Agent Integration

### WebSocket Agent Example

```typescript
private async createUserConnection(ws: WebSocket, userAccountId: string): Promise<UserConnection> {
  // Get standard Hedera tools
  const hederaToolsList = hederaAgentToolkit.getTools();
  
  // Create Bonzo query tool with user context
  const bonzoLangchainTool = createBonzoLangchainTool(
    this.agentClient,
    { mode: AgentMode.RETURN_BYTES },
    userAccountId  // 🔑 User context for personalized queries
  );
  
  // Combine all tools
  const tools = [...hederaToolsList, bonzoLangchainTool];

  // Create agent with combined tools
  const agent = createToolCallingAgent({
    llm: this.llm,
    tools,
    prompt,
  });

  // Agent executor with tool access
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory,
    returnIntermediateSteps: true,
  });

  return { ws, userAccountId, agentExecutor, memory };
}
```

### Tool Calling Agent Example

```typescript
// Standard agent setup
const hederaAgentToolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    tools: [
      CREATE_TOPIC_TOOL,
      SUBMIT_TOPIC_MESSAGE_TOOL,
      GET_HBAR_BALANCE_QUERY_TOOL,
      // Custom Bonzo tool automatically included
    ],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});

const tools = hederaAgentToolkit.getTools();
const agent = createToolCallingAgent({ llm, tools, prompt });
```

## Best Practices

### 1. Error Handling

```typescript
// ✅ Good: Comprehensive error information
return {
  error: `Error querying Bonzo Finance API: ${error.message}`,
  operation: params.operation,
  timestamp: new Date().toISOString(),
  suggestion: 'Check your internet connection',
  troubleshooting: {
    possible_causes: [...],
    next_steps: [...]
  }
};

// ❌ Bad: Generic error message
throw new Error('API failed');
```

### 2. Parameter Validation

```typescript
// ✅ Good: Clear validation with helpful messages
if (params.operation === ACCOUNT_DASHBOARD && !params.accountId) {
  return {
    error: 'accountId is required for account_dashboard operation',
    suggestion: 'Provide a Hedera account ID in format shard.realm.num (e.g., "0.0.123456")'
  };
}
```

### 3. Response Formatting

```typescript
// ✅ Good: Structured response with metadata
return {
  operation: params.operation,
  timestamp: new Date().toISOString(),
  data: data,
  source: 'Bonzo Finance API',
  api_url: apiUrl
};
```

### 4. User Context Integration

```typescript
// ✅ Good: Automatic user context when appropriate
if (params.operation === ACCOUNT_DASHBOARD && !params.accountId) {
  params.accountId = userAccountId;
  console.log(`📋 Using user account ID for dashboard: ${userAccountId}`);
}
```

## Usage Examples

### 1. Direct Tool Usage

```typescript
const bonzoTool = createBonzoLangchainTool(client, context, userAccountId);

// Get market information
const marketData = await bonzoTool.invoke({
  operation: 'market_info'
});

// Get user's lending positions
const accountData = await bonzoTool.invoke({
  operation: 'account_dashboard',
  accountId: '0.0.123456'
});
```

### 2. Agent Integration

```typescript
// The agent can automatically use the tool based on user queries
const response = await agentExecutor.invoke({
  input: "What are the current lending rates on Bonzo Finance?"
});

// Agent will automatically:
// 1. Recognize this as a DeFi query
// 2. Select the Bonzo tool
// 3. Use the market_info operation
// 4. Format the response for the user
```

### 3. Multi-Tool Workflows

```typescript
// Example: Get account balance, then check DeFi positions
const response = await agentExecutor.invoke({
  input: "Show me my HBAR balance and my lending positions on Bonzo"
});

// Agent will:
// 1. Use GET_HBAR_BALANCE_QUERY_TOOL for HBAR balance
// 2. Use Bonzo tool with account_dashboard operation
// 3. Combine results in a coherent response
```

## Advanced Features

### 1. Multiple Tool Creation

```typescript
export const createBonzoLangchainTools = (client: any, context: Context, userAccountId: string) => {
  return [
    createBonzoLangchainTool(client, context, userAccountId),
    // Future specialized tools:
    // createBonzoAccountTool(client, context, userAccountId),
    // createBonzoMarketTool(client, context, userAccountId),
  ];
};
```

### 2. Context-Aware Descriptions

```typescript
description: `Query Bonzo Finance DeFi protocol...
User Account: ${userAccountId}`, // Dynamic description based on user
```

### 3. Operation-Specific Logic

```typescript
switch (params.operation) {
  case BONZO_API_OPERATIONS.ACCOUNT_DASHBOARD:
    apiUrl += `${BONZO_API_CONFIG.ENDPOINTS.ACCOUNT_DASHBOARD}/${params.accountId}`;
    break;
  case BONZO_API_OPERATIONS.BONZO_CIRCULATION:
    apiUrl += BONZO_API_CONFIG.ENDPOINTS.BONZO_CIRCULATION;
    // Special handling for plain text response
    data = await response.text();
    break;
  // ... other cases
}
```

## Integration Patterns

### 1. Toolkit Integration

```typescript
// Automatic inclusion in toolkit
const hederaAgentToolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    tools: [], // Empty array loads all tools including Bonzo
    context: { mode: AgentMode.AUTONOMOUS },
  },
});
```

### 2. Manual Tool Selection

```typescript
// Selective tool loading
const tools = [
  CREATE_TOPIC_TOOL,
  GET_HBAR_BALANCE_QUERY_TOOL,
  BONZO_API_QUERY_TOOL, // Explicitly include Bonzo tool
];
```

### 3. Dynamic Tool Creation

```typescript
// Create tool with specific user context in WebSocket connections
const createUserSpecificTools = (userAccountId: string) => {
  return [
    ...standardHederaTools,
    createBonzoLangchainTool(client, context, userAccountId)
  ];
};
```

## Conclusion

This implementation demonstrates how to create robust, production-ready LangChain tools that:

- **Integrate external APIs** seamlessly into AI agents
- **Provide excellent user experience** with context-aware responses
- **Handle errors gracefully** with helpful troubleshooting information
- **Scale easily** with modular, maintainable architecture
- **Support multiple use cases** from direct invocation to agent integration

The Bonzo Finance integration serves as a template for building similar tools for other APIs and services, following established patterns for parameter validation, error handling, and LangChain integration.

---

## References

- [LangChain Custom Tools Documentation](https://python.langchain.com/docs/modules/agents/tools/custom_tools)
- [LangChain DynamicStructuredTool API](https://v03.api.js.langchain.com/classes/_langchain_core.tools.DynamicStructuredTool.html)
- [Bonzo Finance API Documentation](https://docs.bonzo.finance/hub/developer/bonzo-v1-data-api)
- [Zod Schema Validation](https://zod.dev/) 