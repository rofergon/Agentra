# 🚀 Hedera WebSocket Agent - Railway Deployment

Este repositorio contiene un agente WebSocket para Hedera que se puede desplegar fácilmente en Railway.

## 📋 Pre-requisitos

- Cuenta en [Railway](https://railway.app)
- API Key de OpenAI
- (Opcional) Cuenta de Hedera Testnet

## 🚂 Despliegue en Railway

### Opción 1: Deploy Button (Más Fácil)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Opción 2: Desde GitHub
1. Ve a [Railway](https://railway.app)
2. Crea nuevo proyecto → **Deploy from GitHub repo**
3. Selecciona este repositorio
4. **NO** especifiques Root Directory (déjalo vacío)

## ⚙️ Variables de Entorno Requeridas

En Railway Dashboard → Variables, agrega:

```env
OPENAI_API_KEY=tu_clave_openai_aquí
PORT=8080
NODE_ENV=production
```

### Variables Opcionales:
```env
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.12345
HEDERA_PRIVATE_KEY=tu_private_key
```

## 🔧 Configuración Automática

Railway detecta automáticamente:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Port**: `8080`

## 🌐 Endpoints

Una vez desplegado:
- **Health Check**: `https://tu-app.railway.app/health`
- **WebSocket**: `wss://tu-app.railway.app`

## 🐛 Debugging

Para ver logs:
```bash
railway logs
```

Para desarrollo local:
```bash
npm run dev
```

## 📁 Estructura del Proyecto

```
/
├── package.json (configuración principal)
├── railway.json (configuración de Railway)
├── typescript/
│   ├── src/shared/ (código compartido)
│   └── examples/langchain/
│       └── websocket-agent.ts (agente principal)
```

## 🔗 URLs Útiles

- [Railway Docs](https://docs.railway.app)
- [Hedera Docs](https://docs.hedera.com)
- [WebSocket API Documentation](./typescript/examples/langchain/README-WEBSOCKET.md)