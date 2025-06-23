import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// User Interfaces
interface IAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'provider' | 'admin';
  profilePicture?: string | null;
  phoneNumber?: string | null;
  address?: IAddress;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// Provider Profile Interfaces
interface IServiceArea {
  city: string;
  state: string;
}

interface ITimeSlot {
  start: string;
  end: string;
}

interface IAvailability {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  timeSlots: ITimeSlot[];
}

interface IProviderProfile extends Document {
  userId: mongoose.Types.ObjectId;
  serviceCategories: mongoose.Types.ObjectId[];
  bio?: string;
  certifications: string[];
  yearsOfExperience?: number;
  hourlyRate: number;
  serviceAreas: IServiceArea[];
  availability: IAvailability[];
  backgroundCheckVerified: boolean;
  languagesSpoken: string[];
  documents?: string[];
}

// Service Category Interface
interface IServiceCategory extends Document {
  name: string;
  parentCategory?: mongoose.Types.ObjectId | null;
  description?: string;
  iconUrl?: string | null;
  tasks?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Price Interface
interface IPrice {
  amount: number;
  type: 'hourly' | 'fixed';
}

// Media File Interface
interface IMediaFile {
  url: string;
  type: 'image' | 'video' | 'document';
  name?: string;
}

// Additional Details Interface
interface IAdditionalDetails {
  specialRequirements?: string;
  includedServices?: string[];
}

// Service Interface
interface IService extends Document {
  providerId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  images?: string[];  // Legacy field for backward compatibility
  mediaFiles?: IMediaFile[];  // New field for better media type handling
  price: IPrice;
  duration?: number;
  additionalDetails?: IAdditionalDetails;
  createdAt: Date;
  updatedAt: Date;
}

// Booking Interface
interface IBookingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

interface IBooking extends Document {
  serviceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  dateTime: Date;
  duration: number;
  status: 'reserved' | 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  address: IBookingAddress;
  specialInstructions?: string;
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction Interface
interface ITransaction extends Document {
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  amount: number;
  platformCommission: number;
  paymentMethod: 'stripe' | 'paypal';
  stripeChargeId?: string;
  status: 'pending' | 'completed' | 'refunded' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

// Review Interface
interface IReview extends Document {
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Notification Interface
interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'booking' | 'message' | 'review' | 'system';
  content: string;
  relatedEntityId?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription Interface
interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  plan: 'basic' | 'premium' | 'deluxe';
  stripeSubscriptionId?: string;
  status: 'active' | 'cancelled' | 'past_due';
  startDate: Date;
  endDate?: Date;
}

// Wallet Interface
interface IWalletTransaction {
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  relatedEntityId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  balance: number;
  transactions: IWalletTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

// Wishlist Interface
interface IWishlist extends Document {
  userId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// TimeSlot Interface
interface ITimeSlot extends Document {
  providerId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  isReserved: boolean;
  bookingId?: mongoose.Types.ObjectId;
  segments?: any[]; // Add segments property
  createdAt: Date;
  updatedAt: Date;
}

// User Schema
const UserSchema: Schema = new Schema<IUser>({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'provider', 'admin'],
    default: 'user'
  },
  profilePicture: {
    type: String,
    default: null
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: null
  },
  address: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true
    }
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Provider Profile Schema
const ProviderProfileSchema: Schema = new Schema<IProviderProfile>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  serviceCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory'
  }],
  bio: {
    type: String,
    maxlength: 500
  },
  certifications: [String],
  yearsOfExperience: {
    type: Number,
    min: 0,
    max: 50
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  serviceAreas: [{
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    }
  }],
  availability: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    timeSlots: [{
      start: {
        type: String,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      },
      end: {
        type: String,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      }
    }]
  }],
  backgroundCheckVerified: {
    type: Boolean,
    default: false
  },
  languagesSpoken: [String],
  documents: {
    type: [String],
    default: []
  }
});

// Service Category Schema
const ServiceCategorySchema: Schema = new Schema<IServiceCategory>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory',
    default: null
  },
  description: {
    type: String,
    trim: true
  },
  iconUrl: {
    type: String,
    default: null
  },
  tasks: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Service Schema
const ServiceSchema: Schema = new Schema<IService>({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Add index for faster provider-specific queries
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory',
    required: true,
    index: true // Add index for faster category-specific queries
  },
  title: {
    type: String,
    required: true,
    trim: true,
    index: 'text' // Add text index for faster text search
  },
  description: {
    type: String,
    required: true,
    index: 'text' // Add text index for faster text search
  },
  images: [String], // Legacy field for backward compatibility
  mediaFiles: [{
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['image', 'video', 'document'],
      required: true
    },
    name: String
  }],
  price: {
    amount: {
      type: Number,
      required: true,
      min: 0,
      index: true // Add index for price filtering
    },
    type: {
      type: String,
      enum: ['hourly', 'fixed'],
      required: true,
      index: true // Add index for price type filtering
    }
  },
  duration: {
    type: Number,
    min: 0
  },
  additionalDetails: {
    specialRequirements: String,
    includedServices: [String]
  }
}, {
  timestamps: true
});

// Create compound indexes for common query patterns
ServiceSchema.index({ providerId: 1, categoryId: 1 }); // For queries that filter by both provider and category
ServiceSchema.index({ 'price.amount': 1, categoryId: 1 }); // For price range filtering within a category

// Booking Schema
const BookingSchema: Schema = new Schema<IBooking>({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dateTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['reserved', 'pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    }
  },
  specialInstructions: String,
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

// Transaction Schema
const TransactionSchema: Schema = new Schema<ITransaction>({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  platformCommission: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal'],
    required: true
  },
  stripeChargeId: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'refunded', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Review Schema
const ReviewSchema: Schema = new Schema<IReview>({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: String
}, {
  timestamps: true
});

// Notification Schema
const NotificationSchema: Schema = new Schema<INotification>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['booking', 'message', 'review', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  relatedEntityId: String,
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Subscription Schema
const SubscriptionSchema: Schema = new Schema<ISubscription>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ['basic', 'premium', 'deluxe'],
    required: true
  },
  stripeSubscriptionId: String,
  status: {
    type: String,
    enum: ['active', 'cancelled', 'past_due'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date
});

// Default service categories data
const defaultServiceCategories = [
  {
    name: 'Companion Care',
    description: 'For seniors or individuals who need social interaction and light assistance with daily activities.',
    tasks: [
      'Friendly companionship',
      'Assistance with mobility (walking, light stretching)',
      'Meal preparation',
      'Light housekeeping',
      'Grocery shopping & errands',
      'Medication reminders',
      'Transportation (to appointments, social outings, etc.)',
      'Emotional support'
    ]
  },
  {
    name: 'Personal Care (Non-Medical Assistance)',
    description: 'For individuals who need help with daily living tasks but do not require medical care.',
    tasks: [
      'Bathing & hygiene assistance',
      'Dressing & grooming',
      'Assistance with toileting',
      'Mobility assistance (help getting out of bed, chair, etc.)',
      'Help with eating & drinking',
      'Incontinence care',
      'Light exercises & movement support'
    ]
  },
  {
    name: 'Skilled Nursing Care (Medical Assistance)',
    description: 'For individuals who need specialized care from licensed professionals.',
    tasks: [
      'Wound care & dressing changes',
      'Administering injections & medications',
      'IV therapy & tube feeding',
      'Monitoring vital signs',
      'Post-surgery care',
      'Chronic disease management (diabetes, hypertension, etc.)'
    ]
  },
  {
    name: 'Alzheimer\'s & Dementia Care',
    description: 'For individuals with memory-related conditions who need structured care.',
    tasks: [
      'Cognitive stimulation activities',
      'Safety monitoring (prevent wandering, falls)',
      'Personal care & hygiene assistance',
      'Medication reminders & supervision',
      'Emotional & behavioral support',
      'Meal preparation & feeding assistance'
    ]
  },
  {
    name: 'Post-Hospitalization & Recovery Care',
    description: 'For patients recovering from surgery, accidents, or major illnesses.',
    tasks: [
      'Assistance with mobility & transfers',
      'Medication management',
      'Wound care & dressing changes',
      'Help with daily activities (bathing, dressing, toileting)',
      'Meal prep & nutritional support',
      'Physical therapy assistance (under supervision)'
    ]
  },
  {
    name: 'Disability & Special Needs Care',
    description: 'For individuals with physical or developmental disabilities.',
    tasks: [
      'Assistance with daily activities (bathing, dressing, feeding)',
      'Mobility support (wheelchair assistance, transfers)',
      'Therapy exercises (as prescribed by specialists)',
      'Communication support (for non-verbal individuals)',
      'Emotional & social support'
    ]
  },
  {
    name: 'Pet Care',
    description: 'For pet owners who need temporary assistance in caring for their pets.',
    tasks: [
      'Pet sitting (feeding, companionship, overnight care)',
      'Dog walking (exercise, leash management, outdoor play)',
      'Grooming (brushing, bathing, nail trimming)',
      'Administering medication (for pets with medical needs)',
      'Special needs pet care (mobility aid for elderly pets)'
    ]
  }
];

// Add static method to ServiceCategory schema to ensure default categories exist
ServiceCategorySchema.statics.ensureDefaultCategories = async function() {
  const count = await this.countDocuments();
  if (count === 0) {
    console.log('No service categories found. Creating default categories...');
    await this.insertMany(defaultServiceCategories);
    console.log(`Created ${defaultServiceCategories.length} default service categories`);
  }
};

// Wallet Schema
const WalletSchema: Schema = new Schema<IWallet>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  transactions: [{
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// TimeSlot Schema
const TimeSlotSchema: Schema = new Schema<ITimeSlot>({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  endTime: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  isBooked: {
    type: Boolean,
    default: false
  },
  isReserved: {
    type: Boolean,
    default: false
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }
}, {
  timestamps: true
});

// Create compound index for unique time slots
TimeSlotSchema.index({ providerId: 1, date: 1, startTime: 1, endTime: 1 }, { unique: true });

// Wishlist Schema
const WishlistSchema: Schema = new Schema<IWishlist>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  }
}, {
  timestamps: true
});

// Create compound index for unique wishlist items per user
WishlistSchema.index({ userId: 1, serviceId: 1 }, { unique: true });

// Import models
import ChatModel from './chatModel';
import notificationSchema from './notificationModel';
import TimeSlotSegmentModel from './timeSlotSegmentModel';
import ProviderConnectAccountModel from './providerConnectAccountModel';

// Create Models
export const User = mongoose.model<IUser>('User', UserSchema);
export const ProviderProfile = mongoose.model<IProviderProfile>('ProviderProfile', ProviderProfileSchema);
export const ServiceCategory = mongoose.model<IServiceCategory & { ensureDefaultCategories: () => Promise<void> }>('ServiceCategory', ServiceCategorySchema);
export const Service = mongoose.model<IService>('Service', ServiceSchema);
export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
export const Review = mongoose.model<IReview>('Review', ReviewSchema);
export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
export const TimeSlot = mongoose.model<ITimeSlot>('TimeSlot', TimeSlotSchema);
export const TimeSlotSegment = TimeSlotSegmentModel;
export const Wishlist = mongoose.model<IWishlist>('Wishlist', WishlistSchema);
export const Chat = ChatModel;
export const ProviderConnectAccount = ProviderConnectAccountModel;
