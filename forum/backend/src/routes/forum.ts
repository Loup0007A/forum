import { Router } from 'express';
import { getCategories, getForum, createCategory, createForum } from '../controllers/forum';
import { requireAdmin } from '../middleware/auth';

// backend/src/routes/forum.ts
// backend/src/routes/forum.ts
export const forumRouter = Router();

// On enlève toute ambiguïté sur les noms
forumRouter.get('/categories', getCategories);
forumRouter.post('/categories', requireAdmin, createCategory); // URL: /api/forum/categories
forumRouter.post('/forums', requireAdmin, createForum);         // URL: /api/forum/forums
forumRouter.get('/:slug', getForum);                            // URL: /api/forum/:slug
