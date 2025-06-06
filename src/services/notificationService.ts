import { Notification, User } from '../models/db';
import mongoose from 'mongoose';
import * as emailService from './emailService';

/**
 * Create a new notification
 * @param userId - User ID
 * @param type - Notification type
 * @param content - Notification content
 * @param relatedEntityId - Related entity ID (optional)
 * @param sendEmail - Whether to send an email notification (default: true)
 * @returns Created notification
 */
export const createNotification = async (
  userId: string,
  type: 'booking' | 'message' | 'review' | 'system',
  content: string,
  relatedEntityId?: string,
  sendEmail: boolean = true
) => {
  try {
    // Create notification in database
    const notification = await Notification.create({
      userId,
      type,
      content,
      relatedEntityId,
      isRead: false
    });

  // Send email notification if requested
  if (sendEmail) {
    try {
      const user = await User.findById(userId);
      if (user && user.email) {
        // Determine email subject based on notification type
        let subject = '';
        switch (type) {
          case 'booking':
            subject = 'New Booking Notification';
            break;
          case 'message':
            subject = 'New Message Notification';
            break;
          case 'review':
            subject = 'New Review Notification';
            break;
          case 'system':
            subject = 'System Notification';
            break;
        }

        // Send email with error handling
        const emailResult = await emailService.sendSystemNotificationEmail(
          userId,
          subject,
          content
        );
        
        if (emailResult && typeof emailResult === 'object' && 'emailSent' in emailResult && !emailResult.emailSent) {
          console.warn(`Email notification not sent for ${type} notification to user ${userId}`);
        }
      }
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Continue even if email fails
    }
  }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Get user notifications with pagination
 * @param userId - User ID
 * @param options - Pagination options
 * @returns Notifications and pagination info
 */
export const getUserNotifications = async (
  userId: string,
  options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  } = {}
) => {
  try {
    const { page = 1, limit = 10, unreadOnly = false } = options;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { userId: new mongoose.Types.ObjectId(userId) };
    if (unreadOnly) {
      query.isRead = false;
    }

    // Get total count
    const total = await Notification.countDocuments(query);

    // Get notifications with pagination
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param notificationId - Notification ID
 * @returns Updated notification
 */
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param userId - User ID
 * @returns Success message
 */
export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    await Notification.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), isRead: false },
      { isRead: true }
    );

    return { success: true, message: 'All notifications marked as read' };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete notification
 * @param notificationId - Notification ID
 * @returns Success message
 */
export const deleteNotification = async (notificationId: string) => {
  try {
    const notification = await Notification.findByIdAndDelete(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    return { success: true, message: 'Notification deleted successfully' };
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

/**
 * Get unread notification count
 * @param userId - User ID
 * @returns Unread notification count
 */
export const getUnreadNotificationCount = async (userId: string) => {
  try {
    const count = await Notification.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isRead: false
    });

    return { count };
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    throw error;
  }
};

/**
 * Create booking notification
 * @param userId - User ID
 * @param providerId - Provider ID
 * @param bookingId - Booking ID
 * @param action - Booking action
 * @param serviceName - Service name
 * @returns Created notifications
 */
export const createBookingNotification = async (
  userId: string,
  providerId: string,
  bookingId: string,
  action: 'created' | 'confirmed' | 'started' | 'completed' | 'cancelled',
  serviceName: string
) => {
  try {
    const notifications = [];
    
    // Get user and provider names
    const [user, provider] = await Promise.all([
      User.findById(userId),
      User.findById(providerId)
    ]);
    
    if (!user || !provider) {
      throw new Error('User or provider not found');
    }
    
    const userName = `${user.firstName} ${user.lastName}`;
    const providerName = `${provider.firstName} ${provider.lastName}`;
    
    // Create notification content based on action
    let userContent = '';
    let providerContent = '';
    
    switch (action) {
      case 'created':
        userContent = `Your booking for ${serviceName} has been created and is pending confirmation.`;
        providerContent = `${userName} has requested a booking for ${serviceName}.`;
        break;
      case 'confirmed':
        userContent = `Your booking for ${serviceName} has been confirmed by ${providerName}.`;
        providerContent = `You have confirmed the booking for ${serviceName} with ${userName}.`;
        break;
      case 'started':
        userContent = `Your service for ${serviceName} has been started by ${providerName}.`;
        providerContent = `You have started the service for ${serviceName} with ${userName}.`;
        break;
      case 'completed':
        userContent = `Your service for ${serviceName} has been completed by ${providerName}.`;
        providerContent = `You have completed the service for ${serviceName} with ${userName}.`;
        break;
      case 'cancelled':
        userContent = `Your booking for ${serviceName} has been cancelled.`;
        providerContent = `The booking for ${serviceName} with ${userName} has been cancelled.`;
        break;
    }
    
    // Create notifications for both user and provider
    const [userNotification, providerNotification] = await Promise.all([
      createNotification(userId, 'booking', userContent, bookingId),
      createNotification(providerId, 'booking', providerContent, bookingId)
    ]);
    
    notifications.push(userNotification, providerNotification);
    
    return notifications;
  } catch (error) {
    console.error('Error creating booking notification:', error);
    throw error;
  }
};

/**
 * Create message notification
 * @param recipientId - Recipient user ID
 * @param senderId - Sender user ID
 * @param messageContent - Message content
 * @param chatId - Chat ID
 * @returns Created notification
 */
export const createMessageNotification = async (
  recipientId: string,
  senderId: string,
  messageContent: string,
  chatId: string
) => {
  try {
    // Get sender name
    const sender = await User.findById(senderId);
    
    if (!sender) {
      throw new Error('Sender not found');
    }
    
    const senderName = `${sender.firstName} ${sender.lastName}`;
    
    // Create notification content
    const content = `New message from ${senderName}: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`;
    
    // Create notification
    const notification = await createNotification(recipientId, 'message', content, chatId);
    
    return notification;
  } catch (error) {
    console.error('Error creating message notification:', error);
    throw error;
  }
};

/**
 * Create review notification
 * @param providerId - Provider ID
 * @param userId - User ID
 * @param rating - Rating
 * @param reviewId - Review ID
 * @returns Created notification
 */
export const createReviewNotification = async (
  providerId: string,
  userId: string,
  rating: number,
  reviewId: string
) => {
  try {
    // Get user name
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const userName = `${user.firstName} ${user.lastName}`;
    
    // Create notification content
    const content = `${userName} has left you a ${rating}-star review.`;
    
    // Create notification
    const notification = await createNotification(providerId, 'review', content, reviewId);
    
    return notification;
  } catch (error) {
    console.error('Error creating review notification:', error);
    throw error;
  }
};

/**
 * Create system notification
 * @param userId - User ID
 * @param content - Notification content
 * @param relatedEntityId - Related entity ID (optional)
 * @returns Created notification
 */
export const createSystemNotification = async (
  userId: string,
  content: string,
  relatedEntityId?: string
) => {
  try {
    // Create notification
    const notification = await createNotification(userId, 'system', content, relatedEntityId);
    
    return notification;
  } catch (error) {
    console.error('Error creating system notification:', error);
    throw error;
  }
};
