// routes/timeSlotRoutes.ts
import { Router } from 'express';
import { 
  createTimeSlots,
  getServiceTimeSlots,
  getProviderTimeSlots,
  updateTimeSlot,
  deleteTimeSlot,
  bookTimeSlot
} from '../controllers/timeSlotController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// Public routes
router.get('/service/:serviceId', catchAsync(getServiceTimeSlots));

// Protected routes
router.use(protect);

// User routes
router.post('/:id/book', catchAsync(bookTimeSlot));

// Provider routes
router.post('/', 
  restrictTo('provider'), 
  catchAsync(createTimeSlots)
);

router.get('/provider', 
  restrictTo('provider'), 
  catchAsync(getProviderTimeSlots)
);

router.patch('/:id', 
  restrictTo('provider'), 
  catchAsync(updateTimeSlot)
);

router.delete('/:id', 
  restrictTo('provider'), 
  catchAsync(deleteTimeSlot)
);

export default router;
