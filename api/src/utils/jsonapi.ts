/**
 * JSON:API 1.0 Response Utilities
 * Compatible with TYPO3-Headless and nuxt-typo3
 */

export interface JsonApiResource {
  type: string;
  id: string;
  attributes: Record<string, any>;
  relationships?: Record<string, JsonApiRelationship>;
  links?: JsonApiLinks;
  meta?: Record<string, any>;
}

export interface JsonApiRelationship {
  data?: JsonApiResourceIdentifier | JsonApiResourceIdentifier[];
  links?: JsonApiLinks;
  meta?: Record<string, any>;
}

export interface JsonApiResourceIdentifier {
  type: string;
  id: string;
  meta?: Record<string, any>;
}

export interface JsonApiLinks {
  self?: string;
  related?: string;
  first?: string;
  last?: string;
  prev?: string;
  next?: string;
}

export interface JsonApiMeta {
  pagination?: {
    page: number;
    pages: number;
    count: number;
    total: number;
  };
  search?: {
    query: string;
    response_time_ms: number;
    collections?: string[];
    language?: string;
  };
  [key: string]: any;
}

export interface JsonApiResponse {
  data: JsonApiResource | JsonApiResource[];
  included?: JsonApiResource[];
  meta?: JsonApiMeta;
  links?: JsonApiLinks;
  jsonapi?: {
    version: string;
  };
}

export interface JsonApiError {
  id?: string;
  status: string;
  code?: string;
  title: string;
  detail?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
  meta?: Record<string, any>;
}

export interface JsonApiErrorResponse {
  errors: JsonApiError[];
  meta?: JsonApiMeta;
  jsonapi?: {
    version: string;
  };
}

/**
 * Create JSON:API compliant response
 */
export function createJsonApiResponse(
  data: JsonApiResource | JsonApiResource[],
  options: {
    included?: JsonApiResource[];
    meta?: JsonApiMeta;
    links?: JsonApiLinks;
    baseUrl?: string;
  } = {}
): JsonApiResponse {
  const response: JsonApiResponse = {
    data,
    jsonapi: { version: '1.0' }
  };

  if (options.included?.length) {
    response.included = options.included;
  }

  if (options.meta) {
    response.meta = options.meta;
  }

  if (options.links) {
    response.links = options.links;
  }

  return response;
}

/**
 * Create JSON:API error response
 */
export function createJsonApiError(
  errors: JsonApiError | JsonApiError[],
  meta?: JsonApiMeta
): JsonApiErrorResponse {
  return {
    errors: Array.isArray(errors) ? errors : [errors],
    meta,
    jsonapi: { version: '1.0' }
  };
}

/**
 * Transform search hit to JSON:API resource
 */
export function transformSearchHitToResource(
  hit: any,
  type: string = 'searchResult'
): JsonApiResource {
  const { id, title, content, summary, url, collection, lang, facets, _score, ...rest } = hit;

  return {
    type,
    id: id || `${collection}:${hit.uid || hit._id}`,
    attributes: {
      title: title || '',
      content: content || '',
      summary: summary || '',
      url: url || null,
      collection: collection || 'default',
      language: lang || 'de',
      score: _score || 0,
      facets: facets || {},
      ...rest
    },
    meta: {
      relevance: _score || 0,
      collection: collection || 'default'
    }
  };
}

/**
 * Transform citation to JSON:API resource
 */
export function transformCitationToResource(
  citation: any,
  index: number
): JsonApiResource {
  return {
    type: 'citation',
    id: citation.id || `citation-${index}`,
    attributes: {
      title: citation.title || '',
      url: citation.url || null,
      snippet: citation.snippet || '',
      collection: citation.collection || null,
      reference: citation.reference || `[${index + 1}]`
    },
    meta: {
      position: index,
      collection: citation.collection || null
    }
  };
}

/**
 * Create pagination links for JSON:API
 */
export function createPaginationLinks(
  baseUrl: string,
  page: number,
  totalPages: number,
  limit: number,
  query?: string
): JsonApiLinks {
  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    params.set('page', p.toString());
    params.set('limit', limit.toString());
    if (query) params.set('q', query);
    return `${baseUrl}?${params.toString()}`;
  };

  const links: JsonApiLinks = {
    self: buildUrl(page),
    first: buildUrl(1),
    last: buildUrl(totalPages)
  };

  if (page > 1) {
    links.prev = buildUrl(page - 1);
  }

  if (page < totalPages) {
    links.next = buildUrl(page + 1);
  }

  return links;
}

/**
 * Transform TYPO3-Headless page data to search document
 */
export function transformTypo3PageToSearchDoc(
  pageData: any,
  projectId: string
): any {
  const { id, type, attributes } = pageData;
  
  return {
    id: `${type}:${id}`,
    project_id: projectId,
    collection: type || 'pages',
    lang: attributes.locale || attributes.language || 'de',
    title: attributes.title || attributes.nav_title || '',
    content: extractContentFromTypo3Page(attributes),
    summary: attributes.abstract || attributes.description || '',
    url: attributes.slug || `/${id}`,
    facets: {
      type: type || 'pages',
      uid: id,
      pid: attributes.pid || 0,
      sys_language_uid: attributes.sys_language_uid || 0,
      hidden: attributes.hidden || false,
      starttime: attributes.starttime || 0,
      endtime: attributes.endtime || 0,
      fe_group: attributes.fe_group || '0'
    },
    boost: calculateTypo3Boost(attributes, type),
    created_at: attributes.crdate ? new Date(attributes.crdate * 1000).toISOString() : new Date().toISOString(),
    updated_at: attributes.tstamp ? new Date(attributes.tstamp * 1000).toISOString() : new Date().toISOString()
  };
}

/**
 * Extract content from TYPO3-Headless page structure
 */
function extractContentFromTypo3Page(attributes: any): string {
  let content = '';

  // Add main content fields
  if (attributes.content) {
    content += extractContentFromContentElements(attributes.content);
  }

  // Add other text fields
  const textFields = ['subtitle', 'abstract', 'description', 'keywords'];
  textFields.forEach(field => {
    if (attributes[field]) {
      content += ' ' + stripHtml(attributes[field]);
    }
  });

  return content.trim();
}

/**
 * Extract content from TYPO3 content elements
 */
function extractContentFromContentElements(contentElements: any[]): string {
  if (!Array.isArray(contentElements)) {
    return '';
  }

  return contentElements.map(element => {
    const attrs = element.attributes || {};
    let text = '';

    // Header
    if (attrs.header) {
      text += stripHtml(attrs.header) + ' ';
    }

    // Subheader
    if (attrs.subheader) {
      text += stripHtml(attrs.subheader) + ' ';
    }

    // Bodytext
    if (attrs.bodytext) {
      text += stripHtml(attrs.bodytext) + ' ';
    }

    // Media captions
    if (attrs.media && Array.isArray(attrs.media)) {
      attrs.media.forEach((media: any) => {
        if (media.attributes?.title) {
          text += stripHtml(media.attributes.title) + ' ';
        }
        if (media.attributes?.alternative) {
          text += stripHtml(media.attributes.alternative) + ' ';
        }
      });
    }

    return text.trim();
  }).join(' ');
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

  // Content quality boost
  if (attributes.title && attributes.title.length > 20) {
    boost += 0.1;
  }

  if (attributes.abstract && attributes.abstract.length > 100) {
    boost += 0.1;
  }

  // Visibility boost
  if (!attributes.hidden && attributes.fe_group === '0') {
    boost += 0.1;
  }

  // Recency boost for news
  if (type === 'news' && attributes.datetime) {
    const daysSince = (Date.now() / 1000 - attributes.datetime) / (24 * 60 * 60);
    if (daysSince < 30) {
      boost += 0.2;
    }
  }

  return Math.min(boost, 2.0);
}

/**
 * Strip HTML tags from text
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

/**
 * Create JSON:API compatible error for common HTTP status codes
 */
export function createHttpError(status: number, detail?: string): JsonApiError {
  const errorMap: Record<number, { title: string; code?: string }> = {
    400: { title: 'Bad Request', code: 'INVALID_REQUEST' },
    401: { title: 'Unauthorized', code: 'AUTHENTICATION_REQUIRED' },
    403: { title: 'Forbidden', code: 'ACCESS_DENIED' },
    404: { title: 'Not Found', code: 'RESOURCE_NOT_FOUND' },
    429: { title: 'Too Many Requests', code: 'RATE_LIMIT_EXCEEDED' },
    500: { title: 'Internal Server Error', code: 'INTERNAL_ERROR' }
  };

  const error = errorMap[status] || { title: 'Unknown Error' };

  return {
    status: status.toString(),
    title: error.title,
    code: error.code,
    detail: detail || error.title
  };
}
