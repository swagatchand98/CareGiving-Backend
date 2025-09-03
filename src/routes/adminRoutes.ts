import { Router } from 'express';
import { 
  getAllUsers,
  getUserById,
  updateUserStatus,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  generateReports,
  getAllServiceCategories,
  manageServiceCategories,
  suspendUser,
  activateUser,
  blockUser,
  unblockUser,
  getAllPayments,
  getPaymentById,
  getAllReviews,
  deleteReview,
  getAllProviders,
  getProviderById,
  getDashboardStats
} from '../controllers/adminController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// // Protect all admin routes
// router.use(protect);
// router.use(restrictTo('admin'));

// Dashboard
router.get('/dashboard', catchAsync(getDashboardStats));

// User Management
router.get('/users', catchAsync(getAllUsers));
router.get('/users/:id', catchAsync(getUserById));
router.patch('/users/:id/status', catchAsync(updateUserStatus));
router.post('/users/:id/suspend', catchAsync(suspendUser));
router.post('/users/:id/activate', catchAsync(activateUser));
router.post('/users/:id/block', catchAsync(blockUser));
router.post('/users/:id/unblock', catchAsync(unblockUser));

// Provider Management
router.get('/providers', catchAsync(getAllProviders));
router.get('/providers/:id', catchAsync(getProviderById));

// Service Management
router.get('/services', catchAsync(getAllServices));
router.get('/services/:id', catchAsync(getServiceById));
router.put('/services/:id', catchAsync(updateService));
router.delete('/services/:id', catchAsync(deleteService));

// Service Categories
router.get('/service-categories', catchAsync(getAllServiceCategories));
router.post('/service-categories', catchAsync(manageServiceCategories));

// Booking Management
router.get('/bookings', catchAsync(getAllBookings));
router.get('/bookings/:id', catchAsync(getBookingById));
router.patch('/bookings/:id/status', catchAsync(updateBookingStatus));

// Payment Management
router.get('/payments', catchAsync(getAllPayments));
router.get('/payments/:id', catchAsync(getPaymentById));

// Review Management
router.get('/reviews', catchAsync(getAllReviews));
router.delete('/reviews/:id', catchAsync(deleteReview));

// Reporting
router.get('/reports', catchAsync(generateReports));

export default router;
