import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { sendWelcomeEmail, sendBanNotification } from '../utils/email.js';
import { invalidateAllSessions } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

// ─── GET DASHBOARD STATS ───────────────────────────────────────────────
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const [
    totalUsers, activeUsers, pendingUsers, totalThreads,
    totalPosts, totalBans, onlineUsers, postsToday,
    usersByCountry, activityByHour, recentLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'PENDING' } }),
    prisma.thread.count(),
    prisma.post.count({ where: { status: 'ACTIVE' } }),
    prisma.ban.count(),
    prisma.user.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } } }),
    prisma.post.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.systemLog.groupBy({ by: ['country'], _count: true, orderBy: { _count: { country: 'desc' } }, take: 10 }),
    prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM "createdAt") as hour, COUNT(*) as count
      FROM "SystemLog"
      WHERE "createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY hour ORDER BY hour
    `,
    prisma.systemLog.findMany({ take: 50, orderBy: { createdAt: 'desc' } }),
  ]);

  res.json({
    totalUsers, activeUsers, pendingUsers, totalThreads,
    totalPosts, totalBans, onlineUsers, postsToday,
    usersByCountry, activityByHour, recentLogs,
  });
}

// ─── LIST USERS ────────────────────────────────────────────────────────
export async function listUsers(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = 50;
  const { search, status, role } = req.query;

  const where: any = {};
  if (search) where.OR = [
    { username: { contains: search as string, mode: 'insensitive' } },
    { email: { contains: search as string, mode: 'insensitive' } },
  ];
  if (status) where.status = status;
  if (role) where.role = role;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, username: true, email: true, role: true, status: true,
        rank: true, points: true, country: true, createdAt: true, lastSeenAt: true,
        banExpiresAt: true, _count: { select: { posts: true, threads: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page, pages: Math.ceil(total / limit) });
}

// ─── VALIDATE USER (PENDING → ACTIVE) ─────────────────────────────────
export async function validateUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable.' }); return; }
  if (user.status !== 'PENDING') { res.status(400).json({ error: 'Compte non en attente.' }); return; }

  await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });

  await prisma.adminLog.create({
    data: {
      adminId: req.user!.id,
      action: 'USER_PROMOTE',
      targetId: userId,
      targetType: 'User',
      metadata: { action: 'validate', username: user.username },
    },
  });

  await sendWelcomeEmail(user.email, user.username);

  logger.info(`Compte validé: ${user.username} par ${req.user!.username}`);
  res.json({ message: `Compte de ${user.username} validé.` });
}

// ─── BAN USER ─────────────────────────────────────────────────────────
export async function banUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { reason, duration, permanent } = req.body;

  if (userId === req.user!.id) { res.status(400).json({ error: 'Impossible de se bannir soi-même.' }); return; }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) { res.status(404).json({ error: 'Utilisateur introuvable.' }); return; }

  if (target.role === 'ADMIN') { res.status(403).json({ error: 'Impossible de bannir un admin.' }); return; }

  const expiresAt = permanent ? null : duration
    ? new Date(Date.now() + parseInt(duration) * 60 * 60 * 1000)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { status: 'BANNED', banExpiresAt: expiresAt },
  });

  // Ban IP too
  const recentSession = await prisma.session.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (recentSession?.ipAddress) {
    await prisma.ban.create({
      data: {
        type: 'IP',
        value: recentSession.ipAddress,
        reason,
        permanent: !!permanent,
        expiresAt,
        bannedById: req.user!.id,
      },
    });
  }

  // Invalidate all sessions
  await invalidateAllSessions(userId);

  await prisma.adminLog.create({
    data: {
      adminId: req.user!.id,
      action: 'USER_BAN',
      targetId: userId,
      targetType: 'User',
      reason,
      metadata: { permanent, duration, username: target.username },
    },
  });

  await sendBanNotification(target.email, target.username, reason, expiresAt || undefined);

  logger.warn(`Utilisateur banni: ${target.username} par ${req.user!.username} — Raison: ${reason}`);
  res.json({ message: `${target.username} a été banni.` });
}

// ─── UNBAN USER ────────────────────────────────────────────────────────
export async function unbanUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable.' }); return; }

  await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE', banExpiresAt: null } });

  await prisma.adminLog.create({
    data: {
      adminId: req.user!.id,
      action: 'USER_UNBAN',
      targetId: userId,
      targetType: 'User',
      metadata: { username: user.username },
    },
  });

  res.json({ message: `${user.username} a été débanni.` });
}

// ─── PROMOTE USER ─────────────────────────────────────────────────────
export async function promoteUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['USER', 'MODERATOR', 'ADMIN'].includes(role)) {
    res.status(400).json({ error: 'Rôle invalide.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable.' }); return; }

  await prisma.user.update({ where: { id: userId }, data: { role } });

  await prisma.adminLog.create({
    data: {
      adminId: req.user!.id,
      action: 'USER_PROMOTE',
      targetId: userId,
      targetType: 'User',
      metadata: { newRole: role, username: user.username },
    },
  });

  logger.info(`${user.username} promu ${role} par ${req.user!.username}`);
  res.json({ message: `${user.username} est maintenant ${role}.` });
}

// ─── GET ADMIN LOGS ────────────────────────────────────────────────────
export async function getAdminLogs(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = 50;

  const [logs, total] = await Promise.all([
    prisma.adminLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { admin: { select: { username: true, avatarUrl: true } } },
    }),
    prisma.adminLog.count(),
  ]);

  res.json({ logs, total, page, pages: Math.ceil(total / limit) });
}

// ─── GET REPORTS ──────────────────────────────────────────────────────
export async function getReports(req: Request, res: Response): Promise<void> {
  const resolved = req.query.resolved === 'true';

  const reports = await prisma.report.findMany({
    where: { resolved },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      reporter: { select: { username: true } },
      reported: { select: { username: true } },
      post: { select: { id: true, content: true } },
      thread: { select: { title: true, slug: true } },
    },
  });

  res.json(reports);
}

// ─── RESOLVE REPORT ───────────────────────────────────────────────────
export async function resolveReport(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await prisma.report.update({ where: { id }, data: { resolved: true, resolvedAt: new Date() } });
  res.json({ message: 'Signalement résolu.' });
}

// ─── MANAGE BANS ─────────────────────────────────────────────────────
export async function getBans(req: Request, res: Response): Promise<void> {
  const bans = await prisma.ban.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  res.json(bans);
}

export async function removeBan(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await prisma.ban.delete({ where: { id } });
  res.json({ message: 'Bannissement supprimé.' });
}
