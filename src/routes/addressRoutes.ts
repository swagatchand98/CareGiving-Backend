// routes/addressRoutes.ts
import { Router } from 'express';
import { 
  getUserAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress
} from '../controllers/addressController';
import { protect } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// Protect all address routes
router.use(protect);

// Get default address
router.get('/default', catchAsync(getDefaultAddress));

// Get all addresses for the logged-in user
router.get('/', catchAsync(getUserAddresses));

// Create a new address
router.post('/', catchAsync(createAddress));

// Get, update, or delete address by ID
router.get('/:id', catchAsync(getAddressById));
router.patch('/:id', catchAsync(updateAddress));
router.delete('/:id', catchAsync(deleteAddress));

// Set address as default
router.patch('/:id/default', catchAsync(setDefaultAddress));

export default router;
