import { request } from 'undici';
import { transformTypo3PageToSearchDoc } from '../../../api/src/utils/jsonapi.js';

export interface Typo3PullOptions {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  batchSize?: number;
  language?: string;
  types?: string[];
}

export interface Typo3ApiResponse {
  data: Typo3Resource[];
  included?: Typo3Resource[];
  meta?: {
    pagination?: {
      current: number;
      next?: number;
      total: number;
      count: number;
    };
  };
  links?: {
    self?: string;
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
  };
}

export interface Typo3Resource {
  type: string;
  id: string;
  attributes: Record<string, any>;
  relationships?: Record<string, any>;
  links?: Record<string, string>;
}

/**
 * Pull and index all content from TYPO3-Headless API
 */
export async function pullTypo3Content(
  projectId: string,
  options: Typo3PullOptions
): Promise<{ processed: number; errors: number; types: Record<string, number> }> {
  const {
    baseUrl,
    apiKey,
    timeout = 30000,
    batchSize = 50,
    language = 'de',
    types = ['pages', 'news']
  } = options;

  console.log(`Starting TYPO3 content pull for project: ${projectId}`);
  console.log(`Base URL: ${baseUrl}, Language: ${language}, Types: ${types.join(', ')}`);

  let totalProcessed = 0;
  let totalErrors = 0;
  const typeStats: Record<string, number> = {};

  for (const type of types) {
    console.log(`\nProcessing type: ${type}`);
    
    try {
      const result = await pullTypo3Type(projectId, type, {
        ...options,
        baseUrl,
        apiKey,
        timeout,
        batchSize,
        language
      });
      
      totalProcessed += result.processed;
      totalErrors += result.errors;
      typeStats[type] = result.processed;
      
      console.log(`Completed ${type}: ${result.processed} processed, ${result.errors} errors`);
    } catch (error) {
      console.error(`Failed to process type ${type}:`, error);
      totalErrors++;
      typeStats[type] = 0;
    }
  }

  console.log(`\nTYPO3 pull completed: ${totalProcessed} processed, ${totalErrors} errors`);
  return { processed: totalProcessed, errors: totalErrors, types: typeStats };
}

/**
 * Pull specific content type from TYPO3-Headless
 */
async function pullTypo3Type(
  projectId: string,
  type: string,
  options: Typo3PullOptions
): Promise<{ processed: number; errors: number }> {
  const { baseUrl, apiKey, timeout, batchSize, language } = options;
  
  let processed = 0;
  let errors = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      console.log(`Fetching ${type} page ${page}...`);
      
      const apiResponse = await fetchTypo3ApiPage(baseUrl, type, {
        page,
        limit: batchSize,
        language,
        apiKey,
        timeout
      });

      if (!apiResponse.data || apiResponse.data.length === 0) {
        hasMore = false;
        break;
      }

      // Process each resource
      for (const resource of apiResponse.data) {
        try {
          await processTypo3Resource(projectId, resource, apiResponse.included || []);
          processed++;
        } catch (error) {
          console.error(`Failed to process ${type}:${resource.id}:`, error);
          errors++;
        }
      }

      // Check for next page
      hasMore = !!(apiResponse.links?.next || apiResponse.meta?.pagination?.next);
      page++;

      // Rate limiting - be nice to TYPO3 API
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Failed to fetch ${type} page ${page}:`, error);
      errors++;
      hasMore = false;
    }
  }

  return { processed, errors };
}

/**
 * Fetch single page from TYPO3-Headless API
 */
async function fetchTypo3ApiPage(
  baseUrl: string,
  type: string,
  options: {
    page: number;
    limit: number;
    language?: string;
    apiKey?: string;
    timeout?: number;
  }
): Promise<Typo3ApiResponse> {
  const { page, limit, language, apiKey, timeout } = options;
  
  // Build API URL according to TYPO3-Headless conventions
  const url = new URL(`/api/${type}`, baseUrl);
  url.searchParams.set('page', page.toString());
  url.searchParams.set('limit', limit.toString());
  
  if (language) {
    url.searchParams.set('language', language);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    'User-Agent': 'pixelcoda-search-indexer/1.0'
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await request(url.toString(), {
    method: 'GET',
    headers,
    headersTimeout: timeout,
    bodyTimeout: timeout
  });

  if (response.statusCode >= 400) {
    const errorText = await response.body.text();
    throw new Error(`TYPO3 API error ${response.statusCode}: ${errorText}`);
  }

  const data = await response.body.json() as Typo3ApiResponse;
  
  if (!data.data) {
    throw new Error('Invalid TYPO3 API response: missing data field');
  }

  return data;
}

/**
 * Process individual TYPO3 resource
 */
async function processTypo3Resource(
  projectId: string,
  resource: Typo3Resource,
  included: Typo3Resource[] = []
): Promise<void> {
  try {
    // Transform TYPO3-Headless resource to search document
    const searchDoc = transformTypo3ResourceToSearchDoc(resource, projectId, included);
    
    // Skip if no meaningful content
    if (!searchDoc.content || searchDoc.content.length < 50) {
      console.warn(`Skipping ${resource.type}:${resource.id} - insufficient content`);
      return;
    }

    // Send to indexing API
    await indexSearchDocument(projectId, resource.type, searchDoc);
    
    console.log(`Indexed ${resource.type}:${resource.id} (${searchDoc.content.length} chars)`);
    
  } catch (error) {
    console.error(`Failed to process resource ${resource.type}:${resource.id}:`, error);
    throw error;
  }
}

/**
 * Transform TYPO3-Headless resource to search document
 */
function transformTypo3ResourceToSearchDoc(
  resource: Typo3Resource,
  projectId: string,
  included: Typo3Resource[] = []
): any {
  const { type, id, attributes } = resource;
  
  // Extract content from attributes and relationships
  let content = '';
  let title = attributes.title || attributes.nav_title || attributes.header || '';
  
  // Extract main content fields
  const contentFields = ['bodytext', 'description', 'abstract', 'teaser'];
  contentFields.forEach(field => {
    if (attributes[field]) {
      content += stripHtml(attributes[field]) + ' ';
    }
  });

  // Process content elements if present
  if (attributes.content && Array.isArray(attributes.content)) {
    content += extractContentFromElements(attributes.content, included);
  }

  // Extract media information
  if (attributes.media && Array.isArray(attributes.media)) {
    content += extractMediaContent(attributes.media, included);
  }

  // Generate URL from slug or fallback
  const url = attributes.slug || 
              attributes.realurl || 
              `/${type}/${id}`;

  return {
    id: `${type}:${id}`,
    project_id: projectId,
    collection: type,
    lang: attributes.locale || attributes.language || 'de',
    title: stripHtml(title),
    content: content.trim(),
    summary: stripHtml(attributes.abstract || attributes.description || ''),
    url,
    facets: {
      type,
      uid: parseInt(id),
      pid: attributes.pid || 0,
      sys_language_uid: attributes.sys_language_uid || 0,
      hidden: attributes.hidden || false,
      starttime: attributes.starttime || 0,
      endtime: attributes.endtime || 0,
      fe_group: attributes.fe_group || '0',
      categories: extractCategories(resource, included),
      tags: extractTags(resource, included)
    },
    boost: calculateTypo3Boost(attributes, type),
    created_at: attributes.crdate ? new Date(attributes.crdate * 1000).toISOString() : new Date().toISOString(),
    updated_at: attributes.tstamp ? new Date(attributes.tstamp * 1000).toISOString() : new Date().toISOString()
  };
}

/**
 * Extract content from TYPO3 content elements
 */
function extractContentFromElements(contentElements: any[], included: Typo3Resource[]): string {
  let content = '';
  
  contentElements.forEach(element => {
    if (typeof element === 'string') {
      // Element ID reference - find in included
      const includedElement = included.find(inc => inc.id === element);
      if (includedElement) {
        content += extractElementContent(includedElement.attributes) + ' ';
      }
    } else if (element.attributes) {
      // Direct element data
      content += extractElementContent(element.attributes) + ' ';
    }
  });
  
  return content;
}

/**
 * Extract content from single content element
 */
function extractElementContent(attributes: any): string {
  let content = '';
  
  const textFields = ['header', 'subheader', 'bodytext', 'caption', 'altText'];
  textFields.forEach(field => {
    if (attributes[field]) {
      content += stripHtml(attributes[field]) + ' ';
    }
  });
  
  return content.trim();
}

/**
 * Extract media content (alt texts, captions)
 */
function extractMediaContent(mediaElements: any[], included: Typo3Resource[]): string {
  let content = '';
  
  mediaElements.forEach(media => {
    let mediaData = media;
    
    // If media is just an ID, find in included
    if (typeof media === 'string') {
      mediaData = included.find(inc => inc.id === media);
    }
    
    if (mediaData?.attributes) {
      const attrs = mediaData.attributes;
      if (attrs.title) content += stripHtml(attrs.title) + ' ';
      if (attrs.alternative) content += stripHtml(attrs.alternative) + ' ';
      if (attrs.description) content += stripHtml(attrs.description) + ' ';
      if (attrs.caption) content += stripHtml(attrs.caption) + ' ';
    }
  });
  
  return content;
}

/**
 * Extract categories from resource relationships
 */
function extractCategories(resource: Typo3Resource, included: Typo3Resource[]): string[] {
  const categories: string[] = [];
  
  if (resource.relationships?.categories?.data) {
    const categoryRefs = Array.isArray(resource.relationships.categories.data) 
      ? resource.relationships.categories.data 
      : [resource.relationships.categories.data];
    
    categoryRefs.forEach(ref => {
      const category = included.find(inc => inc.type === ref.type && inc.id === ref.id);
      if (category?.attributes?.title) {
        categories.push(category.attributes.title);
      }
    });
  }
  
  return categories;
}

/**
 * Extract tags from resource relationships
 */
function extractTags(resource: Typo3Resource, included: Typo3Resource[]): string[] {
  const tags: string[] = [];
  
  if (resource.relationships?.tags?.data) {
    const tagRefs = Array.isArray(resource.relationships.tags.data) 
      ? resource.relationships.tags.data 
      : [resource.relationships.tags.data];
    
    tagRefs.forEach(ref => {
      const tag = included.find(inc => inc.type === ref.type && inc.id === ref.id);
      if (tag?.attributes?.title) {
        tags.push(tag.attributes.title);
      }
    });
  }
  
  return tags;
}

/**
 * Calculate boost factor for TYPO3 content
 */
function calculateTypo3Boost(attributes: any, type: string): number {
  let boost = 1.0;

  // Type-based boost
  if (type === 'pages') {
    boost = 1.2;
  } else if (type === 'news') {
    boost = 1.1;
  }

  // Content quality indicators
  if (attributes.title && attributes.title.length > 20) {
    boost += 0.1;
  }

  if (attributes.abstract && attributes.abstract.length > 100) {
    boost += 0.1;
  }

  // Visibility and accessibility
  if (!attributes.hidden && attributes.fe_group === '0') {
    boost += 0.1;
  }

  // SEO indicators
  if (attributes.seo_title || attributes.meta_description) {
    boost += 0.05;
  }

  // Recency boost for news
  if (type === 'news' && attributes.datetime) {
    const daysSince = (Date.now() / 1000 - attributes.datetime) / (24 * 60 * 60);
    if (daysSince < 7) boost += 0.3;
    else if (daysSince < 30) boost += 0.2;
    else if (daysSince < 90) boost += 0.1;
  }

  return Math.min(boost, 2.0);
}

/**
 * Send search document to indexing API
 */
async function indexSearchDocument(
  projectId: string,
  collection: string,
  searchDoc: any
): Promise<void> {
  const apiBase = process.env.API_BASE || 'http://localhost:8787';
  const apiKey = process.env.API_WRITE_KEY;

  if (!apiKey) {
    throw new Error('API_WRITE_KEY is required for indexing');
  }

  const response = await request(`${apiBase}/v1/index/${projectId}/${collection}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'User-Agent': 'pixelcoda-typo3-indexer/1.0'
    },
    body: JSON.stringify({
      documents: [searchDoc]
    }),
    timeout: 30000
  });

  if (response.statusCode >= 400) {
    const errorText = await response.body.text();
    throw new Error(`Indexing API error ${response.statusCode}: ${errorText}`);
  }

  const result = await response.body.json() as any;
  
  if (!result.success) {
    throw new Error(`Indexing failed: ${JSON.stringify(result.results || result)}`);
  }
}

/**
 * Pull single resource by ID and type
 */
export async function pullSingleTypo3Resource(
  projectId: string,
  type: string,
  id: string,
  options: Typo3PullOptions
): Promise<void> {
  const { baseUrl, apiKey, timeout, language } = options;

  console.log(`Pulling single resource: ${type}:${id}`);

  try {
    const url = new URL(`/api/${type}/${id}`, baseUrl);
    if (language) {
      url.searchParams.set('language', language);
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      'User-Agent': 'pixelcoda-search-indexer/1.0'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await request(url.toString(), {
      method: 'GET',
      headers,
      headersTimeout: timeout,
      bodyTimeout: timeout
    });

    if (response.statusCode === 404) {
      console.warn(`Resource not found: ${type}:${id} - may have been deleted`);
      return;
    }

    if (response.statusCode >= 400) {
      const errorText = await response.body.text();
      throw new Error(`TYPO3 API error ${response.statusCode}: ${errorText}`);
    }

    const apiResponse = await response.body.json() as Typo3ApiResponse;
    
    if (apiResponse.data) {
      const resource = Array.isArray(apiResponse.data) ? apiResponse.data[0] : apiResponse.data;
      await processTypo3Resource(projectId, resource, apiResponse.included || []);
      console.log(`Successfully indexed ${type}:${id}`);
    }

  } catch (error) {
    console.error(`Failed to pull resource ${type}:${id}:`, error);
    throw error;
  }
}

/**
 * Delete resource from search index
 */
export async function deleteTypo3Resource(
  projectId: string,
  type: string,
  id: string
): Promise<void> {
  const apiBase = process.env.API_BASE || 'http://localhost:8787';
  const apiKey = process.env.API_WRITE_KEY;

  if (!apiKey) {
    throw new Error('API_WRITE_KEY is required for deletion');
  }

  console.log(`Deleting resource: ${type}:${id}`);

  try {
    const response = await request(`${apiBase}/v1/index/${projectId}/${type}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'User-Agent': 'pixelcoda-typo3-indexer/1.0'
      },
      body: JSON.stringify({
        ids: [`${type}:${id}`]
      }),
      timeout: 30000
    });

    if (response.statusCode >= 400) {
      const errorText = await response.body.text();
      throw new Error(`Deletion API error ${response.statusCode}: ${errorText}`);
    }

    console.log(`Successfully deleted ${type}:${id}`);

  } catch (error) {
    console.error(`Failed to delete resource ${type}:${id}:`, error);
    throw error;
  }
}

/**
 * Strip HTML tags and entities
 */
function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&[^;]+;/g, ' ') // Remove HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
