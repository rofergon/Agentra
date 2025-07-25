const WebSocket = require('ws');

// Cliente de prueba para el WebSocket Agent
class TestClient {
  constructor(url = 'ws://localhost:8080') {
    this.ws = new WebSocket(url);
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.ws.on('open', () => {
      console.log('🔗 Conectado al Hedera WebSocket Agent');
      this.showMenu();
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });

    this.ws.on('close', () => {
      console.log('🔌 Conexión cerrada');
      process.exit(0);
    });

    this.ws.on('error', (error) => {
      console.error('❌ Error de conexión:', error.message);
      process.exit(1);
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'SYSTEM_MESSAGE':
        console.log(`\n🔔 Sistema [${message.level}]: ${message.message}\n`);
        break;
      
      case 'AGENT_RESPONSE':
        console.log(`\n🤖 Agente: ${message.message}`);
        if (message.hasTransaction) {
          console.log('💰 Esta respuesta incluye una transacción para firmar...');
        }
        console.log('');
        break;
      
      case 'TRANSACTION_TO_SIGN':
        console.log(`\n🔏 Transacción recibida para firmar:`);
        console.log(`📝 Consulta original: ${message.originalQuery}`);
        console.log(`📊 Bytes de transacción: ${message.transactionBytes.length} bytes`);
        console.log(`🔗 Bytes (hex): ${Buffer.from(message.transactionBytes).toString('hex').substring(0, 100)}...`);
        
        // Simular firma y ejecución exitosa
        setTimeout(() => {
          this.simulateTransactionSuccess();
        }, 2000);
        break;
      
      default:
        console.log('⚠️  Mensaje desconocido:', message);
    }
    
    this.showMenu();
  }

  simulateTransactionSuccess() {
    console.log('\n🔄 Simulando firma y ejecución de transacción...');
    
    const result = {
      type: 'TRANSACTION_RESULT',
      success: true,
      transactionId: '0.0.5864846@1234567890.123456789',
      status: 'SUCCESS',
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(result));
    console.log('✅ Resultado de transacción enviado');
  }

  sendUserMessage(message) {
    const userMessage = {
      type: 'USER_MESSAGE',
      message: message,
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(userMessage));
    console.log(`\n👤 Tú: ${message}`);
    console.log('⏳ Esperando respuesta del agente...\n');
  }

  showMenu() {
    console.log('────────────────────────────────────');
    console.log('💬 Comandos disponibles:');
    console.log('1. balance - Consultar balance de HBAR');
    console.log('2. create token - Crear un token fungible');
    console.log('3. create topic - Crear un tema de consenso');
    console.log('4. exit - Salir');
    console.log('O escribe cualquier mensaje para el agente...');
    console.log('────────────────────────────────────');
  }

  start() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    rl.on('line', (input) => {
      const message = input.trim();
      
      if (message.toLowerCase() === 'exit') {
        console.log('👋 ¡Hasta luego!');
        this.ws.close();
        rl.close();
        return;
      }
      
      if (message) {
        // Mapear comandos rápidos
        const quickCommands = {
          'balance': '¿Cuál es mi balance de HBAR?',
          'create token': 'Crea un token fungible llamado "MiToken" con símbolo "MTK"',
          'create topic': 'Crea un nuevo tema de consenso para mensajes'
        };

        const finalMessage = quickCommands[message.toLowerCase()] || message;
        this.sendUserMessage(finalMessage);
      }
      
      setTimeout(() => rl.prompt(), 100);
    });

    rl.on('close', () => {
      console.log('\n👋 Cliente cerrado');
      process.exit(0);
    });

    rl.prompt();
  }
}

// Ejecutar el cliente de prueba
console.log('🚀 Iniciando cliente de prueba WebSocket...');
console.log('📡 Conectando a ws://localhost:8080...\n');

const client = new TestClient();

// Esperar a que se conecte antes de mostrar el prompt
setTimeout(() => {
  client.start();
}, 1000); 