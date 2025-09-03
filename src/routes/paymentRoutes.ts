import { Router } from 'express';
import {
  createPaymentIntent,
  confirmPayment,
  processRefund,
  getPaymentHistory,
  getBookingPaymentDetails,
  handleStripeWebhook,
  triggerProviderPayouts
} from '../controllers/paymentController';
import { protect, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';
import express from 'express';

const router = Router();

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  catchAsync(handleStripeWebhook)
);

// All other routes require authentication
router.use(protect);

// Create payment intent
router.post('/create-intent', catchAsync(createPaymentIntent));

// Confirm payment
router.post('/confirm', catchAsync(confirmPayment));

// Process refund
router.post('/refund', catchAsync(processRefund));

// Get payment history
router.get('/history', catchAsync(getPaymentHistory));

// Get payment details for a booking
router.get('/booking/:bookingId', catchAsync(getBookingPaymentDetails));

// Admin-only routes
router.use(restrictTo('admin'));

// Manually trigger provider payouts
router.post('/process-payouts', catchAsync(triggerProviderPayouts));

export default router;
