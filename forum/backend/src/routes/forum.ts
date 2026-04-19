import { Router } from 'express';
import { getCategories, getForum, createCategory, createForum } from '../controllers/forum';
import { requireAdmin } from '../middleware/auth';

export const forumRouter = Router();
forumRouter.get('/', getCategories);
forumRouter.get('/:slug', getForum);
forumRouter.post('/categories', requireAdmin, createCategory);
forumRouter.post('/', requireAdmin, createForum);
