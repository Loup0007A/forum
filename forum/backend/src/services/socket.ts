import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

interface SocketData {
  userId: string;
  username: string;
  role: string;
}

const onlineUsers = new Map<string, { username: string; room: string; socketId: string }>();

// Store io reference set from index.ts
let ioInstance: Server | null = null;

export function getIo(): Server {
  if (!ioInstance) throw new Error('Socket.io not initialized');
  return ioInstance;
}

export function setupSocketHandlers(io: Server): void {
  ioInstance = io;

  // Auth middleware
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const authData = socket.handshake.auth as Record<string, string>;
      const authHeader = socket.handshake.headers.authorization as string | undefined;
      const token = authData.token || (authHeader ? authHeader.slice(7) : '');

      if (!token) { next(new Error('Token manquant')); return; }

      const payload = verifyToken(token);
      if (!payload) { next(new Error('Token invalide')); return; }

      const session = await prisma.session.findFirst({
        where: { id: payload.sessionId, userId: payload.userId, expiresAt: { gt: new Date() } },
      });
      if (!session) { next(new Error('Session expirée')); return; }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, username: true, role: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE') { next(new Error('Accès refusé')); return; }

      (socket.data as SocketData) = { userId: user.id, username: user.username, role: user.role };
      next();
    } catch {
      next(new Error("Erreur d'authentification"));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId, username, role } = socket.data as SocketData;
    logger.info(`Socket connecté: ${username} (${socket.id})`);

    socket.on('join_thread', (threadId: string) => {
      void socket.join(`thread:${threadId}`);
    });

    socket.on('leave_thread', (threadId: string) => {
      void socket.leave(`thread:${threadId}`);
    });

    socket.on('join_chat', (room = 'general') => {
      void socket.join(`chat:${room}`);
      onlineUsers.set(userId, { username, room, socketId: socket.id });
      io.emit('online_users', [...onlineUsers.values()]);

      void prisma.chatMessage.findMany({
        where: { room },
        take: 50,
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { username: true, avatarUrl: true, rank: true, role: true } } },
      }).then(messages => socket.emit('chat_history', messages));
    });

    socket.on('leave_chat', (room = 'general') => {
      void socket.leave(`chat:${room}`);
      onlineUsers.delete(userId);
      io.emit('online_users', [...onlineUsers.values()]);
    });

    socket.on('chat_message', async (data: { content: string; room?: string }) => {
      const room = data.room || 'general';
      const content = data.content?.trim();
      if (!content || content.length > 2000) { socket.emit('error', { message: 'Message invalide.' }); return; }

      const recentCount = await prisma.chatMessage.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - 1500) } },
      });
      if (recentCount >= 2) { socket.emit('error', { message: 'Trop rapide.' }); return; }

      const message = await prisma.chatMessage.create({
        data: { content, userId, room },
        include: { user: { select: { username: true, avatarUrl: true, rank: true, role: true } } },
      });
      io.to(`chat:${room}`).emit('chat_message', message);
    });

    socket.on('typing_start', (data: { threadId?: string; room?: string }) => {
      if (data.threadId) socket.to(`thread:${data.threadId}`).emit('user_typing', { userId, username });
      if (data.room) socket.to(`chat:${data.room}`).emit('user_typing', { userId, username });
    });

    socket.on('typing_stop', (data: { threadId?: string; room?: string }) => {
      if (data.threadId) socket.to(`thread:${data.threadId}`).emit('user_stopped_typing', { userId });
      if (data.room) socket.to(`chat:${data.room}`).emit('user_stopped_typing', { userId });
    });

    socket.on('private_message', async (data: { receiverId: string; content: string }) => {
      const { receiverId, content } = data;
      if (!content?.trim() || content.length > 5000) return;

      const blocked = await prisma.block.findFirst({
        where: { OR: [{ blockerId: receiverId, blockedId: userId }, { blockerId: userId, blockedId: receiverId }] },
      });
      if (blocked) { socket.emit('error', { message: 'Impossible.' }); return; }

      const message = await prisma.privateMessage.create({
        data: { content: content.trim(), senderId: userId, receiverId },
        include: { sender: { select: { username: true, avatarUrl: true } } },
      });

      const receiverEntry = [...onlineUsers.entries()].find(([uid]) => uid === receiverId);
      if (receiverEntry) io.to(receiverEntry[1].socketId).emit('private_message', message);
      socket.emit('private_message_sent', message);
    });

    socket.on('admin_delete_message', async (messageId: string) => {
      if (!['MODERATOR', 'ADMIN'].includes(role)) { socket.emit('error', { message: 'Permissions insuffisantes.' }); return; }
      await prisma.chatMessage.delete({ where: { id: messageId } }).catch(() => {});
      io.emit('chat_message_deleted', { messageId });
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      io.emit('online_users', [...onlineUsers.values()]);
      logger.info(`Socket déconnecté: ${username}`);
    });
  });
}

export async function sendNotification(userId: string, notif: {
  type: string; title: string; body: string; link?: string;
}): Promise<void> {
  const notification = await prisma.notification.create({ data: { userId, ...notif } });
  const userEntry = [...onlineUsers.entries()].find(([uid]) => uid === userId);
  if (userEntry && ioInstance) {
    ioInstance.to(userEntry[1].socketId).emit('notification', notification);
  }
}
