import { Context, Next } from 'hono';
import { getDb } from '../db.js';
import crypto from 'crypto';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (c: Context) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    keyGenerator = (c) => c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [storeKey, data] of rateLimitStore.entries()) {
      if (data.resetTime < windowStart) {
        rateLimitStore.delete(storeKey);
      }
    }

    const current = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

    if (current.resetTime < now) {
      // Reset window
      current.count = 0;
      current.resetTime = now + windowMs;
    }

    // Check limit
    if (current.count >= maxRequests) {
      return c.json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      }, 429);
    }

    // Execute request
    await next();

    // Update counter (conditionally)
    const shouldCount = (!skipSuccessfulRequests || c.res.status >= 400) &&
                       (!skipFailedRequests || c.res.status < 400);

    if (shouldCount) {
      current.count++;
      rateLimitStore.set(key, current);
    }

    // Add rate limit headers
    c.res.headers.set('X-RateLimit-Limit', maxRequests.toString());
    c.res.headers.set('X-RateLimit-Remaining', Math.max(0, maxRequests - current.count).toString());
    c.res.headers.set('X-RateLimit-Reset', Math.ceil(current.resetTime / 1000).toString());
  };
}

/**
 * Enhanced API key authentication with database storage
 */
export function enhancedApiKeyAuth(scope: 'read' | 'write' | 'admin') {
  return async (c: Context, next: Next) => {
    const apiKey = c.req.header('x-api-key') || c.req.header('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return c.json({ error: 'API key required' }, 401);
    }

    try {
      const keyData = await validateApiKey(apiKey, scope);
      
      if (!keyData) {
        return c.json({ error: 'Invalid or expired API key' }, 401);
      }

      // Add key info to context
      c.set('apiKey', keyData);
      c.set('projectId', keyData.project_id);

      await next();

      // Update last used timestamp
      await updateApiKeyUsage(keyData.id);

    } catch (error) {
      console.error('API key validation error:', error);
      return c.json({ error: 'Authentication failed' }, 401);
    }
  };
}

/**
 * Validate API key against database
 */
async function validateApiKey(key: string, requiredScope: string): Promise<any> {
  const db = getDb();
  
  try {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    
    const result = await db.query(`
      SELECT id, scope, project_id, name, expires_at, created_at
      FROM api_keys 
      WHERE key_hash = $1 
      AND (expires_at IS NULL OR expires_at > NOW())
    `, [keyHash]);

    if (result.rows.length === 0) {
      return null;
    }

    const keyData = result.rows[0];

    // Check scope hierarchy: admin > write > read
    const scopeHierarchy = { read: 1, write: 2, admin: 3 };
    const userScope = scopeHierarchy[keyData.scope as keyof typeof scopeHierarchy] || 0;
    const requiredLevel = scopeHierarchy[requiredScope as keyof typeof scopeHierarchy] || 0;

    if (userScope < requiredLevel) {
      return null;
    }

    return keyData;
  } catch (error) {
    console.error('Database error during API key validation:', error);
    return null;
  }
}

/**
 * Update API key last used timestamp
 */
async function updateApiKeyUsage(keyId: string): Promise<void> {
  const db = getDb();
  
  try {
    await db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [keyId]);
  } catch (error) {
    console.error('Failed to update API key usage:', error);
    // Don't fail the request for this
  }
}

/**
 * CORS middleware with configurable origins
 */
export function corsMiddleware() {
  const allowedOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(o => o.trim());

  return async (c: Context, next: Next) => {
    const origin = c.req.header('origin');
    
    if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
      c.res.headers.set('Access-Control-Allow-Origin', origin || '*');
    }

    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Signature-SHA256');
    c.res.headers.set('Access-Control-Max-Age', '86400');

    if (c.req.method === 'OPTIONS') {
      return c.text('', 204);
    }

    await next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    // Security headers
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('X-Frame-Options', 'DENY');
    c.res.headers.set('X-XSS-Protection', '1; mode=block');
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    if (process.env.NODE_ENV === 'production') {
      c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
  };
}

/**
 * Request logging middleware
 */
export function requestLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const method = c.req.method;
    const url = c.req.url;
    const userAgent = c.req.header('user-agent') || 'unknown';
    const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown';

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    // Log format: timestamp method url status duration ip user-agent
    console.log(`${new Date().toISOString()} ${method} ${url} ${status} ${duration}ms ${ip} "${userAgent}"`);

    // Add response time header
    c.res.headers.set('X-Response-Time', `${duration}ms`);
  };
}

/**
 * Input validation middleware for common attacks
 */
export function inputSanitization() {
  return async (c: Context, next: Next) => {
    try {
      // Check for common attack patterns in query parameters
      const url = new URL(c.req.url);
      for (const [key, value] of url.searchParams.entries()) {
        if (containsSuspiciousPatterns(value)) {
          return c.json({ error: 'Invalid input detected' }, 400);
        }
      }

      // Check request body if present
      if (c.req.header('content-type')?.includes('application/json')) {
        try {
          const body = await c.req.text();
          if (containsSuspiciousPatterns(body)) {
            return c.json({ error: 'Invalid input detected' }, 400);
          }
          // Re-set body for next middleware
          c.req.bodyCache = JSON.parse(body);
        } catch (error) {
          // Invalid JSON will be caught by zod validation
        }
      }

      await next();
    } catch (error) {
      console.error('Input sanitization error:', error);
      return c.json({ error: 'Request processing failed' }, 400);
    }
  };
}

function containsSuspiciousPatterns(input: string): boolean {
  const suspiciousPatterns = [
    // SQL Injection patterns
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    /(\b(script|javascript|vbscript|onload|onerror|onclick)\b)/i,
    // XSS patterns
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    // Path traversal
    /\.\.[\/\\]/,
    // Command injection
    /[;&|`$()]/
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}
