import { request } from 'undici';

export interface CrawlOptions {
  userAgent?: string;
  timeout?: number;
  maxSize?: number;
  followRedirects?: boolean;
}

export interface CrawlResult {
  html: string;
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  finalUrl?: string;
}

export async function crawl(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const {
    userAgent = 'pixelcoda-search-bot/1.0',
    timeout = 30000,
    maxSize = 10 * 1024 * 1024, // 10MB limit
    followRedirects = true
  } = options;

  try {
    console.log(`Crawling: ${url}`);
    
    const res = await request(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache'
      },
      headersTimeout: timeout,
      bodyTimeout: timeout,
      maxRedirections: followRedirects ? 5 : 0
    });

    if (res.statusCode >= 400) {
      throw new Error(`HTTP ${res.statusCode}: ${res.statusCode >= 500 ? 'Server Error' : 'Client Error'}`);
    }

    // Check content type
    const contentType = res.headers['content-type'] as string || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    // Check content length
    const contentLength = parseInt(res.headers['content-length'] as string || '0');
    if (contentLength > maxSize) {
      throw new Error(`Content too large: ${contentLength} bytes (max: ${maxSize})`);
    }

    const html = await res.body.text();
    
    // Additional size check after download
    if (html.length > maxSize) {
      throw new Error(`Content too large after download: ${html.length} bytes`);
    }

    const result: CrawlResult = {
      html,
      url,
      statusCode: res.statusCode,
      headers: Object.fromEntries(Object.entries(res.headers)),
      finalUrl: res.context?.history?.[0]?.origin || url
    };

    console.log(`Crawl successful: ${url} (${html.length} bytes, ${res.statusCode})`);
    
    return result;
  } catch (error) {
    console.error(`Crawl failed for ${url}:`, error);
    throw new Error(`Failed to crawl ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
