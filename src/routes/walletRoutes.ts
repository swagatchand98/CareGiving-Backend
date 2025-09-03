import { Router } from 'express';
import { 
  getWallet,
  addFunds,
  payWithWallet,
  getTransactions,
  transferToProvider,
  withdrawFunds
} from '../controllers/walletController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// All wallet routes are protected
router.use(protect);

// User wallet routes
router.get('/', catchAsync(getWallet));
router.post('/add-funds', catchAsync(addFunds));
router.post('/pay/:bookingId', catchAsync(payWithWallet));
router.get('/transactions', catchAsync(getTransactions));
router.post('/withdraw', catchAsync(withdrawFunds));

// Admin routes
router.post('/transfer/:providerId', 
  restrictTo('admin'), 
  catchAsync(transferToProvider)
);

export default router;
