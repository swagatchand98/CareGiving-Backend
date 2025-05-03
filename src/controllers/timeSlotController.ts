import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { TimeSlot, Service, User } from '../models/db';
import { createError } from '../middleware/errorHandler';

/**
 * @desc    Create time slots for a service
 * @route   POST /api/timeslots
 * @access  Private (Provider only)
 */
export const createTimeSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId, slots } = req.body;

    // Ensure user is authenticated and is a provider
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    if (req.user.role !== 'provider') {
      return next(createError.forbidden('Only providers can create time slots'));
    }

    // Validate service exists and belongs to the provider
    const service = await Service.findOne({ 
      _id: serviceId, 
      providerId: req.user._id 
    });

    if (!service) {
      return next(createError.notFound('Service not found or you are not authorized'));
    }

    // Validate slots array
    if (!Array.isArray(slots) || slots.length === 0) {
      return next(createError.badRequest('Slots array is required'));
    }

    // Create time slots
    const timeSlots = [];
    for (const slot of slots) {
      const { date, startTime, endTime } = slot;

      // Validate date and time format
      if (!date || !startTime || !endTime) {
        return next(createError.badRequest('Date, startTime, and endTime are required for each slot'));
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return next(createError.badRequest('Time must be in HH:MM format'));
      }

      // Create time slot
      try {
        const timeSlot = await TimeSlot.create({
          providerId: req.user._id,
          serviceId,
          date: new Date(date),
          startTime,
          endTime,
          isBooked: false
        });
        timeSlots.push(timeSlot);
      } catch (error) {
        // Handle duplicate time slot error
        if (error instanceof Error && 'code' in error && error.code === 11000) {
          // Continue with the next slot if this one is a duplicate
          continue;
        }
        throw error;
      }
    }

    res.status(201).json({
      status: 'success',
      results: timeSlots.length,
      data: { timeSlots }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get available time slots for a service
 * @route   GET /api/timeslots/service/:serviceId
 * @access  Public
 */
export const getServiceTimeSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;
    const { date, startDate, endDate } = req.query;

    // Validate service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return next(createError.notFound('Service not found'));
    }

    // Build query
    const query: any = { 
      serviceId,
      isBooked: false
    };

    // Filter by specific date or date range
    if (date) {
      const queryDate = new Date(date as string);
      queryDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(queryDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query.date = {
        $gte: queryDate,
        $lt: nextDay
      };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate as string);
      }
      if (endDate) {
        const endDateObj = new Date(endDate as string);
        endDateObj.setHours(23, 59, 59, 999);
        query.date.$lte = endDateObj;
      }
    } else {
      // Default to future dates if no date filter provided
      query.date = { $gte: new Date() };
    }

    // Get time slots
    const timeSlots = await TimeSlot.find(query)
      .sort({ date: 1, startTime: 1 })
      .populate({
        path: 'providerId',
        select: 'firstName lastName profilePicture'
      });

    // Group time slots by date
    const groupedSlots = timeSlots.reduce((acc: any, slot) => {
      const dateStr = slot.date.toISOString().split('T')[0];
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(slot);
      return acc;
    }, {});

    res.status(200).json({
      status: 'success',
      results: timeSlots.length,
      data: { groupedSlots }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get provider's time slots
 * @route   GET /api/timeslots/provider
 * @access  Private (Provider only)
 */
export const getProviderTimeSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated and is a provider
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    if (req.user.role !== 'provider') {
      return next(createError.forbidden('Only providers can access their time slots'));
    }

    const { serviceId, date, startDate, endDate } = req.query;

    // Build query
    const query: any = { providerId: req.user._id };

    // Filter by service
    if (serviceId) {
      query.serviceId = serviceId;
    }

    // Filter by specific date or date range
    if (date) {
      const queryDate = new Date(date as string);
      queryDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(queryDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query.date = {
        $gte: queryDate,
        $lt: nextDay
      };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate as string);
      }
      if (endDate) {
        const endDateObj = new Date(endDate as string);
        endDateObj.setHours(23, 59, 59, 999);
        query.date.$lte = endDateObj;
      }
    }

    // Get time slots
    const timeSlots = await TimeSlot.find(query)
      .sort({ date: 1, startTime: 1 })
      .populate({
        path: 'serviceId',
        select: 'title price'
      })
      .populate({
        path: 'bookingId',
        select: 'userId status',
        populate: {
          path: 'userId',
          select: 'firstName lastName profilePicture'
        }
      });

    // Group time slots by date
    const groupedSlots = timeSlots.reduce((acc: any, slot) => {
      const dateStr = slot.date.toISOString().split('T')[0];
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(slot);
      return acc;
    }, {});

    res.status(200).json({
      status: 'success',
      results: timeSlots.length,
      data: { groupedSlots }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a time slot
 * @route   PATCH /api/timeslots/:id
 * @access  Private (Provider only)
 */
export const updateTimeSlot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { startTime, endTime } = req.body;

    // Ensure user is authenticated and is a provider
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find time slot
    const timeSlot = await TimeSlot.findById(id);
    if (!timeSlot) {
      return next(createError.notFound('Time slot not found'));
    }

    // Check if user is authorized to update this time slot
    if (timeSlot.providerId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('You are not authorized to update this time slot'));
    }

    // Check if time slot is already booked
    if (timeSlot.isBooked) {
      return next(createError.badRequest('Cannot update a booked time slot'));
    }

    // Update time slot
    if (startTime) timeSlot.startTime = startTime;
    if (endTime) timeSlot.endTime = endTime;

    await timeSlot.save();

    res.status(200).json({
      status: 'success',
      data: { timeSlot }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a time slot
 * @route   DELETE /api/timeslots/:id
 * @access  Private (Provider only)
 */
export const deleteTimeSlot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Ensure user is authenticated and is a provider
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find time slot
    const timeSlot = await TimeSlot.findById(id);
    if (!timeSlot) {
      return next(createError.notFound('Time slot not found'));
    }

    // Check if user is authorized to delete this time slot
    if (timeSlot.providerId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('You are not authorized to delete this time slot'));
    }

    // Check if time slot is already booked
    if (timeSlot.isBooked) {
      return next(createError.badRequest('Cannot delete a booked time slot'));
    }

    // Delete time slot
    await TimeSlot.findByIdAndDelete(id);

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Book a time slot
 * @route   POST /api/timeslots/:id/book
 * @access  Private
 */
export const bookTimeSlot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { address, specialInstructions } = req.body;

    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find time slot
    const timeSlot = await TimeSlot.findById(id);
    if (!timeSlot) {
      return next(createError.notFound('Time slot not found'));
    }

    // Check if time slot is already booked
    if (timeSlot.isBooked) {
      return next(createError.badRequest('This time slot is already booked'));
    }

    // Get service details
    const service = await Service.findById(timeSlot.serviceId);
    if (!service) {
      return next(createError.notFound('Service not found'));
    }

    // Calculate duration in minutes
    const startParts = timeSlot.startTime.split(':').map(Number);
    const endParts = timeSlot.endTime.split(':').map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];
    const duration = endMinutes - startMinutes;

    // Calculate total price
    let totalPrice = 0;
    if (service.price.type === 'fixed') {
      totalPrice = service.price.amount;
    } else if (service.price.type === 'hourly') {
      // Convert duration from minutes to hours and multiply by hourly rate
      totalPrice = service.price.amount * (duration / 60);
    }

    // Validate address
    if (!address || !address.street || !address.city || !address.state || !address.zipCode) {
      return next(createError.badRequest('Complete address is required'));
    }

    // Create booking
    const booking = await mongoose.model('Booking').create({
      serviceId: service._id,
      userId: req.user._id,
      providerId: timeSlot.providerId,
      dateTime: new Date(`${timeSlot.date.toISOString().split('T')[0]}T${timeSlot.startTime}:00`),
      duration,
      status: 'pending',
      address,
      specialInstructions: specialInstructions || '',
      totalPrice
    });

    // Update time slot with booking info
    timeSlot.isBooked = true;
    timeSlot.bookingId = booking._id;
    await timeSlot.save();

    // Create a pending transaction record
    await mongoose.model('Transaction').create({
      bookingId: booking._id,
      userId: req.user._id,
      providerId: timeSlot.providerId,
      amount: totalPrice,
      platformCommission: totalPrice * 0.1, // Assuming 10% platform commission
      paymentMethod: 'stripe', // Default payment method
      status: 'pending'
    });

    // Populate booking with service and provider details
    const populatedBooking = await mongoose.model('Booking').findById(booking._id)
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
      data: { 
        booking: populatedBooking,
        timeSlot
      }
    });
  } catch (error) {
    next(error);
  }
};
