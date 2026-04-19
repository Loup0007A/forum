import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

import { authRouter } from './routes/auth';
import { forumRouter } from './routes/forum';
import { threadRouter } from './routes/thread';
import { postRouter } from './routes/post';
import { userRouter } from './routes/user';
import { adminRouter } from './routes/admin';
import { chatRouter } from './routes/chat';
import { notifRouter } from './routes/notification';

import { requireAuth } from './middleware/auth';
import { requireJs } from './middleware/requireJs';
import { logRequest } from './middleware/logger';
import { setupSocketHandlers } from './services/socket';
import { logger } from './utils/logger';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-JS-Enabled', 'X-Fingerprint'],
}));

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '200'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes.' },
  skip: (req) => req.path === '/api/health',
});

app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(logRequest);
app.use('/api', requireJs);

app.use('/api/auth', authRouter);
app.use('/api/forums', requireAuth, forumRouter);
app.use('/api/threads', requireAuth, threadRouter);
app.use('/api/posts', requireAuth, postRouter);
app.use('/api/users', requireAuth, userRouter);
app.use('/api/admin', requireAuth, adminRouter);
app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/notifications', requireAuth, notifRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erreur serveur interne.' });
});

setupSocketHandlers(io);

const PORT = parseInt(process.env.PORT || '3001');
httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Serveur démarré sur le port ${PORT}`);
  logger.info(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
});
