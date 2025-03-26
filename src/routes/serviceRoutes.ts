// routes/serviceRoutes.ts
import { Router } from 'express';
import { 
  createService, 
  getServices, 
  getServiceById, 
  updateService, 
  deleteService,
  searchServices,
  getCategoryServices
} from '../controllers/serviceController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';
import { uploadServiceImages } from '../middleware/uploadMiddleware';

const router = Router();

// Public Routes
router.get('/', catchAsync(getServices));
router.get('/search', catchAsync(searchServices));
router.get('/category/:categoryId', catchAsync(getCategoryServices));
router.get('/:id', catchAsync(getServiceById));

// Protected Routes
router.use(protect);

// Provider-specific routes
router.post('/', 
  restrictTo('provider'), 
  uploadServiceImages, 
  catchAsync(createService)
);

router.patch('/:id', 
  restrictTo('provider'), 
  uploadServiceImages, 
  catchAsync(updateService)
);

router.delete('/:id', 
  restrictTo('provider'), 
  catchAsync(deleteService)
);

export default router;