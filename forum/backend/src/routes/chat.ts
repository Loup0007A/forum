import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const chatRouter = Router();

chatRouter.get('/history/:room', async (req: Request, res: Response) => {
  const messages = await prisma.chatMessage.findMany({
    where: { room: req.params.room },
    take: 100,
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { username: true, avatarUrl: true, rank: true, role: true } } },
  });
  res.json(messages);
});
