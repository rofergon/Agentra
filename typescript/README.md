# Hedera Agent Kit

![npm version](https://badgen.net/npm/v/hedera-agent-kit)
![license](https://badgen.net/github/license/your-username/Agentra)
![build](https://badgen.net/github/checks/hedera-dev/hedera-agent-kit)

> Build Hedera-powered AI agents **in under a minute**.

## 📋 Contents

- [Key Features](#key-features)
- [About the Agent Kit Tools](#about-the-agent-kit-tools)
- [🚀 60-Second Quick-Start](#-60-second-quick-start)
- [📦 Clone & Test the SDK Examples](#-clone--test-the-sdk-examples)
- [Agent Execution Modes](#agent-execution-modes)
- [Hedera Transaction Tools](#hedera-transaction-tools)
- [Hedera Mirror Node Query Tools](#hedera-mirror-node-query-tools)
- [Creating Tools](#creating-tools)
- [License](#license)
- [Credits](#credits)

---

## Key Features

This version of the Hedera Agent Kit, known as v3, is a complete rewrite of the original version. It is designed to be more flexible and easier to use, with a focus on developer experience. It enables direct API execution through a simple HederaAgentAPI class, with an individual LangChain tools call for each example.

---

## About the Agent Kit Tools

The list of currently available tools can be found in the [Tools section](#hedera-transaction-tools) of this page

👉 See [docs/TOOLS.md](docs/TOOLS.md) for the full catalogue & usage examples.

Want to add more functionality from Hedera Services? [Open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.md&title=[FEATURE]%20-%20)!

---

## 🚀 60-Second Quick-Start

See more info at [https://www.npmjs.com/package/hedera-agent-kit](https://www.npmjs.com/package/hedera-agent-kit)

### 1 – Project Setup

Create a directory for your project and install dependencies:

```bash
mkdir hello-hedera-agent-kit
cd hello-hedera-agent-kit
```

Init and install with npm

```bash
npm init -y
```

```bash
npm install hedera-agent-kit @langchain/openai @langchain/core langchain @hashgraph/sdk dotenv
```

### 2 – Configure: Add Environment Variables

Create an .env file in the root directory of your project:

```bash
touch .env
```

If you already have a **testnet** account, you can use it. Otherwise, you can create a new one at [https://portal.hedera.com/dashboard](https://portal.hedera.com/dashboard)

Add the following to the .env file:

```env
ACCOUNT_ID= 0.0.xxxxx # your operator account ID from https://portal.hedera.com/dashboard
PRIVATE_KEY= 302e... # DER encoded private key
OPENAI_API_KEY= sk-proj-... # Create an OpenAPI Key at https://platform.openai.com/api-keys
```

### 3 – Simple "Hello Hedera Agent Kit" Example

Create a a new file called `index.js` in the `hello-hedera-agent-kit` folder.

```bash
touch index.js
```

Once you have created a new file `index.js` and added the environment variables, you can run the following code:

```javascript
// index.js
import dotenv from 'dotenv';
dotenv.config();

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client, PrivateKey } from '@hashgraph/sdk';

async function main() {
  // Initialise OpenAI LLM
  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID,
    PrivateKey.fromStringDer(process.env.PRIVATE_KEY),
  ); // get these from https://portal.hedera.com

  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [], // use an empty array if you want to load all tools
    },
  });

  // Load the structured chat prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant'],
    ['placeholder', '{chat_history}'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  // Fetch tools from toolkit
  const tools = hederaAgentToolkit.getTools();

  // Create the underlying agent
  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  // Wrap everything in an executor that will maintain memory
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  const response = await agentExecutor.invoke({ input: "what's my balance?" });
  console.log(response);
}

main().catch(console.error);
```

### 4 – Run Your "Hello Hedera Agent Kit" Example

From the root directory, run your example agent, and prompt it to give your hbar balance:

```bash
node index.js
```

If you would like, try adding in other prompts to the agent to see what it can do.

```javascript
...
//original
  const response = await agentExecutor.invoke({ input: "what's my balance?" });
// or
  const response = await agentExecutor.invoke({ input: "create a new token called 'TestToken' with symbol 'TEST'" });
// or
  const response = await agentExecutor.invoke({ input: "transfer 5 HBAR to account 0.0.1234" });
// or
  const response = await agentExecutor.invoke({ input: "create a new topic for project updates" });
...
   console.log(response);
```

> To get other Hedera Agent Kit tools working, take a look at the example agent implementations at [https://github.com/hedera-dev/hedera-agent-kit/tree/main/typescript/examples/langchain](https://github.com/hedera-dev/hedera-agent-kit/tree/main/typescript/examples/langchain)

---

## 📦 Clone & Test the SDK Examples

### 1 – Install

```bash
git clone https://github.com/hedera-dev/hedera-agent-kit.git
```

**Requirements**

- Node.js v20 or higher

**Repo Dependencies**

- Hedera [Hashgraph SDK](https://github.com/hiero-ledger/hiero-sdk-js) and API
- [Langchain Tools](https://js.langchain.com/docs/concepts/tools/)
- zod
- dotenv

### 2 – Configure: Add Environment Variables

#### For Agent Examples

Copy `typescript/examples/langchain/.env.example` to `typescript/examples/langchain/.env`:

```bash
cd typescript/examples/langchain
cp .env.example .env
```

Add in your [Hedera API](https://portal.hedera.com/dashboard) and [OPENAPI](https://platform.openai.com/api-keys) Keys

```env
ACCOUNT_ID= 0.0.xxxxx
PRIVATE_KEY= 302e...
OPENAI_API_KEY= sk-proj-...
```

### 3 – Option A: Run the Example Tool Calling Agent

With the tool-calling-agent (found at `typescript/examples/langchain/tool-calling-agent.ts`), you can experiment with and call the [available tools](docs/TOOLS.md) in the Hedera Agent Kit for the operator account (the account you are using in the .env file). This example tool-calling-agent uses GPT 4-o-mini that is a simple template you can use with other LLMs.

1. First, go into the directory where the example is and run `npm install`

```bash
cd typescript/examples/langchain
npm install
```

2. Then, run the example

```bash
npm run langchain:tool-calling-agent
```

3. interact with the agent. First, tell the agent who you are (your name) and try out some of the interactions by asking questions:

- _What can you help me do with Hedera?_
- _What's my current HBAR balance?_
- _Create a new topic called 'Daily Updates_
- _Submit the message 'Hello World' to topic 0.0.12345_
- _Create a fungible token called 'MyToken' with symbol 'MTK'_
- _Check my balance and then create a topic for announcements_
- _Create a token with 1000 initial supply and then submit a message about it to topic 0.0.67890_

### 4 – Option B: Run the Structured Chat Agent

The structured chat agent enables you to interact with the Hedera blockchain in the same way as the tool calling agent, using GPT-4.1 as the LLM. You can use tools in autonomous mode using pre-built [prompts from the LangChain Hub](https://github.com/hwchase17/langchain-hub/blob/master/prompts/README.md).

1. First, go into the directory where the example is and run `npm install`

```bash
cd typescript/examples/langchain
npm install
```

2. Then, run the example

```bash
npm run langchain:structured-chat-agent
```

### 5 - Option C: Try the Human in the Loop Chat Agent

### 6 - Option D: Try Out the MCP Server

---

## Agent Execution Modes

This tool has two execution modes with AI agents; autonomous excution and return bytes. If you set:

- `mode: AgentMode.RETURN_BYTE` the transaction will be executed, and the bytes to execute the Hedera transaction will be returned.
- `mode: AgentMode.AUTONOMOUS` the transaction will be executed autonomously, using the accountID set (the operator account can be set in the client with `.setOperator(process.env.ACCOUNT_ID!`)

## Hedera Transaction Tools

The Hedera Agent Kit provides a set of tools to execute transactions on the Hedera network, which we will be expanding in the future.

To request more functionality in the toolkit for:

- [Token Service](https://docs.hedera.com/hedera/sdks-and-apis/sdks/token-service)
- [Consensus Service](https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service)
- [Smart Contract Servce](https://docs.hedera.com/hedera/tutorials/smart-contracts)

Please [open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.yml&labels=feature-request).

**Available Tools**

- Transfer HBAR
- Create a Topic
- Submit a message to a Topic
- Create a Fungible Token
- Create a Non-Fungible Token
- Airdrop Fungible Tokens
- Transfer Fungible Tokens

See the implementation details in [docs/TOOLS.md](docs/TOOLS.md)

## Hedera Mirror Node Query Tools

The Hedera network is made up of two types of nodes: consensus nodes and mirror nodes. Mirror nodes are free to query, and maintain a copy of the state of the network for users to query.

This toolkit provides a set of tools to query the state of the network, including accounts, tokens, and transactions. To request more functionality, please [open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.md&title=[FEATURE]%20-%20).

The Hedera Agent Kit provides a set of tools to execute query these nodes:

- Get Account Query
- Get HBAR Balance Query
- Get Account Token Balances Query
- Get Topic Messages Query

See the implementation details in [docs/TOOLS.md](docs/TOOLS.md)

---

## Creating Tools

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to contribute to the Hedera Agent Kit.

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)**.

### What this means:

✅ **You can:**
- Share and redistribute the code
- Adapt and modify the code
- Use for personal, educational, and research purposes

❌ **You cannot:**
- Use for commercial purposes without explicit permission
- Distribute modified versions under a different license

### For Commercial Use:
If you want to use this project for commercial purposes, please contact the project maintainers for licensing options.

## Credits

Special thanks to the developers of the [Stripe Agent Toolkit](https://github.com/stripe/agent-toolkit) who provided the inspiration for the architecture and patterns used in this project.
