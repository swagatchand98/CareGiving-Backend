import mongoose, { Schema, Document } from 'mongoose';

// Define the payment status enum
export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

// Define the payment type enum
export enum PaymentType {
  BOOKING = 'booking',
  REFUND = 'refund',
  PAYOUT = 'payout'
}

// Interface for the Payment document
export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  amount: number;
  platformFee: number;
  providerAmount: number;
  currency: string;
  status: PaymentStatus;
  type: PaymentType;
  stripePaymentIntentId?: string;
  stripeRefundId?: string;
  stripeTransferId?: string;
  refundAmount?: number;
  refundReason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Define the Payment schema
const PaymentSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    platformFee: {
      type: Number,
      required: true,
      min: 0
    },
    providerAmount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: 'usd'
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      required: true,
      default: PaymentStatus.PENDING
    },
    type: {
      type: String,
      enum: Object.values(PaymentType),
      required: true
    },
    stripePaymentIntentId: {
      type: String
    },
    stripeRefundId: {
      type: String
    },
    stripeTransferId: {
      type: String
    },
    refundAmount: {
      type: Number,
      min: 0
    },
    refundReason: {
      type: String
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// Create and export the Payment model
export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
