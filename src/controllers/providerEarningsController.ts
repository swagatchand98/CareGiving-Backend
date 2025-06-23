import { Request, Response } from 'express';
import { Payment, PaymentType, PaymentStatus } from '../models/paymentModel';
import { Booking } from '../models/db';
import mongoose from 'mongoose';

/**
 * Get provider earnings summary
 * @route GET /api/providers/earnings/summary
 */
export const getEarningsSummary = async (req: Request, res: Response) => {
  try {
    const providerId = req.user?.id;

    if (!providerId) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized'
      });
    }

    // Get all payments for the provider where the booking is completed
    const payments = await Payment.find({
      providerId: new mongoose.Types.ObjectId(providerId)
    }).populate({
      path: 'bookingId',
      select: 'status'
    });

    // Calculate total earnings and pending payouts
    let totalEarnings = 0;
    let pendingPayouts = 0;

    payments.forEach(payment => {
      // Only count payments for completed bookings
      const booking = payment.bookingId as any;
      const isBookingCompleted = booking && booking.status === 'completed';
      
      if (payment.type === PaymentType.BOOKING) {
        if (payment.status === PaymentStatus.COMPLETED && isBookingCompleted) {
          totalEarnings += payment.providerAmount;
        } else if (payment.status === PaymentStatus.PENDING && isBookingCompleted) {
          pendingPayouts += payment.providerAmount;
        }
      } else if (payment.type === PaymentType.REFUND && isBookingCompleted) {
        // Subtract refunds from total earnings
        totalEarnings -= Math.abs(payment.providerAmount);
      }
    });

    // Get completed bookings count
    const completedBookings = await Booking.countDocuments({
      providerId: new mongoose.Types.ObjectId(providerId),
      status: 'completed'
    });

    // Calculate monthly earnings for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get all completed bookings for the provider
    const completedBookingIds = await Booking.find({
      providerId: new mongoose.Types.ObjectId(providerId),
      status: 'completed'
    }).distinct('_id');
    
    // Convert booking IDs to ObjectIds
    const completedBookingObjectIds = completedBookingIds.map(id => {
      // Ensure id is a valid string or ObjectId before converting
      if (id && (typeof id === 'string' || id instanceof mongoose.Types.ObjectId)) {
        return new mongoose.Types.ObjectId(id.toString());
      }
      // Skip invalid IDs
      console.warn('Invalid booking ID encountered:', id);
      return null;
    }).filter(id => id !== null) as mongoose.Types.ObjectId[];
    
    const monthlyEarnings = await Payment.aggregate([
      {
        $match: {
          providerId: new mongoose.Types.ObjectId(providerId),
          type: PaymentType.BOOKING,
          status: PaymentStatus.COMPLETED,
          bookingId: { $in: completedBookingObjectIds },
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          amount: { $sum: '$providerAmount' }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1
        }
      }
    ]);

    // Format monthly earnings
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedMonthlyEarnings = monthlyEarnings.map(item => ({
      month: months[item._id.month - 1],
      amount: item.amount
    }));

    // Fill in missing months with zero
    const today = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = months[month.getMonth()];
      const existingMonth = formattedMonthlyEarnings.find(m => m.month === monthKey);
      
      result.push({
        month: monthKey,
        amount: existingMonth ? existingMonth.amount : 0
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        totalEarnings,
        pendingPayouts,
        completedBookings,
        monthlyEarnings: result
      }
    });
  } catch (error: any) {
    console.error('Error getting earnings summary:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Get provider earnings history
 * @route GET /api/providers/earnings/history
 */
export const getEarningsHistory = async (req: Request, res: Response) => {
  try {
    const providerId = req.user?.id;

    if (!providerId) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized'
      });
    }

    // Parse query parameters
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const status = req.query.status as string;
    const serviceType = req.query.serviceType as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get all completed bookings for the provider
    const completedBookingIds = await Booking.find({
      providerId: new mongoose.Types.ObjectId(providerId),
      status: 'completed'
    }).distinct('_id');
    
    // Convert booking IDs to ObjectIds
    const completedBookingObjectIds = completedBookingIds.map(id => {
      // Ensure id is a valid string or ObjectId before converting
      if (id && (typeof id === 'string' || id instanceof mongoose.Types.ObjectId)) {
        return new mongoose.Types.ObjectId(id.toString());
      }
      // Skip invalid IDs
      console.warn('Invalid booking ID encountered:', id);
      return null;
    }).filter(id => id !== null) as mongoose.Types.ObjectId[];
    
    // Build query
    const query: any = {
      providerId: new mongoose.Types.ObjectId(providerId),
      bookingId: { $in: completedBookingObjectIds }
    };

    // Add date filters
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = startDate;
      }
      if (endDate) {
        query.createdAt.$lte = endDate;
      }
    }

    // Add status filter
    if (status && status !== 'all') {
      // Convert status string to PaymentStatus enum
      if (status.toLowerCase() === 'paid') {
        query.status = PaymentStatus.COMPLETED;
      } else if (status.toLowerCase() === 'pending') {
        query.status = PaymentStatus.PENDING;
      } else if (status.toLowerCase() === 'refunded') {
        query.status = PaymentStatus.REFUNDED;
      }
    }

    // Get payments with pagination
    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('bookingId', 'serviceId dateTime status')
      .populate('userId', 'firstName lastName email');

    // Filter by service type if specified
    let filteredPayments = payments;
    if (serviceType && serviceType !== 'all') {
      filteredPayments = payments.filter(payment => {
        const booking = payment.bookingId as any;
        if (!booking || !booking.serviceId) return false;
        
        // Check if service type matches
        return booking.serviceId.type === serviceType;
      });
    }

    // Transform payments to earnings history format
    const earnings = filteredPayments.map(payment => {
      const booking = payment.bookingId as any;
      const user = payment.userId as any;
      
      return {
        id: payment._id,
        date: payment.createdAt,
        amount: payment.providerAmount,
        status: payment.type === PaymentType.REFUND ? 'refunded' : payment.status.toLowerCase(),
        service: booking?.serviceId?.name || 'Service',
        client: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Client',
        bookingId: booking?._id || ''
      };
    });

    // Get total count for pagination
    const totalCount = await Payment.countDocuments(query);

    return res.status(200).json({
      status: 'success',
      data: {
        earnings,
        totalCount
      }
    });
  } catch (error: any) {
    console.error('Error getting earnings history:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};
