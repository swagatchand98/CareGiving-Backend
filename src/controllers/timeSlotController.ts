import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { TimeSlot, TimeSlotSegment, Service, User } from '../models/db';
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

      // Get service details to check duration
      const serviceDetails = await Service.findById(serviceId);
      if (!serviceDetails || !serviceDetails.duration) {
        return next(createError.badRequest('Service duration is required'));
      }

      // Calculate time slot duration in minutes
      const startParts = startTime.split(':').map(Number);
      const endParts = endTime.split(':').map(Number);
      const startMinutes = startParts[0] * 60 + startParts[1];
      const endMinutes = endParts[0] * 60 + endParts[1];
      const slotDuration = endMinutes - startMinutes;

      // Check if time slot is long enough for the service
      if (slotDuration < serviceDetails.duration) {
        return next(createError.badRequest(`Time slot must be at least ${serviceDetails.duration} minutes long for this service`));
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

        // Calculate number of segments based on service duration
        const numSegments = Math.floor(slotDuration / serviceDetails.duration);
        
        // Create segments for the time slot
        const segments = [];
        for (let i = 0; i < numSegments; i++) {
          const segmentStartMinutes = startMinutes + (i * serviceDetails.duration);
          const segmentEndMinutes = segmentStartMinutes + serviceDetails.duration;
          
          const segmentStartHours = Math.floor(segmentStartMinutes / 60);
          const segmentStartMins = segmentStartMinutes % 60;
          const segmentEndHours = Math.floor(segmentEndMinutes / 60);
          const segmentEndMins = segmentEndMinutes % 60;
          
          const formattedSegmentStart = `${segmentStartHours.toString().padStart(2, '0')}:${segmentStartMins.toString().padStart(2, '0')}`;
          const formattedSegmentEnd = `${segmentEndHours.toString().padStart(2, '0')}:${segmentEndMins.toString().padStart(2, '0')}`;
          
          const segment = await TimeSlotSegment.create({
            timeSlotId: timeSlot._id,
            segmentIndex: i,
            startTime: formattedSegmentStart,
            endTime: formattedSegmentEnd,
            isBooked: false
          });
          
          segments.push(segment);
        }
        
        console.log(`Created ${segments.length} segments for time slot ${timeSlot._id}`);
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
      serviceId
      // Remove isBooked: false to get all time slots, even partially booked ones
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

    // Get all time slot IDs
    const timeSlotIds = timeSlots.map(slot => slot._id);

    // Get all segments for all time slots
    const segments = await TimeSlotSegment.find({
      timeSlotId: { $in: timeSlotIds }
    }).sort({ segmentIndex: 1 });
    
    console.log(`Found ${segments.length} segments for time slots`);
    // Log a sample segment to check its properties
    if (segments.length > 0) {
      console.log('Sample segment:', JSON.stringify(segments[0].toObject()));
    }

    // Group segments by time slot ID
    const segmentsByTimeSlot = segments.reduce((acc: any, segment) => {
      const timeSlotId = segment.timeSlotId.toString();
      if (!acc[timeSlotId]) {
        acc[timeSlotId] = [];
      }
      acc[timeSlotId].push(segment);
      return acc;
    }, {});

    // Add segments to time slots
    const timeSlotsWithSegments = timeSlots.map(slot => {
      const slotObj = slot.toObject();
      const slotId = slot._id instanceof mongoose.Types.ObjectId ? slot._id.toString() : String(slot._id);
      slotObj.segments = segmentsByTimeSlot[slotId] || [];
      return slotObj;
    });

    // Filter out time slots where all segments are booked
    const availableTimeSlots = timeSlotsWithSegments.filter(slot => {
      // If the slot has no segments, it's not available
      if (!slot.segments || slot.segments.length === 0) {
        return false;
      }
      
      // Check if at least one segment is available
      return slot.segments.some(segment => !segment.isBooked);
    });
    
    console.log(`Filtered out ${timeSlotsWithSegments.length - availableTimeSlots.length} fully booked time slots`);
    
    // Group time slots by date
    const groupedSlots = availableTimeSlots.reduce((acc: any, slot) => {
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

    // Get all time slot IDs
    const timeSlotIds = timeSlots.map(slot => slot._id);

    // Get segments for all time slots
    const segments = await TimeSlotSegment.find({
      timeSlotId: { $in: timeSlotIds }
    }).sort({ segmentIndex: 1 });

    // Group segments by time slot ID
    const segmentsByTimeSlot = segments.reduce((acc: any, segment) => {
      const timeSlotId = segment.timeSlotId.toString();
      if (!acc[timeSlotId]) {
        acc[timeSlotId] = [];
      }
      acc[timeSlotId].push(segment);
      return acc;
    }, {});

    // Add segments to time slots
    const timeSlotsWithSegments = timeSlots.map(slot => {
      const slotObj = slot.toObject();
      const slotId = slot._id instanceof mongoose.Types.ObjectId ? slot._id.toString() : String(slot._id);
      slotObj.segments = segmentsByTimeSlot[slotId] || [];
      return slotObj;
    });

    // Group time slots by date
    const groupedSlots = timeSlotsWithSegments.reduce((acc: any, slot) => {
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

    // Delete time slot segments first
    await TimeSlotSegment.deleteMany({ timeSlotId: id });
    
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
    const { address, specialInstructions, segmentIndex, segmentStart, segmentEnd } = req.body;

    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Validate required parameters
    if (segmentIndex === undefined && !segmentStart && !segmentEnd) {
      return next(createError.badRequest('A segment index or segment time range is required'));
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
    
    // Find the requested segment
    let selectedSegment = null;
    
    if (segmentIndex !== undefined) {
      // Find the segment by index
      selectedSegment = await TimeSlotSegment.findOne({
        timeSlotId: id,
        segmentIndex: segmentIndex
      });
      
      // If segment doesn't exist, create it on the fly
      if (!selectedSegment) {
        console.log(`Segment with index ${segmentIndex} not found, creating it dynamically`);
        
        // Get service details to calculate duration
        const service = await Service.findById(timeSlot.serviceId);
        if (!service || !service.duration) {
          return next(createError.badRequest('Service duration is required'));
        }
        
        // Calculate segment times
        const [startHours, startMinutes] = timeSlot.startTime.split(':').map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        
        const segmentStartMinutes = startTotalMinutes + (segmentIndex * service.duration);
        const segmentEndMinutes = segmentStartMinutes + service.duration;
        
        const segmentStartHours = Math.floor(segmentStartMinutes / 60);
        const segmentStartMins = segmentStartMinutes % 60;
        const segmentEndHours = Math.floor(segmentEndMinutes / 60);
        const segmentEndMins = segmentEndMinutes % 60;
        
        const formattedSegmentStart = `${segmentStartHours.toString().padStart(2, '0')}:${segmentStartMins.toString().padStart(2, '0')}`;
        const formattedSegmentEnd = `${segmentEndHours.toString().padStart(2, '0')}:${segmentEndMins.toString().padStart(2, '0')}`;
        
        // Create the segment
        selectedSegment = await TimeSlotSegment.create({
          timeSlotId: id,
          segmentIndex: segmentIndex,
          startTime: formattedSegmentStart,
          endTime: formattedSegmentEnd,
          isBooked: false,
          isReserved: false
        });
        
        console.log(`Created segment dynamically:`, selectedSegment);
      }
      
      if (selectedSegment.isBooked) {
        return next(createError.badRequest('This segment is already booked'));
      }
    } else if (segmentStart && segmentEnd) {
      // Find the segment by time range
      selectedSegment = await TimeSlotSegment.findOne({
        timeSlotId: id,
        startTime: segmentStart,
        endTime: segmentEnd,
        isBooked: false,
        isReserved: false
      });
      
      if (!selectedSegment) {
        return next(createError.notFound('No available segment found for the specified time range'));
      }
    }
    
    if (!selectedSegment) {
      return next(createError.badRequest('A valid segment must be specified for booking'));
    }

    // Get service details
    const service = await Service.findById(timeSlot.serviceId);
    if (!service) {
      return next(createError.notFound('Service not found'));
    }

    // Calculate duration in minutes using the segment's times
    const startTime = selectedSegment.startTime;
    const endTime = selectedSegment.endTime;
    
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
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
    
    // Ensure minimum price for Stripe ($0.50 USD)
    if (totalPrice < 0.5) {
      totalPrice = 0.5;
      console.log('Adjusted price to minimum $0.50 for Stripe');
    }

    // Validate address
    if (!address || !address.street || !address.city || !address.state || !address.zipCode) {
      return next(createError.badRequest('Complete address is required'));
    }

    // Create booking with reserved status
    // Using 'reserved' status to indicate that the booking is not yet confirmed
    // and should not trigger notifications to the provider
    const booking = await mongoose.model('Booking').create({
      serviceId: service._id,
      userId: req.user._id,
      providerId: timeSlot.providerId,
      dateTime: new Date(`${timeSlot.date.toISOString().split('T')[0]}T${timeSlot.startTime}:00`),
      duration,
      status: 'reserved', // Use 'reserved' status instead of 'pending'
      address,
      specialInstructions: specialInstructions || '',
      totalPrice
    });

    // Mark the segment as temporarily reserved, but not fully booked yet
    // It will be marked as fully booked only after payment confirmation
    selectedSegment.isReserved = true;
    selectedSegment.isBooked = false; // Ensure it's not marked as booked yet
    selectedSegment.bookingId = booking._id;
    await selectedSegment.save();
    
    console.log(`Segment ${selectedSegment._id} marked as reserved for booking ${booking._id}`);
    
    // Check if all segments are now booked or reserved
    const allSegments = await TimeSlotSegment.find({ timeSlotId: id });
    const allBooked = allSegments.every(segment => segment.isBooked);
    const allReservedOrBooked = allSegments.every(segment => segment.isBooked || segment.isReserved);
    
    // Update the parent time slot's status if all segments are reserved or booked
    if (allReservedOrBooked) {
      timeSlot.isReserved = true;
      await timeSlot.save();
      console.log(`All segments reserved or booked, marking time slot ${timeSlot._id} as reserved`);
    }
    
    // We don't mark the segment as fully booked until payment is confirmed
    // If payment is cancelled, the segment will be marked as available again
    // This is handled in the payment confirmation webhook

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
