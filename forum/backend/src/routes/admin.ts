import { Router } from 'express';
import { requireAdmin, requireMod } from '../middleware/auth';
import {
  getDashboardStats, listUsers, validateUser, banUser, unbanUser,
  promoteUser, getAdminLogs, getReports, resolveReport, getBans, removeBan
} from '../controllers/admin';

export const adminRouter = Router();
adminRouter.use(requireMod);
adminRouter.get('/stats', requireAdmin, getDashboardStats);
adminRouter.get('/users', listUsers);
adminRouter.post('/users/:userId/validate', requireAdmin, validateUser);
adminRouter.post('/users/:userId/ban', banUser);
adminRouter.post('/users/:userId/unban', unbanUser);
adminRouter.patch('/users/:userId/role', requireAdmin, promoteUser);
adminRouter.get('/logs', requireAdmin, getAdminLogs);
adminRouter.get('/reports', getReports);
adminRouter.patch('/reports/:id/resolve', resolveReport);
adminRouter.get('/bans', getBans);
adminRouter.delete('/bans/:id', removeBan);
