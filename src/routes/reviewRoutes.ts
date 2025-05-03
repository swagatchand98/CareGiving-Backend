// routes/reviewRoutes.ts
import { Router } from 'express';
import { 
  createReview,
  getProviderReviews,
  getServiceReviews,
  getUserReviews,
  updateReview,
  deleteReview,
  getReviewById
} from '../controllers/reviewController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// Public routes
router.get('/provider/:providerId', catchAsync(getProviderReviews));
router.get('/service/:serviceId', catchAsync(getServiceReviews));
router.get('/:id', catchAsync(getReviewById));

// Protected routes
router.use(protect);

// User routes
router.post('/', catchAsync(createReview));
router.get('/user', catchAsync(getUserReviews));
router.patch('/:id', catchAsync(updateReview));
router.delete('/:id', catchAsync(deleteReview));

export default router;
