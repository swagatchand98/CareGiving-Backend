import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Review, Booking, User, Notification } from '../models/db';
import { createError } from '../middleware/errorHandler';
import * as notificationService from '../services/notificationService';

/**
 * @desc    Create a review for a completed booking
 * @route   POST /api/reviews
 * @access  Private
 */
export const createReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId, rating, comment } = req.body;

    // Validate required fields
    if (!bookingId || !rating) {
      return next(createError.badRequest('Booking ID and rating are required'));
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return next(createError.badRequest('Rating must be between 1 and 5'));
    }

    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return next(createError.notFound('Booking not found'));
    }

    // Check if user is authorized to review this booking
    if (booking.userId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('You are not authorized to review this booking'));
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return next(createError.badRequest('You can only review completed bookings'));
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ bookingId });
    if (existingReview) {
      return next(createError.badRequest('You have already reviewed this booking'));
    }

    // Create review
    const review = await Review.create({
      bookingId,
      userId: req.user._id,
      providerId: booking.providerId,
      rating,
      comment: comment || ''
    });

    // Get user details for notification
    const user = await User.findById(req.user._id).select('firstName lastName');
    const reviewerName = `${user?.firstName} ${user?.lastName}`;

    // Send notification to provider
    await notificationService.createReviewNotification(
      booking.providerId.toString(),
      req.user._id.toString(),
      rating,
      review._id instanceof mongoose.Types.ObjectId 
        ? review._id.toString() 
        : String(review._id)
    );

    // Calculate provider's average rating
    const providerReviews = await Review.find({ providerId: booking.providerId });
    const totalRating = providerReviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / providerReviews.length;

    // Update provider's average rating (if you have a field for it in the User model)
    // await User.findByIdAndUpdate(booking.providerId, { averageRating });

    res.status(201).json({
      status: 'success',
      data: { 
        review,
        providerAverageRating: averageRating.toFixed(1)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get reviews for a provider
 * @route   GET /api/reviews/provider/:providerId
 * @access  Public
 */
export const getProviderReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Validate provider exists
    const provider = await User.findOne({ _id: providerId, role: 'provider' });
    if (!provider) {
      return next(createError.notFound('Provider not found'));
    }

    // Get reviews
    const reviews = await Review.find({ providerId })
      .populate({
        path: 'userId',
        select: 'firstName lastName profilePicture'
      })
      .populate({
        path: 'bookingId',
        select: 'serviceId dateTime',
        populate: {
          path: 'serviceId',
          select: 'title'
        }
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Get total reviews count
    const total = await Review.countDocuments({ providerId });

    // Calculate average rating
    const ratingStats = await Review.aggregate([
      { $match: { providerId: new mongoose.Types.ObjectId(providerId) } },
      { 
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
        }
      }
    ]);

    const stats = ratingStats.length > 0 ? {
      averageRating: parseFloat(ratingStats[0].averageRating.toFixed(1)),
      totalReviews: ratingStats[0].totalReviews,
      distribution: {
        5: ratingStats[0].rating5,
        4: ratingStats[0].rating4,
        3: ratingStats[0].rating3,
        2: ratingStats[0].rating2,
        1: ratingStats[0].rating1
      }
    } : {
      averageRating: 0,
      totalReviews: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    res.status(200).json({
      status: 'success',
      stats,
      results: reviews.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: { reviews }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get reviews for a service
 * @route   GET /api/reviews/service/:serviceId
 * @access  Public
 */
export const getServiceReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Find bookings for this service
    const bookings = await Booking.find({ 
      serviceId,
      status: 'completed'
    });

    if (bookings.length === 0) {
      return res.status(200).json({
        status: 'success',
        stats: {
          averageRating: 0,
          totalReviews: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        },
        results: 0,
        total: 0,
        page,
        totalPages: 0,
        data: { reviews: [] }
      });
    }

    // Get booking IDs
    const bookingIds = bookings.map(booking => booking._id);

    // Get reviews for these bookings
    const reviews = await Review.find({ bookingId: { $in: bookingIds } })
      .populate({
        path: 'userId',
        select: 'firstName lastName profilePicture'
      })
      .populate({
        path: 'bookingId',
        select: 'serviceId dateTime'
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Get total reviews count
    const total = await Review.countDocuments({ bookingId: { $in: bookingIds } });

    // Calculate average rating
    const ratingStats = await Review.aggregate([
      { $match: { bookingId: { $in: bookingIds } } },
      { 
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
        }
      }
    ]);

    const stats = ratingStats.length > 0 ? {
      averageRating: parseFloat(ratingStats[0].averageRating.toFixed(1)),
      totalReviews: ratingStats[0].totalReviews,
      distribution: {
        5: ratingStats[0].rating5,
        4: ratingStats[0].rating4,
        3: ratingStats[0].rating3,
        2: ratingStats[0].rating2,
        1: ratingStats[0].rating1
      }
    } : {
      averageRating: 0,
      totalReviews: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    res.status(200).json({
      status: 'success',
      stats,
      results: reviews.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: { reviews }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's reviews
 * @route   GET /api/reviews/user
 * @access  Private
 */
export const getUserReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get reviews created by the user
    const reviews = await Review.find({ userId: req.user._id })
      .populate({
        path: 'providerId',
        select: 'firstName lastName profilePicture'
      })
      .populate({
        path: 'bookingId',
        select: 'serviceId dateTime',
        populate: {
          path: 'serviceId',
          select: 'title'
        }
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Get total reviews count
    const total = await Review.countDocuments({ userId: req.user._id });

    res.status(200).json({
      status: 'success',
      results: reviews.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: { reviews }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a review
 * @route   PATCH /api/reviews/:id
 * @access  Private
 */
export const updateReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find review
    const review = await Review.findById(id);
    if (!review) {
      return next(createError.notFound('Review not found'));
    }

    // Check if user is authorized to update this review
    if (review.userId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('You are not authorized to update this review'));
    }

    // Update review
    if (rating) {
      // Validate rating range
      if (rating < 1 || rating > 5) {
        return next(createError.badRequest('Rating must be between 1 and 5'));
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      review.comment = comment;
    }

    await review.save();

    // Recalculate provider's average rating
    const providerReviews = await Review.find({ providerId: review.providerId });
    const totalRating = providerReviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / providerReviews.length;

    res.status(200).json({
      status: 'success',
      data: { 
        review,
        providerAverageRating: averageRating.toFixed(1)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a review
 * @route   DELETE /api/reviews/:id
 * @access  Private
 */
export const deleteReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find review
    const review = await Review.findById(id);
    if (!review) {
      return next(createError.notFound('Review not found'));
    }

    // Check if user is authorized to delete this review
    if (review.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(createError.forbidden('You are not authorized to delete this review'));
    }

    // Delete review
    await Review.findByIdAndDelete(id);

    // Recalculate provider's average rating
    const providerReviews = await Review.find({ providerId: review.providerId });
    const totalRating = providerReviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = providerReviews.length > 0 ? totalRating / providerReviews.length : 0;

    res.status(200).json({
      status: 'success',
      message: 'Review deleted successfully',
      data: {
        providerAverageRating: averageRating.toFixed(1)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get review by ID
 * @route   GET /api/reviews/:id
 * @access  Public
 */
export const getReviewById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Find review
    const review = await Review.findById(id)
      .populate({
        path: 'userId',
        select: 'firstName lastName profilePicture'
      })
      .populate({
        path: 'providerId',
        select: 'firstName lastName profilePicture'
      })
      .populate({
        path: 'bookingId',
        select: 'serviceId dateTime',
        populate: {
          path: 'serviceId',
          select: 'title'
        }
      });

    if (!review) {
      return next(createError.notFound('Review not found'));
    }

    res.status(200).json({
      status: 'success',
      data: { review }
    });
  } catch (error) {
    next(error);
  }
};
