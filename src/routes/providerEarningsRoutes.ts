import { Router } from 'express';
import * as providerEarningsController from '../controllers/providerEarningsController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// Protect all routes - require authentication
router.use(protect);

// Restrict to provider role
router.use(restrictTo('provider'));

// Get provider earnings summary
router.get('/summary', catchAsync(providerEarningsController.getEarningsSummary));

// Get provider earnings history
router.get('/history', catchAsync(providerEarningsController.getEarningsHistory));

export default router;
