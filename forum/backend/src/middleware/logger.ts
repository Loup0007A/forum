import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { extractRequestMeta } from '../utils/geo.js';
import { logger } from '../utils/logger.js';

const SKIP_PATHS = ['/api/health', '/api/auth/check'];

export function logRequest(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.some(p => req.path.startsWith(p))) {
    next();
    return;
  }

  const meta = extractRequestMeta(req);

  // Async log to DB (don't await to avoid blocking)
  prisma.systemLog.create({
    data: {
      userId: (req as any).user?.id || null,
      action: 'LOGIN', // will be overridden by specific actions
      ipAddress: meta.ip,
      country: meta.country,
      userAgent: meta.userAgent,
      browser: meta.browser,
      os: meta.os,
      page: req.path,
      metadata: {
        method: req.method,
        query: req.query,
      },
    },
  }).catch(err => logger.error('Log error:', err));

  next();
}
