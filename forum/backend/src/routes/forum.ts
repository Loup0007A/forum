import { Router } from 'express';
import { getCategories, getForum, createCategory, createForum } from '../controllers/forum';
import { requireAdmin } from '../middleware/auth';

// backend/src/routes/forum.ts
// backend/src/routes/forum.ts
export const forumRouter = Router();

// Route pour récupérer toutes les catégories
forumRouter.get('/categories', getCategories); 

// Route pour créer une catégorie
forumRouter.post('/categories', requireAdmin, createCategory);

// Route pour créer un forum (on change '/' par '/forums' pour être plus clair)
forumRouter.post('/forums', requireAdmin, createForum);

// Route pour voir un forum spécifique (doit être en dernier car c'est une variable :slug)
forumRouter.get('/:slug', getForum);
