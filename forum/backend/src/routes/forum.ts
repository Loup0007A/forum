import { Router } from 'express';
import { getCategories, getForum, createCategory, createForum } from '../controllers/forum';
import { requireAdmin } from '../middleware/auth';

// backend/src/routes/forum.ts
export const forumRouter = Router();

forumRouter.get('/categories', getCategories); 
forumRouter.post('/categories', requireAdmin, createCategory);

// ON FORCE l'URL '/forums' au lieu de '/'
forumRouter.post('/forums', requireAdmin, createForum); 

forumRouter.get('/:slug', getForum);
