import { Router } from 'express';
import { 
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlistStatus
} from '../controllers/wishlistController';
import { protect } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// Protect all wishlist routes
router.use(protect);

// Get user's wishlist
router.get('/', catchAsync(getUserWishlist));

// Add service to wishlist
router.post('/', catchAsync(addToWishlist));

// Remove service from wishlist
router.delete('/:serviceId', catchAsync(removeFromWishlist));

// Check if service is in wishlist
router.get('/check/:serviceId', catchAsync(checkWishlistStatus));

export default router;
