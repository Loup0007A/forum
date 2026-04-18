// routes/chat.ts
import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
export const chatRouter = Router();

chatRouter.get('/history/:room', async (req, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { room: req.params.room },
    take: 100,
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { username: true, avatarUrl: true, rank: true, role: true } } },
  });
  res.json(messages);
});

// routes/notification.ts
import { Router as NotifRouter } from 'express';
export const notifRouter = NotifRouter();

notifRouter.get('/', async (req, res) => {
  const notifs = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifs);
});

notifRouter.patch('/:id/read', async (req, res) => {
  await prisma.notification.update({
    where: { id: req.params.id, userId: req.user!.id },
    data: { read: true },
  });
  res.json({ ok: true });
});

notifRouter.patch('/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});
