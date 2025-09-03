import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Chat } from '../models/db';
import * as notificationService from '../services/notificationService';

// Get chat for a specific booking
export const getChatByBookingId = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    
    // Validate bookingId
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid booking ID format'
      });
    }
    
    // Find chat by booking ID
    const chat = await Chat.findOne({ bookingId });
    
    // If chat doesn't exist, create a new one
    if (!chat) {
      // Get booking details to create a new chat
      const booking = await mongoose.model('Booking').findById(bookingId)
        .select('userId providerId');
      
      if (!booking) {
        return res.status(404).json({
          status: 'error',
          message: 'Booking not found'
        });
      }
      
      // Create new chat
      const newChat = await Chat.create({
        bookingId,
        userId: booking.userId,
        providerId: booking.providerId,
        messages: []
      });
      
      return res.status(201).json({
        status: 'success',
        data: {
          chat: newChat
        }
      });
    }
    
    // Return existing chat
    return res.status(200).json({
      status: 'success',
      data: {
        chat
      }
    });
  } catch (error: any) {
    console.error('Error in getChatByBookingId:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};

// Send a message in a chat
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { content, sender } = req.body;
    const userId = req.user?.id;
    
    // Validate chatId
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid chat ID format'
      });
    }
    
    // Validate required fields
    if (!content || !sender) {
      return res.status(400).json({
        status: 'error',
        message: 'Content and sender are required'
      });
    }
    
    // Validate sender value
    if (sender !== 'user' && sender !== 'provider') {
      return res.status(400).json({
        status: 'error',
        message: 'Sender must be either "user" or "provider"'
      });
    }
    
    // Find chat
    const chat = await Chat.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat not found'
      });
    }
    
    // Verify user has permission to send message in this chat
    if (
      (sender === 'user' && chat.userId.toString() !== userId) ||
      (sender === 'provider' && chat.providerId.toString() !== userId)
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to send messages in this chat'
      });
    }
    
    // Add message to chat
    const newMessage = {
      sender,
      content,
      timestamp: new Date(),
      read: false
    };
    
    chat.messages.push(newMessage);
    await chat.save();
    
    // Send notification to the recipient
    try {
      const recipientId = sender === 'user' 
        ? chat.providerId.toString() 
        : chat.userId.toString();
      
      const senderId = sender === 'user' 
        ? chat.userId.toString() 
        : chat.providerId.toString();
      
      await notificationService.createMessageNotification(
        recipientId,
        senderId,
        content,
        chatId
      );
      
      console.log(`Chat notification sent to ${recipientId}`);
    } catch (error) {
      console.error('Failed to send chat notification:', error);
      // Don't throw error here, as we still want to return the message
    }
    
    // Return the new message
    return res.status(201).json({
      status: 'success',
      data: {
        message: newMessage
      }
    });
  } catch (error: any) {
    console.error('Error in sendMessage:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};

// Mark messages as read
export const markMessagesAsRead = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { messageIds } = req.body;
    const userId = req.user?.id;
    
    // Validate chatId
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid chat ID format'
      });
    }
    
    // Validate messageIds
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Message IDs array is required'
      });
    }
    
    // Find chat
    const chat = await Chat.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat not found'
      });
    }
    
    // Verify user has permission to access this chat
    if (
      chat.userId.toString() !== userId &&
      chat.providerId.toString() !== userId
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to access this chat'
      });
    }
    
    // Mark messages as read
    let updatedCount = 0;
    
    // Find messages by their _id and mark as read
    chat.messages.forEach((message: any) => {
      if (messageIds.includes(message._id.toString()) && !message.read) {
        message.read = true;
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      await chat.save();
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        updatedCount
      }
    });
  } catch (error: any) {
    console.error('Error in markMessagesAsRead:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};

// Get all chats for a user (either as client or provider)
export const getUserChats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Find all chats where user is either the client or provider
    const chats = await Chat.find({
      $or: [
        { userId },
        { providerId: userId }
      ]
    })
    .populate('bookingId', 'status dateTime')
    .populate('userId', 'firstName lastName profilePicture')
    .populate('providerId', 'firstName lastName profilePicture')
    .sort({ updatedAt: -1 });
    
    return res.status(200).json({
      status: 'success',
      results: chats.length,
      data: {
        chats
      }
    });
  } catch (error: any) {
    console.error('Error in getUserChats:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};
