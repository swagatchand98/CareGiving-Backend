import { Router, Request, Response, NextFunction } from 'express';
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
router.post('/login', catchAsync(login));
router.post('/forgot-password', catchAsync(forgotPassword));
router.post('/reset-password/:token', catchAsync(resetPassword));
router.get('/verify-email/:token', catchAsync(verifyEmail));

// Protected Routes
router.use(protect); // All routes below this will require authentication

router.get('/me', catchAsync(getCurrentUser));
router.post('/update-password', catchAsync(updatePassword));

export default router;