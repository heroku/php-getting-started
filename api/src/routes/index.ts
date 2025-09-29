import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/auth.js';
import { MeiliEngine } from '../engines/meili.js';
import { upsertDocSchema, deleteDocSchema } from '../schemas.js';

export const router = new Hono();

const engine = new MeiliEngine(
  process.env.MEILI_URL || 'http://localhost:7700', 
  process.env.MEILI_KEY
);

// Upsert documents to collection
router.post('/index/:project/:collection', 
  authMiddleware.requireKey('write'), 
  zValidator('json', upsertDocSchema), 
  async (c) => {
    try {
      const { project, collection } = c.req.param();
      const { documents } = await c.req.json();
      
      // Validate project and collection names
      if (!project.match(/^[a-zA-Z0-9_-]+$/)) {
        return c.json({ error: 'Invalid project name' }, 400);
      }
      if (!collection.match(/^[a-zA-Z0-9_-]+$/)) {
        return c.json({ error: 'Invalid collection name' }, 400);
      }

      // Upsert each document
      const results = [];
      for (const doc of documents) {
        try {
          await engine.upsert(project, collection, {
            ...doc,
            project_id: project,
            collection,
            updated_at: new Date().toISOString()
          });
          results.push({ id: doc.id, status: 'success' });
        } catch (error) {
          console.error(`Failed to upsert document ${doc.id}:`, error);
          results.push({ 
            id: doc.id, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.length - successCount;

      return c.json({
        success: errorCount === 0,
        processed: results.length,
        successful: successCount,
        failed: errorCount,
        results
      });
    } catch (error) {
      console.error('Index upsert error:', error);
      return c.json({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 500);
    }
  }
);

// Delete documents from collection
router.delete('/index/:project/:collection', 
  authMiddleware.requireKey('write'), 
  zValidator('json', deleteDocSchema), 
  async (c) => {
    try {
      const { project, collection } = c.req.param();
      const { ids } = await c.req.json();

      const results = [];
      for (const id of ids) {
        try {
          await engine.remove(project, collection, id);
          results.push({ id, status: 'success' });
        } catch (error) {
          console.error(`Failed to delete document ${id}:`, error);
          results.push({ 
            id, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.length - successCount;

      return c.json({
        success: errorCount === 0,
        processed: results.length,
        successful: successCount,
        failed: errorCount,
        results
      });
    } catch (error) {
      console.error('Index delete error:', error);
      return c.json({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 500);
    }
  }
);

// Get collection info
router.get('/index/:project/:collection', 
  authMiddleware.requireKey('read'), 
  async (c) => {
    try {
      const { project, collection } = c.req.param();
      
      // This would need to be implemented in the search engine
      // For now, return basic info
      return c.json({
        project,
        collection,
        status: 'active',
        // TODO: Add document count, last updated, etc.
        documents: 0,
        last_updated: null
      });
    } catch (error) {
      console.error('Index info error:', error);
      return c.json({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 500);
    }
  }
);
