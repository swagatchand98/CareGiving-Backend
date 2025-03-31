import { Notification, User, Booking } from '../models/db';
import mongoose from 'mongoose';

/**
 * Create a new notification
 * @param notificationData - Notification data
 * @returns Created notification document
 */
export const createNotification = async (notificationData: {
  userId: string;
  type: 'booking' | 'message' | 'review' | 'system';
  content: string;
  relatedEntityId?: string;
}) => {
  return Notification.create({
    ...notificationData,
    isRead: false
  });
};

/**
 * Get notifications for a user with pagination
 * @param userId - User ID
 * @param options - Pagination options
 * @returns Notifications and total count
 */
export const getUserNotifications = async (
  userId: string,
  options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }
) => {
  const { page = 1, limit = 10, unreadOnly = false } = options;
  const skip = (page - 1) * limit;

  const query: any = { userId };
  
  // Filter by read status
  if (unreadOnly) {
    query.isRead = false;
  }

  const notifications = await Notification.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Notification.countDocuments(query);

  return {
    notifications,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Mark notification as read
 * @param notificationId - Notification ID
 * @returns Updated notification document
 */
export const markNotificationAsRead = async (notificationId: string) => {
  return Notification.findByIdAndUpdate(
    notificationId,
    { isRead: true },
    { new: true }
  );
};

/**
 * Mark all notifications as read for a user
 * @param userId - User ID
 * @returns Success message
 */
export const markAllNotificationsAsRead = async (userId: string) => {
  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );

  return { message: 'All notifications marked as read' };
};

/**
 * Delete a notification
 * @param notificationId - Notification ID
 * @returns Success message
 */
export const deleteNotification = async (notificationId: string) => {
  await Notification.findByIdAndDelete(notificationId);
  return { message: 'Notification deleted successfully' };
};

/**
 * Send booking notification to user and provider
 * @param bookingId - Booking ID
 * @param action - Booking action (created, confirmed, started, completed, cancelled)
 * @returns Created notifications
 */
export const sendBookingNotification = async (
  bookingId: string,
  action: 'created' | 'confirmed' | 'started' | 'completed' | 'cancelled'
) => {
  // Use type assertion to handle populated fields
  const booking = await Booking.findById(bookingId)
    .populate({
      path: 'serviceId',
      select: 'title'
    })
    .populate({
      path: 'userId',
      select: 'firstName lastName'
    })
    .populate({
      path: 'providerId',
      select: 'firstName lastName'
    });

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Type assertions for populated fields
  const service = booking.serviceId as unknown as { title: string };
  const user = booking.userId as unknown as { firstName: string; lastName: string };
  const provider = booking.providerId as unknown as { firstName: string; lastName: string };

  const serviceName = service.title;
  const userName = `${user.firstName} ${user.lastName}`;
  const providerName = `${provider.firstName} ${provider.lastName}`;
  
  let userContent = '';
  let providerContent = '';

  switch (action) {
    case 'created':
      userContent = `Your booking for ${serviceName} has been created and is pending confirmation.`;
      providerContent = `New booking request from ${userName} for ${serviceName}.`;
      break;
    case 'confirmed':
      userContent = `Your booking for ${serviceName} has been confirmed by ${providerName}.`;
      providerContent = `You have confirmed the booking for ${serviceName} with ${userName}.`;
      break;
    case 'started':
      userContent = `Your booking for ${serviceName} has been started by ${providerName}.`;
      providerContent = `You have started the booking for ${serviceName} with ${userName}.`;
      break;
    case 'completed':
      userContent = `Your booking for ${serviceName} has been completed. Please leave a review.`;
      providerContent = `You have completed the booking for ${serviceName} with ${userName}.`;
      break;
    case 'cancelled':
      userContent = `Your booking for ${serviceName} has been cancelled.`;
      providerContent = `The booking for ${serviceName} with ${userName} has been cancelled.`;
      break;
  }

  // Create notifications
  const userNotification = await createNotification({
    userId: booking.userId._id.toString(),
    type: 'booking',
    content: userContent,
    relatedEntityId: bookingId
  });

  const providerNotification = await createNotification({
    userId: booking.providerId._id.toString(),
    type: 'booking',
    content: providerContent,
    relatedEntityId: bookingId
  });

  return {
    userNotification,
    providerNotification
  };
};

/**
 * Send system notification to a user
 * @param userId - User ID
 * @param content - Notification content
 * @returns Created notification
 */
export const sendSystemNotification = async (userId: string, content: string) => {
  return createNotification({
    userId,
    type: 'system',
    content
  });
};

/**
 * Send system notification to all users or users with specific role
 * @param content - Notification content
 * @param role - Optional role filter
 * @returns Number of notifications created
 */
export const sendSystemNotificationToAll = async (content: string, role?: 'user' | 'provider' | 'admin') => {
  const query = role ? { role } : {};
  const users = await User.find(query).select('_id');

  const notifications = await Promise.all(
    users.map(user => 
      createNotification({
        userId: user._id.toString(),
        type: 'system',
        content
      })
    )
  );

  return { 
    message: `Sent notifications to ${notifications.length} users`,
    count: notifications.length
  };
};

/**
 * Get unread notification count for a user
 * @param userId - User ID
 * @returns Unread notification count
 */
export const getUnreadNotificationCount = async (userId: string) => {
  const count = await Notification.countDocuments({ 
    userId, 
    isRead: false 
  });

  return { count };
};
