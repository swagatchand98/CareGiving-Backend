import stripe, { 
  calculatePlatformFee,
  calculateTax,
  calculateStripeFee,
  calculateProviderAmount,
  DEFAULT_CURRENCY,
  PAYOUT_SCHEDULE
} from '../config/stripe';
import { Payment, PaymentStatus, PaymentType, PaymentReleaseStatus, IPayment } from '../models/paymentModel';
import { User } from '../models/db';
import ProviderConnectAccount from '../models/providerConnectAccountModel';
import * as paymentNotificationService from './paymentNotificationService';
import * as paymentEmailService from './paymentEmailService';

/**
 * Create a payment intent for a booking
 */
export const createPaymentIntent = async (
  bookingId: string,
  userId: string,
  providerId: string,
  amount: number,
  currency: string = DEFAULT_CURRENCY
): Promise<{ clientSecret: string; paymentId: string }> => {
  try {
    // Calculate fees and amounts
    const platformFee = calculatePlatformFee(amount);
    const taxAmount = calculateTax(amount);
    const stripeFee = calculateStripeFee(amount);
    const providerAmount = calculateProviderAmount(amount);

    // Check if provider has a Stripe Connect account
    const providerConnectAccount = await ProviderConnectAccount.findOne({ providerId });
    const stripeConnectAccountId = providerConnectAccount?.stripeConnectAccountId;

    // Create a payment record in the database
    const payment = await Payment.create({
      userId,
      providerId,
      bookingId,
      amount,
      platformFee,
      taxAmount,
      stripeFee,
      providerAmount,
      currency,
      status: PaymentStatus.PENDING,
      type: PaymentType.BOOKING,
      releaseStatus: PaymentReleaseStatus.HELD,
      stripeConnectAccountId
    });

    // Ensure minimum amount for Stripe ($0.50 USD)
    const minAmount = 50; // 50 cents = $0.50
    const stripeAmount = Math.max(Math.round(amount * 100), minAmount); // Convert to cents and ensure minimum
    
    console.log(`Creating payment intent with amount: ${amount}, stripeAmount: ${stripeAmount}`);
    
    // Create payment intent options
    const paymentIntentOptions: any = {
      amount: stripeAmount, // Amount in cents, minimum $0.50
      currency,
      metadata: {
        bookingId,
        userId,
        providerId,
        paymentId: payment._id ? payment._id.toString() : ''
      }
    };
    
    // If provider has a Connect account, add application fee
    if (stripeConnectAccountId && providerConnectAccount?.chargesEnabled) {
      paymentIntentOptions.application_fee_amount = Math.round((platformFee + taxAmount) * 100); // Convert to cents
      paymentIntentOptions.transfer_data = {
        destination: stripeConnectAccountId,
      };
    }
    
    // Create a payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

    // Update the payment record with the Stripe payment intent ID
    payment.stripePaymentIntentId = paymentIntent.id;
    await payment.save();

    return {
      clientSecret: paymentIntent.client_secret as string,
      paymentId: payment._id ? payment._id.toString() : ''
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

/**
 * Confirm a payment for a booking
 */
export const confirmPayment = async (
  paymentIntentId: string
): Promise<IPayment> => {
  try {
    console.log('Backend: Confirming payment with intent ID:', paymentIntentId);
    
    // Get the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log('Backend: Retrieved payment intent from Stripe:', paymentIntent.id);

    // Find the payment record in the database
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntentId
    });

    if (!payment) {
      console.error('Backend: Payment record not found for payment intent ID:', paymentIntentId);
      throw new Error(`Payment not found for payment intent ID: ${paymentIntentId}`);
    }

    console.log('Backend: Found payment record:', payment._id);

    // Update the payment status
    payment.status = PaymentStatus.COMPLETED;
    await payment.save();
    console.log('Backend: Updated payment status to COMPLETED');

    // Send notification to the provider
    await paymentNotificationService.createPaymentNotification(
      payment.providerId.toString(),
      payment.userId.toString(),
      payment.amount,
      payment.bookingId.toString()
    );
    console.log('Backend: Sent payment notification to provider');

    // Send email confirmation to the user
    const user = await User.findById(payment.userId);
    if (user && user.email) {
      await paymentEmailService.sendPaymentConfirmation(
        user.email,
        payment.amount,
        payment.bookingId.toString()
      );
      console.log('Backend: Sent payment confirmation email to user');
    }

    return payment;
  } catch (error) {
    console.error('Backend: Error confirming payment:', error);
    throw error;
  }
};

/**
 * Process a refund for a booking
 */
export const processRefund = async (
  bookingId: string,
  amount: number,
  reason: string
): Promise<IPayment> => {
  try {
    // Find the original payment
    const originalPayment = await Payment.findOne({
      bookingId,
      type: PaymentType.BOOKING,
      status: PaymentStatus.COMPLETED
    });

    if (!originalPayment) {
      throw new Error('Original payment not found or not completed');
    }

    // Ensure refund amount is not greater than original payment
    if (amount > originalPayment.amount) {
      throw new Error('Refund amount cannot exceed original payment amount');
    }

    // Create a refund with Stripe
    const refund = await stripe.refunds.create({
      payment_intent: originalPayment.stripePaymentIntentId as string,
      amount,
      reason: 'requested_by_customer',
      metadata: {
        bookingId,
        originalPaymentId: originalPayment._id ? originalPayment._id.toString() : '',
        reason
      }
    });

    // Calculate platform fee refund and provider amount refund
    const refundRatio = amount / originalPayment.amount;
    const platformFeeRefund = Math.round(originalPayment.platformFee * refundRatio);
    const providerAmountRefund = amount - platformFeeRefund;

    // Create a refund record in the database
    const refundPayment = await Payment.create({
      userId: originalPayment.userId,
      providerId: originalPayment.providerId,
      bookingId,
      amount: -amount, // Negative amount for refund
      platformFee: -platformFeeRefund,
      providerAmount: -providerAmountRefund,
      currency: originalPayment.currency,
      status: PaymentStatus.COMPLETED,
      type: PaymentType.REFUND,
      stripeRefundId: refund.id,
      refundAmount: amount,
      refundReason: reason
    });

    // Update the original payment status
    if (amount === originalPayment.amount) {
      originalPayment.status = PaymentStatus.REFUNDED;
    } else {
      originalPayment.status = PaymentStatus.PARTIALLY_REFUNDED;
    }
    await originalPayment.save();

    // Send notification to the user
    await paymentNotificationService.createRefundNotification(
      originalPayment.userId.toString(),
      amount,
      bookingId
    );

    // Send email confirmation to the user
    const user = await User.findById(originalPayment.userId);
    if (user && user.email) {
      await paymentEmailService.sendRefundConfirmation(
        user.email,
        amount,
        bookingId
      );
    }

    return refundPayment;
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
};

/**
 * Process payouts for providers
 */
export const processProviderPayouts = async (): Promise<void> => {
  try {
    // Find all completed payments that haven't been paid out to providers
    const pendingPayouts = await Payment.aggregate([
      {
        $match: {
          status: PaymentStatus.COMPLETED,
          type: PaymentType.BOOKING,
          releaseStatus: PaymentReleaseStatus.RELEASED,
          stripeTransferId: { $exists: false }
        }
      },
      {
        $group: {
          _id: '$providerId',
          totalAmount: { $sum: '$providerAmount' },
          payments: { $push: '$$ROOT' }
        }
      }
    ]);

    // Process each provider's payout
    for (const payout of pendingPayouts) {
      const providerId = payout._id;
      const totalAmount = payout.totalAmount;
      const payments = payout.payments;

      // Get the provider's Connect account
      const providerConnectAccount = await ProviderConnectAccount.findOne({ providerId });
      
      if (!providerConnectAccount || !providerConnectAccount.stripeConnectAccountId) {
        console.log(`Provider ${providerId} does not have a Stripe Connect account`);
        continue;
      }
      
      // Skip if payouts are not enabled
      if (!providerConnectAccount.payoutEnabled) {
        console.log(`Payouts are not enabled for provider ${providerId}`);
        continue;
      }
      
      // Skip if provider has manual payout schedule and hasn't requested a payout
      if (providerConnectAccount.payoutSchedule === 'manual') {
        console.log(`Provider ${providerId} has manual payout schedule`);
        continue;
      }

      // Create a transfer to the provider's Stripe account
      const transfer = await stripe.transfers.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: DEFAULT_CURRENCY,
        destination: providerConnectAccount.stripeConnectAccountId,
        metadata: {
          providerId: providerId.toString(),
          paymentCount: payments.length.toString()
        }
      });

      // Update all the payments with the transfer ID and mark as paid out
      await Payment.updateMany(
        {
          _id: { $in: payments.map((p: any) => p._id) }
        },
        {
          $set: { 
            stripeTransferId: transfer.id,
            releaseStatus: PaymentReleaseStatus.PAID_OUT,
            paidOutDate: new Date()
          }
        }
      );

      // Create a payout record in the database
      await Payment.create({
        userId: providerId, // In this case, the provider is receiving the payment
        providerId, // Same as userId for payout
        bookingId: payments[0].bookingId, // Use the first booking ID as reference
        amount: totalAmount,
        platformFee: 0, // No platform fee for payouts
        taxAmount: 0, // No tax for payouts
        stripeFee: 0, // No Stripe fee for payouts
        providerAmount: totalAmount,
        currency: DEFAULT_CURRENCY,
        status: PaymentStatus.COMPLETED,
        type: PaymentType.PAYOUT,
        releaseStatus: PaymentReleaseStatus.PAID_OUT,
        stripeTransferId: transfer.id,
        stripeConnectAccountId: providerConnectAccount.stripeConnectAccountId,
        metadata: {
          paymentIds: payments.map((p: any) => p._id.toString()),
          paymentCount: payments.length
        }
      });

      // Send notification to the provider
      await paymentNotificationService.createPayoutNotification(
        providerId.toString(),
        totalAmount
      );

      // Send email confirmation to the provider
      const provider = await User.findById(providerId);
      if (provider && provider.email) {
        await paymentEmailService.sendPayoutConfirmation(
          provider.email,
          totalAmount
        );
      }
    }
  } catch (error) {
    console.error('Error processing provider payouts:', error);
    throw error;
  }
};

/**
 * Schedule weekly payouts for providers
 */
export const scheduleProviderPayouts = (): void => {
  // Schedule weekly payouts (every Monday at midnight)
  const schedulePayouts = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysUntilMonday = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);

    const timeUntilNextMonday = nextMonday.getTime() - now.getTime();

    setTimeout(async () => {
      try {
        await processProviderPayouts();
      } catch (error) {
        console.error('Error in scheduled provider payouts:', error);
      }
      schedulePayouts(); // Schedule the next payout
    }, timeUntilNextMonday);
  };

  // Start the scheduling
  schedulePayouts();
};

/**
 * Get payment history for a user
 */
export const getUserPaymentHistory = async (
  userId: string
): Promise<IPayment[]> => {
  try {
    return await Payment.find({
      userId,
      $or: [
        { type: PaymentType.BOOKING },
        { type: PaymentType.REFUND }
      ]
    })
      .sort({ createdAt: -1 })
      .populate('bookingId', 'serviceId dateTime status')
      .populate('providerId', 'firstName lastName email');
  } catch (error) {
    console.error('Error getting user payment history:', error);
    throw error;
  }
};

/**
 * Get payment history for a provider
 */
export const getProviderPaymentHistory = async (
  providerId: string
): Promise<IPayment[]> => {
  try {
    return await Payment.find({
      providerId,
      $or: [
        { type: PaymentType.BOOKING, status: PaymentStatus.COMPLETED },
        { type: PaymentType.REFUND },
        { type: PaymentType.PAYOUT }
      ]
    })
      .sort({ createdAt: -1 })
      .populate('bookingId', 'serviceId dateTime status')
      .populate('userId', 'firstName lastName email');
  } catch (error) {
    console.error('Error getting provider payment history:', error);
    throw error;
  }
};

/**
 * Get payment details for a booking
 */
export const getBookingPaymentDetails = async (
  bookingId: string
): Promise<IPayment[]> => {
  try {
    return await Payment.find({ bookingId })
      .sort({ createdAt: -1 });
  } catch (error) {
    console.error('Error getting booking payment details:', error);
    throw error;
  }
};

/**
 * Release funds to provider when booking is completed
 */
export const releaseProviderFunds = async (
  bookingId: string
): Promise<IPayment | null> => {
  try {
    // Find the payment for this booking
    const payment = await Payment.findOne({
      bookingId,
      type: PaymentType.BOOKING,
      status: PaymentStatus.COMPLETED,
      releaseStatus: PaymentReleaseStatus.HELD
    });

    if (!payment) {
      console.log(`No payment found for booking ${bookingId} or payment already released`);
      return null;
    }

    // Update the payment release status
    payment.releaseStatus = PaymentReleaseStatus.RELEASED;
    payment.releaseDate = new Date();
    await payment.save();

    console.log(`Released funds for booking ${bookingId} to provider ${payment.providerId}`);

    // Check if provider has a Connect account with manual payout schedule
    const providerConnectAccount = await ProviderConnectAccount.findOne({
      providerId: payment.providerId
    });

    // If provider has a Connect account and wants immediate payout
    if (providerConnectAccount && providerConnectAccount.payoutSchedule === 'manual') {
      console.log(`Provider ${payment.providerId} has manual payout schedule, funds available for payout`);
      
      // Send notification to provider that funds are available for payout
      await paymentNotificationService.createPaymentNotification(
        payment.providerId.toString(),
        payment.userId.toString(),
        payment.providerAmount,
        payment.bookingId.toString(),
        'Funds are now available for payout'
      );
    } else if (providerConnectAccount) {
      // For automatic payout schedules, funds will be transferred on the next scheduled payout
      console.log(`Provider ${payment.providerId} has ${providerConnectAccount.payoutSchedule} payout schedule, funds will be transferred on next scheduled payout`);
    }

    return payment;
  } catch (error) {
    console.error('Error releasing provider funds:', error);
    throw error;
  }
};
