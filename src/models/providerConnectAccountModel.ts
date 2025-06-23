import mongoose, { Schema, Document } from 'mongoose';

export interface IProviderConnectAccount extends Document {
  providerId: mongoose.Types.ObjectId;
  stripeConnectAccountId: string;
  payoutSchedule: 'manual' | 'daily' | 'weekly' | 'monthly';
  detailsSubmitted: boolean;
  payoutEnabled: boolean;
  chargesEnabled: boolean;
  defaultPayoutMethod?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderConnectAccountSchema: Schema = new Schema<IProviderConnectAccount>({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  stripeConnectAccountId: {
    type: String,
    required: true,
    unique: true
  },
  payoutSchedule: {
    type: String,
    enum: ['manual', 'daily', 'weekly', 'monthly'],
    default: 'manual'
  },
  detailsSubmitted: {
    type: Boolean,
    default: false
  },
  payoutEnabled: {
    type: Boolean,
    default: false
  },
  chargesEnabled: {
    type: Boolean,
    default: false
  },
  defaultPayoutMethod: {
    type: String
  }
}, {
  timestamps: true
});

const ProviderConnectAccount = mongoose.model<IProviderConnectAccount>('ProviderConnectAccount', ProviderConnectAccountSchema);

export default ProviderConnectAccount;
