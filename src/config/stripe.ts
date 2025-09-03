import Stripe from 'stripe';
import { config } from './env';

// Initialize Stripe
const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
});

// Platform fee percentage
export const PLATFORM_FEE_PERCENTAGE = 15;

// Tax rate percentage
export const TAX_PERCENTAGE = 7;

// Stripe service fee percentage
export const STRIPE_FEE_PERCENTAGE = 2.9;
export const STRIPE_FIXED_FEE = 30; // in cents

// Refund policy
export const REFUND_POLICY = {
  BEFORE_24_HOURS: 90,
  BEFORE_12_HOURS: 75,
  BEFORE_6_HOURS: 50,
  LESS_THAN_6_HOURS: 0
};

// Payout schedule
export const PAYOUT_SCHEDULE = 'weekly';

// Currency
export const DEFAULT_CURRENCY = 'usd';

const webhookSecret = config.STRIPE_WEBHOOK_SECRET;

// calculate platform fee amount
export const calculatePlatformFee = (amount: number): number => {
  return Math.round((amount * PLATFORM_FEE_PERCENTAGE) / 100);
};

// calculate tax amount
export const calculateTax = (amount: number): number => {
  return Math.round((amount * TAX_PERCENTAGE) / 100);
};

// calculate Stripe fee
export const calculateStripeFee = (amount: number): number => {
  // Convert amount to cents for calculation
  const amountInCents = Math.round(amount * 100);
  const stripeFeeInCents = Math.round((amountInCents * STRIPE_FEE_PERCENTAGE) / 100) + STRIPE_FIXED_FEE;
  return stripeFeeInCents / 100;
};

// calculate provider amount
export const calculateProviderAmount = (amount: number): number => {
  const platformFee = calculatePlatformFee(amount);
  const tax = calculateTax(amount);
  // Provider doesn't pay the Stripe fee directly
  return amount - platformFee - tax;
};

// calculate refund amount based on cancellation time
export const calculateRefundAmount = (
  amount: number, 
  bookingTime: Date, 
  cancellationTime: Date
): number => {
  const hoursDifference = 
    (bookingTime.getTime() - cancellationTime.getTime()) / (1000 * 60 * 60);
  
  let refundPercentage = 0;
  
  if (hoursDifference >= 24) {
    refundPercentage = REFUND_POLICY.BEFORE_24_HOURS;
  } else if (hoursDifference >= 12) {
    refundPercentage = REFUND_POLICY.BEFORE_12_HOURS;
  } else if (hoursDifference >= 6) {
    refundPercentage = REFUND_POLICY.BEFORE_6_HOURS;
  } else {
    refundPercentage = REFUND_POLICY.LESS_THAN_6_HOURS;
  }
  
  return Math.round((amount * refundPercentage) / 100);
};

// verify Stripe webhook signatures
export const verifyWebhookSignature = (
  body: string | Buffer,
  signature: string
): Stripe.Event => {
  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
};

export default stripe;
