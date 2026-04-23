import { Router } from 'express';
import { getCategories, getForum, createCategory, createForum } from '../controllers/forum';
import { requireAdmin } from '../middleware/auth';

// backend/src/routes/forum.ts
export const forumRouter = Router();

forumRouter.get('/categories', getCategories); // Plus explicite
forumRouter.get('/:slug', getForum);
forumRouter.post('/categories', requireAdmin, createCategory);
forumRouter.post('/forums', requireAdmin, createForum); // On change '/' par '/forums'
