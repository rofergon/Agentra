# Hedera DeFi AI Agent 🚀

## 📋 Project Description

An artificial intelligence agent specialized in the Hedera Hashgraph DeFi ecosystem that helps both novice and experienced users navigate and optimize their investments in decentralized finance protocols. The agent uses real-time analysis of multiple DeFi platforms to identify the best yield opportunities.



## 🎯 Problem Solved

### For Novice Users:
- **Complexity of the DeFi ecosystem**: New users feel overwhelmed by the number of protocols and available options
- **Lack of technical knowledge**: Difficulty understanding concepts like liquidity mining, yield farming, lending, staking
- **Risk of losses**: Making investment decisions without enough information can result in significant losses
- **Fragmented information**: Data is scattered across multiple platforms without a unified view

### For Experienced Users:
- **Inefficient manual monitoring**: Manually reviewing multiple protocols consumes valuable time
- **Missed opportunities**: The best arbitrage and yield opportunities can go unnoticed
- **Complex comparative analysis**: Comparing yields, risks, and features between protocols takes a lot of time
- **Lack of automation**: Need for tools that facilitate data-driven decision making

## 💡 How It Solves the Problem

### 🤖 Intelligent AI Agent
- **Automated analysis**: Continuous monitoring of multiple DeFi protocols on Hedera
- **Personalized recommendations**: Suggestions based on the user's risk profile and objectives
- **Conversational interface**: Natural interaction via WebSocket for real-time queries
- **Persistent context**: Conversation memory that maintains session context

### 📊 Real-Time Multi-Protocol Analysis

#### Integration with APIs and Smart Contracts:
- **REST APIs**: Direct connection to platform data endpoints
- **Smart contracts**: Native interaction with on-chain protocols
- **Intelligent rate limiting**: Optimized request management to avoid limitations
- **Smart cache**: 30-second cache system to optimize performance

### 🏦 Supported DeFi Platforms

#### 🥇 SaucerSwap
- **Type**: DEX with AMM (Automated Market Maker)
- **Yield Features**: 
  - Token swaps
  - Liquidity provision
  - Yield farming
  - Single-sided staking (Infinity Pools, Community Pools)
  - Rewards in SAUCE tokens
- **Dominance**: +44% of total Hedera DeFi TVL and +60% of unique active wallets

#### 🔄 HeliSwap
- **Type**: Native Hedera DEX (Uniswap v2 style)
- **Yield Features**:
  - LP token staking
  - Liquidity mining rewards in HELI and HBAR
  - Support for HTS, ERC-20, wrapped HBAR
- **Growth**: TVL increased ~355% quarterly up to Q4 2024 (~$6.6M)

#### 🏛️ Stader Labs
- **Type**: Liquid staking provider for HBAR
- **Yield Features**:
  - Stake HBAR → receive HBARX (rebasing token)
  - Maintains liquidity while earning staking rewards
  - 10% fee on rewards
  - Unstaking requires ~1 day
- **TVL**: ~47% of total Hedera DeFi TVL by end of 2024

#### 💰 Bonzo Finance
- **Type**: Lending & borrowing protocol (Aave V2 fork)
- **Yield Features**:
  - Supply assets to earn interest
  - Loans enabled after TVL threshold
- **TVL**: Steady growth post-launch (~$25M in Q4 2024, later ~$38M)

#### 🧠 Sirio Finance
- **Type**: Lending & borrowing protocol with AI integration
- **Yield Features**:
  - Similar to Bonzo but at a smaller scale
  - First AI-powered protocol on Hedera
- **Current TVL**: ~$28.8K (emerging protocol)

#### 🏦 HLiquity
- **Type**: Interest-free lending protocol using HBAR as collateral
- **Yield Features**:
  - HCHF loans (stablecoin pegged to Swiss franc)
  - HLQT tokens via staking in Stability Pool

## 🛠️ Technical Architecture

### 🔌 WebSocket Communication
- **Persistent connections**: Real-time bidirectional communication
- **User authentication**: Each user maintains their own session with account ID
- **Transaction management**: Transaction signing outside the agent for maximum security

### 🧰 Integrated Tools
- **Hedera Native**: HTS, HCS, transfers, balance queries
- **DeFi Analytics**: Real-time market data, account positions
- **Memory Management**: Persistent conversation context per user

### 📡 Supported Message Types
- `CONNECTION_AUTH`: User authentication
- `USER_MESSAGE`: User queries to the agent
- `AGENT_RESPONSE`: Agent responses with analysis
- `TRANSACTION_TO_SIGN`: Transactions requiring signature
- `TRANSACTION_RESULT`: Confirmation of executed transactions
- `SYSTEM_MESSAGE`: System messages (info, errors, warnings)

## 🎯 Use Cases

### For Novice Users:
- "What are the best staking options on Hedera?"
- "Explain what yield farming is and where I can do it"
- "Which protocol is safest to start with?"

### For Experienced Users:
- "Show me the highest APYs available now"
- "Compare arbitrage opportunities between SaucerSwap and HeliSwap"
- "What is the best strategy for $10,000 with high risk tolerance?"

## 🚀 Key Benefits

- **⏱️ Time Savings**: Automated analysis instead of manual research
- **📈 Maximized Yields**: Identification of the best opportunities
- **🛡️ Risk Reduction**: Comparative analysis of protocols and strategies
- **🎓 Continuous Education**: Learn about DeFi through natural interactions
- **🔐 Security**: Does not custody funds, only provides analysis and recommendations

## 🔜 Future Roadmap

- **Integration of more protocols**: Expansion to new DeFi protocols on Hedera
- **Smart alerts**: Automatic notifications about yield opportunities
- **Automated strategies**: Automatic execution of pre-configured strategies
- **Web dashboard**: Graphical interface complementing the conversational agent
- **Predictive analysis**: ML to predict market trends and opportunities


## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager

### Installation & Startup

1. **Navigate to the langchain directory:**
   ```bash
   cd typescript/examples/langchain
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the WebSocket agent:**
   ```bash
   npm run start:websocket
   ```

The agent will start and be ready to accept WebSocket connections for real-time DeFi analysis and recommendations.
---

## 📄 License

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

### Attribution:
When using this project, please provide appropriate credit and link to this repository.

---

*Built to democratize access to DeFi on Hedera Hashgraph* 🌐 