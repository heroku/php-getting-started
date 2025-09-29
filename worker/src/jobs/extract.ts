import { parse } from 'node-html-parser';

export interface ExtractOptions {
  removeScripts?: boolean;
  removeStyles?: boolean;
  preserveFormatting?: boolean;
  extractMeta?: boolean;
  minContentLength?: number;
}

export interface ExtractedDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  summary?: string;
  headings: string[];
  meta: {
    description?: string;
    keywords?: string;
    author?: string;
    lang?: string;
    canonical?: string;
    robots?: string;
  };
  lang: string;
  wordCount: number;
  created_at: string;
}

export async function extract(html: string, url: string, options: ExtractOptions = {}): Promise<ExtractedDocument> {
  const {
    removeScripts = true,
    removeStyles = true,
    preserveFormatting = false,
    extractMeta = true,
    minContentLength = 100
  } = options;

  try {
    console.log(`Extracting content from: ${url}`);
    
    const root = parse(html);

    // Remove unwanted elements
    if (removeScripts) {
      root.querySelectorAll('script, noscript').forEach(el => el.remove());
    }
    if (removeStyles) {
      root.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
    }

    // Remove navigation, ads, and other non-content elements
    const unwantedSelectors = [
      'nav', 'header', 'footer', 'aside',
      '.navigation', '.nav', '.menu',
      '.advertisement', '.ads', '.ad',
      '.sidebar', '.widget',
      '.comments', '.comment',
      '.social', '.share',
      '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
    ];
    
    unwantedSelectors.forEach(selector => {
      root.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Extract title
    let title = root.querySelector('title')?.text?.trim() || '';
    if (!title) {
      title = root.querySelector('h1')?.text?.trim() || url;
    }
    title = title.replace(/\s+/g, ' ').slice(0, 200);

    // Extract meta information
    const meta: ExtractedDocument['meta'] = {};
    if (extractMeta) {
      meta.description = root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
      meta.keywords = root.querySelector('meta[name="keywords"]')?.getAttribute('content')?.trim();
      meta.author = root.querySelector('meta[name="author"]')?.getAttribute('content')?.trim();
      meta.canonical = root.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim();
      meta.robots = root.querySelector('meta[name="robots"]')?.getAttribute('content')?.trim();
      
      // Language detection
      meta.lang = root.querySelector('html')?.getAttribute('lang') || 
                 root.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') ||
                 'de';
    }

    // Extract headings for structure
    const headings: string[] = [];
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
      root.querySelectorAll(tag).forEach(heading => {
        const text = heading.text.trim();
        if (text && text.length > 2) {
          headings.push(text);
        }
      });
    });

    // Extract main content - prioritize article, main, or content areas
    let contentElement = root.querySelector('article') || 
                        root.querySelector('main') || 
                        root.querySelector('[role="main"]') || 
                        root.querySelector('.content') || 
                        root.querySelector('.post-content') || 
                        root.querySelector('.entry-content') ||
                        root;

    // Clean up content text
    let content = contentElement.text.trim();
    if (preserveFormatting) {
      content = content.replace(/\n\s*\n/g, '\n\n'); // Normalize line breaks
    } else {
      content = content.replace(/\s+/g, ' '); // Collapse all whitespace
    }

    // Check minimum content length
    if (content.length < minContentLength) {
      throw new Error(`Content too short: ${content.length} characters (minimum: ${minContentLength})`);
    }

    // Generate summary from first paragraph or description
    let summary = meta.description || '';
    if (!summary) {
      const firstParagraph = contentElement.querySelector('p')?.text?.trim();
      if (firstParagraph && firstParagraph.length > 50) {
        summary = firstParagraph.slice(0, 300) + (firstParagraph.length > 300 ? '...' : '');
      }
    }

    // Word count
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

    const result: ExtractedDocument = {
      id: url,
      url,
      title,
      content,
      summary,
      headings,
      meta,
      lang: meta.lang || 'de',
      wordCount,
      created_at: new Date().toISOString()
    };

    console.log(`Extraction successful: ${url} (${wordCount} words, ${headings.length} headings)`);
    
    return result;
  } catch (error) {
    console.error(`Extraction failed for ${url}:`, error);
    throw new Error(`Failed to extract content from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
