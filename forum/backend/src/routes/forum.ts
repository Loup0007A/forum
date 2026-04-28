import { Router } from 'express';
import { getCategories, getForum, createCategory, createForum } from '../controllers/forum';
import { requireAdmin } from '../middleware/auth';

// backend/src/routes/forum.ts
export const forumRouter = Router();

// 1. D'ABORD les routes fixes (statiques)
forumRouter.get('/categories', getCategories); 
forumRouter.post('/categories', requireAdmin, createCategory);
forumRouter.post('/forums', requireAdmin, createForum);

// 2. EN DERNIER la route avec paramètre dynamique
// Sinon, Express pense que "categories" ou "forums" est un :slug
forumRouter.get('/:slug', getForum);
