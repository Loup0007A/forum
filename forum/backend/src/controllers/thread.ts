import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) + '-' + Date.now();
}

export async function getThread(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;

  const thread = await prisma.thread.findUnique({
    where: { slug },
    include: {
      author: {
        select: {
          id: true, username: true, avatarUrl: true, rank: true,
          points: true, signature: true, createdAt: true,
          _count: { select: { posts: true } },
        },
      },
      forum: { include: { category: true } },
      tags: true,
      poll: {
        include: {
          options: { include: { _count: { select: { votes: true } } } },
          votes: { where: { userId: req.user?.id ?? '' } },
        },
      },
    },
  });

  if (!thread) { res.status(404).json({ error: 'Sujet introuvable.' }); return; }

  void prisma.thread.update({ where: { id: thread.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { threadId: thread.id, status: 'ACTIVE', parentId: null },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: {
          select: {
            id: true, username: true, avatarUrl: true, rank: true,
            points: true, signature: true, createdAt: true, role: true,
            _count: { select: { posts: true } },
          },
        },
        reactions: { include: { user: { select: { username: true } } } },
        attachments: true,
        replies: {
          where: { status: 'ACTIVE' },
          include: { author: { select: { id: true, username: true, avatarUrl: true, rank: true } } },
        },
      },
    }),
    prisma.post.count({ where: { threadId: thread.id, status: 'ACTIVE' } }),
  ]);

  res.json({ thread, posts, total, page, pages: Math.ceil(total / limit) });
}

export async function createThread(req: Request, res: Response): Promise<void> {
  const { title, content, forumId, tags } = req.body;

  if (!title || !content || !forumId) {
    res.status(400).json({ error: 'Titre, contenu et forum requis.' });
    return;
  }
  if (title.length < 5 || title.length > 200) {
    res.status(400).json({ error: 'Le titre doit faire entre 5 et 200 caractères.' });
    return;
  }

  const forum = await prisma.forum.findUnique({ where: { id: forumId } });
  if (!forum) { res.status(404).json({ error: 'Forum introuvable.' }); return; }

  const slug = slugify(title);

  const thread = await prisma.thread.create({
    data: {
      title,
      slug,
      forumId,
      authorId: req.user!.id,
      tags: tags?.length
        ? {
            connectOrCreate: (tags as string[]).map((name: string) => ({
              where: { name },
              create: { name },
            })),
          }
        : undefined,
      posts: {
        create: { content, authorId: req.user!.id },
      },
    },
    include: { forum: true, tags: true, posts: true },
  });

  void prisma.user.update({
    where: { id: req.user!.id },
    data: { points: { increment: 10 } },
  }).catch(() => {});

  void prisma.systemLog.create({
    data: { userId: req.user!.id, action: 'THREAD_CREATE', ipAddress: req.clientIp, metadata: { threadId: thread.id, title } },
  }).catch(() => {});

  logger.info(`Thread créé: "${title}" par ${req.user!.username}`);
  res.status(201).json(thread);
}

export async function deleteThread(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const thread = await prisma.thread.findUnique({ where: { id } });
  if (!thread) { res.status(404).json({ error: 'Sujet introuvable.' }); return; }

  const canDelete = req.user?.id === thread.authorId || ['MODERATOR', 'ADMIN'].includes(req.user?.role || '');
  if (!canDelete) { res.status(403).json({ error: 'Permissions insuffisantes.' }); return; }

  await prisma.thread.delete({ where: { id } });

  void prisma.adminLog.create({
    data: { adminId: req.user!.id, action: 'THREAD_DELETE', targetId: id, targetType: 'Thread', metadata: { title: thread.title } },
  }).catch(() => {});

  res.json({ message: 'Sujet supprimé.' });
}

export async function pinThread(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const thread = await prisma.thread.findUnique({ where: { id } });
  if (!thread) { res.status(404).json({ error: 'Sujet introuvable.' }); return; }

  const updated = await prisma.thread.update({ where: { id }, data: { isPinned: !thread.isPinned } });

  void prisma.adminLog.create({
    data: { adminId: req.user!.id, action: 'THREAD_PIN', targetId: id, targetType: 'Thread', metadata: { pinned: updated.isPinned } },
  }).catch(() => {});

  res.json(updated);
}

export async function closeThread(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const thread = await prisma.thread.findUnique({ where: { id } });
  if (!thread) { res.status(404).json({ error: 'Sujet introuvable.' }); return; }

  const updated = await prisma.thread.update({
    where: { id },
    data: {
      isLocked: !thread.isLocked,
      status: !thread.isLocked ? 'CLOSED' : 'OPEN',
    },
  });

  void prisma.adminLog.create({
    data: { adminId: req.user!.id, action: 'THREAD_CLOSE', targetId: id, targetType: 'Thread', metadata: { locked: updated.isLocked } },
  }).catch(() => {});

  res.json(updated);
}

export async function searchThreads(req: Request, res: Response): Promise<void> {
  const { q, author, forumId, from, to, page: p } = req.query;
  const page = parseInt(p as string) || 1;
  const limit = 20;

  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { title: { contains: q as string, mode: 'insensitive' } },
      { posts: { some: { content: { contains: q as string, mode: 'insensitive' } } } },
    ];
  }
  if (author) where.author = { username: { contains: author as string, mode: 'insensitive' } };
  if (forumId) where.forumId = forumId;
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);
    where.createdAt = dateFilter;
  }

  const [threads, total] = await Promise.all([
    prisma.thread.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: { select: { username: true, avatarUrl: true } },
        forum: { select: { name: true, slug: true } },
        tags: true,
        _count: { select: { posts: true } },
      },
    }),
    prisma.thread.count({ where }),
  ]);

  res.json({ threads, total, page, pages: Math.ceil(total / limit) });
}
