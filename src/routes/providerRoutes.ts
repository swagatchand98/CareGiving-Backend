// routes/providerRoutes.ts
import { Router } from 'express';
import { 
  completeOnboarding,
  uploadDocuments as uploadDocumentsController,
  updateProfilePicture,
  updateAddress,
  getOnboardingStatus,
  getProviderServices
} from '../controllers/providerController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';
import { uploadDocuments, uploadProfilePicture } from '../middleware/uploadMiddleware';

const router = Router();

// All provider routes are protected
router.use(protect);
router.use(restrictTo('provider'));

// Onboarding routes
router.post('/onboarding', catchAsync(completeOnboarding));
router.get('/onboarding-status', catchAsync(getOnboardingStatus));

// Document upload routes
router.post('/documents', uploadDocuments('documents', 5), catchAsync(uploadDocumentsController));
router.post('/profile-picture', uploadProfilePicture('profilePicture'), catchAsync(updateProfilePicture));

// Address update route
router.post('/address', catchAsync(updateAddress));

// Services route
router.get('/services', catchAsync(getProviderServices));

export default router;
