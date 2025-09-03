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
import {
  sendOTP,
  verifyOTP,
  getPhoneVerificationStatus
} from '../controllers/phoneVerificationController';
import { protect, restrictTo } from '../middleware/authMiddleware';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void | Response>;

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

// Phone verification routes
router.post('/send-otp', catchAsync(sendOTP));
router.post('/verify-otp', catchAsync(verifyOTP));
router.get('/phone-verification-status', catchAsync(getPhoneVerificationStatus));

export default router;
