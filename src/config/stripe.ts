import Stripe from 'stripe';
import { config } from './env';

// Initialize Stripe with the API key from environment variables
const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' as Stripe.LatestApiVersion, // Use a valid API version
});

// Platform fee percentage (15%)
export const PLATFORM_FEE_PERCENTAGE = 15;

// Tax rate percentage (e.g., 7%)
export const TAX_PERCENTAGE = 7;

// Stripe service fee percentage (typically 2.9% + 30 cents)
export const STRIPE_FEE_PERCENTAGE = 2.9;
export const STRIPE_FIXED_FEE = 30; // in cents

// Refund policy based on cancellation timing
export const REFUND_POLICY = {
  BEFORE_24_HOURS: 90, // 90% refund if cancelled more than 24 hours before
  BEFORE_12_HOURS: 75, // 75% refund if cancelled between 12-24 hours before
  BEFORE_6_HOURS: 50,  // 50% refund if cancelled between 6-12 hours before
  LESS_THAN_6_HOURS: 0 // No refund if cancelled less than 6 hours before
};

// Payout schedule (weekly)
export const PAYOUT_SCHEDULE = 'weekly';

// Currency (default to USD)
export const DEFAULT_CURRENCY = 'usd';

// Webhook secret for verifying Stripe webhook events
const webhookSecret = config.STRIPE_WEBHOOK_SECRET;

// Function to calculate platform fee amount
export const calculatePlatformFee = (amount: number): number => {
  return Math.round((amount * PLATFORM_FEE_PERCENTAGE) / 100);
};

// Function to calculate tax amount
export const calculateTax = (amount: number): number => {
  return Math.round((amount * TAX_PERCENTAGE) / 100);
};

// Function to calculate Stripe fee
export const calculateStripeFee = (amount: number): number => {
  // Convert amount to cents for calculation
  const amountInCents = Math.round(amount * 100);
  const stripeFeeInCents = Math.round((amountInCents * STRIPE_FEE_PERCENTAGE) / 100) + STRIPE_FIXED_FEE;
  // Convert back to dollars
  return stripeFeeInCents / 100;
};

// Function to calculate provider amount
export const calculateProviderAmount = (amount: number): number => {
  const platformFee = calculatePlatformFee(amount);
  const tax = calculateTax(amount);
  // Provider doesn't pay the Stripe fee directly
  return amount - platformFee - tax;
};

// Function to calculate refund amount based on cancellation time
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

// Function to verify Stripe webhook signatures
export const verifyWebhookSignature = (
  body: string | Buffer,
  signature: string
): Stripe.Event => {
  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
};

export default stripe;
