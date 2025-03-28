import { Request, Response, NextFunction } from 'express';
import { Service, ServiceCategory, User } from '../models/db';
import mongoose from 'mongoose';

// Custom error handling function
const handleError = (error: unknown, next: NextFunction) => {
    console.error(error); // Log the full error for server-side debugging
  
    if (error instanceof mongoose.Error.ValidationError) {
      // Mongoose validation error
      const validationError = new Error('Validation Error');
      (validationError as any).status = 400;
      (validationError as any).errors = Object.values(error.errors).map(err => err.message);
      return next(validationError);
    }
  
    if (error instanceof mongoose.Error.CastError) {
      // Mongoose cast error (e.g., invalid ID)
      const castError = new Error('Invalid data format');
      (castError as any).status = 400;
      return next(castError);
    }
  
    if (error instanceof Error) {
      // Standard Error instance
      (error as any).status = (error as any).status || 500;
      return next(error);
    }
  
    // Fallback for non-Error objects
    const unknownError = new Error('An unknown error occurred');
    (unknownError as any).status = 500;
    return next(unknownError);
};

/**
 * Create a new service
 * @route POST /services
 * @access Private (Provider only)
 */
export const createService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user._id;

    // Validate provider
    const user = await User.findById(userId);
    if (!user || user.role !== 'provider') {
      const error = new Error('Only providers can create services');
      (error as any).status = 403;
      return next(error);
    }

    // Validate category
    const category = await ServiceCategory.findById(req.body.categoryId);
    if (!category) {
      const error = new Error('Invalid service category');
      (error as any).status = 400;
      return next(error);
    }

    const serviceData = {
        providerId: userId,
        categoryId: req.body.categoryId,
        title: req.body.title,
        description: req.body.description,
        images: req.files ? (req.files as Express.Multer.File[]).map(file => file.path) : [],
        price: {
          amount: req.body.priceAmount,
          type: req.body.priceType || 'fixed'
        },
        duration: req.body.duration,
        additionalDetails: {
          specialRequirements: req.body.specialRequirements,
          includedServices: req.body.includedServices
        }
    };

    const service = await Service.create(serviceData);

    res.status(201).json({
      status: 'success',
      data: { service }
    });
  } catch (error) {
    handleError(error, next);
  }
};

/**
 * Get all services with pagination and filtering
 * @route GET /services
 * @access Public
 */
export const getServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    
    // Filter by category
    if (req.query.categoryId) {
      query.categoryId = new mongoose.Types.ObjectId(req.query.categoryId as string);
    }

    // Filter by price range
    if (req.query.minPrice || req.query.maxPrice) {
      query['price.amount'] = {};
      if (req.query.minPrice) query['price.amount'].$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query['price.amount'].$lte = Number(req.query.maxPrice);
    }

    // Filter by price type
    if (req.query.priceType) {
      query['price.type'] = req.query.priceType;
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
        select: 'firstName lastName profilePicture'
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
    handleError(error, next);
  }
};

/**
 * Get a specific service by ID
 * @route GET /services/:id
 * @access Public
 */
export const getServiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate({
        path: 'categoryId',
        model: 'ServiceCategory',
        select: 'name description iconUrl'
      })
      .populate({
        path: 'providerId',
        model: 'User',
        select: 'firstName lastName profilePicture phoneNumber'
      });

    if (!service) {
        const error = new Error('Service not found');
        (error as any).status = 404;
        return next(error);
    }
    
    res.status(200).json({
      status: 'success',
      data: { service }
    });
  } catch (error) {
    handleError(error, next);
  }
};

/**
 * Update a service
 * @route PATCH /services/:id
 * @access Private (Provider only)
 */
export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user._id;

    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, providerId: userId },
      {
        title: req.body.title,
        description: req.body.description,
        categoryId: req.body.categoryId,
        images: req.files ? (req.files as Express.Multer.File[]).map(file => file.path) : undefined,
        price: {
          amount: req.body.priceAmount,
          type: req.body.priceType
        },
        duration: req.body.duration,
        additionalDetails: {
          specialRequirements: req.body.specialRequirements,
          includedServices: req.body.includedServices
        }
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!service) {
        const error = new Error('Service not found or you are not authorized to update');
        (error as any).status = 404;
        return next(error);
    }

    res.status(200).json({
      status: 'success',
      data: { service }
    });
  } catch (error) {
    handleError(error, next);
  }
};

/**
 * Delete a service
 * @route DELETE /services/:id
 * @access Private (Provider only)
 */
export const deleteService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user._id;

    const service = await Service.findOneAndDelete({ 
      _id: req.params.id, 
      providerId: userId 
    });

    if (!service) {
        const error = new Error('Service not found or you are not authorized to delete');
        (error as any).status = 404;
        return next(error);
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    handleError(error, next);
  }
};

/**
 * Search services with text search and filters
 * @route GET /services/search
 * @access Public
 */
export const searchServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, categoryId, minPrice, maxPrice, priceType } = req.query;

    const searchConditions: any = {};

    // Text search on title and description
    if (query) {
      searchConditions.$or = [
        { title: { $regex: query as string, $options: 'i' } },
        { description: { $regex: query as string, $options: 'i' } }
      ];
    }

    // Category filter
    if (categoryId) {
      searchConditions.categoryId = new mongoose.Types.ObjectId(categoryId as string);
    }

    // Price range filter
    if (minPrice || maxPrice) {
      searchConditions['price.amount'] = {};
      if (minPrice) searchConditions['price.amount'].$gte = Number(minPrice);
      if (maxPrice) searchConditions['price.amount'].$lte = Number(maxPrice);
    }

    // Price type filter
    if (priceType) {
      searchConditions['price.type'] = priceType;
    }

    const services = await Service.find(searchConditions)
      .populate({
        path: 'categoryId',
        model: 'ServiceCategory',
        select: 'name description'
      })
      .populate({
        path: 'providerId',
        model: 'User',
        select: 'firstName lastName profilePicture'
      });

    res.status(200).json({
      status: 'success',
      results: services.length,
      data: { services }
    });
  } catch (error) {
    handleError(error, next);
  }
};

/**
 * Get services by category
 * @route GET /services/category/:categoryId
 * @access Public
 */
export const getCategoryServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId } = req.params;

    const services = await Service.find({ categoryId })
      .populate({
        path: 'categoryId',
        model: 'ServiceCategory',
        select: 'name description'
      })
      .populate({
        path: 'providerId',
        model: 'User',
        select: 'firstName lastName profilePicture'
      });

    res.status(200).json({
      status: 'success',
      results: services.length,
      data: { services }
    });
  } catch (error) {
    handleError(error, next);
  }
};