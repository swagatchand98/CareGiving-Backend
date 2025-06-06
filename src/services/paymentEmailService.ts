import { sendEmail, getUserEmail } from './emailService';
import { User } from '../models/db';
import { formatCurrency } from '../utils/helpers';

/**
 * Send payment confirmation email to the user
 * @param email - User email address
 * @param amount - Payment amount
 * @param bookingId - Booking ID
 */
export const sendPaymentConfirmation = async (
  email: string,
  amount: number,
  bookingId: string
): Promise<{ success: boolean; emailSent?: boolean; error?: string }> => {
  try {
    const formattedAmount = formatCurrency(amount);
    
    const subject = `Payment Confirmation - $${formattedAmount}`;
    const html = `
      <h2>Payment Confirmation</h2>
      <p>Dear User,</p>
      <p>Your payment of <strong>$${formattedAmount}</strong> for booking #${bookingId} has been successfully processed.</p>
      <p>You can view your booking details and receipt by logging into your account.</p>
      <p>Thank you for using Urban Caregiving!</p>
    `;

    const emailResult = await sendEmail(email, subject, html);
    
    if (emailResult.success) {
      console.log(`Payment confirmation email sent to: ${email}`);
    } else {
      console.warn(`Failed to send payment confirmation email: ${emailResult.error}`);
    }
    
    return { 
      success: true,
      emailSent: emailResult.success
    };
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Send refund confirmation email to the user
 * @param email - User email address
 * @param amount - Refund amount
 * @param bookingId - Booking ID
 */
export const sendRefundConfirmation = async (
  email: string,
  amount: number,
  bookingId: string
): Promise<{ success: boolean; emailSent?: boolean; error?: string }> => {
  try {
    const formattedAmount = formatCurrency(amount);
    
    const subject = `Refund Confirmation - $${formattedAmount}`;
    const html = `
      <h2>Refund Confirmation</h2>
      <p>Dear User,</p>
      <p>Your refund of <strong>$${formattedAmount}</strong> for booking #${bookingId} has been processed.</p>
      <p>The refund should appear in your account within 5-10 business days, depending on your payment method and financial institution.</p>
      <p>If you have any questions about this refund, please contact our support team.</p>
      <p>Thank you for using Urban Caregiving!</p>
    `;

    const emailResult = await sendEmail(email, subject, html);
    
    if (emailResult.success) {
      console.log(`Refund confirmation email sent to: ${email}`);
    } else {
      console.warn(`Failed to send refund confirmation email: ${emailResult.error}`);
    }
    
    return { 
      success: true,
      emailSent: emailResult.success
    };
  } catch (error) {
    console.error('Error sending refund confirmation email:', error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Send payout confirmation email to the provider
 * @param email - Provider email address
 * @param amount - Payout amount
 */
export const sendPayoutConfirmation = async (
  email: string,
  amount: number
): Promise<{ success: boolean; emailSent?: boolean; error?: string }> => {
  try {
    const formattedAmount = formatCurrency(amount);
    
    const subject = `Payout Confirmation - $${formattedAmount}`;
    const html = `
      <h2>Payout Confirmation</h2>
      <p>Dear Provider,</p>
      <p>Your payout of <strong>$${formattedAmount}</strong> has been processed and is on its way to your bank account.</p>
      <p>The funds should appear in your account within 2-5 business days, depending on your financial institution.</p>
      <p>You can view your earnings and payout history by logging into your provider dashboard.</p>
      <p>Thank you for being a part of Urban Caregiving!</p>
    `;

    const emailResult = await sendEmail(email, subject, html);
    
    if (emailResult.success) {
      console.log(`Payout confirmation email sent to: ${email}`);
    } else {
      console.warn(`Failed to send payout confirmation email: ${emailResult.error}`);
    }
    
    return { 
      success: true,
      emailSent: emailResult.success
    };
  } catch (error) {
    console.error('Error sending payout confirmation email:', error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Send payment failed email to the user
 * @param email - User email address
 * @param bookingId - Booking ID
 */
export const sendPaymentFailedEmail = async (
  email: string,
  bookingId: string
): Promise<{ success: boolean; emailSent?: boolean; error?: string }> => {
  try {
    const subject = `Payment Failed - Action Required`;
    const html = `
      <h2>Payment Failed</h2>
      <p>Dear User,</p>
      <p>We were unable to process your payment for booking #${bookingId}.</p>
      <p>This could be due to insufficient funds, expired card details, or other issues with your payment method.</p>
      <p>Please log in to your account to update your payment information and try again.</p>
      <p>If you continue to experience issues, please contact our support team for assistance.</p>
      <p>Thank you for using Urban Caregiving!</p>
    `;

    const emailResult = await sendEmail(email, subject, html);
    
    if (emailResult.success) {
      console.log(`Payment failed email sent to: ${email}`);
    } else {
      console.warn(`Failed to send payment failed email: ${emailResult.error}`);
    }
    
    return { 
      success: true,
      emailSent: emailResult.success
    };
  } catch (error) {
    console.error('Error sending payment failed email:', error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Send payment dispute email to the user
 * @param email - User email address
 * @param amount - Disputed amount
 * @param bookingId - Booking ID
 */
export const sendPaymentDisputeEmail = async (
  email: string,
  amount: number,
  bookingId: string
): Promise<{ success: boolean; emailSent?: boolean; error?: string }> => {
  try {
    const formattedAmount = formatCurrency(amount);
    
    const subject = `Payment Dispute Notification`;
    const html = `
      <h2>Payment Dispute Notification</h2>
      <p>Dear User,</p>
      <p>We've received a dispute for your payment of <strong>$${formattedAmount}</strong> for booking #${bookingId}.</p>
      <p>Our team is currently reviewing this dispute and will be in touch with you shortly for more information.</p>
      <p>If you have any questions or would like to provide additional information about this transaction, please contact our support team.</p>
      <p>Thank you for your patience and understanding.</p>
      <p>Urban Caregiving Support Team</p>
    `;

    const emailResult = await sendEmail(email, subject, html);
    
    if (emailResult.success) {
      console.log(`Payment dispute email sent to: ${email}`);
    } else {
      console.warn(`Failed to send payment dispute email: ${emailResult.error}`);
    }
    
    return { 
      success: true,
      emailSent: emailResult.success
    };
  } catch (error) {
    console.error('Error sending payment dispute email:', error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
