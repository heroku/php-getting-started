import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/auth.js';
import { synonymsSchema } from '../schemas.js';

export const router = new Hono();

// Update synonyms
router.post('/synonyms/:project', 
  authMiddleware.requireKey('write'), 
  zValidator('json', synonymsSchema), 
  async (c) => {
    try {
      const { project } = c.req.param();
      const { add, remove } = await c.req.json();
      
      // TODO: Persist to database
      // For now, just validate and echo back
      
      const results = {
        added: add.map(synonym => ({
          id: `syn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          terms: synonym.terms,
          lang: synonym.lang,
          type: synonym.type,
          created_at: new Date().toISOString()
        })),
        removed: remove,
        project
      };

      console.log(`Synonyms updated for project ${project}:`, {
        added: results.added.length,
        removed: remove.length
      });

      return c.json({
        success: true,
        ...results
      });
    } catch (error) {
      console.error('Synonyms update error:', error);
      return c.json({ 
        error: 'Failed to update synonyms', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 500);
    }
  }
);

// Get synonyms for project
router.get('/synonyms/:project', 
  authMiddleware.requireKey('read'), 
  async (c) => {
    try {
      const { project } = c.req.param();
      const { lang } = c.req.query();
      
      // TODO: Fetch from database
      // For now, return empty list
      
      return c.json({
        project,
        lang: lang || 'all',
        synonyms: [],
        total: 0
      });
    } catch (error) {
      console.error('Synonyms fetch error:', error);
      return c.json({ 
        error: 'Failed to fetch synonyms', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 500);
    }
  }
);

// Delete specific synonym
router.delete('/synonyms/:project/:synonymId', 
  authMiddleware.requireKey('write'), 
  async (c) => {
    try {
      const { project, synonymId } = c.req.param();
      
      // TODO: Delete from database
      
      return c.json({
        success: true,
        deleted: synonymId,
        project
      });
    } catch (error) {
      console.error('Synonym delete error:', error);
      return c.json({ 
        error: 'Failed to delete synonym', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 500);
    }
  }
);
