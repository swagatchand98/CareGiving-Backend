import mongoose from "mongoose";
import { Booking, Service, Transaction, User } from "../models/db";

/**
 * Create a new booking
 */
export const createBooking = async (bookingData: {
  serviceId: string;
  userId: string;
  dateTime: Date;
  duration: number;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  specialInstructions?: string;
}) => {
  const {
    serviceId,
    userId,
    dateTime,
    duration,
    address,
    specialInstructions,
  } = bookingData;

  // Get service details
  const service = await Service.findById(serviceId);
  if (!service) {
    throw new Error("Service not found");
  }

  // Get provider ID from service
  const providerId = service.providerId;

  // Calculate total price based on service price and duration
  let totalPrice = 0;
  if (service.price.type === "fixed") {
    totalPrice = service.price.amount;
  } else if (service.price.type === "hourly") {
    // Convert duration from minutes to hours and multiply by hourly rate
    totalPrice = service.price.amount * (duration / 60);
  }

  // Create booking
  const booking = await Booking.create({
    serviceId,
    userId,
    providerId,
    dateTime,
    duration,
    status: "pending",
    address,
    specialInstructions,
    totalPrice,
  });

  // Create a pending transaction record
  await Transaction.create({
    bookingId: booking._id,
    userId,
    providerId,
    amount: totalPrice,
    platformCommission: totalPrice * 0.1, // Assuming 10% platform commission
    paymentMethod: "stripe", // Default payment method
    status: "pending",
  });

  return booking;
};

/**
 * Get booking by ID with populated fields
 */
export const getBookingById = async (bookingId: string) => {
  return Booking.findById(bookingId)
    .populate({
      path: "serviceId",
      select: "title description price images",
    })
    .populate({
      path: "userId",
      select: "firstName lastName email profilePicture phoneNumber",
    })
    .populate({
      path: "providerId",
      select: "firstName lastName email profilePicture phoneNumber",
    });
};

/**
 * Get transaction by booking ID
 */
export const getTransactionByBookingId = async (bookingId: string) => {
  return Transaction.findOne({ bookingId });
};

/**
 * Get bookings for a user with pagination and filtering
 */
export const getUserBookings = async (
  userId: string,
  options: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }
) => {
  const { page = 1, limit = 10, status, startDate, endDate } = options;
  const skip = (page - 1) * limit;

  const query: any = { userId };

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    query.dateTime = {};
    if (startDate) query.dateTime.$gte = startDate;
    if (endDate) query.dateTime.$lte = endDate;
  }

  const bookings = await Booking.find(query)
    .populate({
      path: "serviceId",
      select: "title description price images",
    })
    .populate({
      path: "providerId",
      select: "firstName lastName profilePicture",
    })
    .skip(skip)
    .limit(limit)
    .sort({ dateTime: -1 });

  const total = await Booking.countDocuments(query);

  return {
    bookings,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get bookings for a provider with pagination and filtering
 */
export const getProviderBookings = async (
  providerId: string,
  options: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }
) => {
  const { page = 1, limit = 10, status, startDate, endDate } = options;
  const skip = (page - 1) * limit;

  const query: any = { providerId };

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    query.dateTime = {};
    if (startDate) query.dateTime.$gte = startDate;
    if (endDate) query.dateTime.$lte = endDate;
  }

  const bookings = await Booking.find(query)
    .populate({
      path: "serviceId",
      select: "title description price",
    })
    .populate({
      path: "userId",
      select: "firstName lastName profilePicture phoneNumber",
    })
    .skip(skip)
    .limit(limit)
    .sort({ dateTime: -1 });

  const total = await Booking.countDocuments(query);

  return {
    bookings,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Update booking status
 */
export const updateBookingStatus = async (
  bookingId: string,
  status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled"
) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new Error("Booking not found");
  }

  booking.status = status;
  await booking.save();

  // Update transaction status if booking is completed or cancelled
  if (status === "completed") {
    await Transaction.findOneAndUpdate({ bookingId }, { status: "completed" });
  } else if (status === "cancelled") {
    await Transaction.findOneAndUpdate({ bookingId }, { status: "cancelled" });
  }

  return Booking.findById(bookingId)
    .populate({
      path: "serviceId",
      select: "title description price",
    })
    .populate({
      path: "userId",
      select: "firstName lastName email",
    })
    .populate({
      path: "providerId",
      select: "firstName lastName email",
    });
};

/**
 * Cancel booking
 */
export const cancelBooking = async (bookingId: string) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new Error("Booking not found");
  }

  // Check if booking can be cancelled
  if (["in-progress", "completed"].includes(booking.status)) {
    throw new Error("Cannot cancel a booking that is in progress or completed");
  }

  // Update booking status to cancelled
  booking.status = "cancelled";
  await booking.save();

  // Update transaction status
  await Transaction.findOneAndUpdate({ bookingId }, { status: "cancelled" });

  return { message: "Booking cancelled successfully" };
};

/**
 * Get all bookings with pagination and filtering (for admin)
 */
export const getAllBookings = async (options: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
  providerId?: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  const {
    page = 1,
    limit = 10,
    status,
    userId,
    providerId,
    startDate,
    endDate,
  } = options;
  const skip = (page - 1) * limit;

  const query: any = {};

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by user
  if (userId) {
    query.userId = new mongoose.Types.ObjectId(userId);
  }

  // Filter by provider
  if (providerId) {
    query.providerId = new mongoose.Types.ObjectId(providerId);
  }

  // Filter by date range
  if (startDate || endDate) {
    query.dateTime = {};
    if (startDate) query.dateTime.$gte = startDate;
    if (endDate) query.dateTime.$lte = endDate;
  }

  const bookings = await Booking.find(query)
    .populate({
      path: "serviceId",
      model: "Service",
      select: "title price",
    })
    .populate({
      path: "userId",
      model: "User",
      select: "firstName lastName email",
    })
    .populate({
      path: "providerId",
      model: "User",
      select: "firstName lastName email",
    })
    .skip(skip)
    .limit(limit)
    .sort({ dateTime: -1 });

  const total = await Booking.countDocuments(query);

  return {
    bookings,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};
