import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User, Service, Booking, ServiceCategory, Transaction } from '../models/db';
import { AppError, createError } from '../middleware/errorHandler';

/**
 * @desc    Get all users with pagination and filtering
 * @route   GET /api/admin/users
 * @access  Private (Admin only)
 */
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    
    // Filter by role
    if (req.query.role) {
      query.role = req.query.role;
    }

    // Filter by verification status
    if (req.query.verificationStatus) {
      query.verificationStatus = req.query.verificationStatus;
    }

    // Search by name or email
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      status: 'success',
      results: users.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: { users }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/admin/users/:id
 * @access  Private (Admin only)
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return next(createError.notFound('User not found'));
    }

    // Get user's bookings if they exist
    const bookings = await Booking.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    // Get user's services if they are a provider
    let services: any[] = [];
    if (user.role === 'provider') {
      services = await Service.find({ providerId: user._id })
        .sort({ createdAt: -1 })
        .limit(5);
    }

    res.status(200).json({
      status: 'success',
      data: { 
        user,
        bookings,
        services
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user status (verification, role, etc.)
 * @route   PATCH /api/admin/users/:id/status
 * @access  Private (Admin only)
 */
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { verificationStatus, role } = req.body;
    
    // Validate input
    if (!verificationStatus && !role) {
      return next(createError.badRequest('Please provide verificationStatus or role to update'));
    }

    // Build update object
    const updateData: any = {};
    if (verificationStatus) {
      updateData.verificationStatus = verificationStatus;
    }
    if (role) {
      updateData.role = role;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return next(createError.notFound('User not found'));
    }

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Suspend a user
 * @route   POST /api/admin/users/:id/suspend
 * @access  Private (Admin only)
 */
export const suspendUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        verificationStatus: 'rejected',
        suspensionReason: reason || 'Suspended by admin'
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return next(createError.notFound('User not found'));
    }

    // Cancel any pending bookings
    await Booking.updateMany(
      { 
        $or: [
          { userId: user._id },
          { providerId: user._id }
        ],
        status: 'pending'
      },
      { status: 'cancelled' }
    );

    res.status(200).json({
      status: 'success',
      message: 'User suspended successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Activate a suspended user
 * @route   POST /api/admin/users/:id/activate
 * @access  Private (Admin only)
 */
export const activateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        verificationStatus: 'verified',
        $unset: { suspensionReason: 1 }
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return next(createError.notFound('User not found'));
    }

    res.status(200).json({
      status: 'success',
      message: 'User activated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all services with pagination and filtering
 * @route   GET /api/admin/services
 * @access  Private (Admin only)
 */
export const getAllServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    
    // Filter by category
    if (req.query.categoryId) {
      query.categoryId = new mongoose.Types.ObjectId(req.query.categoryId as string);
    }

    // Filter by provider
    if (req.query.providerId) {
      query.providerId = new mongoose.Types.ObjectId(req.query.providerId as string);
    }

    // Filter by price range
    if (req.query.minPrice || req.query.maxPrice) {
      query['price.amount'] = {};
      if (req.query.minPrice) query['price.amount'].$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query['price.amount'].$lte = Number(req.query.maxPrice);
    }

    // Search by title or description
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }

    const services = await Service.find(query)
      .populate({
        path: 'categoryId',
        model: 'ServiceCategory',
        select: 'name description'
      })
      .populate({
        path: 'providerId',
        model: 'User',
        select: 'firstName lastName email'
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Service.countDocuments(query);

    res.status(200).json({
      status: 'success',
      results: services.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: { services }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Manage service categories (create, update, delete)
 * @route   POST /api/admin/service-categories
 * @access  Private (Admin only)
 */
export const manageServiceCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, categoryId, name, description, parentCategory, iconUrl } = req.body;

    if (!action) {
      return next(createError.badRequest('Action is required (create, update, or delete)'));
    }

    let category;

    switch (action) {
      case 'create':
        if (!name) {
          return next(createError.badRequest('Category name is required'));
        }

        category = await ServiceCategory.create({
          name,
          description,
          parentCategory: parentCategory || null,
          iconUrl
        });

        res.status(201).json({
          status: 'success',
          message: 'Category created successfully',
          data: { category }
        });
        break;

      case 'update':
        if (!categoryId) {
          return next(createError.badRequest('Category ID is required for update'));
        }

        category = await ServiceCategory.findByIdAndUpdate(
          categoryId,
          {
            name,
            description,
            parentCategory,
            iconUrl
          },
          { new: true, runValidators: true }
        );

        if (!category) {
          return next(createError.notFound('Category not found'));
        }

        res.status(200).json({
          status: 'success',
          message: 'Category updated successfully',
          data: { category }
        });
        break;

      case 'delete':
        if (!categoryId) {
          return next(createError.badRequest('Category ID is required for deletion'));
        }

        // Check if category has services
        const servicesCount = await Service.countDocuments({ categoryId });
        if (servicesCount > 0) {
          return next(createError.badRequest(`Cannot delete category with ${servicesCount} associated services`));
        }

        // Check if category has child categories
        const childCategoriesCount = await ServiceCategory.countDocuments({ parentCategory: categoryId });
        if (childCategoriesCount > 0) {
          return next(createError.badRequest(`Cannot delete category with ${childCategoriesCount} child categories`));
        }

        category = await ServiceCategory.findByIdAndDelete(categoryId);

        if (!category) {
          return next(createError.notFound('Category not found'));
        }

        res.status(200).json({
          status: 'success',
          message: 'Category deleted successfully'
        });
        break;

      default:
        return next(createError.badRequest('Invalid action. Use create, update, or delete'));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all bookings with pagination and filtering
 * @route   GET /api/admin/bookings
 * @access  Private (Admin only)
 */
export const getAllBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by user
    if (req.query.userId) {
      query.userId = new mongoose.Types.ObjectId(req.query.userId as string);
    }

    // Filter by provider
    if (req.query.providerId) {
      query.providerId = new mongoose.Types.ObjectId(req.query.providerId as string);
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
        model: 'Service',
        select: 'title price'
      })
      .populate({
        path: 'userId',
        model: 'User',
        select: 'firstName lastName email'
      })
      .populate({
        path: 'providerId',
        model: 'User',
        select: 'firstName lastName email'
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
 * @desc    Generate reports (users, bookings, revenue)
 * @route   GET /api/admin/reports
 * @access  Private (Admin only)
 */
export const generateReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reportType, startDate, endDate } = req.query;
    
    if (!reportType) {
      return next(createError.badRequest('Report type is required'));
    }

    // Parse date range
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate as string);
    }

    let report;

    switch (reportType) {
      case 'users':
        // User registration report
        const userQuery: any = {};
        if (Object.keys(dateFilter).length > 0) {
          userQuery.createdAt = dateFilter;
        }

        const totalUsers = await User.countDocuments();
        const newUsers = await User.countDocuments(userQuery);
        
        // User roles breakdown
        const usersByRole = await User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        // User verification status breakdown
        const usersByVerification = await User.aggregate([
          { $group: { _id: '$verificationStatus', count: { $sum: 1 } } }
        ]);

        report = {
          totalUsers,
          newUsers,
          usersByRole: usersByRole.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          usersByVerification: usersByVerification.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {})
        };
        break;

      case 'bookings':
        // Booking statistics report
        const bookingQuery: any = {};
        if (Object.keys(dateFilter).length > 0) {
          bookingQuery.createdAt = dateFilter;
        }

        const totalBookings = await Booking.countDocuments();
        const newBookings = await Booking.countDocuments(bookingQuery);
        
        // Bookings by status
        const bookingsByStatus = await Booking.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Average booking value
        const avgBookingValue = await Booking.aggregate([
          { $group: { _id: null, avg: { $avg: '$totalPrice' } } }
        ]);

        report = {
          totalBookings,
          newBookings,
          bookingsByStatus: bookingsByStatus.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          avgBookingValue: avgBookingValue.length > 0 ? avgBookingValue[0].avg : 0
        };
        break;

      case 'revenue':
        // Revenue report
        const transactionQuery: any = { status: 'completed' };
        if (Object.keys(dateFilter).length > 0) {
          transactionQuery.createdAt = dateFilter;
        }

        // Total revenue
        const totalRevenue = await Transaction.aggregate([
          { $match: { status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Revenue in date range
        const periodRevenue = await Transaction.aggregate([
          { $match: transactionQuery },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Platform commission
        const platformCommission = await Transaction.aggregate([
          { $match: transactionQuery },
          { $group: { _id: null, total: { $sum: '$platformCommission' } } }
        ]);

        // Revenue by payment method
        const revenueByPaymentMethod = await Transaction.aggregate([
          { $match: { status: 'completed' } },
          { $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } }
        ]);

        report = {
          totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
          periodRevenue: periodRevenue.length > 0 ? periodRevenue[0].total : 0,
          platformCommission: platformCommission.length > 0 ? platformCommission[0].total : 0,
          revenueByPaymentMethod: revenueByPaymentMethod.reduce((acc, curr) => {
            acc[curr._id] = curr.total;
            return acc;
          }, {})
        };
        break;

      default:
        return next(createError.badRequest('Invalid report type. Use users, bookings, or revenue'));
    }

    res.status(200).json({
      status: 'success',
      data: { report }
    });
  } catch (error) {
    next(error);
  }
};
