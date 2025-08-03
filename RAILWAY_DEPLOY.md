# 🚀 Hedera WebSocket Agent - Railway Deployment

This repository contains a Hedera WebSocket agent that can be easily deployed on Railway.

## 📋 Prerequisites

- Railway account at [Railway](https://railway.app)
- OpenAI API Key
- (Optional) Hedera Testnet account

## 🚂 Railway Deployment

### Option 1: Deploy Button (Easiest)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Option 2: From GitHub
1. Go to [Railway](https://railway.app)
2. Create new project → **Deploy from GitHub repo**
3. Select this repository
4. **DO NOT** specify Root Directory (leave it empty)

## ⚙️ Required Environment Variables

In Railway Dashboard → Variables, add:

```env
OPENAI_API_KEY=your_openai_key_here
PORT=8080
NODE_ENV=production
```

### Optional Variables:
```env
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.12345
HEDERA_PRIVATE_KEY=your_private_key
```

## 🔧 Automatic Configuration

Railway automatically detects:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Port**: `8080`

## 🌐 Endpoints

Once deployed:
- **Health Check**: `https://tu-app.railway.app/health`
- **WebSocket**: `wss://tu-app.railway.app`

## 🐛 Debugging

To view logs:
```bash
railway logs
```

For local development:
```bash
npm run dev
```

## 📁 Project Structure

```
/
├── package.json (main configuration)
├── railway.json (Railway configuration)
├── typescript/
│   ├── src/shared/ (shared code)
│   └── examples/langchain/
│       └── websocket-agent.ts (main agent)
```

## 🔗 Useful URLs

- [Railway Docs](https://docs.railway.app)
- [Hedera Docs](https://docs.hedera.com)
- [WebSocket API Documentation](./typescript/examples/langchain/README-WEBSOCKET.md)