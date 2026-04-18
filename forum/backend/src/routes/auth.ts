import { Router } from 'express';
import { register, login, logout, logoutAll, checkAuth, authRateLimiter } from '../controllers/auth.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, register);
authRouter.post('/login', authRateLimiter, login);
authRouter.post('/logout', requireAuth, logout);
authRouter.post('/logout-all', requireAuth, logoutAll);
authRouter.get('/check', checkAuth);
