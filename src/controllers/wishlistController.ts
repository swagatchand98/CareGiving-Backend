import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Wishlist, Service } from '../models/db';
import { createError } from '../middleware/errorHandler';

/**
 * @route   GET /api/wishlist
 */
export const getUserWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Find wishlist items for the current user
    const wishlistItems = await Wishlist.find({ userId: req.user._id })
      .populate({
        path: 'serviceId',
        select: 'title description price images providerId',
        populate: {
          path: 'providerId',
          select: 'firstName lastName profilePicture'
        }
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Wishlist.countDocuments({ userId: req.user._id });

    res.status(200).json({
      status: 'success',
      data: {
        items: wishlistItems,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/wishlist
 */
export const addToWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const { serviceId } = req.body;

    if (!serviceId) {
      return next(createError.badRequest('Service ID is required'));
    }

    // Check if service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return next(createError.notFound('Service not found'));
    }

    // Check if service is already in wishlist
    const existingItem = await Wishlist.findOne({
      userId: req.user._id,
      serviceId
    });

    if (existingItem) {
      return res.status(200).json({
        status: 'success',
        message: 'Service already in wishlist',
        data: existingItem
      });
    }

    // Add service to wishlist
    const wishlistItem = await Wishlist.create({
      userId: req.user._id,
      serviceId
    });

    // Populate service details for response
    const populatedItem = await Wishlist.findById(wishlistItem._id)
      .populate({
        path: 'serviceId',
        select: 'title description price images providerId',
        populate: {
          path: 'providerId',
          select: 'firstName lastName profilePicture'
        }
      });

    res.status(201).json({
      status: 'success',
      data: populatedItem
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/wishlist/:serviceId
 */
export const removeFromWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const { serviceId } = req.params;

    // Delete wishlist item
    const result = await Wishlist.findOneAndDelete({
      userId: req.user._id,
      serviceId
    });

    if (!result) {
      return next(createError.notFound('Service not found in wishlist'));
    }

    res.status(200).json({
      status: 'success',
      message: 'Service removed from wishlist'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/wishlist/check/:serviceId
 */
export const checkWishlistStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const { serviceId } = req.params;

    // Check if service is in wishlist
    const existingItem = await Wishlist.findOne({
      userId: req.user._id,
      serviceId
    });

    res.status(200).json({
      status: 'success',
      isInWishlist: !!existingItem
    });
  } catch (error) {
    next(error);
  }
};
