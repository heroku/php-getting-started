# @pixelcoda/llm-adapter

Provider-agnostic LLM adapter for embeddings, text generation, and re-ranking.

## 🚀 Features

- **Multi-Provider Support**: OpenAI, Azure OpenAI, Ollama, Hugging Face
- **Automatic Provider Detection**: Based on environment variables
- **Fallback Handling**: Graceful degradation to stub implementations
- **TypeScript Support**: Full type safety and IntelliSense
- **Configurable Timeouts**: Per-provider timeout and retry settings
- **Development Mode**: Deterministic stubs for testing

## 📦 Installation

```bash
yarn add @pixelcoda/llm-adapter
```

## ⚙️ Configuration

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini                    # Optional, default: gpt-4o-mini
export OPENAI_EMBEDDING_MODEL=text-embedding-3-small # Optional, default: text-embedding-3-small
```

### Azure OpenAI

```bash
export AZURE_OPENAI_API_KEY=your-key
export AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
export AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4         # Optional, default: gpt-4
export AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002 # Optional
```

### Ollama (Local)

```bash
export OLLAMA_BASE_URL=http://localhost:11434     # Optional, default: http://localhost:11434
export OLLAMA_MODEL=llama3.1                      # Optional, default: llama3.1
export OLLAMA_EMBEDDING_MODEL=nomic-embed-text    # Optional, default: nomic-embed-text
```

### Hugging Face

```bash
export HUGGINGFACE_API_KEY=hf_...
export HUGGINGFACE_MODEL=microsoft/DialoGPT-large # Optional
export HUGGINGFACE_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2 # Optional
```

## 🔧 Usage

### Basic Usage

```typescript
import { embed, generateAnswer, rerank } from '@pixelcoda/llm-adapter';

// Generate embeddings
const embedding = await embed('Hello world');
console.log(embedding); // number[]

// Generate answers
const answer = await generateAnswer('What is the capital of France?');
console.log(answer); // "Paris is the capital of France..."

// Re-rank passages
const passages = [
  { text: 'Paris is a city in France.' },
  { text: 'London is a city in England.' }
];
const ranked = await rerank('French cities', passages);
console.log(ranked); // Reordered by relevance
```

### Configuration Utilities

```typescript
import { getProviderInfo, validateConfiguration } from '@pixelcoda/llm-adapter';

// Check current provider
const info = getProviderInfo();
console.log(info);
// {
//   provider: 'openai',
//   hasApiKey: true,
//   models: {
//     text: 'gpt-4o-mini',
//     embedding: 'text-embedding-3-small'
//   }
// }

// Validate configuration
const validation = validateConfiguration();
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

## 🎯 Provider Selection

The adapter automatically selects a provider based on available environment variables:

1. **OpenAI**: If `OPENAI_API_KEY` is set
2. **Azure OpenAI**: If `AZURE_OPENAI_API_KEY` is set
3. **Ollama**: If `OLLAMA_BASE_URL` is set
4. **Hugging Face**: If `HUGGINGFACE_API_KEY` is set
5. **Stub**: Fallback for development (deterministic pseudo-vectors)

## 🔧 Advanced Configuration

### Custom Timeouts

```bash
# Provider-specific timeouts (milliseconds)
export LLM_TIMEOUT=30000           # Default: 30s for cloud providers
export LLM_OLLAMA_TIMEOUT=60000    # Default: 60s for local models
export LLM_MAX_RETRIES=3           # Default: 3 retries
```

### Model Selection

```bash
# OpenAI Models
export OPENAI_MODEL=gpt-4o                        # For better quality
export OPENAI_EMBEDDING_MODEL=text-embedding-3-large # For better embeddings

# Azure Models (use deployment names)
export AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4-turbo
export AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002

# Ollama Models (must be pulled first)
export OLLAMA_MODEL=llama3.1:70b                  # Larger model
export OLLAMA_EMBEDDING_MODEL=mxbai-embed-large   # Better embeddings

# Hugging Face Models
export HUGGINGFACE_MODEL=microsoft/DialoGPT-large
export HUGGINGFACE_EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2
```

## 🚨 Error Handling

The adapter includes graceful error handling:

- **Network Errors**: Automatic retries with exponential backoff
- **Rate Limits**: Respects provider rate limits
- **Invalid Responses**: Falls back to stub implementations
- **Configuration Errors**: Clear error messages

```typescript
try {
  const embedding = await embed('text');
} catch (error) {
  // Will automatically fall back to stub implementation
  console.warn('Embedding failed, using fallback');
}
```

## 🧪 Development Mode

Without any provider configuration, the adapter runs in development mode:

- **Deterministic Embeddings**: Same text always produces same vector
- **Template Responses**: Structured stub responses for testing
- **No External Calls**: Works offline for development

```typescript
// Development mode (no API keys set)
const embedding = await embed('test');
// Returns deterministic 384-dimensional vector

const answer = await generateAnswer('What is AI?');
// Returns: "Antwort (Entwicklungsmodus): Basierend auf Ihren Informationen..."
```

## 📊 Provider Comparison

| Provider | Embeddings | Text Generation | Re-ranking | Cost | Speed |
|----------|------------|-----------------|------------|------|-------|
| OpenAI | ✅ Excellent | ✅ Excellent | ✅ Good | $$$ | Fast |
| Azure OpenAI | ✅ Excellent | ✅ Excellent | ✅ Good | $$$ | Fast |
| Ollama | ✅ Good | ✅ Good | ✅ Basic | Free | Slow |
| Hugging Face | ✅ Good | ✅ Variable | ❌ No | $ | Medium |
| Stub | ✅ Deterministic | ✅ Template | ✅ Lexical | Free | Instant |

## 🔒 Security

- **API Keys**: Never logged or exposed in error messages
- **Request Sanitization**: Input length limits and validation
- **Timeout Protection**: Prevents hanging requests
- **Error Sanitization**: No sensitive data in error responses

## 🎛️ Environment Variables Reference

| Variable | Provider | Required | Default | Description |
|----------|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | OpenAI | Yes | - | OpenAI API key |
| `OPENAI_MODEL` | OpenAI | No | `gpt-4o-mini` | Text generation model |
| `OPENAI_EMBEDDING_MODEL` | OpenAI | No | `text-embedding-3-small` | Embedding model |
| `AZURE_OPENAI_API_KEY` | Azure | Yes | - | Azure OpenAI key |
| `AZURE_OPENAI_ENDPOINT` | Azure | Yes | - | Azure endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Azure | No | `gpt-4` | Deployment name |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | Azure | No | `text-embedding-ada-002` | Embedding deployment |
| `OLLAMA_BASE_URL` | Ollama | No | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | Ollama | No | `llama3.1` | Text generation model |
| `OLLAMA_EMBEDDING_MODEL` | Ollama | No | `nomic-embed-text` | Embedding model |
| `HUGGINGFACE_API_KEY` | HF | Yes | - | Hugging Face API key |
| `HUGGINGFACE_MODEL` | HF | No | `microsoft/DialoGPT-large` | Text model |
| `HUGGINGFACE_EMBEDDING_MODEL` | HF | No | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new providers
4. Submit a pull request

## 🆘 Support

For issues and questions:
- GitHub Issues: [Report bugs](https://github.com/CasianBlanaru/typo3-search/issues)
- Documentation: [Full API docs](https://github.com/CasianBlanaru/typo3-search/wiki)

---

Built with ❤️ by [pixelcoda](https://pixelcoda.com)
