import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../utils/prisma.js';
import { getClientIp, generateFingerprint } from '../utils/geo.js';
import { logger } from '../utils/logger.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        role: string;
        status: string;
      };
      sessionId?: string;
      clientIp?: string;
      fingerprint?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = getClientIp(req);
    const fingerprint = generateFingerprint(req);

    req.clientIp = ip;
    req.fingerprint = fingerprint;

    const ban = await prisma.ban.findFirst({
      where: {
        AND: [
          {
            OR: [
              { type: 'IP', value: ip },
              { type: 'FINGERPRINT', value: fingerprint }
            ]
          },
          {
            OR: [
              { permanent: true },
              { expiresAt: { gt: new Date() } }
            ]
          }
        ]
      }
    });

    if (ban) {
      logger.warn(`Tentative d'accès bannie: ${ip}`);
      res.status(403).json({ error: 'Accès refusé.' });
      return;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.token;

    if (!token) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Token invalide ou expiré.' });
      return;
    }

    const session = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        expiresAt: { gt: new Date() }
      }
    });

    if (!session) {
      res.status(401).json({ error: 'Session expirée.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, email: true, role: true, status: true }
    });

    if (!user) {
      res.status(401).json({ error: 'Utilisateur introuvable.' });
      return;
    }

    if (user.status === 'BANNED') {
      res.status(403).json({ error: 'Compte banni.' });
      return;
    }

    if (user.status === 'PENDING') {
      res.status(403).json({ error: 'Compte en attente.' });
      return;
    }

    req.user = user;
    req.sessionId = payload.sessionId;

    void prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() }
    }).catch(() => {});

    next();
  } catch (error) {
    logger.error('Auth error:', error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}

export function requireMod(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['MODERATOR', 'ADMIN'].includes(req.user.role)) {
    res.status(403).json({ error: 'Modérateur requis.' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin requis.' });
    return;
  }
  next();
}
