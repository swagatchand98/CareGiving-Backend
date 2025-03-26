// routes/bookingRoutes.ts
import { Router } from 'express';
import { 
  createBooking, 
  getUserBookings, 
  getProviderBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking
} from '../controllers/bookingController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// Protect all routes
router.use(protect);

// User Booking Routes
router.post('/', catchAsync(createBooking));
router.get('/user', catchAsync(getUserBookings));

// Provider Booking Routes
router.get('/provider', 
  restrictTo('provider'), 
  catchAsync(getProviderBookings)
);

// Shared Routes
router.get('/:id', catchAsync(getBookingById));
router.patch('/:id/status', 
  restrictTo('provider', 'user'), 
  catchAsync(updateBookingStatus)
);
router.delete('/:id', catchAsync(cancelBooking));

export default router;