import { Request, Response, NextFunction } from 'express';

const EXEMPT = ['/api/auth/login', '/api/auth/register', '/api/health'];

export function requireJs(req: Request, res: Response, next: NextFunction): void {
  if (EXEMPT.some(r => req.path.startsWith(r.replace('/api', '')))) {
    next();
    return;
  }
  const jsEnabled = req.headers['x-js-enabled'];
  if (!jsEnabled || jsEnabled !== '1') {
    res.status(403).json({ error: 'JavaScript est requis.', code: 'JS_REQUIRED' });
    return;
  }
  next();
}
