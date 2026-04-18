import { Router } from 'express';
import { prisma } from '../utils/prisma.js';

export const notifRouter = Router();

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
