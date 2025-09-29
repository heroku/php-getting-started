// API Client for pixelcoda Search Platform
export interface SearchParams {
  q: string;
  filters?: Record<string, any>;
  facets?: string[];
  page?: number;
  limit?: number;
  lang?: string;
  collections?: string[];
}

export interface SearchResult {
  hits: {
    hits: SearchHit[];
    estimatedTotalHits: number;
    processingTimeMs: number;
    query: string;
    page: number;
    hitsPerPage: number;
  };
  meta: {
    query: string;
    page: number;
    limit: number;
    response_time_ms: number;
    collections?: string[];
  };
}

export interface SearchHit {
  id: string;
  title?: string;
  content?: string;
  summary?: string;
  url?: string;
  collection?: string;
  _score?: number;
  _formatted?: Record<string, any>;
}

export interface AskParams {
  q: string;
  lang?: string;
  collections?: string[];
  maxPassages?: number;
  temperature?: number;
  includeDebug?: boolean;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  meta: {
    query: string;
    language: string;
    passages_found: number;
    passages_used: number;
    response_time_ms: number;
    collections: string[];
    search_method: 'vector' | 'keyword';
  };
  debug?: {
    search_method: 'vector' | 'keyword';
    passages_extracted: number;
    reranking_enabled: boolean;
    vector_search_enabled: boolean;
    passages: Array<{
      id: string;
      title: string;
      text_length: number;
      score: number;
      source: string;
    }>;
  };
}

export interface Citation {
  id: string;
  title: string;
  url?: string;
  snippet: string;
  collection?: string;
  reference: string;
}

export interface SuggestParams {
  q: string;
  limit?: number;
  collections?: string[];
}

export interface SuggestResult {
  suggestions: string[];
  query: string;
}

export interface ClientOptions {
  timeout?: number;
  retries?: number;
  userAgent?: string;
}

export class PixelcodaSearchClient {
  private apiBase: string;
  private project: string;
  private apiKey: string;
  private options: Required<ClientOptions>;

  constructor(apiBase: string, project: string, apiKey: string, options: ClientOptions = {}) {
    this.apiBase = apiBase.replace(/\/$/, ''); // Remove trailing slash
    this.project = project;
    this.apiKey = apiKey;
    this.options = {
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      userAgent: options.userAgent || 'pixelcoda-widgets/1.0'
    };
  }

  async search(params: SearchParams): Promise<SearchResult> {
    return this.request<SearchResult>('POST', `/v1/search/${this.project}`, params);
  }

  async ask(params: AskParams): Promise<AskResult> {
    return this.request<AskResult>('POST', `/v1/ask/${this.project}`, params);
  }

  async suggest(params: SuggestParams): Promise<SuggestResult> {
    return this.request<SuggestResult>('POST', `/v1/suggest/${this.project}`, params);
  }

  async logQuery(query: string, resultsCount: number, responseTime: number): Promise<void> {
    try {
      await this.request('POST', `/v1/metrics/query/${this.project}`, {
        query,
        results_count: resultsCount,
        response_time_ms: responseTime,
        user_agent: navigator?.userAgent,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn('Failed to log query metrics:', error);
    }
  }

  async logClick(query: string, documentId: string, position: number, url?: string): Promise<void> {
    try {
      await this.request('POST', `/v1/metrics/click/${this.project}`, {
        query,
        document_id: documentId,
        position,
        url,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn('Failed to log click metrics:', error);
    }
  }

  private async request<T>(method: string, endpoint: string, data?: any): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'User-Agent': this.options.userAgent
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown request error');
        
        if (attempt < this.options.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Request failed after ${this.options.retries + 1} attempts: ${lastError?.message}`);
  }
}

// Legacy functions for backward compatibility
export async function search(apiBase: string, project: string, key: string, params: SearchParams): Promise<SearchResult> {
  const client = new PixelcodaSearchClient(apiBase, project, key);
  return client.search(params);
}

export async function ask(apiBase: string, project: string, key: string, params: AskParams): Promise<AskResult> {
  const client = new PixelcodaSearchClient(apiBase, project, key);
  return client.ask(params);
}

export async function suggest(apiBase: string, project: string, key: string, params: SuggestParams): Promise<SuggestResult> {
  const client = new PixelcodaSearchClient(apiBase, project, key);
  return client.suggest(params);
}
