import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from './middleware/auth.js';
import { router as indexRouter } from './routes/index.js';
import { router as searchRouter } from './routes/search.js';
import { router as askRouter } from './routes/ask.js';
import { router as synonymsRouter } from './routes/synonyms.js';
import { router as metricsRouter } from './routes/metrics.js';
import { router as webhookRouter } from './routes/webhook.js';
import { router as adminRouter } from './routes/admin.js';
import { rateLimit, corsMiddleware, securityHeaders, requestLogger, inputSanitization } from './middleware/security.js';

const app = new Hono();

// Security middleware
app.use('*', corsMiddleware());
app.use('*', securityHeaders());
app.use('*', requestLogger());
app.use('*', inputSanitization());

// Rate limiting (configurable per environment)
const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
};
app.use('*', rateLimit(rateLimitConfig));

app.use('*', prettyJSON());

// Health
app.get('/health', c => c.json({ ok: true }));

// API routes (v1 prefix)
app.route('/v1', indexRouter);
app.route('/v1', searchRouter);
app.route('/v1', askRouter);
app.route('/v1', synonymsRouter);
app.route('/v1', metricsRouter);
app.route('/v1', webhookRouter);
app.route('/v1', adminRouter);

// 404
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

const port = Number(process.env.PORT) || 8787;
export default {
  port,
  fetch: app.fetch,
};

if (process.env.NODE_ENV !== 'production') {
  // Check if running with Bun
  if (typeof Bun !== 'undefined' && Bun?.serve) {
    Bun.serve({ fetch: app.fetch, port });
    console.log(`[api] listening with Bun on http://localhost:${port}`);
  } else {
    // Use Node.js server
    (async () => {
      const { serve } = await import('@hono/node-server');
      serve({ fetch: app.fetch, port });
      console.log(`[api] listening with Node.js on http://localhost:${port}`);
    })();
  }
}
