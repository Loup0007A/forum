import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { extractRequestMeta } from '../utils/geo';
import { logger } from '../utils/logger';

const SKIP = ['/api/health', '/api/auth/check'];

export function logRequest(req: Request, _res: Response, next: NextFunction): void {
  if (SKIP.some(p => req.path.includes(p))) {
    next();
    return;
  }

  const meta = extractRequestMeta(req);

  void prisma.systemLog.create({
    data: {
      action: 'LOGIN',
      ipAddress: meta.ip,
      country: meta.country,
      userAgent: meta.userAgent,
      browser: meta.browser,
      os: meta.os,
      page: req.path,
      metadata: { method: req.method },
    },
  }).catch((err: Error) => logger.error('Log error:', err));

  next();
}
