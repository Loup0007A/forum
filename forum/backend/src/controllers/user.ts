import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import argon2 from 'argon2';

export async function getProfile(req: Request, res: Response): Promise<void> {
  const { username } = req.params;
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true, username: true, bio: true, signature: true,
      avatarUrl: true, rank: true, points: true, country: true,
      createdAt: true, lastSeenAt: true, role: true,
      discordId: true, twitchId: true, youtubeId: true,
      badges: { include: { badge: true } },
      _count: { select: { posts: true, threads: true, followers: true, following: true } },
    },
  });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable.' }); return; }
  res.json(user);
}

export async function editProfile(req: Request, res: Response): Promise<void> {
  const { bio, signature, country, avatarUrl, discordId, twitchId, youtubeId } = req.body;
  if (bio && bio.length > 1000) { res.status(400).json({ error: 'Bio trop longue.' }); return; }
  if (signature && signature.length > 500) { res.status(400).json({ error: 'Signature trop longue.' }); return; }

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { bio, signature, country, avatarUrl, discordId, twitchId, youtubeId },
    select: { id: true, username: true, bio: true, signature: true, avatarUrl: true, rank: true, points: true, country: true },
  });
  res.json(updated);
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) { res.status(400).json({ error: 'Champs requis.' }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: 'Mot de passe trop court.' }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable.' }); return; }

  const valid = await argon2.verify(user.passwordHash, currentPassword);
  if (!valid) { res.status(401).json({ error: 'Mot de passe actuel incorrect.' }); return; }

  const hash = await argon2.hash(newPassword, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
  await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash: hash } });
  res.json({ message: 'Mot de passe modifié.' });
}

export async function toggleFollow(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  if (userId === req.user!.id) { res.status(400).json({ error: 'Impossible de vous suivre vous-même.' }); return; }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: req.user!.id, followingId: userId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    res.json({ following: false });
  } else {
    await prisma.follow.create({ data: { followerId: req.user!.id, followingId: userId } });
    res.json({ following: true });
  }
}

export async function toggleBlock(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: req.user!.id, blockedId: userId } },
  });

  if (existing) {
    await prisma.block.delete({ where: { id: existing.id } });
    res.json({ blocked: false });
  } else {
    await prisma.block.create({ data: { blockerId: req.user!.id, blockedId: userId } });
    res.json({ blocked: true });
  }
}

export async function getMessages(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 30;

  const messages = await prisma.privateMessage.findMany({
    where: {
      OR: [
        { senderId: req.user!.id, receiverId: userId, deletedBySender: false },
        { senderId: userId, receiverId: req.user!.id, deletedByReceiver: false },
      ],
    },
    orderBy: { createdAt: 'asc' },
    skip: (page - 1) * limit,
    take: limit,
    include: { sender: { select: { username: true, avatarUrl: true } } },
  });

  void prisma.privateMessage.updateMany({
    where: { senderId: userId, receiverId: req.user!.id, readAt: null },
    data: { readAt: new Date() },
  }).catch(() => {});

  res.json(messages);
}

export async function getConversations(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  const [sent, received] = await Promise.all([
    prisma.privateMessage.findMany({
      where: { senderId: userId, deletedBySender: false },
      distinct: ['receiverId'],
      orderBy: { createdAt: 'desc' },
      include: { receiver: { select: { id: true, username: true, avatarUrl: true } } },
    }),
    prisma.privateMessage.findMany({
      where: { receiverId: userId, deletedByReceiver: false },
      distinct: ['senderId'],
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
    }),
  ]);

  const partnersMap = new Map<string, { id: string; username: string; avatarUrl: string | null }>();
  sent.forEach(m => partnersMap.set(m.receiverId, m.receiver));
  received.forEach(m => partnersMap.set(m.senderId, m.sender));

  res.json([...partnersMap.values()]);
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { receiverId, content } = req.body;
  if (!receiverId || !content) { res.status(400).json({ error: 'Destinataire et contenu requis.' }); return; }
  if (receiverId === req.user!.id) { res.status(400).json({ error: 'Impossible de vous écrire à vous-même.' }); return; }

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: receiverId, blockedId: req.user!.id },
        { blockerId: req.user!.id, blockedId: receiverId },
      ],
    },
  });
  if (blocked) { res.status(403).json({ error: 'Impossible d\'envoyer un message à cet utilisateur.' }); return; }

  const message = await prisma.privateMessage.create({
    data: { content, senderId: req.user!.id, receiverId },
    include: { sender: { select: { username: true, avatarUrl: true } } },
  });
  res.status(201).json(message);
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  const { password } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable.' }); return; }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) { res.status(401).json({ error: 'Mot de passe incorrect.' }); return; }

  await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      username: `[Supprimé-${Date.now()}]`,
      email: `deleted-${Date.now()}@deleted.invalid`,
      passwordHash: 'DELETED',
      bio: null, signature: null, avatarUrl: null,
      status: 'BANNED',
    },
  });

  res.clearCookie('token');
  res.json({ message: 'Compte supprimé conformément au RGPD.' });
}

export async function saveDraft(req: Request, res: Response): Promise<void> {
  const { content, title, threadId, forumId, draftId } = req.body;

  if (draftId) {
    const draft = await prisma.draft.update({
      where: { id: draftId },
      data: { content, title, updatedAt: new Date() },
    }).catch(() => null);
    if (draft) { res.json(draft); return; }
  }

  const draft = await prisma.draft.create({
    data: { content, title, userId: req.user!.id, threadId, forumId },
  });
  res.json(draft);
}

export async function getDrafts(req: Request, res: Response): Promise<void> {
  const drafts = await prisma.draft.findMany({
    where: { userId: req.user!.id },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(drafts);
}
