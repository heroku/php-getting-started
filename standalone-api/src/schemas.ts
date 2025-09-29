import { z } from 'zod';

// Base document schema for indexing
export const searchDocSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  collection: z.string(),
  lang: z.string().default('de'),
  url: z.string().url().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  facets: z.record(z.any()).optional(),
  boost: z.number().min(0).max(10).default(1),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
});

// Index endpoints schemas
export const upsertDocSchema = z.object({
  documents: z.array(searchDocSchema).min(1).max(100)
});

export const deleteDocSchema = z.object({
  ids: z.array(z.string()).min(1).max(100)
});

// Search schema
export const searchSchema = z.object({
  q: z.string().default(''),
  filters: z.record(z.any()).optional(),
  facets: z.array(z.string()).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  lang: z.string().optional(),
  collections: z.array(z.string()).optional()
});

// Ask/RAG schema
export const askSchema = z.object({
  q: z.string().min(2),
  lang: z.string().default('de'),
  collections: z.array(z.string()).optional(),
  maxPassages: z.number().int().min(1).max(12).default(6),
  temperature: z.number().min(0).max(2).default(0.7),
  includeDebug: z.boolean().default(false)
});

// Synonyms schema
export const synonymsSchema = z.object({
  add: z.array(z.object({
    terms: z.array(z.string()).min(2),
    lang: z.string().default('de'),
    type: z.enum(['synonym', 'alternative', 'oneway']).default('synonym')
  })).default([]),
  remove: z.array(z.string()).default([])
});

// Metrics schemas
export const queryMetricSchema = z.object({
  query: z.string(),
  results_count: z.number().int().min(0),
  response_time_ms: z.number().min(0),
  lang: z.string().optional(),
  user_agent: z.string().optional(),
  ip: z.string().optional(),
  collections: z.array(z.string()).optional()
});

export const clickMetricSchema = z.object({
  query: z.string(),
  document_id: z.string(),
  position: z.number().int().min(0),
  url: z.string().url().optional(),
  collection: z.string().optional()
});

// Suggest schema
export const suggestSchema = z.object({
  q: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(5),
  collections: z.array(z.string()).optional()
});

// API Key validation
export const apiKeySchema = z.object({
  key: z.string().min(32),
  scope: z.enum(['read', 'write', 'admin']),
  project_id: z.string().optional(),
  expires_at: z.string().datetime().optional()
});

// Webhook schema for TYPO3 connector
export const webhookSchema = z.object({
  action: z.enum(['create', 'update', 'delete']),
  table: z.string(),
  uid: z.number().int(),
  data: z.record(z.any()).optional(),
  timestamp: z.number().int(),
  signature: z.string() // HMAC signature
});

export type SearchDoc = z.infer<typeof searchDocSchema>;
export type UpsertDoc = z.infer<typeof upsertDocSchema>;
export type DeleteDoc = z.infer<typeof deleteDocSchema>;
export type SearchQuery = z.infer<typeof searchSchema>;
export type AskQuery = z.infer<typeof askSchema>;
export type SynonymsUpdate = z.infer<typeof synonymsSchema>;
export type QueryMetric = z.infer<typeof queryMetricSchema>;
export type ClickMetric = z.infer<typeof clickMetricSchema>;
export type SuggestQuery = z.infer<typeof suggestSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type WebhookPayload = z.infer<typeof webhookSchema>;
