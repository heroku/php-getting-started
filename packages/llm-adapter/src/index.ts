import 'dotenv/config';
import { OpenAI } from 'openai';
import { request } from 'undici';

// Provider configuration
interface ProviderConfig {
  provider: 'openai' | 'azure' | 'ollama' | 'huggingface' | 'stub';
  apiKey?: string;
  baseURL?: string;
  model?: string;
  embeddingModel?: string;
  maxRetries?: number;
  timeout?: number;
}

// Default configuration from environment
const getConfig = (): ProviderConfig => {
  // Detect provider based on environment variables
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      maxRetries: 3,
      timeout: 30000
    };
  }
  
  if (process.env.AZURE_OPENAI_API_KEY) {
    return {
      provider: 'azure',
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: process.env.AZURE_OPENAI_ENDPOINT,
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
      embeddingModel: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002',
      maxRetries: 3,
      timeout: 30000
    };
  }
  
  if (process.env.OLLAMA_BASE_URL) {
    return {
      provider: 'ollama',
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3.1',
      embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
      timeout: 60000
    };
  }
  
  if (process.env.HUGGINGFACE_API_KEY) {
    return {
      provider: 'huggingface',
      apiKey: process.env.HUGGINGFACE_API_KEY,
      baseURL: 'https://api-inference.huggingface.co',
      model: process.env.HUGGINGFACE_MODEL || 'microsoft/DialoGPT-large',
      embeddingModel: process.env.HUGGINGFACE_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
      maxRetries: 3,
      timeout: 30000
    };
  }
  
  // Default to stub for development
  return {
    provider: 'stub',
    maxRetries: 1,
    timeout: 1000
  };
};

// Cached clients
let openaiClient: OpenAI | null = null;
let azureClient: OpenAI | null = null;

/**
 * Generate embeddings for text
 */
export async function embed(text: string): Promise<number[]> {
  const config = getConfig();
  
  try {
    switch (config.provider) {
      case 'openai':
        return await embedOpenAI(text, config);
      case 'azure':
        return await embedAzure(text, config);
      case 'ollama':
        return await embedOllama(text, config);
      case 'huggingface':
        return await embedHuggingFace(text, config);
      default:
        return embedStub(text);
    }
  } catch (error) {
    console.error(`Embedding failed with ${config.provider}:`, error);
    // Fallback to stub in case of errors
    return embedStub(text);
  }
}

/**
 * Generate answer using LLM with PII redaction
 */
export async function generateAnswer(prompt: string, options: {
  redactPII?: boolean;
  auditLog?: boolean;
  maxTokens?: number;
  temperature?: number;
} = {}): Promise<string> {
  const config = getConfig();
  const { redactPII = true, auditLog = true, maxTokens = 1000, temperature = 0.7 } = options;
  
  // PII Redaction pre-processing
  let processedPrompt = prompt;
  let redactedEntities: string[] = [];
  
  if (redactPII) {
    const redactionResult = redactPersonalData(prompt);
    processedPrompt = redactionResult.redactedText;
    redactedEntities = redactionResult.entities;
  }
  
  // Audit logging
  if (auditLog) {
    await logLLMRequest({
      provider: config.provider,
      promptLength: processedPrompt.length,
      redactedEntities,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    let answer: string;
    
    switch (config.provider) {
      case 'openai':
        answer = await generateOpenAI(processedPrompt, config, { maxTokens, temperature });
      case 'azure':
        answer = await generateAzure(processedPrompt, config, { maxTokens, temperature });
      case 'ollama':
        answer = await generateOllama(processedPrompt, config, { maxTokens, temperature });
      case 'huggingface':
        answer = await generateHuggingFace(processedPrompt, config, { maxTokens, temperature });
      default:
        answer = generateStub(processedPrompt);
    }
    
    // Post-process answer to restore any redacted entities if needed
    return restoreRedactedEntities(answer, redactedEntities);
    
  } catch (error) {
    console.error(`Answer generation failed with ${config.provider}:`, error);
    
    // Audit log the error
    if (auditLog) {
      await logLLMError({
        provider: config.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
    
    // Fallback to stub in case of errors
    return generateStub(processedPrompt);
  }
}

/**
 * Re-rank passages based on query relevance
 */
export async function rerank(query: string, passages: {text: string}[]): Promise<{text: string}[]> {
  const config = getConfig();
  
  try {
    switch (config.provider) {
      case 'openai':
      case 'azure':
        return await rerankWithLLM(query, passages, config);
      case 'ollama':
        return await rerankOllama(query, passages, config);
      default:
        return rerankStub(passages);
    }
  } catch (error) {
    console.error(`Re-ranking failed with ${config.provider}:`, error);
    // Fallback to original order
    return passages;
  }
}

// OpenAI Implementation
async function embedOpenAI(text: string, config: ProviderConfig): Promise<number[]> {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries,
      timeout: config.timeout
    });
  }
  
  const response = await openaiClient.embeddings.create({
    model: config.embeddingModel!,
    input: text.substring(0, 8000), // Limit input length
    encoding_format: 'float'
  });
  
  return response.data[0].embedding;
}

async function generateOpenAI(prompt: string, config: ProviderConfig, options: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries,
      timeout: config.timeout
    });
  }
  
  const response = await openaiClient.chat.completions.create({
    model: config.model!,
    messages: [
      {
        role: 'system',
        content: 'Du bist ein hilfsreicher Assistent, der präzise und sachliche Antworten basierend auf bereitgestellten Informationen gibt.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 1000,
    temperature: 0.7
  });
  
  return response.choices[0]?.message?.content || 'Keine Antwort generiert.';
}

// Azure OpenAI Implementation
async function embedAzure(text: string, config: ProviderConfig): Promise<number[]> {
  if (!azureClient) {
    azureClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      maxRetries: config.maxRetries,
      timeout: config.timeout,
      defaultQuery: { 'api-version': '2024-02-01' }
    });
  }
  
  const response = await azureClient.embeddings.create({
    model: config.embeddingModel!,
    input: text.substring(0, 8000),
    encoding_format: 'float'
  });
  
  return response.data[0].embedding;
}

async function generateAzure(prompt: string, config: ProviderConfig): Promise<string> {
  if (!azureClient) {
    azureClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      maxRetries: config.maxRetries,
      timeout: config.timeout,
      defaultQuery: { 'api-version': '2024-02-01' }
    });
  }
  
  const response = await azureClient.chat.completions.create({
    model: config.model!,
    messages: [
      {
        role: 'system',
        content: 'Du bist ein hilfsreicher Assistent, der präzise und sachliche Antworten basierend auf bereitgestellten Informationen gibt.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 1000,
    temperature: 0.7
  });
  
  return response.choices[0]?.message?.content || 'Keine Antwort generiert.';
}

// Ollama Implementation
async function embedOllama(text: string, config: ProviderConfig): Promise<number[]> {
  const response = await request(`${config.baseURL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.embeddingModel,
      prompt: text.substring(0, 8000)
    })
  });
  
  if (response.statusCode !== 200) {
    throw new Error(`Ollama embedding failed: ${response.statusCode}`);
  }
  
  const data = await response.body.json() as any;
  return data.embedding;
}

async function generateOllama(prompt: string, config: ProviderConfig): Promise<string> {
  const response = await request(`${config.baseURL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 1000
      }
    })
  });
  
  if (response.statusCode !== 200) {
    throw new Error(`Ollama generation failed: ${response.statusCode}`);
  }
  
  const data = await response.body.json() as any;
  return data.response || 'Keine Antwort generiert.';
}

async function rerankOllama(query: string, passages: {text: string}[], config: ProviderConfig): Promise<{text: string}[]> {
  // Simple relevance scoring with Ollama
  const scored = await Promise.all(passages.map(async (passage, index) => {
    try {
      const prompt = `Bewerte die Relevanz des folgenden Textes für die Frage "${query}" auf einer Skala von 0-10. Antworte nur mit einer Zahl.

Text: ${passage.text.substring(0, 500)}`;

      const response = await request(`${config.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt,
          stream: false,
          options: { temperature: 0.1, num_predict: 10 }
        })
      });
      
      if (response.statusCode === 200) {
        const data = await response.body.json() as any;
        const score = parseFloat(data.response.trim()) || 0;
        return { passage, score, originalIndex: index };
      }
    } catch (error) {
      console.warn(`Re-ranking failed for passage ${index}:`, error);
    }
    
    return { passage, score: 5, originalIndex: index }; // Default score
  }));
  
  // Sort by score descending, then by original index for stability
  return scored
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
    .map(item => item.passage);
}

// Hugging Face Implementation
async function embedHuggingFace(text: string, config: ProviderConfig): Promise<number[]> {
  const response = await request(`${config.baseURL}/models/${config.embeddingModel}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: text.substring(0, 8000)
    })
  });
  
  if (response.statusCode !== 200) {
    throw new Error(`Hugging Face embedding failed: ${response.statusCode}`);
  }
  
  const data = await response.body.json() as any;
  
  // Handle different response formats
  if (Array.isArray(data) && data[0] && Array.isArray(data[0])) {
    return data[0];
  } else if (Array.isArray(data)) {
    return data;
  } else {
    throw new Error('Unexpected Hugging Face response format');
  }
}

async function generateHuggingFace(prompt: string, config: ProviderConfig): Promise<string> {
  const response = await request(`${config.baseURL}/models/${config.model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_length: 1000,
        temperature: 0.7,
        do_sample: true
      }
    })
  });
  
  if (response.statusCode !== 200) {
    throw new Error(`Hugging Face generation failed: ${response.statusCode}`);
  }
  
  const data = await response.body.json() as any;
  
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text;
  } else if (data.generated_text) {
    return data.generated_text;
  } else {
    throw new Error('Unexpected Hugging Face response format');
  }
}

// LLM-based re-ranking
async function rerankWithLLM(query: string, passages: {text: string}[], config: ProviderConfig): Promise<{text: string}[]> {
  if (passages.length <= 1) return passages;
  
  // For large numbers of passages, use a simpler approach
  if (passages.length > 10) {
    return rerankStub(passages);
  }
  
  const client = config.provider === 'azure' ? azureClient : openaiClient;
  if (!client) return passages;
  
  try {
    const passageTexts = passages.map((p, i) => `${i}: ${p.text.substring(0, 200)}...`).join('\n\n');
    
    const prompt = `Sortiere die folgenden Textpassagen nach ihrer Relevanz für die Frage "${query}". 
Antworte nur mit den Nummern in der Reihenfolge der Relevanz (höchste zuerst), getrennt durch Kommas.

Passagen:
${passageTexts}

Reihenfolge:`;

    const response = await client.chat.completions.create({
      model: config.model!,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.1
    });
    
    const orderText = response.choices[0]?.message?.content?.trim();
    if (orderText) {
      const indices = orderText.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0 && n < passages.length);
      if (indices.length > 0) {
        const reordered = indices.map(i => passages[i]).filter(Boolean);
        // Add any missing passages at the end
        const used = new Set(indices);
        const remaining = passages.filter((_, i) => !used.has(i));
        return [...reordered, ...remaining];
      }
    }
  } catch (error) {
    console.warn('LLM re-ranking failed:', error);
  }
  
  return passages;
}

// Stub implementations for development
function embedStub(text: string): number[] {
  // Generate deterministic pseudo-vector based on text content
  const dimension = 384; // Common embedding dimension
  const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return Array.from({ length: dimension }, (_, i) => {
    const value = Math.sin((seed + i) * 0.123) * Math.cos((seed + i) * 0.456);
    return Math.round(value * 1000) / 1000; // Round to 3 decimals
  });
}

function generateStub(prompt: string): string {
  const keywords = extractKeywords(prompt);
  return `Antwort (Entwicklungsmodus): Basierend auf Ihren Informationen zu "${keywords.join(', ')}" kann ich folgende Punkte hervorheben: ${prompt.slice(0, 200)}... (Dies ist eine Stub-Antwort für die Entwicklung. Konfigurieren Sie einen echten LLM-Provider für Produktionsumgebungen.)`;
}

function rerankStub(passages: {text: string}[]): {text: string}[] {
  // Simple lexical similarity-based reranking
  return [...passages].sort((a, b) => {
    const aWords = new Set(a.text.toLowerCase().split(/\s+/));
    const bWords = new Set(b.text.toLowerCase().split(/\s+/));
    const aScore = aWords.size;
    const bScore = bWords.size;
    return bScore - aScore; // Longer texts first as a simple heuristic
  });
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const stopWords = new Set(['der', 'die', 'das', 'und', 'oder', 'aber', 'in', 'auf', 'mit', 'zu', 'von', 'für', 'ist', 'sind', 'war', 'waren', 'haben', 'hat', 'wird', 'werden', 'kann', 'könnte', 'sollte', 'muss']);
  return words
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5);
}

// Export configuration utilities
export function getProviderInfo(): { provider: string; hasApiKey: boolean; models: { text?: string; embedding?: string } } {
  const config = getConfig();
  return {
    provider: config.provider,
    hasApiKey: !!config.apiKey,
    models: {
      text: config.model,
      embedding: config.embeddingModel
    }
  };
}

export function validateConfiguration(): { valid: boolean; errors: string[] } {
  const config = getConfig();
  const errors: string[] = [];
  
  if (config.provider === 'stub') {
    errors.push('No LLM provider configured. Set environment variables for OpenAI, Azure, Ollama, or Hugging Face.');
  }
  
  if (config.provider === 'openai' && !config.apiKey) {
    errors.push('OPENAI_API_KEY is required for OpenAI provider');
  }
  
  if (config.provider === 'azure' && (!config.apiKey || !config.baseURL)) {
    errors.push('AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are required for Azure provider');
  }
  
  if (config.provider === 'huggingface' && !config.apiKey) {
    errors.push('HUGGINGFACE_API_KEY is required for Hugging Face provider');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}