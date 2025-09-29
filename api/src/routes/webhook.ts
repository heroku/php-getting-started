import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/auth.js';
import { MeiliEngine } from '../engines/meili.js';
import { upsertChunk } from '../db.js';
import { webhookSchema } from '../schemas.js';
import { pullSingleTypo3Resource, deleteTypo3Resource } from '../../../worker/src/jobs/typo3-pull.js';
import { embed } from '@pixelcoda/llm-adapter';
import crypto from 'crypto';

export const router = new Hono();
const engine = new MeiliEngine(process.env.MEILI_URL || 'http://localhost:7700', process.env.MEILI_KEY);

// HMAC verification middleware
const verifyHmacSignature = async (c: any, next: any) => {
  const signature = c.req.header('x-signature-sha256');
  const secret = process.env.TYPO3_HMAC_SECRET;

  if (!secret) {
    console.warn('TYPO3_HMAC_SECRET not configured - skipping signature verification');
    return next();
  }

  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  try {
    const body = await c.req.text();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // Re-parse body for next middleware
    c.req.bodyCache = JSON.parse(body);
    return next();
  } catch (error) {
    console.error('HMAC verification error:', error);
    return c.json({ error: 'Signature verification failed' }, 401);
  }
};

// TYPO3 webhook endpoint - handles lightweight webhooks
router.post('/webhook/typo3',
  authMiddleware.requireKey('write'),
  verifyHmacSignature,
  async (c) => {
    try {
      const webhook = c.req.bodyCache || await c.req.json();
      
      console.log(`TYPO3 webhook received: ${webhook.action} ${webhook.type}:${webhook.id}`);
      console.log(`Webhook version: ${webhook.webhook_version || '1.0'}`);

      // Handle both legacy (v1) and new lightweight (v2) webhooks
      if (webhook.webhook_version === '2.0') {
        await handleLightweightWebhook(webhook);
      } else {
        await handleLegacyWebhook(webhook);
      }

      return c.json({
        success: true,
        action: webhook.action,
        type: webhook.type || webhook.table,
        id: webhook.id || webhook.uid,
        processed_at: new Date().toISOString(),
        webhook_version: webhook.webhook_version || '1.0'
      });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return c.json({
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Handle lightweight webhook (v2.0) - refetch from TYPO3-Headless API
 */
async function handleLightweightWebhook(webhook: any) {
  const { action, type, id, project_id, typo3_headless_url, language } = webhook;
  
  console.log(`Processing lightweight webhook: ${action} ${type}:${id}`);

  switch (action) {
    case 'create':
    case 'update':
      // Refetch resource from TYPO3-Headless JSON:API
      try {
        await pullSingleTypo3Resource(project_id, type, id, {
          baseUrl: typo3_headless_url,
          language: language || 'de',
          apiKey: process.env.TYPO3_API_KEY
        });
        console.log(`Successfully refetched and indexed ${type}:${id}`);
      } catch (error) {
        console.error(`Failed to refetch ${type}:${id}:`, error);
        throw error;
      }
      break;
      
    case 'delete':
      await deleteTypo3Resource(project_id, type, id);
      console.log(`Successfully deleted ${type}:${id}`);
      break;
      
    default:
      console.warn(`Unknown webhook action: ${action}`);
  }
}

/**
 * Handle legacy webhook (v1.0) - direct data processing
 */
async function handleLegacyWebhook(webhook: any) {
  const { table, uid, data, project_id } = webhook;
  
  console.log(`Processing legacy webhook: ${webhook.action} ${table}:${uid}`);

  switch (webhook.action) {
    case 'create':
    case 'update':
      await handleUpsertWebhook(webhook);
      break;
    case 'delete':
      await handleDeleteWebhook(webhook);
      break;
    default:
      console.warn(`Unknown webhook action: ${webhook.action}`);
  }
}

async function handleUpsertWebhook(webhook: any) {
  const { table, uid, data, project_id } = webhook;
  
  // Transform TYPO3 record to search document
  const document = transformTypo3Record(table, uid, data, project_id);
  
  // Index in Meilisearch
  await engine.upsert(project_id, table, document);
  
  // If vector search is enabled, also create chunks and embeddings
  if (process.env.ENABLE_VECTOR_SEARCH === 'true' && document.content) {
    await indexWithVectorSearch(document, project_id, table);
  }
  
  console.log(`Indexed ${table}:${uid} in project ${project_id}`);
}

async function handleDeleteWebhook(webhook: any) {
  const { table, uid, project_id } = webhook;
  
  // Delete from Meilisearch
  await engine.remove(project_id, table, `${table}:${uid}`);
  
  // Delete chunks from vector database
  // TODO: Implement chunk deletion by document ID
  
  console.log(`Deleted ${table}:${uid} from project ${project_id}`);
}

function transformTypo3Record(table: string, uid: number, data: any, projectId: string) {
  // Extract meaningful title
  const title = extractTitle(table, data);
  
  // Extract and clean content
  const content = extractContent(table, data);
  
  // Generate URL (simplified)
  const url = generateUrl(table, uid, data);
  
  return {
    id: `${table}:${uid}`,
    project_id: projectId,
    collection: table,
    lang: detectLanguage(data),
    title,
    content,
    url,
    summary: extractSummary(table, data),
    facets: {
      table,
      uid,
      pid: data.pid || 0,
      sys_language_uid: data.sys_language_uid || 0,
      created: data.crdate || 0,
      modified: data.tstamp || 0,
      hidden: data.hidden || 0,
      deleted: data.deleted || 0
    },
    boost: calculateBoost(table, data),
    created_at: data.crdate ? new Date(data.crdate * 1000).toISOString() : new Date().toISOString(),
    updated_at: data.tstamp ? new Date(data.tstamp * 1000).toISOString() : new Date().toISOString()
  };
}

function extractTitle(table: string, data: any): string {
  const titleFields = ['title', 'header', 'name', 'subject'];
  
  for (const field of titleFields) {
    if (data[field] && typeof data[field] === 'string') {
      return stripTags(data[field]).substring(0, 200);
    }
  }
  
  return `${table.charAt(0).toUpperCase() + table.slice(1)} #${data.uid || 'unknown'}`;
}

function extractContent(table: string, data: any): string {
  const contentFields = ['bodytext', 'description', 'abstract', 'teaser', 'content'];
  let content = '';
  
  for (const field of contentFields) {
    if (data[field] && typeof data[field] === 'string') {
      content += stripTags(data[field]) + ' ';
    }
  }
  
  // If no specific content fields, concatenate text fields
  if (!content.trim()) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.length > 10 && value.length < 2000) {
        content += stripTags(value) + ' ';
      }
    }
  }
  
  return content.trim().substring(0, 10000); // Limit content length
}

function extractSummary(table: string, data: any): string | undefined {
  const summaryFields = ['description', 'abstract', 'teaser'];
  
  for (const field of summaryFields) {
    if (data[field] && typeof data[field] === 'string') {
      const summary = stripTags(data[field]);
      if (summary.length > 50) {
        return summary.substring(0, 300);
      }
    }
  }
  
  // Generate summary from content
  const content = extractContent(table, data);
  if (content.length > 100) {
    return content.substring(0, 300) + '...';
  }
  
  return undefined;
}

function generateUrl(table: string, uid: number, data: any): string | undefined {
  // Simplified URL generation - in real implementation, 
  // this would use TYPO3 site configuration
  if (table === 'pages') {
    return `/page/${uid}`;
  }
  
  if (table === 'tx_news_domain_model_news') {
    return `/news/${uid}`;
  }
  
  return undefined;
}

function detectLanguage(data: any): string {
  const langUid = data.sys_language_uid || 0;
  
  // Simple language mapping - extend as needed
  const languageMap: Record<number, string> = {
    0: 'de',
    1: 'en',
    2: 'fr',
    3: 'es'
  };
  
  return languageMap[langUid] || 'de';
}

function calculateBoost(table: string, data: any): number {
  let boost = 1.0;
  
  // Table-based boost
  if (table === 'pages') {
    boost = 1.2;
  } else if (table === 'tx_news_domain_model_news') {
    boost = 1.1;
  }
  
  // Content quality boost
  if (data.title && data.title.length > 20) {
    boost += 0.1;
  }
  
  if (data.description && data.description.length > 100) {
    boost += 0.1;
  }
  
  // Recency boost for news
  if (table === 'tx_news_domain_model_news' && data.datetime) {
    const daysSinceCreation = (Date.now() / 1000 - data.datetime) / (24 * 60 * 60);
    if (daysSinceCreation < 30) {
      boost += 0.2;
    }
  }
  
  return Math.min(boost, 2.0); // Cap at 2.0
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&[^;]+;/g, ' ') // Remove HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

async function indexWithVectorSearch(document: any, projectId: string, collection: string) {
  try {
    if (!document.content || document.content.length < 100) {
      return; // Skip short content
    }
    
    // Simple chunking for webhook processing
    const chunkSize = 800;
    const overlap = 100;
    const chunks = [];
    
    for (let i = 0; i < document.content.length; i += chunkSize - overlap) {
      const chunkText = document.content.substring(i, i + chunkSize).trim();
      if (chunkText.length > 50) {
        chunks.push({
          id: `${document.id}_chunk_${chunks.length}`,
          text: chunkText,
          startIndex: i,
          endIndex: i + chunkText.length
        });
      }
    }
    
    // Generate embeddings and store chunks
    for (const chunk of chunks) {
      try {
        const embedding = await embed(chunk.text);
        
        await upsertChunk({
          id: chunk.id,
          project_id: projectId,
          collection,
          title: document.title,
          content: chunk.text,
          url: document.url,
          embedding,
          metadata: {
            document_id: document.id,
            chunk_index: chunks.indexOf(chunk),
            start_index: chunk.startIndex,
            end_index: chunk.endIndex
          }
        });
      } catch (error) {
        console.warn(`Failed to process chunk ${chunk.id}:`, error);
      }
    }
    
    console.log(`Created ${chunks.length} vector chunks for ${document.id}`);
  } catch (error) {
    console.error('Vector indexing error:', error);
    // Don't fail the whole webhook for vector indexing errors
  }
}
