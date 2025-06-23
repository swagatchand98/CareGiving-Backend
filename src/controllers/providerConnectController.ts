import { Request, Response, NextFunction } from 'express';
import { User, ProviderConnectAccount } from '../models/db';
import { createError } from '../middleware/errorHandler';
import stripe from '../config/stripe';

/**
 * @desc    Get provider's Stripe Connect account details
 * @route   GET /api/v1/providers/connect/account
 * @access  Private (Provider only)
 */
export const getConnectAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Check if user is a provider
    if (req.user.role !== 'provider') {
      return next(createError.forbidden('Only providers can access this resource'));
    }

    // Find provider's connect account
    const connectAccount = await ProviderConnectAccount.findOne({ providerId: req.user._id });

    if (!connectAccount) {
      return next(createError.notFound('Connect account not found'));
    }

    res.status(200).json({
      status: 'success',
      data: connectAccount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a Stripe Connect account link for onboarding
 * @route   POST /api/v1/providers/connect/create-account-link
 * @access  Private (Provider only)
 */
export const createAccountLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Check if user is a provider
    if (req.user.role !== 'provider') {
      return next(createError.forbidden('Only providers can access this resource'));
    }

    // Check if provider already has a connect account
    let connectAccount = await ProviderConnectAccount.findOne({ providerId: req.user._id });
    let stripeConnectAccountId;

    if (!connectAccount) {
      // Create a new Stripe Connect account
      const stripeAccount = await stripe.accounts.create({
        type: 'express',
        email: req.user.email,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_profile: {
          mcc: '8050', // Healthcare Services
          url: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/^"|"$/g, '') : 'https://caregiving-app.com'
        },
        metadata: {
          providerId: req.user._id.toString()
        }
      });

      stripeConnectAccountId = stripeAccount.id;

      // Create a new connect account record
      connectAccount = await ProviderConnectAccount.create({
        providerId: req.user._id,
        stripeConnectAccountId,
        payoutSchedule: 'manual', // Default to manual payouts
        detailsSubmitted: false,
        payoutEnabled: false,
        chargesEnabled: false
      });
    } else {
      stripeConnectAccountId = connectAccount.stripeConnectAccountId;
    }

    // Create an account link for onboarding
    const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/^"|"$/g, '') : 'https://caregiving-app.com';
    const accountLink = await stripe.accountLinks.create({
      account: stripeConnectAccountId,
      refresh_url: `${frontendUrl}/dashboard/provider/earnings?refresh=true`,
      return_url: `${frontendUrl}/dashboard/provider/earnings?success=true`,
      type: 'account_onboarding'
    });

    res.status(200).json({
      status: 'success',
      data: {
        url: accountLink.url
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a Stripe Connect login link for existing accounts
 * @route   POST /api/v1/providers/connect/login-link
 * @access  Private (Provider only)
 */
export const createLoginLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Check if user is a provider
    if (req.user.role !== 'provider') {
      return next(createError.forbidden('Only providers can access this resource'));
    }

    // Find provider's connect account
    const connectAccount = await ProviderConnectAccount.findOne({ providerId: req.user._id });

    if (!connectAccount) {
      return next(createError.notFound('Connect account not found'));
    }

    // Create a login link
    const loginLink = await stripe.accounts.createLoginLink(
      connectAccount.stripeConnectAccountId
    );

    res.status(200).json({
      status: 'success',
      data: {
        url: loginLink.url
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update provider's payout schedule
 * @route   PATCH /api/v1/providers/connect/payout-schedule
 * @access  Private (Provider only)
 */
export const updatePayoutSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const { payoutSchedule } = req.body;

    // Validate payout schedule
    if (!['manual', 'daily', 'weekly', 'monthly'].includes(payoutSchedule)) {
      return next(createError.badRequest('Invalid payout schedule'));
    }

    // Find provider's connect account
    const connectAccount = await ProviderConnectAccount.findOne({ providerId: req.user._id });

    if (!connectAccount) {
      return next(createError.notFound('Connect account not found'));
    }

    // Update payout schedule in Stripe
    await stripe.accounts.update(connectAccount.stripeConnectAccountId, {
      settings: {
        payouts: {
          schedule: {
            interval: payoutSchedule === 'manual' ? 'manual' : payoutSchedule,
            ...(payoutSchedule === 'weekly' && { weekly_anchor: 'monday' }),
            ...(payoutSchedule === 'monthly' && { monthly_anchor: 1 })
          }
        }
      }
    });

    // Update payout schedule in database
    connectAccount.payoutSchedule = payoutSchedule;
    await connectAccount.save();

    res.status(200).json({
      status: 'success',
      data: {
        payoutSchedule
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request an immediate payout
 * @route   POST /api/v1/providers/connect/request-payout
 * @access  Private (Provider only)
 */
export const requestPayout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const { amount } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return next(createError.badRequest('Invalid amount'));
    }

    // Find provider's connect account
    const connectAccount = await ProviderConnectAccount.findOne({ providerId: req.user._id });

    if (!connectAccount) {
      return next(createError.notFound('Connect account not found'));
    }

    // Check if payouts are enabled
    if (!connectAccount.payoutEnabled) {
      return next(createError.badRequest('Payouts are not enabled for your account'));
    }

    // Create a payout
    const payout = await stripe.payouts.create(
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        method: 'standard'
      },
      {
        stripeAccount: connectAccount.stripeConnectAccountId
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        payout
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get provider's Stripe balance
 * @route   GET /api/v1/providers/connect/balance
 * @access  Private (Provider only)
 */
export const getBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find provider's connect account
    const connectAccount = await ProviderConnectAccount.findOne({ providerId: req.user._id });

    if (!connectAccount) {
      return next(createError.notFound('Connect account not found'));
    }

    // Get balance from Stripe
    const balance = await stripe.balance.retrieve({
      stripeAccount: connectAccount.stripeConnectAccountId
    });

    res.status(200).json({
      status: 'success',
      data: balance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get provider's payout history
 * @route   GET /api/v1/providers/connect/payouts
 * @access  Private (Provider only)
 */
export const getPayouts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find provider's connect account
    const connectAccount = await ProviderConnectAccount.findOne({ providerId: req.user._id });

    if (!connectAccount) {
      return next(createError.notFound('Connect account not found'));
    }

    // Get payouts from Stripe
    const payouts = await stripe.payouts.list(
      {
        limit: 100
      },
      {
        stripeAccount: connectAccount.stripeConnectAccountId
      }
    );

    res.status(200).json({
      status: 'success',
      data: payouts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Webhook handler for Stripe Connect account updates
 */
export const handleAccountUpdate = async (event: any) => {
  try {
    const account = event.data.object;
    
    // Find the provider connect account
    const connectAccount = await ProviderConnectAccount.findOne({
      stripeConnectAccountId: account.id
    });

    if (!connectAccount) {
      console.error(`Connect account not found for Stripe account ID: ${account.id}`);
      return;
    }

    // Update account details
    connectAccount.detailsSubmitted = account.details_submitted;
    connectAccount.payoutEnabled = account.payouts_enabled;
    connectAccount.chargesEnabled = account.charges_enabled;
    
    if (account.settings?.payouts?.schedule) {
      const schedule = account.settings.payouts.schedule;
      connectAccount.payoutSchedule = schedule.interval;
    }

    await connectAccount.save();
    
    console.log(`Updated connect account for provider: ${connectAccount.providerId}`);
  } catch (error) {
    console.error('Error handling account update webhook:', error);
  }
};
