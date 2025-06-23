import mongoose, { Schema, Document, Types } from 'mongoose';

// TimeSlotSegment Interface
export interface ITimeSlotSegment extends Document {
  timeSlotId: Types.ObjectId;
  segmentIndex: number;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  isReserved: boolean;
  bookingId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// TimeSlotSegment Schema
const TimeSlotSegmentSchema: Schema = new Schema<ITimeSlotSegment>({
  timeSlotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimeSlot',
    required: true
  },
  segmentIndex: {
    type: Number,
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

// Create compound index for unique segments
TimeSlotSegmentSchema.index({ timeSlotId: 1, segmentIndex: 1 }, { unique: true });

// Create Model
const TimeSlotSegment = mongoose.model<ITimeSlotSegment>('TimeSlotSegment', TimeSlotSegmentSchema);

export default TimeSlotSegment;
