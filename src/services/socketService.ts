import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { User } from '../models/db';
import * as chatService from './notificationService';

interface AuthenticatedSocket extends Socket {
  user?: any;
}

// Setup Socket.IO
export const setupSocketIO = (io: SocketIOServer) => {
  // Middleware for authentication
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token not provided'));
      }
      
      // Verify token
      const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
      
      // Get user from database
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      // Attach user to socket
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });
  
  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.user?._id}`);
    
    // Join chat room
    socket.on('join-chat', async ({ bookingId }) => {
      if (!bookingId) {
        socket.emit('error', { message: 'Booking ID is required' });
        return;
      }
      
      try {
        // Join room
        socket.join(`chat:${bookingId}`);
        
        // Notify others in the room
        socket.to(`chat:${bookingId}`).emit('user-joined', {
          userId: socket.user?._id,
          timestamp: new Date()
        });
        
        console.log(`User ${socket.user?._id} joined chat room for booking ${bookingId}`);
      } catch (error) {
        console.error('Error joining chat room:', error);
        socket.emit('error', { message: 'Failed to join chat room' });
      }
    });
    
    // Leave chat room
    socket.on('leave-chat', ({ bookingId }) => {
      if (!bookingId) return;
      
      socket.leave(`chat:${bookingId}`);
      
      // Notify others in the room
      socket.to(`chat:${bookingId}`).emit('user-left', {
        userId: socket.user?._id,
        timestamp: new Date()
      });
      
      console.log(`User ${socket.user?._id} left chat room for booking ${bookingId}`);
    });
    
    // Send message
    socket.on('send-message', async ({ bookingId, content }) => {
      if (!bookingId || !content) {
        socket.emit('error', { message: 'Booking ID and content are required' });
        return;
      }
      
      try {
        // Create message in database
        // This is a simplified version - in a real app, you would use a proper chat service
        const message = {
          sender: socket.user?.role === 'provider' ? 'provider' : 'user',
          content,
          timestamp: new Date(),
          read: false,
          _id: Math.random().toString(36).substring(2, 15) // Simplified ID generation
        };
        
        // Broadcast message to all users in the room
        io.to(`chat:${bookingId}`).emit('new-message', { message });
        
        console.log(`Message sent in chat room for booking ${bookingId}`);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Mark messages as read
    socket.on('mark-messages-read', async ({ bookingId, messageIds }) => {
      if (!bookingId || !messageIds || !Array.isArray(messageIds)) {
        socket.emit('error', { message: 'Booking ID and message IDs array are required' });
        return;
      }
      
      try {
        // Update messages in database
        // This is a simplified version - in a real app, you would use a proper chat service
        
        // Broadcast to all users in the room
        io.to(`chat:${bookingId}`).emit('messages-read', { messageIds });
        
        console.log(`Messages marked as read in chat room for booking ${bookingId}`);
      } catch (error) {
        console.error('Error marking messages as read:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });
    
    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user?._id}`);
    });
  });
  
  return io;
};
