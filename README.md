# Hedera DeFi AI Agent 🚀

## 📋 Project Description

An artificial intelligence agent specialized in the Hedera Hashgraph DeFi ecosystem that helps both novice and experienced users navigate and optimize their investments through integrated SaucerSwap DEX operations, Bonzo Finance lending protocols, and advanced AutoSwapLimit trading strategies. The agent provides real-time analysis and automated execution capabilities.



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
- **Automated analysis**: Continuous monitoring of SaucerSwap, Bonzo Finance, and AutoSwapLimit
- **Personalized recommendations**: Suggestions based on the user's risk profile and objectives
- **Conversational interface**: Natural interaction via WebSocket for real-time queries
- **Persistent context**: Conversation memory that maintains session context

### 📊 Real-Time Multi-Protocol Analysis

#### Integration with APIs and Smart Contracts:
- **REST APIs**: Direct connection to platform data endpoints
- **Smart contracts**: Native interaction with on-chain protocols
- **Intelligent rate limiting**: Optimized request management to avoid limitations
- **Smart cache**: 30-second cache system to optimize performance

### 🏦 Integrated DeFi Platforms

#### 🥇 SaucerSwap
- **Type**: DEX with AMM (Automated Market Maker)
- **Features**: 
  - Token swap quotes and execution
  - Real-time price discovery
  - Single-sided staking (Infinity Pools)
  - Liquidity analysis
  - Advanced trading with AutoSwapLimit orders
- **Dominance**: +44% of total Hedera DeFi TVL and +60% of unique active wallets

#### 💰 Bonzo Finance
- **Type**: Lending & borrowing protocol (Aave V2 fork)
- **Features**:
  - Supply assets to earn interest
  - Real-time lending rates monitoring
  - Portfolio analysis and optimization
  - Risk assessment tools
- **TVL**: Steady growth post-launch (~$25M in Q4 2024, later ~$38M)

#### 🎯 AutoSwapLimit (SaucerSwap Integration)
- **Type**: Advanced limit order system
- **Features**:
  - Automated limit orders execution
  - Price monitoring and alerts
  - Order management and cancellation
  - Strategic trading automation

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
- "What are the best yield opportunities on SaucerSwap?"
- "How does lending work on Bonzo Finance?"
- "What are limit orders and how can I use them?"

### For Experienced Users:
- "Show me the best APYs between SaucerSwap and Bonzo Finance"
- "Set up automated limit orders for my trading strategy"
- "Analyze my current positions across SaucerSwap and Bonzo"

## 🚀 Key Benefits

- **⏱️ Time Savings**: Automated analysis instead of manual research
- **📈 Maximized Yields**: Identification of the best opportunities
- **🛡️ Risk Reduction**: Comparative analysis of protocols and strategies
- **🎓 Continuous Education**: Learn about DeFi through natural interactions
- **🔐 Security**: Does not custody funds, only provides analysis and recommendations

## 🔜 Future Roadmap

- **Enhanced SaucerSwap features**: Advanced liquidity pool analytics and farming optimization
- **Expanded Bonzo Finance tools**: Liquidation monitoring and advanced lending strategies  
- **AutoSwapLimit improvements**: More sophisticated order types and execution algorithms
- **Smart alerts**: Automatic notifications about yield opportunities and price targets
- **Web dashboard**: Graphical interface complementing the conversational agent
- **Integration of additional protocols**: HeliSwap, Stader Labs, and other emerging Hedera DeFi protocols


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