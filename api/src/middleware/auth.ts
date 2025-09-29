import { Context, Next } from 'hono';

export function requireKey(scope: 'read' | 'write') {
  return async (c: Context, next: Next) => {
    const key = c.req.header('x-api-key') || '';
    const expected = scope === 'read' ? process.env.API_READ_KEY : process.env.API_WRITE_KEY;
    if (!expected || key !== expected) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  };
}

export const authMiddleware = { requireKey };
