import * as notificationService from './notificationService';
import { formatCurrency } from '../utils/helpers';

/**
 * Create a payment notification for the provider
 * @param providerId - Provider ID
 * @param userId - User ID
 * @param amount - Payment amount
 * @param bookingId - Booking ID
 * @param customMessage - Optional custom message
 * @returns Created notification
 */
export const createPaymentNotification = async (
  providerId: string,
  userId: string,
  amount: number,
  bookingId: string,
  customMessage?: string
) => {
  try {
    const formattedAmount = formatCurrency(amount);
    const content = customMessage || `You have received a payment of $${formattedAmount} for booking #${bookingId}.`;
    
    return await notificationService.createNotification(
      providerId,
      'booking',
      content,
      bookingId
    );
  } catch (error) {
    console.error('Error creating payment notification:', error);
    throw error;
  }
};

/**
 * Create a refund notification for the user
 * @param userId - User ID
 * @param amount - Refund amount
 * @param bookingId - Booking ID
 * @returns Created notification
 */
export const createRefundNotification = async (
  userId: string,
  amount: number,
  bookingId: string
) => {
  try {
    const formattedAmount = formatCurrency(amount);
    const content = `Your refund of $${formattedAmount} for booking #${bookingId} has been processed.`;
    
    return await notificationService.createNotification(
      userId,
      'booking',
      content,
      bookingId
    );
  } catch (error) {
    console.error('Error creating refund notification:', error);
    throw error;
  }
};

/**
 * Create a payout notification for the provider
 * @param providerId - Provider ID
 * @param amount - Payout amount
 * @returns Created notification
 */
export const createPayoutNotification = async (
  providerId: string,
  amount: number
) => {
  try {
    const formattedAmount = formatCurrency(amount);
    const content = `Your payout of $${formattedAmount} has been processed and is on its way to your bank account.`;
    
    return await notificationService.createNotification(
      providerId,
      'system',
      content
    );
  } catch (error) {
    console.error('Error creating payout notification:', error);
    throw error;
  }
};

/**
 * Create a payment failed notification for the user
 * @param userId - User ID
 * @param bookingId - Booking ID
 * @returns Created notification
 */
export const createPaymentFailedNotification = async (
  userId: string,
  bookingId: string
) => {
  try {
    const content = `Your payment for booking #${bookingId} has failed. Please update your payment information and try again.`;
    
    return await notificationService.createNotification(
      userId,
      'booking',
      content,
      bookingId,
      true // Send email notification
    );
  } catch (error) {
    console.error('Error creating payment failed notification:', error);
    throw error;
  }
};

/**
 * Create a payment dispute notification for the user and admin
 * @param userId - User ID
 * @param adminId - Admin ID
 * @param amount - Disputed amount
 * @param bookingId - Booking ID
 * @returns Created notifications
 */
export const createPaymentDisputeNotification = async (
  userId: string,
  adminId: string,
  amount: number,
  bookingId: string
) => {
  try {
    const formattedAmount = formatCurrency(amount);
    const userContent = `A dispute has been filed for your payment of $${formattedAmount} for booking #${bookingId}. Our team will contact you shortly.`;
    const adminContent = `A payment dispute has been filed for booking #${bookingId} for $${formattedAmount}. Please review and take appropriate action.`;
    
    const [userNotification, adminNotification] = await Promise.all([
      notificationService.createNotification(
        userId,
        'system',
        userContent,
        bookingId,
        true // Send email notification
      ),
      notificationService.createNotification(
        adminId,
        'system',
        adminContent,
        bookingId,
        true // Send email notification
      )
    ]);
    
    return { userNotification, adminNotification };
  } catch (error) {
    console.error('Error creating payment dispute notification:', error);
    throw error;
  }
};
