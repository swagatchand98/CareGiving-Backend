// routes/adminRoutes.ts
import { Router } from 'express';
import { 
  getAllUsers,
  getUserById,
  updateUserStatus,
  getAllServices,
  getAllBookings,
  generateReports,
  manageServiceCategories,
  suspendUser,
  activateUser
} from '../controllers/adminController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// Protect all admin routes
router.use(protect);
router.use(restrictTo('admin'));

// User Management
router.get('/users', catchAsync(getAllUsers));
router.get('/users/:id', catchAsync(getUserById));
router.patch('/users/:id/status', catchAsync(updateUserStatus));
router.post('/users/:id/suspend', catchAsync(suspendUser));
router.post('/users/:id/activate', catchAsync(activateUser));

// Service Management
router.get('/services', catchAsync(getAllServices));
router.post('/service-categories', catchAsync(manageServiceCategories));

// Booking Management
router.get('/bookings', catchAsync(getAllBookings));

// Reporting
router.get('/reports', catchAsync(generateReports));

export default router;