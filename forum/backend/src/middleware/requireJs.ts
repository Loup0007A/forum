import type { Request, Response, NextFunction } from 'express';

// Routes that don't require JS check (auth routes handle it themselves)
const EXEMPT_ROUTES = ['/api/auth/login', '/api/auth/register', '/api/health'];

export function requireJs(req: Request, res: Response, next: NextFunction): void {
  if (EXEMPT_ROUTES.some(r => req.path.startsWith(r))) {
    next();
    return;
  }

  const jsEnabled = req.headers['x-js-enabled'];
  
  if (!jsEnabled || jsEnabled !== '1') {
    res.status(403).json({ 
      error: 'JavaScript est requis pour accéder à ce forum.',
      code: 'JS_REQUIRED'
    });
    return;
  }

  next();
}
