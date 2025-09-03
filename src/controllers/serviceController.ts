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

    // Validate that the selected tasks are from the predefined list for this category
    if (req.body.includedServices && Array.isArray(req.body.includedServices)) {
      const invalidTasks = req.body.includedServices.filter(
        (task: string) => !category.tasks?.includes(task)
      );

      if (invalidTasks.length > 0) {
        const error = new Error(`Invalid tasks selected: ${invalidTasks.join(', ')}`);
        (error as any).status = 400;
        return next(error);
      }
    }

    // Process uploaded files
    let images: string[] = [];
    let mediaFiles: { url: string; type: string; name?: string }[] = [];

    if (req.body.s3Urls) {
      // S3 URLs are available
      images = req.body.s3Urls;
      
      // Process files to determine their type (image or video)
      if (req.files && Array.isArray(req.files)) {
        const files = req.files as Express.Multer.File[];
        
        mediaFiles = req.body.s3Urls.map((url: string, index: number) => {
          const file = files[index];
          const fileType = file.mimetype.startsWith('image/') ? 'image' : 
                          file.mimetype.startsWith('video/') ? 'video' : 'document';
          
          return {
            url: url,
            type: fileType,
            name: file.originalname
          };
        });
      }
    } else if (req.files) {
      // Local file paths
      const files = req.files as Express.Multer.File[];
      images = files.map(file => file.path);
      
      mediaFiles = files.map(file => {
        const fileType = file.mimetype.startsWith('image/') ? 'image' : 
                        file.mimetype.startsWith('video/') ? 'video' : 'document';
        
        return {
          url: file.path,
          type: fileType,
          name: file.originalname
        };
      });
    }

    const serviceData = {
        providerId: userId,
        categoryId: req.body.categoryId,
        title: req.body.title,
        description: req.body.description,
        images: images, // For backward compatibility
        mediaFiles: mediaFiles, // New field with type information
        price: {
          amount: req.body.priceAmount,
          type: req.body.priceType || 'fixed'
        },
        duration: req.body.duration,
        additionalDetails: {
          specialRequirements: req.body.specialRequirements,
          includedServices: req.body.includedServices || []
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

    // Define projection to limit fields returned
    const projection = {
      title: 1,
      description: 1,
      price: 1,
      images: { $slice: 1 }, // Only return the first image
      duration: 1,
      createdAt: 1
    };

    const services = await Service.find(query, projection)
      .populate({
        path: 'categoryId',
        model: 'ServiceCategory',
        select: 'name description' // Only select necessary fields
      })
      .populate({
        path: 'providerId',
        model: 'User',
        select: 'firstName lastName profilePicture' // Only select necessary fields
      })
      .lean() // Convert to plain JavaScript objects for better performance
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
 */
export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user._id;

    // First find the service to check if it exists and the user is authorized
    const existingService = await Service.findOne({ _id: req.params.id, providerId: userId });
    if (!existingService) {
      const error = new Error('Service not found or you are not authorized to update');
      (error as any).status = 404;
      return next(error);
    }

    // If category is being updated, validate it
    let category;
    if (req.body.categoryId) {
      category = await ServiceCategory.findById(req.body.categoryId);
      if (!category) {
        const error = new Error('Invalid service category');
        (error as any).status = 400;
        return next(error);
      }
    } else {
      // Use existing category
      category = await ServiceCategory.findById(existingService.categoryId);
    }

    // Validate that the selected tasks are from the predefined list for this category
    if (req.body.includedServices && Array.isArray(req.body.includedServices)) {
      const invalidTasks = req.body.includedServices.filter(
        (task: string) => !category?.tasks?.includes(task)
      );

      if (invalidTasks.length > 0) {
        const error = new Error(`Invalid tasks selected: ${invalidTasks.join(', ')}`);
        (error as any).status = 400;
        return next(error);
      }
    }

    // Update the service
    const updateData: any = {};
    if (req.body.title) updateData.title = req.body.title;
    if (req.body.description) updateData.description = req.body.description;
    if (req.body.categoryId) updateData.categoryId = req.body.categoryId;
    
    // Process uploaded files
    if (req.body.s3Urls || req.files) {
      let images: string[] = [];
      let mediaFiles: { url: string; type: string; name?: string }[] = [];

      if (req.body.s3Urls) {
        // S3 URLs are available
        images = req.body.s3Urls;
        
        // Process files to determine their type (image or video)
        if (req.files && Array.isArray(req.files)) {
          const files = req.files as Express.Multer.File[];
          
          mediaFiles = req.body.s3Urls.map((url: string, index: number) => {
            const file = files[index];
            const fileType = file.mimetype.startsWith('image/') ? 'image' : 
                            file.mimetype.startsWith('video/') ? 'video' : 'document';
            
            return {
              url: url,
              type: fileType,
              name: file.originalname
            };
          });
        }
      } else if (req.files) {
        // Local file paths
        const files = req.files as Express.Multer.File[];
        images = files.map(file => file.path);
        
        mediaFiles = files.map(file => {
          const fileType = file.mimetype.startsWith('image/') ? 'image' : 
                          file.mimetype.startsWith('video/') ? 'video' : 'document';
          
          return {
            url: file.path,
            type: fileType,
            name: file.originalname
          };
        });
      }

      updateData.images = images; // For backward compatibility
      updateData.mediaFiles = mediaFiles; // New field with type information
    }
    
    if (req.body.priceAmount || req.body.priceType) {
      updateData.price = {
        amount: req.body.priceAmount || existingService.price.amount,
        type: req.body.priceType || existingService.price.type
      };
    }
    
    if (req.body.duration) updateData.duration = req.body.duration;
    
    updateData.additionalDetails = {
      specialRequirements: req.body.specialRequirements || existingService.additionalDetails?.specialRequirements,
      includedServices: req.body.includedServices || existingService.additionalDetails?.includedServices
    };

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      updateData,
      { 
        new: true, 
        runValidators: true 
      }
    );

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

    // Define projection to limit fields returned
    const projection = {
      title: 1,
      description: 1,
      price: 1,
      images: { $slice: 1 }, // Only return the first image
      duration: 1,
      createdAt: 1
    };

    const services = await Service.find(searchConditions, projection)
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
      .lean() // Convert to plain JavaScript objects for better performance
      .limit(20); // Limit results for better performance

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
 */
export const getCategoryServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId } = req.params;

    // Define projection to limit fields returned
    const projection = {
      title: 1,
      description: 1,
      price: 1,
      images: { $slice: 1 }, // Only return the first image
      duration: 1,
      createdAt: 1
    };

    const services = await Service.find({ categoryId }, projection)
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
      .lean() // Convert to plain JavaScript objects for better performance
      .limit(20); // Limit results for better performance

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
 * Get all service categories
 * @route GET /services/categories
 */
export const getServiceCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await ServiceCategory.find().sort({ name: 1 });

    res.status(200).json({
      status: 'success',
      results: categories.length,
      data: { categories }
    });
  } catch (error) {
    handleError(error, next);
  }
};

/**
 * Get service category by ID with tasks
 * @route GET /services/categories/:id
 */
export const getServiceCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await ServiceCategory.findById(req.params.id);

    if (!category) {
      const error = new Error('Service category not found');
      (error as any).status = 404;
      return next(error);
    }

    res.status(200).json({
      status: 'success',
      data: { category }
    });
  } catch (error) {
    handleError(error, next);
  }
};
