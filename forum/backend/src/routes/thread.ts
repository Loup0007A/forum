// routes/thread.ts
import { Router } from 'express';
import { getThread, createThread, deleteThread, pinThread, closeThread, searchThreads } from '../controllers/thread.js';
import { requireMod } from '../middleware/auth.js';

export const threadRouter = Router();
threadRouter.get('/search', searchThreads);
threadRouter.get('/:slug', getThread);
threadRouter.post('/', createThread);
threadRouter.delete('/:id', deleteThread);
threadRouter.patch('/:id/pin', requireMod, pinThread);
threadRouter.patch('/:id/close', requireMod, closeThread);
