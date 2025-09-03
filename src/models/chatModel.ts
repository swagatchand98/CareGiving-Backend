import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  sender: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface IChat extends Document {
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema({
  sender: {
    type: String,
    required: true,
    enum: ['user', 'provider']
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
});

const ChatSchema = new Schema({
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
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
  messages: [MessageSchema]
}, {
  timestamps: true
});

// Create a compound index to ensure one chat per booking
ChatSchema.index({ bookingId: 1 }, { unique: true });

export default mongoose.model<IChat>('Chat', ChatSchema);
