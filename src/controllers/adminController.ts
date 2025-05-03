import { Request, Response, NextFunction } from 'express';
import { User, Service, Booking, ServiceCategory } from '../models/db';
import mongoose from 'mongoose';

/**
 * @desc    Get all users
 * @route   GET /api/v1/admin/users
 * @access  Private/Admin
 */
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.find().select('-password');
    
    res.json({
      count: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/v1/admin/users/:id
 * @access  Private/Admin
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user status
 * @route   PATCH /api/v1/admin/users/:id/status
 * @access  Private/Admin
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
 * @desc    Suspend a user
 * @route   POST /api/v1/admin/users/:id/suspend
 * @access  Private/Admin
 */
export const suspendUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'suspended',
        suspensionReason: reason || 'Suspended by admin',
        suspendedAt: new Date()
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Cancel any active bookings
    await Booking.updateMany(
      { 
        user: user._id,
        status: { $in: ['pending', 'confirmed'] }
      },
      { 
        status: 'cancelled',
        cancellationReason: 'User account suspended'
      }
    );
    
    res.json({
      message: 'User suspended successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Activate a suspended user
 * @route   POST /api/v1/admin/users/:id/activate
 * @access  Private/Admin
 */
export const activateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'active',
        suspensionReason: null,
        suspendedAt: null
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      message: 'User activated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all services
 * @route   GET /api/v1/admin/services
 * @access  Private/Admin
 */
export const getAllServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await Service.find()
      .populate('category', 'name')
      .populate('provider', 'firstName lastName email');
    
    res.json({
      count: services.length,
      services
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Manage service categories (create, update, delete)
 * @route   POST /api/v1/admin/service-categories
 * @access  Private/Admin
 */
export const manageServiceCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, categoryId, name, description, icon } = req.body;
    
    switch (action) {
      case 'create':
        if (!name) {
          return res.status(400).json({ message: 'Category name is required' });
        }
        
        const newCategory = await ServiceCategory.create({
          name,
          description,
          icon
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
          { name, description, icon },
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
        const servicesUsingCategory = await Service.countDocuments({ category: categoryId });
        
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
 * @desc    Get all bookings
 * @route   GET /api/v1/admin/bookings
 * @access  Private/Admin
 */
export const getAllBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, startDate, endDate, userId, serviceId } = req.query;
    
    // Build filter object
    const filter: any = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (startDate && endDate) {
      filter.bookingDate = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      };
    } else if (startDate) {
      filter.bookingDate = { $gte: new Date(startDate as string) };
    } else if (endDate) {
      filter.bookingDate = { $lte: new Date(endDate as string) };
    }
    
    if (userId && mongoose.Types.ObjectId.isValid(userId as string)) {
      filter.user = userId;
    }
    
    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId as string)) {
      filter.service = serviceId;
    }
    
    const bookings = await Booking.find(filter)
      .populate('user', 'firstName lastName email')
      .populate('service', 'name price duration')
      .populate('provider', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    res.json({
      count: bookings.length,
      bookings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate reports
 * @route   GET /api/v1/admin/reports
 * @access  Private/Admin
 */
export const generateReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reportType, startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate as string) : new Date();
    
    switch (reportType) {
      case 'user-growth':
        // User growth report
        const userGrowth = await User.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
          },
          {
            $project: {
              _id: 0,
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: {
                    $dateFromParts: {
                      year: '$_id.year',
                      month: '$_id.month',
                      day: '$_id.day'
                    }
                  }
                }
              },
              count: 1
            }
          }
        ]);
        
        return res.json({
          reportType: 'user-growth',
          timeframe: { start, end },
          data: userGrowth
        });
        
      case 'booking-stats':
        // Booking statistics
        const bookingStats = await Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end }
            }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', 'completed'] },
                    '$totalAmount',
                    0
                  ]
                }
              }
            }
          },
          {
            $project: {
              _id: 0,
              status: '$_id',
              count: 1,
              revenue: 1
            }
          }
        ]);
        
        return res.json({
          reportType: 'booking-stats',
          timeframe: { start, end },
          data: bookingStats
        });
        
      case 'service-popularity':
        // Service popularity
        const servicePopularity = await Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              status: 'completed'
            }
          },
          {
            $group: {
              _id: '$service',
              bookingsCount: { $sum: 1 },
              revenue: { $sum: '$totalAmount' }
            }
          },
          {
            $lookup: {
              from: 'services',
              localField: '_id',
              foreignField: '_id',
              as: 'serviceDetails'
            }
          },
          {
            $unwind: '$serviceDetails'
          },
          {
            $project: {
              _id: 0,
              serviceId: '$_id',
              serviceName: '$serviceDetails.name',
              bookingsCount: 1,
              revenue: 1
            }
          },
          {
            $sort: { bookingsCount: -1 }
          }
        ]);
        
        return res.json({
          reportType: 'service-popularity',
          timeframe: { start, end },
          data: servicePopularity
        });
        
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }
  } catch (error) {
    next(error);
  }
};
