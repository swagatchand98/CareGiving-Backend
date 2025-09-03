import { Router } from 'express';
import { 
  adminLogin, 
  adminLogout, 
  getCurrentAdmin, 
  verifyAdminToken,
  loginRateLimiter,
  adminAuth,
  createAdmin
} from '../controllers/adminAuthController';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// Public routes
router.post('/login', loginRateLimiter, catchAsync(adminLogin));
router.post('/verify-token', catchAsync(verifyAdminToken));

// Protected routes - require admin authentication
router.use(adminAuth);
router.post('/logout', catchAsync(adminLogout));
router.get('/me', catchAsync(getCurrentAdmin));

// Super admin routes -need to be more restricted
router.post('/create-admin', catchAsync(createAdmin));

export default router;
