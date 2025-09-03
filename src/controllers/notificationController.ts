import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notificationService';

/**
 * @route   GET /api/v1/notifications
 */
export const getUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await notificationService.getUserNotifications(
      req.user._id.toString(),
      { page, limit, unreadOnly }
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/notifications/:id/read
 */
export const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { id } = req.params;
    const result = await notificationService.markNotificationAsRead(id);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/notifications/read-all
 */
export const markAllNotificationsAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const result = await notificationService.markAllNotificationsAsRead(req.user._id.toString());

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/notifications/:id
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { id } = req.params;
    const result = await notificationService.deleteNotification(id);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/notifications/unread-count
 */
export const getUnreadNotificationCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const result = await notificationService.getUnreadNotificationCount(req.user._id.toString());

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
