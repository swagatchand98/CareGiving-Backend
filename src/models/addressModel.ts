import mongoose, { Schema, Document } from 'mongoose';

export interface IAddress extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'home' | 'work' | 'other';
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
  landmark?: string;
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema: Schema = new Schema<IAddress>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  street: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  zipCode: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true,
    default: 'India'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  landmark: {
    type: String,
    trim: true
  },
  instructions: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

export const Address = mongoose.model<IAddress>('Address', AddressSchema);

// Ensure only one default address per user
AddressSchema.pre('save', async function(next) {
  if (this.isDefault) {
    // Find all other addresses for this user and set isDefault to false
    await Address.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});
