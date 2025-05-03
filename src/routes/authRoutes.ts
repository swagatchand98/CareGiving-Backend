import { Router, Request, Response, NextFunction } from 'express';
import { 
  register, 
  login,
  registerProvider,
  forgotPassword, 
  resetPassword, 
  updateUserPassword,
  verifyEmail,
  getCurrentUser,
  getUserData,
  getUserProfile,
  updateUserProfile
} from '../controllers/authController';
import { protect, restrictTo } from '../middleware/authMiddleware';

// Type definition for async route handler
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void | Response>;

// Async error handling wrapper
const catchAsync = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const router = Router();

// Public Routes
router.post('/register', catchAsync(register));
router.post('/register-provider', catchAsync(registerProvider));
router.post('/login', catchAsync(login));
router.post('/forgot-password', catchAsync(forgotPassword));
router.post('/reset-password', catchAsync(resetPassword));

// Protected Routes
router.use(protect); // All routes below this will require authentication

router.get('/me', catchAsync(getUserData));
router.post('/update-password', catchAsync(updateUserPassword));
router.post('/verify-email', catchAsync(verifyEmail));
router.get('/profile', catchAsync(getUserProfile));
router.put('/profile', catchAsync(updateUserProfile));

export default router;
