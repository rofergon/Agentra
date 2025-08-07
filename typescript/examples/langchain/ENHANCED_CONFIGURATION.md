# Enhanced Agent Configuration

This document describes the enhanced configuration options available for the Hedera WebSocket Agent to increase context and memory tokens.

## Environment Variables

### LLM Configuration

Configure these environment variables to control the LLM behavior:

- **`LLM_MAX_TOKENS`** (default: `8192`): Maximum number of tokens the LLM can generate in a single response
- **`LLM_TEMPERATURE`** (default: `0.7`): Controls randomness in the LLM responses (0.0 = deterministic, 1.0 = very random)
- **`LLM_MODEL`** (default: `gpt-4o-mini`): The OpenAI model to use

### Memory Configuration

Configure these environment variables to control memory management:

- **`MEMORY_MAX_TOKEN_LIMIT`** (default: `4000`): Maximum tokens stored in conversation memory
- **`MEMORY_RETURN_MAX_TOKENS`** (default: `2000`): Maximum tokens returned from memory in responses

### Debug Configuration

- **`FORCE_CLEAR_MEMORY`** (default: `false`): If set to `true`, clears memory on every message (useful for debugging)

## Example Configuration

Create a `.env` file in your project root with the following configuration for extended context:

```bash
# Extended LLM Configuration
LLM_MAX_TOKENS=16384
LLM_TEMPERATURE=0.7
LLM_MODEL=gpt-4o

# Enhanced Memory Configuration
MEMORY_MAX_TOKEN_LIMIT=8000
MEMORY_RETURN_MAX_TOKENS=4000

# Network Configuration
HEDERA_NETWORK=mainnet

# Debug Mode (set to true for development)
FORCE_CLEAR_MEMORY=false
```

## Configuration Impact

### Higher Token Limits

**Benefits:**
- Longer, more detailed responses
- Better context retention in conversations
- Ability to handle complex multi-step operations

**Considerations:**
- Higher API costs (more tokens = higher cost)
- Increased processing time
- Higher memory usage

### Memory Token Management

**Benefits:**
- Better conversation flow
- Contextual awareness across messages
- Improved user experience

**Configuration Guidelines:**
- `MEMORY_MAX_TOKEN_LIMIT` should be less than your model's context window
- `MEMORY_RETURN_MAX_TOKENS` should be less than `MEMORY_MAX_TOKEN_LIMIT`
- For production, consider cost implications of higher limits

## Usage Examples

### Development Environment (Extended Context)
```bash
LLM_MAX_TOKENS=16384
MEMORY_MAX_TOKEN_LIMIT=8000
MEMORY_RETURN_MAX_TOKENS=4000
```

### Production Environment (Balanced)
```bash
LLM_MAX_TOKENS=8192
MEMORY_MAX_TOKEN_LIMIT=4000
MEMORY_RETURN_MAX_TOKENS=2000
```

### Cost-Optimized Environment
```bash
LLM_MAX_TOKENS=4096
MEMORY_MAX_TOKEN_LIMIT=2000
MEMORY_RETURN_MAX_TOKENS=1000
```

## Monitoring and Debugging

The agent will log the active configuration on startup:

```
🤖 Enhanced LLM Configuration:
   - Model: gpt-4o-mini
   - Max Tokens: 8192
   - Temperature: 0.7

🧠 Enhanced Memory Configuration:
   - Max Token Limit: 4000
   - Return Max Tokens: 2000
```

This helps you verify that your environment variables are being read correctly.

## Best Practices

1. **Start Conservative**: Begin with default values and increase gradually based on needs
2. **Monitor Costs**: Higher token limits increase API costs significantly
3. **Test Thoroughly**: Test your configuration with realistic workloads
4. **Environment-Specific**: Use different configurations for development, staging, and production
5. **Monitor Performance**: Higher token limits may increase response times

## Troubleshooting

### Common Issues

**Agent responses are truncated:**
- Increase `LLM_MAX_TOKENS`

**Agent doesn't remember previous conversations:**
- Increase `MEMORY_MAX_TOKEN_LIMIT`
- Ensure `FORCE_CLEAR_MEMORY` is set to `false`

**High API costs:**
- Reduce `LLM_MAX_TOKENS`
- Reduce `MEMORY_MAX_TOKEN_LIMIT`

**Slow responses:**
- Consider reducing token limits
- Check your network connection to OpenAI API

## Migration from Previous Version

If you're upgrading from a previous version without these environment variables, the agent will use sensible defaults. No configuration changes are required, but you can now optimize for your specific use case.