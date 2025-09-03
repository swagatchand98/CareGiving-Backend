import { Request, Response, NextFunction } from 'express';
import { User, Service, Booking, ServiceCategory, Transaction, Review, Notification, TimeSlot, Wishlist, ProviderProfile, ProviderConnectAccount, Chat } from '../models/db';
import mongoose from 'mongoose';

/**
 * @route   GET /api/v1/admin/users
 */
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, status, verificationStatus, search } = req.query;
    
    const filter: any = {};
    
    if (role) {
      filter.role = role;
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (verificationStatus) {
      filter.verificationStatus = verificationStatus;
    }
    
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(filter).select('-password');
    
    res.json({
      count: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/users/:id
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user's bookings
    const bookings = await Booking.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('serviceId', 'title')
      .populate('providerId', 'firstName lastName');
    
    // Get user's transactions
    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get user's reviews
    const reviews = await Review.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('providerId', 'firstName lastName')
      .populate('serviceId', 'title');
    
    res.json({
      user,
      bookings,
      transactions,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/users/:id/status
 */
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    
    if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      message: `User status updated to ${status}`,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/admin/users/:id/suspend
 */
export const suspendUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason, duration } = req.body;
    
    const suspendUntil = duration ? new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000) : null;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'suspended',
        suspendReason: reason || 'Suspended by admin',
        suspendedAt: new Date(),
        suspendUntil
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Cancel any active bookings
    await Booking.updateMany(
      { 
        userId: user._id,
        status: { $in: ['pending', 'confirmed', 'reserved'] }
      },
      { 
        status: 'cancelled',
        cancellationReason: 'User account suspended'
      }
    );
    
    // Create notification for the user
    await Notification.create({
      userId: user._id,
      type: 'system',
      content: `Your account has been suspended. Reason: ${reason || 'Suspended by admin'}${suspendUntil ? `. Suspension will end on ${suspendUntil.toDateString()}.` : ''}`,
      isRead: false
    });
    
    res.json({
      message: 'User suspended successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/admin/users/:id/activate
 */
export const activateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'active',
        suspendReason: null,
        suspendedAt: null,
        suspendUntil: null
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Create notification for the user
    await Notification.create({
      userId: user._id,
      type: 'system',
      content: 'Your account has been activated. You can now use all features of the platform.',
      isRead: false
    });
    
    res.json({
      message: 'User activated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/admin/users/:id/block
 */
export const blockUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        verificationStatus: 'rejected',
        blockReason: reason || 'Blocked by admin',
        blockedAt: new Date()
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Cancel any active bookings
    await Booking.updateMany(
      { 
        userId: user._id,
        status: { $in: ['pending', 'confirmed', 'reserved'] }
      },
      { 
        status: 'cancelled',
        cancellationReason: 'User account blocked'
      }
    );
    
    // Create notification for the user
    await Notification.create({
      userId: user._id,
      type: 'system',
      content: `Your account has been blocked. Reason: ${reason || 'Blocked by admin'}`,
      isRead: false
    });
    
    res.json({
      message: 'User blocked successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/admin/users/:id/unblock
 */
export const unblockUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        verificationStatus: 'verified',
        blockReason: null,
        blockedAt: null
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Create notification for the user
    await Notification.create({
      userId: user._id,
      type: 'system',
      content: 'Your account has been unblocked. You can now use all features of the platform.',
      isRead: false
    });
    
    res.json({
      message: 'User unblocked successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/services
 */
export const getAllServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, providerId, minPrice, maxPrice, search } = req.query;
    
    const filter: any = {};
    
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId as string)) {
      filter.categoryId = new mongoose.Types.ObjectId(categoryId as string);
    }
    
    if (providerId && mongoose.Types.ObjectId.isValid(providerId as string)) {
      filter.providerId = new mongoose.Types.ObjectId(providerId as string);
    }
    
    // Price filter
    if (minPrice || maxPrice) {
      filter['price.amount'] = {};
      
      if (minPrice) {
        filter['price.amount'].$gte = Number(minPrice);
      }
      
      if (maxPrice) {
        filter['price.amount'].$lte = Number(maxPrice);
      }
    }
    
    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const services = await Service.find(filter)
      .populate('categoryId', 'name')
      .populate('providerId', 'firstName lastName email');
    
    res.json({
      count: services.length,
      services
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/services/:id
 */
export const getServiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('categoryId', 'name')
      .populate('providerId', 'firstName lastName email');
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Get bookings for this service
    const bookings = await Booking.find({ serviceId: service._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'firstName lastName');
    
    // Get reviews for this service
    const reviews = await Review.find({ serviceId: service._id })
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName');
    
    // Get available time slots
    const timeSlots = await TimeSlot.find({ 
      serviceId: service._id,
      isBooked: false,
      date: { $gte: new Date() }
    }).sort({ date: 1 });
    
    res.json({
      service,
      bookings,
      reviews,
      timeSlots
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/v1/admin/services/:id
 */
export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, price, duration, categoryId, additionalDetails, mediaFiles } = req.body;
    
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { 
        title,
        description,
        price,
        duration,
        categoryId,
        additionalDetails,
        mediaFiles,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Notify the provider
    await Notification.create({
      userId: service.providerId,
      type: 'system',
      content: `Your service "${service.title}" has been updated by an administrator.`,
      relatedEntityId: service._id as unknown as string,
      isRead: false
    });
    
    res.json({
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/admin/services/:id
 */
export const deleteService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if service has any active bookings
    const activeBookings = await Booking.countDocuments({
      serviceId: req.params.id,
      status: { $in: ['pending', 'confirmed', 'reserved'] }
    });
    
    if (activeBookings > 0) {
      return res.status(400).json({
        message: 'Cannot delete service with active bookings',
        activeBookingsCount: activeBookings
      });
    }
    
    const service = await Service.findByIdAndDelete(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Delete related time slots
    await TimeSlot.deleteMany({ serviceId: req.params.id });
    
    // Remove from wishlists
    await Wishlist.deleteMany({ serviceId: req.params.id });
    
    // Notify the provider
    await Notification.create({
      userId: service.providerId,
      type: 'system',
      content: `Your service "${service.title}" has been deleted by an administrator.`,
      isRead: false
    });
    
    res.json({
      message: 'Service deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/service-categories
 */
export const getAllServiceCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await ServiceCategory.find();
    
    // For each category, get the count of services
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const serviceCount = await Service.countDocuments({ categoryId: category._id });
        return {
          ...category.toObject(),
          serviceCount
        };
      })
    );
    
    res.json({
      count: categories.length,
      categories: categoriesWithCounts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/admin/service-categories
 */
export const manageServiceCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, categoryId, name, description, iconUrl, tasks } = req.body;
    
    switch (action) {
      case 'create':
        if (!name) {
          return res.status(400).json({ message: 'Category name is required' });
        }
        
        const newCategory = await ServiceCategory.create({
          name,
          description,
          iconUrl,
          tasks: tasks || []
        });
        
        return res.status(201).json({
          message: 'Category created successfully',
          category: newCategory
        });
        
      case 'update':
        if (!categoryId) {
          return res.status(400).json({ message: 'Category ID is required' });
        }
        
        const updatedCategory = await ServiceCategory.findByIdAndUpdate(
          categoryId,
          { 
            name, 
            description, 
            iconUrl,
            tasks: tasks || [],
            updatedAt: new Date()
          },
          { new: true }
        );
        
        if (!updatedCategory) {
          return res.status(404).json({ message: 'Category not found' });
        }
        
        return res.json({
          message: 'Category updated successfully',
          category: updatedCategory
        });
        
      case 'delete':
        if (!categoryId) {
          return res.status(400).json({ message: 'Category ID is required' });
        }
        
        // Check if category is in use
        const servicesUsingCategory = await Service.countDocuments({ categoryId });
        
        if (servicesUsingCategory > 0) {
          return res.status(400).json({ 
            message: 'Cannot delete category that is in use by services',
            servicesCount: servicesUsingCategory
          });
        }
        
        const deletedCategory = await ServiceCategory.findByIdAndDelete(categoryId);
        
        if (!deletedCategory) {
          return res.status(404).json({ message: 'Category not found' });
        }
        
        return res.json({
          message: 'Category deleted successfully'
        });
        
      default:
        return res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/bookings
 */
export const getAllBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, startDate, endDate, userId, serviceId, providerId, sortBy, limit, page } = req.query;
    
    const filter: any = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (startDate && endDate) {
      filter.dateTime = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      };
    } else if (startDate) {
      filter.dateTime = { $gte: new Date(startDate as string) };
    } else if (endDate) {
      filter.dateTime = { $lte: new Date(endDate as string) };
    }
    
    if (userId && mongoose.Types.ObjectId.isValid(userId as string)) {
      filter.userId = new mongoose.Types.ObjectId(userId as string);
    }
    
    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId as string)) {
      filter.serviceId = new mongoose.Types.ObjectId(serviceId as string);
    }
    
    if (providerId && mongoose.Types.ObjectId.isValid(providerId as string)) {
      filter.providerId = new mongoose.Types.ObjectId(providerId as string);
    }
    
    // Pagination
    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = parseInt(limit as string) || 20;
    const skip = (pageNumber - 1) * limitNumber;
    
    // Sorting
    let sort: any = { createdAt: -1 }; // Default sort by creation date, newest first
    if (sortBy === 'dateTime') {
      sort = { dateTime: 1 }; // Sort by booking date/time, ascending
    } else if (sortBy === 'totalPrice') {
      sort = { totalPrice: -1 }; // Sort by price, highest first
    }
    
    const bookings = await Booking.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('serviceId', 'title price duration')
      .populate('providerId', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNumber);
    
    const totalBookings = await Booking.countDocuments(filter);
    
    res.json({
      count: bookings.length,
      totalBookings,
      totalPages: Math.ceil(totalBookings / limitNumber),
      currentPage: pageNumber,
      bookings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/bookings/:id
 */
export const getBookingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('userId', 'firstName lastName email phoneNumber')
      .populate('serviceId', 'title price duration')
      .populate('providerId', 'firstName lastName email phoneNumber');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Get related payment transaction
    const transaction = await Transaction.findOne({ bookingId: booking._id });
    
    // Get related reviews
    const review = await Review.findOne({ bookingId: booking._id });
    
    res.json({
      booking,
      payment: transaction || null,
      review: review || null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/bookings/:id/status
 */
export const updateBookingStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reason } = req.body;
    
    if (!status || !['reserved', 'pending', 'confirmed', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        cancellationReason: status === 'cancelled' ? (reason || 'Cancelled by admin') : undefined,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Notify the user
    await Notification.create({
      userId: booking.userId,
      type: 'booking',
      content: `Your booking status has been updated to ${status}${status === 'cancelled' ? `. Reason: ${reason || 'Cancelled by admin'}` : ''}.`,
      relatedEntityId: booking._id as unknown as string,
      isRead: false
    });
    
    // Notify the provider
    await Notification.create({
      userId: booking.providerId,
      type: 'booking',
      content: `Booking status has been updated to ${status}${status === 'cancelled' ? `. Reason: ${reason || 'Cancelled by admin'}` : ''}.`,
      relatedEntityId: booking._id as unknown as string,
      isRead: false
    });
    
    res.json({
      message: `Booking status updated to ${status}`,
      booking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/payments
 */
export const getAllPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, startDate, endDate, userId, providerId, minAmount, maxAmount, sortBy, limit, page } = req.query;
    
    const filter: any = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      };
    } else if (startDate) {
      filter.createdAt = { $gte: new Date(startDate as string) };
    } else if (endDate) {
      filter.createdAt = { $lte: new Date(endDate as string) };
    }
    
    if (userId && mongoose.Types.ObjectId.isValid(userId as string)) {
      filter.userId = new mongoose.Types.ObjectId(userId as string);
    }
    
    if (providerId && mongoose.Types.ObjectId.isValid(providerId as string)) {
      filter.providerId = new mongoose.Types.ObjectId(providerId as string);
    }
    
    // Amount filter
    if (minAmount || maxAmount) {
      filter.amount = {};
      
      if (minAmount) {
        filter.amount.$gte = Number(minAmount);
      }
      
      if (maxAmount) {
        filter.amount.$lte = Number(maxAmount);
      }
    }
    
    // Pagination
    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = parseInt(limit as string) || 20;
    const skip = (pageNumber - 1) * limitNumber;
    
    // Sorting
    let sort: any = { createdAt: -1 }; // Default sort by creation date, newest first
    if (sortBy === 'amount') {
      sort = { amount: -1 }; // Sort by amount, highest first
    }
    
    const transactions = await Transaction.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('providerId', 'firstName lastName email')
      .populate('bookingId')
      .sort(sort)
      .skip(skip)
      .limit(limitNumber);
    
    const totalTransactions = await Transaction.countDocuments(filter);
    
    res.json({
      count: transactions.length,
      totalTransactions,
      totalPages: Math.ceil(totalTransactions / limitNumber),
      currentPage: pageNumber,
      transactions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/payments/:id
 */
export const getPaymentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('userId', 'firstName lastName email')
      .populate('providerId', 'firstName lastName email')
      .populate('bookingId');
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/reviews
 */
export const getAllReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, providerId, minRating, maxRating, sortBy, limit, page } = req.query;
    
    const filter: any = {};
    
    if (userId && mongoose.Types.ObjectId.isValid(userId as string)) {
      filter.userId = new mongoose.Types.ObjectId(userId as string);
    }
    
    if (providerId && mongoose.Types.ObjectId.isValid(providerId as string)) {
      filter.providerId = new mongoose.Types.ObjectId(providerId as string);
    }
    
    // Rating filter
    if (minRating || maxRating) {
      filter.rating = {};
      
      if (minRating) {
        filter.rating.$gte = Number(minRating);
      }
      
      if (maxRating) {
        filter.rating.$lte = Number(maxRating);
      }
    }
    
    // Pagination
    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = parseInt(limit as string) || 20;
    const skip = (pageNumber - 1) * limitNumber;
    
    // Sorting
    let sort: any = { createdAt: -1 }; // Default sort by creation date, newest first
    if (sortBy === 'rating') {
      sort = { rating: -1 }; // Sort by rating, highest first
    }
    
    const reviews = await Review.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('providerId', 'firstName lastName email')
      .populate('bookingId')
      .sort(sort)
      .skip(skip)
      .limit(limitNumber);
    
    const totalReviews = await Review.countDocuments(filter);
    
    res.json({
      count: reviews.length,
      totalReviews,
      totalPages: Math.ceil(totalReviews / limitNumber),
      currentPage: pageNumber,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/admin/reviews/:id
 */
export const deleteReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    // Notify the user
    await Notification.create({
      userId: review.userId,
      type: 'system',
      content: 'Your review has been removed by an administrator.',
      isRead: false
    });
    
    res.json({
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/providers
 */
export const getAllProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, verificationStatus, search, specialties, minRating, maxRating, limit, page } = req.query;
    
    const filter: any = { role: 'provider' };
    
    if (status) {
      filter.status = status;
    }
    
    if (verificationStatus) {
      filter.verificationStatus = verificationStatus;
    }
    
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = parseInt(limit as string) || 20;
    const skip = (pageNumber - 1) * limitNumber;
    
    // Get users with provider role
    const providers = await User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(limitNumber);
    
    // Get provider profiles with additional details
    const providerDetails = await Promise.all(
      providers.map(async (provider) => {
        const profile = await ProviderProfile.findOne({ userId: provider._id });
        const connectAccount = await ProviderConnectAccount.findOne({ userId: provider._id });
        
        // Get service count
        const serviceCount = await Service.countDocuments({ providerId: provider._id });
        
        // Get booking count
        const bookingCount = await Booking.countDocuments({ providerId: provider._id });
        
        // Get average rating
        const reviews = await Review.find({ providerId: provider._id });
        const avgRating = reviews.length > 0 
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
          : 0;
        
        // Filter by rating if specified
        if ((minRating && avgRating < Number(minRating)) || 
            (maxRating && avgRating > Number(maxRating))) {
          return null;
        }
        
        // Filter by specialties if specified
        if (specialties && profile) {
          const profileData = profile as any;
          if (profileData.specialties) {
            const requestedSpecialties = (specialties as string).split(',');
            const hasSpecialty = requestedSpecialties.some(s => 
              profileData.specialties.includes(s.trim())
            );
            
            if (!hasSpecialty) {
              return null;
            }
          }
        }
        
        return {
          ...provider.toObject(),
          profile: profile || null,
          connectAccount: connectAccount ? {
            hasAccount: !!connectAccount,
            accountStatus: (connectAccount as any).accountStatus || 'unknown',
            payoutsEnabled: (connectAccount as any).payoutEnabled || false
          } : null,
          stats: {
            serviceCount,
            bookingCount,
            reviewCount: reviews.length,
            avgRating: parseFloat(avgRating.toFixed(1))
          }
        };
      })
    );
    
    const filteredProviders = providerDetails.filter(p => p !== null);
    
    const totalProviders = await User.countDocuments({ ...filter, role: 'provider' });
    
    res.json({
      count: filteredProviders.length,
      totalProviders,
      totalPages: Math.ceil(totalProviders / limitNumber),
      currentPage: pageNumber,
      providers: filteredProviders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/providers/:id
 */
export const getProviderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = await User.findOne({ 
      _id: req.params.id,
      role: 'provider'
    }).select('-password');
    
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }
    
    // Get provider profile
    const profile = await ProviderProfile.findOne({ userId: provider._id });
    
    // Get provider connect account
    const connectAccount = await ProviderConnectAccount.findOne({ userId: provider._id });
    
    // Get provider services
    const services = await Service.find({ providerId: provider._id })
      .populate('categoryId', 'name');
    
    // Get provider bookings
    const bookings = await Booking.find({ providerId: provider._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'firstName lastName')
      .populate('serviceId', 'title');
    
    // Get provider reviews
    const reviews = await Review.find({ providerId: provider._id })
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName')
      .populate('serviceId', 'title');
    
    // Calculate average rating
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
      : 0;
    
    // Get provider transactions
    const transactions = await Transaction.find({ providerId: provider._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      provider,
      profile,
      connectAccount: connectAccount ? {
        hasAccount: !!connectAccount,
        accountStatus: (connectAccount as any).accountStatus || 'unknown',
        payoutsEnabled: (connectAccount as any).payoutEnabled || false,
        createdAt: connectAccount.createdAt,
        updatedAt: connectAccount.updatedAt
      } : null,
      services,
      stats: {
        serviceCount: services.length,
        bookingCount: await Booking.countDocuments({ providerId: provider._id }),
        reviewCount: reviews.length,
        avgRating: parseFloat(avgRating.toFixed(1)),
        totalEarnings: await Transaction.aggregate([
          { $match: { providerId: new mongoose.Types.ObjectId(provider._id.toString()) } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).then(result => result.length > 0 ? result[0].total : 0)
      },
      bookings,
      reviews,
      transactions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/dashboard
 */
export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    
    const startOfWeek = new Date();
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // User statistics
    const totalUsers = await User.countDocuments();
    const totalProviders = await User.countDocuments({ role: 'provider' });
    const totalCustomers = await User.countDocuments({ role: 'user' });
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: startOfToday, $lte: endOfToday } });
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: startOfWeek } });
    const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: startOfMonth } });
    
    // Service statistics
    const totalServices = await Service.countDocuments();
    const totalCategories = await ServiceCategory.countDocuments();
    const newServicesToday = await Service.countDocuments({ createdAt: { $gte: startOfToday, $lte: endOfToday } });
    const newServicesThisWeek = await Service.countDocuments({ createdAt: { $gte: startOfWeek } });
    const newServicesThisMonth = await Service.countDocuments({ createdAt: { $gte: startOfMonth } });
    
    // Booking statistics
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
    const bookingsToday = await Booking.countDocuments({ createdAt: { $gte: startOfToday, $lte: endOfToday } });
    const bookingsThisWeek = await Booking.countDocuments({ createdAt: { $gte: startOfWeek } });
    const bookingsThisMonth = await Booking.countDocuments({ createdAt: { $gte: startOfMonth } });
    
    // Revenue statistics
    const totalRevenue = await Transaction.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).then(result => result.length > 0 ? result[0].total : 0);
    
    const revenueToday = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfToday, $lte: endOfToday } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).then(result => result.length > 0 ? result[0].total : 0);
    
    const revenueThisWeek = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfWeek } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).then(result => result.length > 0 ? result[0].total : 0);
    
    const revenueThisMonth = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).then(result => result.length > 0 ? result[0].total : 0);
    
    // Review statistics
    const totalReviews = await Review.countDocuments();
    const avgRating = await Review.aggregate([
      { $group: { _id: null, avg: { $avg: '$rating' } } }
    ]).then(result => result.length > 0 ? parseFloat(result[0].avg.toFixed(1)) : 0);
    
    // Recent activity
    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'firstName lastName')
      .populate('providerId', 'firstName lastName')
      .populate('serviceId', 'title');
    
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('-password');
    
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'firstName lastName')
      .populate('providerId', 'firstName lastName');
    
    // Monthly revenue for chart
    const monthlyRevenue = await Transaction.aggregate([
      {
        $group: {
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);
    
    const formattedMonthlyRevenue = monthlyRevenue.map(item => ({
      month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
      amount: item.total
    }));
    
    res.json({
      users: {
        total: totalUsers,
        providers: totalProviders,
        customers: totalCustomers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth
      },
      services: {
        total: totalServices,
        categories: totalCategories,
        newToday: newServicesToday,
        newThisWeek: newServicesThisWeek,
        newThisMonth: newServicesThisMonth
      },
      bookings: {
        total: totalBookings,
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        today: bookingsToday,
        thisWeek: bookingsThisWeek,
        thisMonth: bookingsThisMonth
      },
      revenue: {
        total: totalRevenue,
        today: revenueToday,
        thisWeek: revenueThisWeek,
        thisMonth: revenueThisMonth,
        monthly: formattedMonthlyRevenue
      },
      reviews: {
        total: totalReviews,
        avgRating
      },
      recent: {
        bookings: recentBookings,
        users: recentUsers,
        transactions: recentTransactions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/reports
 */
export const generateReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, startDate, endDate, format } = req.query;
    
    if (!type || !['users', 'bookings', 'revenue', 'services', 'providers'].includes(type as string)) {
      return res.status(400).json({ message: 'Invalid report type' });
    }
    
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    
    let reportData;
    let fileName;
    
    switch (type) {
      case 'users':
        fileName = `users-report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}`;
        
        // Get users created in date range
        const users = await User.find({
          createdAt: { $gte: start, $lte: end }
        }).select('-password');
        
        // Group by role and status
        const usersByRole = users.reduce((acc: any, user) => {
          const role = (user as any).role || 'unknown';
          acc[role] = acc[role] || 0;
          acc[role]++;
          return acc;
        }, {});
        
        const usersByStatus = users.reduce((acc: any, user) => {
          const status = (user as any).status || 'unknown';
          acc[status] = acc[status] || 0;
          acc[status]++;
          return acc;
        }, {});
        
        // Group by day
        const usersByDay = users.reduce((acc: any, user) => {
          const day = user.createdAt.toISOString().split('T')[0];
          acc[day] = acc[day] || 0;
          acc[day]++;
          return acc;
        }, {});
        
        reportData = {
          totalUsers: users.length,
          byRole: usersByRole,
          byStatus: usersByStatus,
          byDay: usersByDay,
          users: users.map(user => ({
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
            status: user.verificationStatus,
            createdAt: user.createdAt
          }))
        };
        break;
        
      case 'bookings':
        fileName = `bookings-report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}`;
        
        // Get bookings created in date range
        const bookings = await Booking.find({
          createdAt: { $gte: start, $lte: end }
        })
          .populate('userId', 'firstName lastName email')
          .populate('providerId', 'firstName lastName email')
          .populate('serviceId', 'title price');
        
        // Group by status
        const bookingsByStatus = bookings.reduce((acc: any, booking) => {
          acc[booking.status] = acc[booking.status] || 0;
          acc[booking.status]++;
          return acc;
        }, {});
        
        // Group by day
        const bookingsByDay = bookings.reduce((acc: any, booking) => {
          const day = booking.createdAt.toISOString().split('T')[0];
          acc[day] = acc[day] || 0;
          acc[day]++;
          return acc;
        }, {});
        
        // Calculate total revenue
        const totalBookingRevenue = bookings.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);
        
        reportData = {
          totalBookings: bookings.length,
          totalRevenue: totalBookingRevenue,
          byStatus: bookingsByStatus,
          byDay: bookingsByDay,
          bookings: bookings.map(booking => ({
            id: booking._id,
            service: booking.serviceId ? (booking.serviceId as any).title : 'Unknown',
            user: booking.userId ? `${(booking.userId as any).firstName} ${(booking.userId as any).lastName}` : 'Unknown',
            provider: booking.providerId ? `${(booking.providerId as any).firstName} ${(booking.providerId as any).lastName}` : 'Unknown',
            status: booking.status,
            totalPrice: booking.totalPrice,
            dateTime: booking.dateTime,
            createdAt: booking.createdAt
          }))
        };
        break;
        
      case 'revenue':
        fileName = `revenue-report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}`;
        
        // Get transactions in date range
        const transactions = await Transaction.find({
          createdAt: { $gte: start, $lte: end }
        })
          .populate('userId', 'firstName lastName email')
          .populate('providerId', 'firstName lastName email')
          .populate('bookingId');
        
        // Group by status
        const transactionsByStatus = transactions.reduce((acc: any, transaction) => {
          acc[transaction.status] = acc[transaction.status] || 0;
          acc[transaction.status]++;
          return acc;
        }, {});
        
        // Group by day
        const revenueByDay = transactions.reduce((acc: any, transaction) => {
          const day = transaction.createdAt.toISOString().split('T')[0];
          acc[day] = acc[day] || 0;
          acc[day] += transaction.amount;
          return acc;
        }, {});
        
        // Calculate total revenue
        const totalRevenue = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
        
        // Calculate platform fees
        const platformFees = transactions.reduce((sum, transaction) => {
          return sum + ((transaction as any).platformFee || 0);
        }, 0);
        
        reportData = {
          totalTransactions: transactions.length,
          totalRevenue,
          platformFees,
          netRevenue: totalRevenue - platformFees,
          byStatus: transactionsByStatus,
          byDay: revenueByDay,
          transactions: transactions.map(transaction => ({
            id: transaction._id,
            user: transaction.userId ? `${(transaction.userId as any).firstName} ${(transaction.userId as any).lastName}` : 'Unknown',
            provider: transaction.providerId ? `${(transaction.providerId as any).firstName} ${(transaction.providerId as any).lastName}` : 'Unknown',
            amount: transaction.amount,
            platformFee: (transaction as any).platformFee || 0,
            status: transaction.status,
            paymentMethod: transaction.paymentMethod,
            createdAt: transaction.createdAt
          }))
        };
        break;
        
      case 'services':
        fileName = `services-report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}`;
        
        // Get services created in date range
        const services = await Service.find({
          createdAt: { $gte: start, $lte: end }
        })
          .populate('providerId', 'firstName lastName email')
          .populate('categoryId', 'name');
        
        // Group by category
        const servicesByCategory = services.reduce((acc: any, service) => {
          const categoryName = service.categoryId ? (service.categoryId as any).name : 'Uncategorized';
          acc[categoryName] = acc[categoryName] || 0;
          acc[categoryName]++;
          return acc;
        }, {});
        
        // Get booking counts for each service
        const serviceBookingCounts = await Promise.all(
          services.map(async (service) => {
            const count = await Booking.countDocuments({ serviceId: service._id });
            return { serviceId: service._id, count };
          })
        );
        
        const bookingCountMap = serviceBookingCounts.reduce((acc: any, item) => {
          const serviceIdStr = item.serviceId ? item.serviceId.toString() : '';
          if (serviceIdStr) {
            acc[serviceIdStr] = item.count;
          }
          return acc;
        }, {});
        
        reportData = {
          totalServices: services.length,
          byCategory: servicesByCategory,
          services: services.map(service => ({
            id: service._id,
            title: service.title,
            provider: service.providerId ? `${(service.providerId as any).firstName} ${(service.providerId as any).lastName}` : 'Unknown',
            category: service.categoryId ? (service.categoryId as any).name : 'Uncategorized',
            price: service.price,
            bookingCount: service._id ? bookingCountMap[service._id.toString()] || 0 : 0,
            createdAt: service.createdAt
          }))
        };
        break;
        
      case 'providers':
        fileName = `providers-report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}`;
        
        // Get providers
        const providers = await User.find({
          role: 'provider',
          createdAt: { $gte: start, $lte: end }
        }).select('-password');
        
        // Get provider stats
        const providerStats = await Promise.all(
          providers.map(async (provider) => {
            const serviceCount = await Service.countDocuments({ providerId: provider._id });
            const bookingCount = await Booking.countDocuments({ providerId: provider._id });
            const reviews = await Review.find({ providerId: provider._id });
            const avgRating = reviews.length > 0 
              ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
              : 0;
            
            const earnings = await Transaction.aggregate([
              { $match: { providerId: new mongoose.Types.ObjectId(provider._id.toString()) } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).then(result => result.length > 0 ? result[0].total : 0);
            
            return {
              id: provider._id,
              name: `${provider.firstName} ${provider.lastName}`,
              email: provider.email,
              status: (provider as any).status || 'unknown',
              verificationStatus: (provider as any).verificationStatus || 'unknown',
              serviceCount,
              bookingCount,
              reviewCount: reviews.length,
              avgRating: parseFloat(avgRating.toFixed(1)),
              earnings,
              createdAt: provider.createdAt
            };
          })
        );
        
        reportData = {
          totalProviders: providers.length,
          providers: providerStats
        };
        break;
    }
    
    res.json({
      reportType: type,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      generatedAt: new Date().toISOString(),
      data: reportData
    });
  } catch (error) {
    next(error);
  }
};
