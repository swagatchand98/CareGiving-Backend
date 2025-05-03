// routes/serviceRoutes.ts
import { Router } from 'express';
import { 
  createService, 
  getServices, 
  getServiceById, 
  updateService, 
  deleteService,
  searchServices,
  getCategoryServices,
  getServiceCategories,
  getServiceCategoryById
} from '../controllers/serviceController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';
import { uploadServiceImages } from '../middleware/uploadMiddleware';
import { cacheResponse, clearCacheMiddleware } from '../middleware/cacheMiddleware';

const router = Router();

// Public Routes
router.get('/', catchAsync(getServices)); // Cache for 5 minutes
router.get('/search', catchAsync(searchServices)); // Cache for 5 minutes
router.get('/categories', catchAsync(getServiceCategories)); // Cache for 1 hour
router.get('/categories/:id', catchAsync(getServiceCategoryById)); // Cache for 1 hour
router.get('/category/:categoryId', catchAsync(getCategoryServices)); // Cache for 5 minutes
router.get('/:id', catchAsync(getServiceById)); // Cache for 5 minutes

// Protected Routes
router.use(protect);

// Provider-specific routes
router.post('/', 
  restrictTo('provider'), 
  uploadServiceImages,
  clearCacheMiddleware('/services'), // Clear services cache when a new service is created
  catchAsync(createService)
);

router.patch('/:id', 
  restrictTo('provider'), 
  uploadServiceImages,
  clearCacheMiddleware('/services'), // Clear services cache when a service is updated
  catchAsync(updateService)
);

router.delete('/:id', 
  restrictTo('provider'),
  clearCacheMiddleware('/services'), // Clear services cache when a service is deleted
  catchAsync(deleteService)
);

export default router;
