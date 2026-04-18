import { Router } from 'express';
import {
  getProfile, editProfile, changePassword, toggleFollow, toggleBlock,
  getMessages, getConversations, sendMessage, deleteAccount, saveDraft, getDrafts
} from '../controllers/user.js';

export const userRouter = Router();
userRouter.get('/me/drafts', getDrafts);
userRouter.post('/me/drafts', saveDraft);
userRouter.get('/me/conversations', getConversations);
userRouter.get('/me/messages/:userId', getMessages);
userRouter.post('/me/messages', sendMessage);
userRouter.patch('/me/profile', editProfile);
userRouter.patch('/me/password', changePassword);
userRouter.delete('/me', deleteAccount);
userRouter.post('/:userId/follow', toggleFollow);
userRouter.post('/:userId/block', toggleBlock);
userRouter.get('/:username', getProfile);
