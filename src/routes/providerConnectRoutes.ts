import express from 'express';
import * as providerConnectController from '../controllers/providerConnectController';
import { protect as authenticate, restrictTo } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = express.Router();

/**
 * @route   GET /api/v1/providers/connect/account
 * @desc    Get provider's Stripe Connect account details
 * @access  Private (Provider only)
 */
router.get('/account', authenticate, catchAsync(providerConnectController.getConnectAccount));

/**
 * @route   POST /api/v1/providers/connect/create-account-link
 * @desc    Create a Stripe Connect account link for onboarding
 * @access  Private (Provider only)
 */
router.post('/create-account-link', authenticate, catchAsync(providerConnectController.createAccountLink));

/**
 * @route   POST /api/v1/providers/connect/login-link
 * @desc    Create a Stripe Connect login link for existing accounts
 * @access  Private (Provider only)
 */
router.post('/login-link', authenticate, catchAsync(providerConnectController.createLoginLink));

/**
 * @route   PATCH /api/v1/providers/connect/payout-schedule
 * @desc    Update provider's payout schedule
 * @access  Private (Provider only)
 */
router.patch(
  '/payout-schedule',
  authenticate,
  restrictTo('provider'),
  catchAsync(providerConnectController.updatePayoutSchedule)
);

/**
 * @route   POST /api/v1/providers/connect/request-payout
 * @desc    Request an immediate payout
 * @access  Private (Provider only)
 */
router.post(
  '/request-payout',
  authenticate,
  restrictTo('provider'),
  catchAsync(providerConnectController.requestPayout)
);

/**
 * @route   GET /api/v1/providers/connect/balance
 * @desc    Get provider's Stripe balance
 * @access  Private (Provider only)
 */
router.get('/balance', authenticate, catchAsync(providerConnectController.getBalance));

/**
 * @route   GET /api/v1/providers/connect/payouts
 * @desc    Get provider's payout history
 * @access  Private (Provider only)
 */
router.get('/payouts', authenticate, catchAsync(providerConnectController.getPayouts));

export default router;
