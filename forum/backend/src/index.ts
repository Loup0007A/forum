import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

import { authRouter } from './routes/auth.js';
import { forumRouter } from './routes/forum.js';
import { threadRouter } from './routes/thread.js';
import { postRouter } from './routes/post.js';
import { userRouter } from './routes/user.js';
import { adminRouter } from './routes/admin.js';
import { chatRouter } from './routes/chat.js';
import { notifRouter } from './routes/notification.js';

import { requireAuth } from './middleware/auth.js';
import { requireJs } from './middleware/requireJs.js';
import { logRequest } from './middleware/logger.js';
import { setupSocketHandlers } from './services/socket.js';
import { logger } from './utils/logger.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// ─── Security middleware ───────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-JS-Enabled', 'X-Fingerprint'],
}));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
});

app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────
app.use(logRequest);

// ─── JS check (public route, but checked on protected routes) ─────────
app.use('/api', requireJs);

// ─── Routes ───────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// All routes below require authentication
app.use('/api/forums', requireAuth, forumRouter);
app.use('/api/threads', requireAuth, threadRouter);
app.use('/api/posts', requireAuth, postRouter);
app.use('/api/users', requireAuth, userRouter);
app.use('/api/admin', requireAuth, adminRouter);
app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/notifications', requireAuth, notifRouter);

// Health check (no auth needed)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// ─── Socket.io ────────────────────────────────────────────────────────
setupSocketHandlers(io);

// ─── Start ────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001');
httpServer.listen(PORT, () => {
  logger.info(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  logger.info(`🔌 Socket.io actif`);
  logger.info(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
});

export { io };
