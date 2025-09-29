// Standalone LLM Adapter - simplified version without workspace dependencies
import { OpenAI } from 'openai';

// Simple configuration
const getConfig = () => {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai' as const,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
    };
  }
  
  return { provider: 'stub' as const };
};

let openaiClient: OpenAI | null = null;

export async function embed(text: string): Promise<number[]> {
  const config = getConfig();
  
  if (config.provider === 'openai') {
    try {
      if (!openaiClient) {
        openaiClient = new OpenAI({ apiKey: config.apiKey });
      }
      
      const response = await openaiClient.embeddings.create({
        model: config.embeddingModel!,
        input: text.substring(0, 8000),
        encoding_format: 'float'
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.warn('OpenAI embedding failed, using stub:', error);
    }
  }
  
  // Stub implementation
  const dimension = 384;
  const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return Array.from({ length: dimension }, (_, i) => {
    const value = Math.sin((seed + i) * 0.123) * Math.cos((seed + i) * 0.456);
    return Math.round(value * 1000) / 1000;
  });
}

export async function generateAnswer(prompt: string): Promise<string> {
  const config = getConfig();
  
  if (config.provider === 'openai') {
    try {
      if (!openaiClient) {
        openaiClient = new OpenAI({ apiKey: config.apiKey });
      }
      
      const response = await openaiClient.chat.completions.create({
        model: config.model!,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides precise and factual answers based on provided information.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });
      
      return response.choices[0]?.message?.content || 'No answer generated.';
    } catch (error) {
      console.warn('OpenAI generation failed, using stub:', error);
    }
  }
  
  // Stub implementation
  const keywords = prompt.toLowerCase().match(/\b\w+\b/g)?.slice(0, 3) || ['search'];
  return `Answer (development mode): Based on the information about "${keywords.join(', ')}", I can provide the following insights: ${prompt.slice(0, 200)}... (This is a stub response for development. Configure a real LLM provider for production.)`;
}

export async function rerank(query: string, passages: {text: string}[]): Promise<{text: string}[]> {
  // Simple lexical similarity reranking
  return [...passages].sort((a, b) => {
    const aWords = new Set(a.text.toLowerCase().split(/\s+/));
    const bWords = new Set(b.text.toLowerCase().split(/\s+/));
    const aScore = aWords.size;
    const bScore = bWords.size;
    return bScore - aScore;
  });
}
