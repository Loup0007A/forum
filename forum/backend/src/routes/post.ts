import { Router } from 'express';
import { createPost, editPost, deletePost, reactToPost, markBestAnswer, reportPost } from '../controllers/post.js';

export const postRouter = Router();
postRouter.post('/', createPost);
postRouter.patch('/:id', editPost);
postRouter.delete('/:id', deletePost);
postRouter.post('/:id/react', reactToPost);
postRouter.patch('/:id/best-answer', markBestAnswer);
postRouter.post('/:id/report', reportPost);
