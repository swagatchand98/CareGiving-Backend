import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'booking' | 'message' | 'review' | 'system';
  content: string;
  isRead: boolean;
  relatedEntityId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
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
    isRead: {
      type: Boolean,
      default: false
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      refPath: 'type',
      required: false
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries on unread notifications
notificationSchema.index({ userId: 1, isRead: 1 });

// Index for faster queries on notification type
notificationSchema.index({ userId: 1, type: 1 });

export default notificationSchema;
