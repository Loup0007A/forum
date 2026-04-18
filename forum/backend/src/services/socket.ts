import type { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  role?: string;
}

const onlineUsers = new Map<string, { username: string; room: string; socketId: string }>();

export function setupSocketHandlers(io: Server): void {

  // ─── AUTH MIDDLEWARE ─────────────────────────────────────────────────
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.slice(7);
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

      socket.userId = user.id;
      socket.username = user.username;
      socket.role = user.role;
      next();
    } catch (err) {
      next(new Error('Erreur d\'authentification'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const username = socket.username!;

    logger.info(`Socket connecté: ${username} (${socket.id})`);

    // ─── JOIN ROOMS ────────────────────────────────────────────────────
    socket.on('join_thread', (threadId: string) => {
      socket.join(`thread:${threadId}`);
    });

    socket.on('leave_thread', (threadId: string) => {
      socket.leave(`thread:${threadId}`);
    });

    socket.on('join_chat', (room: string = 'general') => {
      socket.join(`chat:${room}`);
      onlineUsers.set(userId, { username, room, socketId: socket.id });
      io.emit('online_users', [...onlineUsers.values()]);

      // Send recent messages
      prisma.chatMessage.findMany({
        where: { room },
        take: 50,
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { username: true, avatarUrl: true, rank: true } } },
      }).then(messages => {
        socket.emit('chat_history', messages);
      });
    });

    socket.on('leave_chat', (room: string = 'general') => {
      socket.leave(`chat:${room}`);
      onlineUsers.delete(userId);
      io.emit('online_users', [...onlineUsers.values()]);
    });

    // ─── CHAT PUBLIC ───────────────────────────────────────────────────
    socket.on('chat_message', async (data: { content: string; room?: string }) => {
      const room = data.room || 'general';
      const content = data.content?.trim();

      if (!content || content.length > 2000) {
        socket.emit('error', { message: 'Message invalide.' });
        return;
      }

      // Rate limit: 1 message per second
      const recentCount = await prisma.chatMessage.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - 1000) } },
      });
      if (recentCount >= 2) {
        socket.emit('error', { message: 'Vous envoyez des messages trop rapidement.' });
        return;
      }

      const message = await prisma.chatMessage.create({
        data: { content, userId, room },
        include: { user: { select: { username: true, avatarUrl: true, rank: true, role: true } } },
      });

      io.to(`chat:${room}`).emit('chat_message', message);
    });

    // ─── TYPING INDICATOR ─────────────────────────────────────────────
    socket.on('typing_start', (data: { threadId?: string; room?: string }) => {
      if (data.threadId) {
        socket.to(`thread:${data.threadId}`).emit('user_typing', { userId, username });
      }
      if (data.room) {
        socket.to(`chat:${data.room}`).emit('user_typing', { userId, username });
      }
    });

    socket.on('typing_stop', (data: { threadId?: string; room?: string }) => {
      if (data.threadId) {
        socket.to(`thread:${data.threadId}`).emit('user_stopped_typing', { userId });
      }
      if (data.room) {
        socket.to(`chat:${data.room}`).emit('user_stopped_typing', { userId });
      }
    });

    // ─── PRIVATE MESSAGE ──────────────────────────────────────────────
    socket.on('private_message', async (data: { receiverId: string; content: string }) => {
      const { receiverId, content } = data;
      if (!content?.trim() || content.length > 5000) return;

      const blocked = await prisma.block.findFirst({
        where: { OR: [
          { blockerId: receiverId, blockedId: userId },
          { blockerId: userId, blockedId: receiverId },
        ]},
      });
      if (blocked) { socket.emit('error', { message: 'Impossible d\'envoyer un message.' }); return; }

      const message = await prisma.privateMessage.create({
        data: { content: content.trim(), senderId: userId, receiverId },
        include: { sender: { select: { username: true, avatarUrl: true } } },
      });

      // Find receiver's socket
      const receiverEntry = [...onlineUsers.entries()].find(([uid]) => uid === receiverId);
      if (receiverEntry) {
        io.to(receiverEntry[1].socketId).emit('private_message', message);
      }

      socket.emit('private_message_sent', message);
    });

    // ─── NOTIFICATIONS ────────────────────────────────────────────────
    socket.on('mark_notification_read', async (notifId: string) => {
      await prisma.notification.update({ where: { id: notifId, userId }, data: { read: true } });
    });

    // ─── ADMIN: DELETE CHAT MESSAGE ───────────────────────────────────
    socket.on('admin_delete_message', async (messageId: string) => {
      if (!['MODERATOR', 'ADMIN'].includes(socket.role || '')) {
        socket.emit('error', { message: 'Permissions insuffisantes.' });
        return;
      }
      await prisma.chatMessage.delete({ where: { id: messageId } }).catch(() => {});
      io.emit('chat_message_deleted', { messageId });
    });

    // ─── DISCONNECT ───────────────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      io.emit('online_users', [...onlineUsers.values()]);
      logger.info(`Socket déconnecté: ${username}`);
    });
  });
}

// Helper to send notification to a user
export async function sendNotification(io: Server, userId: string, notif: {
  type: string; title: string; body: string; link?: string;
}): Promise<void> {
  const notification = await prisma.notification.create({
    data: { userId, ...notif },
  });

  const userSocket = [...(io.sockets.sockets.values() as any)]
    .find((s: AuthenticatedSocket) => s.userId === userId);

  if (userSocket) {
    userSocket.emit('notification', notification);
  }
}
