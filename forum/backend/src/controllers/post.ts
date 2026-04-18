import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { io } from '../index.js';

// ─── CREATE POST ───────────────────────────────────────────────────────
export async function createPost(req: Request, res: Response): Promise<void> {
  const { content, threadId, parentId } = req.body;

  if (!content || !threadId) {
    res.status(400).json({ error: 'Contenu et threadId requis.' });
    return;
  }

  if (content.length < 2) {
    res.status(400).json({ error: 'Le message est trop court.' });
    return;
  }

  if (content.length > 50000) {
    res.status(400).json({ error: 'Le message est trop long (50 000 caractères max).' });
    return;
  }

  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread) {
    res.status(404).json({ error: 'Sujet introuvable.' });
    return;
  }

  if (thread.isLocked && req.user?.role === 'USER') {
    res.status(403).json({ error: 'Ce sujet est verrouillé.' });
    return;
  }

  const post = await prisma.post.create({
    data: {
      content,
      threadId,
      authorId: req.user!.id,
      parentId: parentId || null,
    },
    include: {
      author: {
        select: {
          id: true, username: true, avatarUrl: true, rank: true,
          points: true, signature: true, role: true, createdAt: true,
          _count: { select: { posts: true } },
        },
      },
      reactions: true,
      attachments: true,
    },
  });

  // Update thread updatedAt
  await prisma.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

  // Update user points
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { points: { increment: 5 } },
  });

  // Update user rank
  await updateUserRank(req.user!.id);

  // Log
  await prisma.systemLog.create({
    data: {
      userId: req.user!.id,
      action: 'POST_CREATE',
      ipAddress: req.clientIp,
      metadata: { postId: post.id, threadId },
    },
  }).catch(() => {});

  // Emit via Socket.io for real-time updates
  io.to(`thread:${threadId}`).emit('new_post', post);

  logger.info(`Post créé dans thread ${threadId} par ${req.user!.username}`);
  res.status(201).json(post);
}

// ─── EDIT POST ─────────────────────────────────────────────────────────
export async function editPost(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { content } = req.body;

  const post = await prisma.post.findUnique({ where: { id }, include: { thread: true } });
  if (!post) { res.status(404).json({ error: 'Message introuvable.' }); return; }

  const canEdit = req.user?.id === post.authorId || ['MODERATOR', 'ADMIN'].includes(req.user?.role || '');
  if (!canEdit) { res.status(403).json({ error: 'Permissions insuffisantes.' }); return; }

  if (post.thread.isLocked && req.user?.role === 'USER') {
    res.status(403).json({ error: 'Ce sujet est verrouillé.' });
    return;
  }

  const updated = await prisma.post.update({
    where: { id },
    data: { content, editedAt: new Date() },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true, rank: true } },
      reactions: true,
    },
  });

  io.to(`thread:${post.threadId}`).emit('post_updated', updated);
  res.json(updated);
}

// ─── DELETE POST ───────────────────────────────────────────────────────
export async function deletePost(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) { res.status(404).json({ error: 'Message introuvable.' }); return; }

  const canDelete = req.user?.id === post.authorId || ['MODERATOR', 'ADMIN'].includes(req.user?.role || '');
  if (!canDelete) { res.status(403).json({ error: 'Permissions insuffisantes.' }); return; }

  // Soft delete
  await prisma.post.update({ where: { id }, data: { status: 'DELETED' } });

  await prisma.adminLog.create({
    data: {
      adminId: req.user!.id,
      action: 'POST_DELETE',
      targetId: id,
      targetType: 'Post',
      metadata: { threadId: post.threadId },
    },
  });

  io.to(`thread:${post.threadId}`).emit('post_deleted', { postId: id });
  res.json({ message: 'Message supprimé.' });
}

// ─── REACT TO POST ─────────────────────────────────────────────────────
export async function reactToPost(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { emoji } = req.body;

  const validEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];
  if (!validEmojis.includes(emoji)) {
    res.status(400).json({ error: 'Emoji non valide.' });
    return;
  }

  const existing = await prisma.reaction.findUnique({
    where: { userId_postId_emoji: { userId: req.user!.id, postId: id, emoji } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    res.json({ removed: true, emoji });
  } else {
    await prisma.reaction.create({
      data: { emoji, userId: req.user!.id, postId: id },
    });
    res.json({ added: true, emoji });
  }
}

// ─── MARK BEST ANSWER ──────────────────────────────────────────────────
export async function markBestAnswer(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: { thread: true },
  });

  if (!post) { res.status(404).json({ error: 'Message introuvable.' }); return; }

  const isThreadAuthor = req.user?.id === post.thread.authorId;
  const isMod = ['MODERATOR', 'ADMIN'].includes(req.user?.role || '');

  if (!isThreadAuthor && !isMod) {
    res.status(403).json({ error: 'Seul l\'auteur du sujet peut choisir la meilleure réponse.' });
    return;
  }

  // Unmark all others
  await prisma.post.updateMany({ where: { threadId: post.threadId }, data: { isBestAnswer: false } });
  await prisma.post.update({ where: { id }, data: { isBestAnswer: true } });

  res.json({ message: 'Meilleure réponse marquée.' });
}

// ─── REPORT POST ───────────────────────────────────────────────────────
export async function reportPost(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason, description } = req.body;

  await prisma.report.create({
    data: {
      reason,
      description,
      reporterId: req.user!.id,
      postId: id,
    },
  });

  res.json({ message: 'Signalement envoyé.' });
}

// ─── HELPER: UPDATE RANK ───────────────────────────────────────────────
async function updateUserRank(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true } });
  if (!user) return;

  let rank = 'Nouveau';
  if (user.points >= 5000) rank = 'Légende';
  else if (user.points >= 1000) rank = 'Expert';
  else if (user.points >= 300) rank = 'Confirmé';
  else if (user.points >= 50) rank = 'Actif';

  await prisma.user.update({ where: { id: userId }, data: { rank } });
}
