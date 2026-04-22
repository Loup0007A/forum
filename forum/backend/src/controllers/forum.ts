import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export async function getCategories(_req: Request, res: Response): Promise<void> {
  const categories = await prisma.category.findMany({
    orderBy: { order: 'asc' },
    include: {
      forums: {
        where: { parentId: null },
        orderBy: { order: 'asc' },
        include: {
          subForums: { orderBy: { order: 'asc' } },
          _count: { select: { threads: true } },
          threads: {
            take: 1,
            orderBy: { updatedAt: 'desc' },
            include: {
              author: { select: { username: true, avatarUrl: true } },
              posts: {
                take: 1,
                orderBy: { createdAt: 'desc' },
                include: { author: { select: { username: true } } },
              },
            },
          },
        },
      },
    },
  });
  res.json(categories);
}

export async function getForum(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;

  const forum = await prisma.forum.findUnique({
    where: { slug },
    include: { category: true, subForums: { orderBy: { order: 'asc' } } },
  });

  if (!forum) { res.status(404).json({ error: 'Forum introuvable.' }); return; }

  const [threads, total] = await Promise.all([
    prisma.thread.findMany({
      where: { forumId: forum.id },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: { select: { username: true, avatarUrl: true, rank: true } },
        tags: true,
        _count: { select: { posts: true } },
        posts: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { username: true } } },
        },
      },
    }),
    prisma.thread.count({ where: { forumId: forum.id } }),
  ]);

  res.json({ forum, threads, total, page, pages: Math.ceil(total / limit) });
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  if (req.user?.role !== 'ADMIN') { res.status(403).json({ error: 'Admin requis.' }); return; }
  const { name, description, slug, icon, order } = req.body;
  if (!name || !slug) { res.status(400).json({ error: 'Nom et slug requis.' }); return; }

  const category = await prisma.category.create({
    data: { name, description, slug, icon, order: order || 0 },
  });

  void prisma.adminLog.create({
    data: { adminId: req.user.id, action: 'CATEGORY_CREATE', targetId: category.id, targetType: 'Category', metadata: { name, slug } },
  }).catch(() => {});

  logger.info(`Catégorie créée: ${name}`);
  res.status(201).json(category);
}

export async function createForum(req: Request, res: Response): Promise<void> {
  if (req.user?.role !== 'ADMIN') { res.status(403).json({ error: 'Admin requis.' }); return; }
  const { name, description, slug, categoryId, parentId, order } = req.body;
  if (!name || !slug || !categoryId) { res.status(400).json({ error: 'Nom, slug et categoryId requis.' }); return; }

  const forum = await prisma.forum.create({
    data: { name, description, slug, categoryId, parentId, order: order || 0 },
  });

  res.status(201).json(forum);
}
