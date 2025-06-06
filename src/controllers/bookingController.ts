import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Booking, Service, User, Transaction } from '../models/db';
import { createError } from '../middleware/errorHandler';
import * as notificationService from '../services/notificationService';
import { Server as SocketIOServer } from 'socket.io';

// Socket.io instance
let io: SocketIOServer;

// Set Socket.io instance
export const setSocketIO = (socketIO: SocketIOServer) => {
  io = socketIO;
};

/**
 * @desc    Create a new booking
 * @route   POST /api/bookings
 * @access  Private
 */
export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      serviceId, 
      dateTime, 
      duration, 
      address, 
      specialInstructions 
    } = req.body;

    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Validate service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return next(createError.notFound('Service not found'));
    }

    // Get provider ID from service
    const providerId = service.providerId;

    // Calculate total price based on service price and duration
    let totalPrice = 0;
    if (service.price.type === 'fixed') {
      totalPrice = service.price.amount;
    } else if (service.price.type === 'hourly') {
      // Convert duration from minutes to hours and multiply by hourly rate
      totalPrice = service.price.amount * (duration / 60);
    }

    // Create booking
    const booking = await Booking.create({
      serviceId,
      userId: req.user._id,
      providerId,
      dateTime: new Date(dateTime),
      duration,
      status: 'pending',
      address,
      specialInstructions,
      totalPrice
    });

    // Create a pending transaction record
    await Transaction.create({
      bookingId: booking._id,
      userId: req.user._id,
      providerId,
      amount: totalPrice,
      platformCommission: totalPrice * 0.1, // Assuming 10% platform commission
      paymentMethod: 'stripe', // Default payment method
      status: 'pending'
    });

    // Send booking notification
    try {
      const bookingId = booking._id as mongoose.Types.ObjectId;
      const serviceName = service.title;
      await notificationService.createBookingNotification(
        req.user._id.toString(),
        providerId.toString(),
        bookingId.toString(),
        'created',
        serviceName
      );
      console.log(`Booking notification sent for new booking: ${bookingId.toString()}`);
    } catch (error) {
      console.error('Failed to send booking notification:', error);
      // Don't throw error here, as we still want to return the booking
    }

    // Populate service and provider details for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate({
        path: 'serviceId',
        select: 'title description price'
      })
      .populate({
        path: 'providerId',
        select: 'firstName lastName email'
      });

    res.status(201).json({
      status: 'success',
      data: { booking: populatedBooking }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all bookings for the logged-in user
 * @route   GET /api/bookings/user
 * @access  Private
 */
export const getUserBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = { userId: req.user._id };
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by date range
    if (req.query.startDate || req.query.endDate) {
      query.dateTime = {};
      if (req.query.startDate) query.dateTime.$gte = new Date(req.query.startDate as string);
      if (req.query.endDate) query.dateTime.$lte = new Date(req.query.endDate as string);
    }

    const bookings = await Booking.find(query)
      .populate({
        path: 'serviceId',
        select: 'title description price images'
      })
      .populate({
        path: 'providerId',
        select: 'firstName lastName profilePicture'
      })
      .skip(skip)
      .limit(limit)
      .sort({ dateTime: -1 });

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      status: 'success',
      results: bookings.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: { bookings }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all bookings for the logged-in provider
 * @route   GET /api/bookings/provider
 * @access  Private (Provider only)
 */
export const getProviderBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure provider is authenticated
    if (!req.user) {
      return next(createError.unauthorized('Provider not authenticated'));
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = { providerId: req.user._id };
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by date range
    if (req.query.startDate || req.query.endDate) {
      query.dateTime = {};
      if (req.query.startDate) query.dateTime.$gte = new Date(req.query.startDate as string);
      if (req.query.endDate) query.dateTime.$lte = new Date(req.query.endDate as string);
    }

    const bookings = await Booking.find(query)
      .populate({
        path: 'serviceId',
        select: 'title description price'
      })
      .populate({
        path: 'userId',
        select: 'firstName lastName profilePicture phoneNumber'
      })
      .skip(skip)
      .limit(limit)
      .sort({ dateTime: -1 });

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      status: 'success',
      results: bookings.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: { bookings }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get booking by ID
 * @route   GET /api/bookings/:id
 * @access  Private
 */
export const getBookingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'serviceId',
        select: 'title description price images'
      })
      .populate({
        path: 'userId',
        select: 'firstName lastName email profilePicture phoneNumber'
      })
      .populate({
        path: 'providerId',
        select: 'firstName lastName email profilePicture phoneNumber'
      });

    if (!booking) {
      return next(createError.notFound('Booking not found'));
    }

    // Debug information
    console.log('User ID:', req.user._id);
    console.log('User Firebase UID:', req.user.firebaseUid);
    console.log('User Role:', req.user.role);
    console.log('Booking User ID:', booking.userId);
    console.log('Booking Provider ID:', booking.providerId);

    // Convert IDs to strings for comparison
    const userIdStr = req.user._id.toString();
    const bookingUserIdStr = booking.userId.toString();
    const bookingProviderIdStr = booking.providerId.toString();
    const firebaseUid = req.user.firebaseUid;

    console.log('User ID (string):', userIdStr);
    console.log('Booking User ID (string):', bookingUserIdStr);
    console.log('Booking Provider ID (string):', bookingProviderIdStr);
    console.log('Firebase UID:', firebaseUid);

    // Check if the user is authorized to view this booking
    // Allow access if the user is the client, the provider, or an admin
    
    // Get the user from the booking
    const bookingUser = await User.findById(booking.userId);
    const bookingProvider = await User.findById(booking.providerId);
    
    console.log('Booking User Firebase UID:', bookingUser?.firebaseUid);
    console.log('Booking Provider Firebase UID:', bookingProvider?.firebaseUid);
    
    // Check if the current user is the client, provider, or admin
    const isClient = bookingUserIdStr === userIdStr || 
                     (bookingUser && bookingUser.firebaseUid === req.user.firebaseUid);
    
    const isProvider = bookingProviderIdStr === userIdStr || 
                       (bookingProvider && bookingProvider.firebaseUid === req.user.firebaseUid);
    
    const isAdmin = req.user.role === 'admin';
    
    console.log('Is Client:', isClient);
    console.log('Is Provider:', isProvider);
    console.log('Is Admin:', isAdmin);
    
    if (!isClient && !isProvider && !isAdmin) {
      console.log('Access denied: User is not authorized to view this booking');
      return next(createError.forbidden('You are not authorized to view this booking'));
    }

    // Get transaction details
    const transaction = await Transaction.findOne({ bookingId: booking._id });

    res.status(200).json({
      status: 'success',
      data: { 
        booking,
        transaction
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update booking status
 * @route   PATCH /api/bookings/:id/status
 * @access  Private (Provider or User)
 */
export const updateBookingStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return next(createError.badRequest('Status is required'));
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return next(createError.badRequest(`Status must be one of: ${validStatuses.join(', ')}`));
    }

    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return next(createError.notFound('Booking not found'));
    }

    // Get the user and provider from the booking
    const bookingUser = await User.findById(booking.userId);
    const bookingProvider = await User.findById(booking.providerId);
    
    // Check if the current user is the client, provider, or admin
    const isClient = booking.userId.toString() === req.user._id.toString() || 
                     (bookingUser && bookingUser.firebaseUid === req.user.firebaseUid);
    
    const isProvider = booking.providerId.toString() === req.user._id.toString() || 
                       (bookingProvider && bookingProvider.firebaseUid === req.user.firebaseUid);
    
    const isAdmin = req.user.role === 'admin';
    
    // Check authorization based on the status change
    if (!isAdmin) {
      // Providers can confirm, start, or complete bookings
      if (['confirmed', 'in-progress', 'completed'].includes(status)) {
        if (!isProvider) {
          return next(createError.forbidden('Only the provider can update this booking status'));
        }
      }
      
      // Users can only cancel their own bookings
      if (status === 'cancelled') {
        if (!isClient) {
          return next(createError.forbidden('Only the user who made the booking can cancel it'));
        }
        
        // Check if booking is already in progress or completed
        if (['in-progress', 'completed'].includes(booking.status)) {
          return next(createError.badRequest('Cannot cancel a booking that is in progress or completed'));
        }
      }
    }

    // Update booking status
    booking.status = status;
    await booking.save();

    // Update transaction status if booking is completed or cancelled
    if (status === 'completed') {
      await Transaction.findOneAndUpdate(
        { bookingId: booking._id },
        { status: 'completed' }
      );
    } else if (status === 'cancelled') {
      await Transaction.findOneAndUpdate(
        { bookingId: booking._id },
        { status: 'cancelled' }
      );
    }

    // Send booking notification
    try {
      // Get service name
      const bookingWithService = await Booking.findById(req.params.id).populate('serviceId');
      if (bookingWithService && bookingWithService.serviceId) {
        const serviceName = (bookingWithService.serviceId as any).title;
        
        await notificationService.createBookingNotification(
          booking.userId.toString(),
          booking.providerId.toString(),
          req.params.id,
          status as 'confirmed' | 'started' | 'completed' | 'cancelled',
          serviceName
        );
        console.log(`Booking notification sent for status update to ${status}: ${req.params.id}`);
        
        // Emit socket event for booking status change
        if (io) {
          io.emit('booking-status-changed', { 
            bookingId: req.params.id, 
            status,
            userId: booking.userId.toString(),
            providerId: booking.providerId.toString()
          });
          console.log(`Socket event emitted for booking status change to ${status}: ${req.params.id}`);
        }
      }
    } catch (error) {
      console.error('Failed to send booking notification:', error);
      // Don't throw error here, as we still want to return the booking
    }

    // Get updated booking with populated fields
    const updatedBooking = await Booking.findById(booking._id)
      .populate({
        path: 'serviceId',
        select: 'title description price'
      })
      .populate({
        path: 'userId',
        select: 'firstName lastName email'
      })
      .populate({
        path: 'providerId',
        select: 'firstName lastName email'
      });

    res.status(200).json({
      status: 'success',
      data: { booking: updatedBooking }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel booking
 * @route   DELETE /api/bookings/:id
 * @access  Private
 */
export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return next(createError.notFound('Booking not found'));
    }

    // Check if user is authorized to cancel this booking
    // Get the user from the booking
    const bookingUser = await User.findById(booking.userId);
    
    // Check if the current user is the client or admin
    const isClient = booking.userId.toString() === req.user._id.toString() || 
                     (bookingUser && bookingUser.firebaseUid === req.user.firebaseUid);
    
    const isAdmin = req.user.role === 'admin';
    
    if (!isClient && !isAdmin) {
      return next(createError.forbidden('You are not authorized to cancel this booking'));
    }

    // Check if booking can be cancelled
    if (['in-progress', 'completed'].includes(booking.status)) {
      return next(createError.badRequest('Cannot cancel a booking that is in progress or completed'));
    }

    // Update booking status to cancelled
    booking.status = 'cancelled';
    await booking.save();

    // Update transaction status
    await Transaction.findOneAndUpdate(
      { bookingId: booking._id },
      { status: 'cancelled' }
    );

    // Send booking notification
    try {
      // Get service name
      const bookingWithService = await Booking.findById(req.params.id).populate('serviceId');
      if (bookingWithService && bookingWithService.serviceId) {
        const serviceName = (bookingWithService.serviceId as any).title;
        
        await notificationService.createBookingNotification(
          booking.userId.toString(),
          booking.providerId.toString(),
          req.params.id,
          'cancelled',
          serviceName
        );
        console.log(`Booking notification sent for cancellation: ${req.params.id}`);
        
        // Emit socket event for booking cancellation
        if (io) {
          io.emit('booking-status-changed', { 
            bookingId: req.params.id, 
            status: 'cancelled',
            userId: booking.userId.toString(),
            providerId: booking.providerId.toString()
          });
          console.log(`Socket event emitted for booking cancellation: ${req.params.id}`);
        }
      }
    } catch (error) {
      console.error('Failed to send booking notification:', error);
      // Don't throw error here, as we still want to return the success message
    }

    res.status(200).json({
      status: 'success',
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};
