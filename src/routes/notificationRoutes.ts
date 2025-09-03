import { Router, Request, Response, NextFunction } from 'express';
import * as notificationController from '../controllers/notificationController';
import { protect } from '../middleware/authMiddleware';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void | Response>;

const catchAsync = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const router = Router();

// authentication middleware
router.use(protect);

// Get notifications for the authenticated user
router.get('/', catchAsync(notificationController.getUserNotifications));

// Get unread notification count
router.get('/unread-count', catchAsync(notificationController.getUnreadNotificationCount));

// Mark notification as read
router.patch('/:id/read', catchAsync(notificationController.markNotificationAsRead));

// Mark all notifications as read
router.patch('/read-all', catchAsync(notificationController.markAllNotificationsAsRead));

// Delete notification
router.delete('/:id', catchAsync(notificationController.deleteNotification));

export default router;
