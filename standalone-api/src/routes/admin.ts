import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { enhancedApiKeyAuth } from '../middleware/security.js';
import { getDb } from '../db.js';
import crypto from 'crypto';

export const router = new Hono();

// Schema for creating API keys
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scope: z.enum(['read', 'write', 'admin']),
  project_id: z.string().optional(),
  expires_in_days: z.number().int().min(1).max(365).optional()
});

// Schema for updating API keys
const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  expires_in_days: z.number().int().min(1).max(365).optional()
});

// Create API key
router.post('/admin/api-keys',
  enhancedApiKeyAuth('admin'),
  zValidator('json', createApiKeySchema),
  async (c) => {
    try {
      const { name, scope, project_id, expires_in_days } = await c.req.json();
      
      // Generate secure API key
      const apiKey = generateApiKey();
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const keyId = crypto.randomUUID();
      
      const expiresAt = expires_in_days 
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const db = getDb();
      await db.query(`
        INSERT INTO api_keys (id, key_hash, scope, project_id, name, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [keyId, keyHash, scope, project_id, name, expiresAt]);

      return c.json({
        id: keyId,
        key: apiKey, // Only returned once!
        name,
        scope,
        project_id,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        warning: 'Store this key securely - it will not be shown again!'
      });
    } catch (error) {
      console.error('API key creation error:', error);
      return c.json({ 
        error: 'Failed to create API key',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// List API keys
router.get('/admin/api-keys',
  enhancedApiKeyAuth('admin'),
  async (c) => {
    try {
      const db = getDb();
      const result = await db.query(`
        SELECT id, scope, project_id, name, expires_at, created_at, last_used_at
        FROM api_keys
        ORDER BY created_at DESC
      `);

      const keys = result.rows.map(row => ({
        ...row,
        is_expired: row.expires_at ? new Date(row.expires_at) < new Date() : false,
        key_preview: '***' + crypto.createHash('sha256').update(row.id).digest('hex').slice(-8)
      }));

      return c.json({ keys });
    } catch (error) {
      console.error('API key listing error:', error);
      return c.json({ 
        error: 'Failed to list API keys',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Update API key
router.patch('/admin/api-keys/:keyId',
  enhancedApiKeyAuth('admin'),
  zValidator('json', updateApiKeySchema),
  async (c) => {
    try {
      const keyId = c.req.param('keyId');
      const updates = await c.req.json();
      
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      if (updates.name) {
        setParts.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }

      if (updates.expires_in_days) {
        const expiresAt = new Date(Date.now() + updates.expires_in_days * 24 * 60 * 60 * 1000).toISOString();
        setParts.push(`expires_at = $${paramIndex++}`);
        values.push(expiresAt);
      }

      if (setParts.length === 0) {
        return c.json({ error: 'No updates provided' }, 400);
      }

      values.push(keyId);
      
      const db = getDb();
      const result = await db.query(`
        UPDATE api_keys 
        SET ${setParts.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING id, name, scope, project_id, expires_at, updated_at
      `, values);

      if (result.rows.length === 0) {
        return c.json({ error: 'API key not found' }, 404);
      }

      return c.json({ key: result.rows[0] });
    } catch (error) {
      console.error('API key update error:', error);
      return c.json({ 
        error: 'Failed to update API key',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Delete API key
router.delete('/admin/api-keys/:keyId',
  enhancedApiKeyAuth('admin'),
  async (c) => {
    try {
      const keyId = c.req.param('keyId');
      
      const db = getDb();
      const result = await db.query('DELETE FROM api_keys WHERE id = $1 RETURNING id, name', [keyId]);

      if (result.rows.length === 0) {
        return c.json({ error: 'API key not found' }, 404);
      }

      return c.json({ 
        success: true,
        deleted: result.rows[0]
      });
    } catch (error) {
      console.error('API key deletion error:', error);
      return c.json({ 
        error: 'Failed to delete API key',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Get API key usage statistics
router.get('/admin/api-keys/:keyId/usage',
  enhancedApiKeyAuth('admin'),
  async (c) => {
    try {
      const keyId = c.req.param('keyId');
      const { from, to } = c.req.query();
      
      // TODO: Implement usage tracking from request logs
      // This would require storing request logs with API key references
      
      return c.json({
        key_id: keyId,
        period: { from, to },
        total_requests: 0,
        requests_by_day: [],
        endpoints_used: [],
        last_activity: null
      });
    } catch (error) {
      console.error('API key usage error:', error);
      return c.json({ 
        error: 'Failed to get API key usage',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// System health check (admin only)
router.get('/admin/health',
  enhancedApiKeyAuth('admin'),
  async (c) => {
    try {
      const db = getDb();
      
      // Check database
      const dbStart = Date.now();
      await db.query('SELECT 1');
      const dbTime = Date.now() - dbStart;

      // Check Meilisearch
      const meiliStart = Date.now();
      const meiliUrl = process.env.MEILI_URL || 'http://localhost:7700';
      let meiliStatus = 'unknown';
      let meiliTime = 0;
      
      try {
        const response = await fetch(`${meiliUrl}/health`);
        meiliTime = Date.now() - meiliStart;
        meiliStatus = response.ok ? 'healthy' : 'unhealthy';
      } catch (error) {
        meiliTime = Date.now() - meiliStart;
        meiliStatus = 'error';
      }

      // System stats
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'healthy',
            response_time_ms: dbTime
          },
          meilisearch: {
            status: meiliStatus,
            response_time_ms: meiliTime,
            url: meiliUrl
          }
        },
        system: {
          uptime_seconds: Math.floor(uptime),
          memory: {
            rss: Math.floor(memoryUsage.rss / 1024 / 1024) + 'MB',
            heap_used: Math.floor(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            heap_total: Math.floor(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
          },
          node_version: process.version,
          environment: process.env.NODE_ENV || 'development'
        }
      });
    } catch (error) {
      console.error('Health check error:', error);
      return c.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

function generateApiKey(): string {
  // Generate a secure, URL-safe API key
  const prefix = 'pc_';
  const randomBytes = crypto.randomBytes(32);
  const key = randomBytes.toString('base64url');
  return prefix + key;
}
