import * as nodemailer from 'nodemailer';
import { app } from '../config/firebase-admin';
import * as functions from 'firebase-functions';
import { User } from '../models/db';
import { config } from '../config/env';

// Create a transporter using SMTP configuration from environment variables
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // use SSL
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASSWORD
  },
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false
  }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP server connection error:', error);
  } else {
    console.log('SMTP server connection established successfully');
  }
});

/**
 * Send an email notification
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - Email content in HTML format
 * @returns Promise resolving to the sent message info or error object
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string
) => {
  try {
    const mailOptions = {
      from: config.EMAIL_FROM,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    // Return error object instead of throwing
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error sending email' 
    };
  }
};

/**
 * Get user email by user ID
 * @param userId - User ID
 * @returns User email address
 */
export const getUserEmail = async (userId: string): Promise<string> => {
  const user = await User.findById(userId);
  if (!user || !user.email) {
    throw new Error('User not found or email not available');
  }
  return user.email;
};

/**
 * Send booking notification email
 * @param userId - User ID
 * @param providerId - Provider ID
 * @param bookingDetails - Booking details
 * @param action - Booking action
 */
export const sendBookingNotificationEmail = async (
  userId: string,
  providerId: string,
  bookingDetails: {
    serviceName: string;
    dateTime: Date;
    duration: number;
    address: string;
    status: string;
  },
  action: 'created' | 'confirmed' | 'started' | 'completed' | 'cancelled'
) => {
  try {
    // Get user and provider details
    const user = await User.findById(userId);
    const provider = await User.findById(providerId);

    if (!user || !provider) {
      throw new Error('User or provider not found');
    }

    const userName = `${user.firstName} ${user.lastName}`;
    const providerName = `${provider.firstName} ${provider.lastName}`;
    const { serviceName, dateTime, duration, address, status } = bookingDetails;

    // Format date and time
    const formattedDate = new Date(dateTime).toLocaleDateString();
    const formattedTime = new Date(dateTime).toLocaleTimeString();

    // Create email content for user
    let userSubject = '';
    let userHtml = '';

    // Create email content for provider
    let providerSubject = '';
    let providerHtml = '';

    switch (action) {
      case 'created':
        userSubject = `Booking Confirmation: ${serviceName}`;
        userHtml = `
          <h2>Your booking has been created</h2>
          <p>Dear ${userName},</p>
          <p>Your booking for <strong>${serviceName}</strong> has been created and is pending confirmation.</p>
          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Provider:</strong> ${providerName}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
            <li><strong>Duration:</strong> ${duration} hour(s)</li>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Status:</strong> ${status}</li>
          </ul>
          <p>You will receive another notification when the provider confirms your booking.</p>
          <p>Thank you for using Urban Caregiving!</p>
        `;

        providerSubject = `New Booking Request: ${serviceName}`;
        providerHtml = `
          <h2>New Booking Request</h2>
          <p>Dear ${providerName},</p>
          <p>You have received a new booking request from <strong>${userName}</strong> for <strong>${serviceName}</strong>.</p>
          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Client:</strong> ${userName}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
            <li><strong>Duration:</strong> ${duration} hour(s)</li>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Status:</strong> ${status}</li>
          </ul>
          <p>Please log in to your account to confirm or decline this booking.</p>
          <p>Thank you for being a part of Urban Caregiving!</p>
        `;
        break;

      case 'confirmed':
        userSubject = `Booking Confirmed: ${serviceName}`;
        userHtml = `
          <h2>Your booking has been confirmed</h2>
          <p>Dear ${userName},</p>
          <p>Great news! Your booking for <strong>${serviceName}</strong> has been confirmed by ${providerName}.</p>
          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Provider:</strong> ${providerName}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
            <li><strong>Duration:</strong> ${duration} hour(s)</li>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Status:</strong> Confirmed</li>
          </ul>
          <p>Thank you for using Urban Caregiving!</p>
        `;

        providerSubject = `Booking Confirmation: ${serviceName}`;
        providerHtml = `
          <h2>Booking Confirmation</h2>
          <p>Dear ${providerName},</p>
          <p>You have confirmed the booking for <strong>${serviceName}</strong> with ${userName}.</p>
          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Client:</strong> ${userName}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
            <li><strong>Duration:</strong> ${duration} hour(s)</li>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Status:</strong> Confirmed</li>
          </ul>
          <p>Thank you for being a part of Urban Caregiving!</p>
        `;
        break;

      case 'started':
        userSubject = `Service Started: ${serviceName}`;
        userHtml = `
          <h2>Your service has started</h2>
          <p>Dear ${userName},</p>
          <p>Your booking for <strong>${serviceName}</strong> has been started by ${providerName}.</p>
          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Provider:</strong> ${providerName}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
            <li><strong>Duration:</strong> ${duration} hour(s)</li>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Status:</strong> In Progress</li>
          </ul>
          <p>Thank you for using Urban Caregiving!</p>
        `;

        providerSubject = `Service Started: ${serviceName}`;
        providerHtml = `
          <h2>Service Started</h2>
          <p>Dear ${providerName},</p>
          <p>You have started the service for <strong>${serviceName}</strong> with ${userName}.</p>
          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Client:</strong> ${userName}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
            <li><strong>Duration:</strong> ${duration} hour(s)</li>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Status:</strong> In Progress</li>
          </ul>
          <p>Thank you for being a part of Urban Caregiving!</p>
        `;
        break;

      case 'completed':
        userSubject = `Service Completed: ${serviceName}`;
        userHtml = `
          <h2>Your service has been completed</h2>
          <p>Dear ${userName},</p>
          <p>Your booking for <strong>${serviceName}</strong> has been completed by ${providerName}.</p>
          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Provider:</strong> ${providerName}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
            <li><strong>Duration:</strong> ${duration} hour(s)</li>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Status:</strong> Completed</li>
          </ul>
          <p>We hope you had a great experience! Please take a moment to leave a review for your provider.</p>
          <p>Thank you for using Urban Caregiving!</p>
        `;

        providerSubject = `Service Completed: ${serviceName}`;
        providerHtml = `
          <h2>Service Completed</h2>
          <p>Dear ${providerName},</p>
          <p>You have completed the service for <strong>${serviceName}</strong> with ${userName}.</p>
          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Client:</strong> ${userName}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
            <li><strong>Duration:</strong> ${duration} hour(s)</li>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Status:</strong> Completed</li>
          </ul>
          <p>Thank you for being a part of Urban Caregiving!</p>
        `;
        break;

      case 'cancelled':
        userSubject = `Booking Cancelled: ${serviceName}`;
        userHtml = `
          <h2>Your booking has been cancelled</h2>
          <p>Dear ${userName},</p>
          <p>Your booking for <strong>${serviceName}</strong> has been cancelled.</p>
          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Provider:</strong> ${providerName}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
            <li><strong>Duration:</strong> ${duration} hour(s)</li>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Status:</strong> Cancelled</li>
          </ul>
          <p>If you have any questions, please contact our support team.</p>
          <p>Thank you for using Urban Caregiving!</p>
        `;

        providerSubject = `Booking Cancelled: ${serviceName}`;
        providerHtml = `
          <h2>Booking Cancelled</h2>
          <p>Dear ${providerName},</p>
          <p>The booking for <strong>${serviceName}</strong> with ${userName} has been cancelled.</p>
          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Client:</strong> ${userName}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
            <li><strong>Duration:</strong> ${duration} hour(s)</li>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Status:</strong> Cancelled</li>
          </ul>
          <p>If you have any questions, please contact our support team.</p>
          <p>Thank you for being a part of Urban Caregiving!</p>
        `;
        break;
    }

    // Send emails with error handling
    const [userEmailResult, providerEmailResult] = await Promise.all([
      sendEmail(user.email, userSubject, userHtml),
      sendEmail(provider.email, providerSubject, providerHtml)
    ]);

    // Log results
    if (userEmailResult.success) {
      console.log(`User booking notification email sent for action: ${action}`);
    } else {
      console.warn(`Failed to send user booking notification email: ${userEmailResult.error}`);
    }

    if (providerEmailResult.success) {
      console.log(`Provider booking notification email sent for action: ${action}`);
    } else {
      console.warn(`Failed to send provider booking notification email: ${providerEmailResult.error}`);
    }

    // Return success even if emails fail - notifications will still be created in the database
    return { 
      success: true,
      emailsSent: {
        user: userEmailResult.success,
        provider: providerEmailResult.success
      }
    };
  } catch (error) {
    console.error('Error sending booking notification emails:', error);
    throw error;
  }
};

/**
 * Send chat notification email
 * @param userId - User ID
 * @param senderName - Sender name
 * @param messagePreview - Message preview
 */
export const sendChatNotificationEmail = async (
  userId: string,
  senderName: string,
  messagePreview: string
) => {
  try {
    const userEmail = await getUserEmail(userId);
    
    const subject = `New Message from ${senderName}`;
    const html = `
      <h2>New Message Received</h2>
      <p>Dear User,</p>
      <p>You have received a new message from <strong>${senderName}</strong>.</p>
      <p><strong>Message Preview:</strong> "${messagePreview.substring(0, 100)}${messagePreview.length > 100 ? '...' : ''}"</p>
      <p>Please log in to your account to view and respond to this message.</p>
      <p>Thank you for using Urban Caregiving!</p>
    `;

    const emailResult = await sendEmail(userEmail, subject, html);
    
    if (emailResult.success) {
      console.log(`Chat notification email sent to user: ${userId}`);
    } else {
      console.warn(`Failed to send chat notification email: ${emailResult.error}`);
    }
    
    // Return success even if email fails - notification will still be created in the database
    return { 
      success: true,
      emailSent: emailResult.success
    };
  } catch (error) {
    console.error('Error sending chat notification email:', error);
    throw error;
  }
};

/**
 * Send review notification email
 * @param providerId - Provider ID
 * @param reviewerName - Reviewer name
 * @param rating - Rating
 * @param comment - Review comment
 */
export const sendReviewNotificationEmail = async (
  providerId: string,
  reviewerName: string,
  rating: number,
  comment: string
) => {
  try {
    const providerEmail = await getUserEmail(providerId);
    
    const subject = `New Review from ${reviewerName}`;
    const html = `
      <h2>New Review Received</h2>
      <p>Dear Provider,</p>
      <p>You have received a new review from <strong>${reviewerName}</strong>.</p>
      <h3>Review Details:</h3>
      <ul>
        <li><strong>Rating:</strong> ${rating} out of 5</li>
        <li><strong>Comment:</strong> "${comment}"</li>
      </ul>
      <p>Please log in to your account to view this review.</p>
      <p>Thank you for being a part of Urban Caregiving!</p>
    `;

    const emailResult = await sendEmail(providerEmail, subject, html);
    
    if (emailResult.success) {
      console.log(`Review notification email sent to provider: ${providerId}`);
    } else {
      console.warn(`Failed to send review notification email: ${emailResult.error}`);
    }
    
    // Return success even if email fails - notification will still be created in the database
    return { 
      success: true,
      emailSent: emailResult.success
    };
  } catch (error) {
    console.error('Error sending review notification email:', error);
    throw error;
  }
};

/**
 * Send system notification email
 * @param userId - User ID
 * @param subject - Email subject
 * @param message - Email message
 */
export const sendSystemNotificationEmail = async (
  userId: string,
  subject: string,
  message: string
) => {
  try {
    const userEmail = await getUserEmail(userId);
    
    const html = `
      <h2>${subject}</h2>
      <p>Dear User,</p>
      <p>${message}</p>
      <p>Thank you for using Urban Caregiving!</p>
    `;

    const emailResult = await sendEmail(userEmail, subject, html);
    
    if (emailResult.success) {
      console.log(`System notification email sent to user: ${userId}`);
    } else {
      console.warn(`Failed to send system notification email: ${emailResult.error}`);
    }
    
    // Return success even if email fails - notification will still be created in the database
    return { 
      success: true,
      emailSent: emailResult.success
    };
  } catch (error) {
    console.error('Error sending system notification email:', error);
    throw error;
  }
};
