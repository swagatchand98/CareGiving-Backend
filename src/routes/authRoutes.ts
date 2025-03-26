// routes/authRoutes.ts
import { Router } from 'express';
import { 
  register, 
  login, 
  logout, 
  forgotPassword, 
  resetPassword, 
  updatePassword,
  verifyEmail,
  getCurrentUser
} from '../controllers/authController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// Public Routes
router.post('/register', catchAsync(register));
router.post('/login', catchAsync(login));
router.post('/forgot-password', catchAsync(forgotPassword));
router.post('/reset-password/:token', catchAsync(resetPassword));
router.get('/verify-email/:token', catchAsync(verifyEmail));

// Protected Routes
router.use(protect); // All routes below this will require authentication

router.get('/me', catchAsync(getCurrentUser));
router.post('/update-password', catchAsync(updatePassword));
router.post('/logout', catchAsync(logout));

export default router;