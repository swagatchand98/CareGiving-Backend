import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as paymentService from '../services/paymentService';
import { Payment } from '../models/paymentModel';
import stripe, { calculateRefundAmount } from '../config/stripe';
import { Booking, Wallet } from '../models/db';

/**
 * Create a payment intent for a booking
 * @route POST /api/payments/create-intent
 */
export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user?.id;

    if (!bookingId) {
      return res.status(400).json({
        status: 'error',
        message: 'Booking ID is required'
      });
    }

    // Get booking details
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Verify that the user is the one who made the booking
    if (booking.userId.toString() !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to make a payment for this booking'
      });
    }

    // Create payment intent
    const { clientSecret, paymentId } = await paymentService.createPaymentIntent(
      bookingId,
      userId as string,
      booking.providerId.toString(),
      booking.totalPrice
    );

    return res.status(200).json({
      status: 'success',
      data: {
        clientSecret,
        paymentId
      }
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Confirm a payment
 * @route POST /api/payments/confirm
 */
export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment intent ID is required'
      });
    }

    // Confirm payment
    const payment = await paymentService.confirmPayment(paymentIntentId);

    // Update booking status to confirmed (from either 'pending' or 'reserved')
    const booking = await Booking.findByIdAndUpdate(
      payment.bookingId, 
      { status: 'confirmed' },
      { new: true }
    );

    if (!booking) {
      throw new Error('Booking not found');
    }
    
    // Also mark the segment as booked
    const TimeSlotSegment = mongoose.model('TimeSlotSegment');
    const timeSlotSegment = await TimeSlotSegment.findOne({
      bookingId: booking._id
    });
    
    if (timeSlotSegment) {
      console.log(`API: Found segment ${timeSlotSegment._id} for booking ${booking._id}, marking as booked`);
      timeSlotSegment.isBooked = true;
      timeSlotSegment.isReserved = false; // Clear the reserved flag
      await timeSlotSegment.save();
      
      // Also update the parent time slot if all segments are booked
      const allSegments = await TimeSlotSegment.find({ timeSlotId: timeSlotSegment.timeSlotId });
      const allBooked = allSegments.every(seg => seg.isBooked);
      if (allBooked) {
        await mongoose.model('TimeSlot').findByIdAndUpdate(timeSlotSegment.timeSlotId, { 
          isBooked: true,
          isReserved: false // Clear the reserved flag on the parent time slot
        });
        console.log(`API: All segments booked, marking time slot ${timeSlotSegment.timeSlotId} as booked`);
      } else {
        // If not all segments are booked, check if the time slot should still be marked as reserved
        const anyReserved = allSegments.some(seg => seg.isReserved);
        if (!anyReserved) {
          // If no segments are reserved, clear the reserved flag on the parent time slot
          await mongoose.model('TimeSlot').findByIdAndUpdate(timeSlotSegment.timeSlotId, { 
            isReserved: false 
          });
          console.log(`API: No segments reserved, clearing reserved flag on time slot ${timeSlotSegment.timeSlotId}`);
        }
      }
      
      console.log(`API: Segment ${timeSlotSegment._id} marked as booked for booking ${booking._id}`);
    } else {
      console.error(`API: No segment found for booking ${booking._id}`);
    }

    // Transfer provider amount to provider's wallet
    const providerId = payment.providerId.toString();
    const providerAmount = payment.providerAmount;
    
    // Find or create provider wallet
    let providerWallet = await Wallet.findOne({ userId: providerId });
    
    if (!providerWallet) {
      providerWallet = await Wallet.create({
        userId: providerId,
        balance: 0,
        transactions: []
      });
    }

    // Add transaction to provider wallet
    providerWallet.transactions.push({
      amount: providerAmount,
      type: 'credit',
      description: `Payment for booking #${payment.bookingId}`,
      relatedEntityId: payment.bookingId,
      createdAt: new Date()
    });

    // Update provider wallet balance
    providerWallet.balance += providerAmount;
    await providerWallet.save();

    return res.status(200).json({
      status: 'success',
      data: {
        payment,
        booking,
        providerWallet: {
          balance: providerWallet.balance,
          lastTransaction: providerWallet.transactions[providerWallet.transactions.length - 1]
        }
      }
    });
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Process a refund for a booking
 * @route POST /api/payments/refund
 */
export const processRefund = async (req: Request, res: Response) => {
  try {
    const { bookingId, reason } = req.body;
    const userId = req.user?.id;

    if (!bookingId) {
      return res.status(400).json({
        status: 'error',
        message: 'Booking ID is required'
      });
    }

    // Get booking details
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Check if the user is authorized to request a refund
    const isAdmin = req.user?.role === 'admin';
    const isBookingUser = booking.userId.toString() === userId;
    const isProvider = booking.providerId.toString() === userId;

    if (!isAdmin && !isBookingUser && !isProvider) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to process a refund for this booking'
      });
    }

    // Get the original payment
    const originalPayment = await Payment.findOne({
      bookingId,
      type: 'booking',
      status: 'completed'
    });

    if (!originalPayment) {
      return res.status(404).json({
        status: 'error',
        message: 'No completed payment found for this booking'
      });
    }

    // Calculate refund amount based on cancellation time
    const now = new Date();
    const bookingTime = new Date(booking.dateTime);
    let refundAmount = 0;

    // If booking is in the future, calculate refund based on policy
    if (bookingTime > now) {
      refundAmount = calculateRefundAmount(
        originalPayment.amount,
        bookingTime,
        now
      );
    } else {
      // If booking is in the past, only admin can issue refund
      if (!isAdmin) {
        return res.status(403).json({
          status: 'error',
          message: 'Only administrators can issue refunds for past bookings'
        });
      }
      // Admin can refund the full amount
      refundAmount = originalPayment.amount;
    }

    if (refundAmount === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No refund is available based on the cancellation policy'
      });
    }

    // Process refund
    const refundPayment = await paymentService.processRefund(
      bookingId,
      refundAmount,
      reason || 'Booking cancelled'
    );

    // Update booking status to cancelled
    await Booking.findByIdAndUpdate(bookingId, {
      status: 'cancelled'
    });

    // Calculate provider refund amount
    const refundRatio = refundAmount / originalPayment.amount;
    const providerRefundAmount = Math.round(originalPayment.providerAmount * refundRatio);

    // Update provider wallet if there's a provider refund amount
    if (providerRefundAmount > 0) {
      const providerId = originalPayment.providerId.toString();
      
      // Find provider wallet
      const providerWallet = await Wallet.findOne({ userId: providerId });
      
      if (providerWallet) {
        // Add refund transaction to provider wallet
        providerWallet.transactions.push({
          amount: -providerRefundAmount, // Negative amount for refund
          type: 'debit',
          description: `Refund for booking #${bookingId}`,
          relatedEntityId: bookingId,
          createdAt: new Date()
        });

        // Update provider wallet balance
        providerWallet.balance -= providerRefundAmount;
        await providerWallet.save();
        
        console.log(`Provider wallet updated for refund of booking ${bookingId}, deducted ${providerRefundAmount}`);
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        refund: refundPayment,
        refundAmount,
        providerRefundAmount
      }
    });
  } catch (error: any) {
    console.error('Error processing refund:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Get payment history for the current user
 * @route GET /api/payments/history
 */
export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (role === 'provider') {
      // Get provider payment history
      const payments = await paymentService.getProviderPaymentHistory(userId as string);
      
      return res.status(200).json({
        status: 'success',
        results: payments.length,
        data: {
          payments
        }
      });
    } else {
      // Get user payment history
      const payments = await paymentService.getUserPaymentHistory(userId as string);
      
      return res.status(200).json({
        status: 'success',
        results: payments.length,
        data: {
          payments
        }
      });
    }
  } catch (error: any) {
    console.error('Error getting payment history:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Get payment details for a booking
 * @route GET /api/payments/booking/:bookingId
 */
export const getBookingPaymentDetails = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id;

    // Get booking details
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Check if the user is authorized to view payment details
    const isAdmin = req.user?.role === 'admin';
    const isBookingUser = booking.userId.toString() === userId;
    const isProvider = booking.providerId.toString() === userId;

    if (!isAdmin && !isBookingUser && !isProvider) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to view payment details for this booking'
      });
    }

    // Get payment details
    const payments = await paymentService.getBookingPaymentDetails(bookingId);

    return res.status(200).json({
      status: 'success',
      results: payments.length,
      data: {
        payments
      }
    });
  } catch (error: any) {
    console.error('Error getting booking payment details:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Process Stripe webhook events
 * @route POST /api/payments/webhook
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;

  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        // Payment was successful
        const paymentIntent = event.data.object;
        const payment = await paymentService.confirmPayment(paymentIntent.id);
        
        // Update booking status to confirmed (from either 'pending' or 'reserved')
        const booking = await Booking.findByIdAndUpdate(
          payment.bookingId, 
          { status: 'confirmed' },
          { new: true }
        );

        if (booking) {
          // Mark the segment as fully booked now that payment is confirmed
          console.log(`Looking for segment with bookingId: ${booking._id}`);
          const TimeSlotSegment = mongoose.model('TimeSlotSegment');
          
          // Convert booking._id to string to ensure proper comparison
          const bookingIdStr = booking._id ? booking._id.toString() : '';
          console.log(`Converted booking ID to string: ${bookingIdStr}`);
          
          // First try to find by direct match
          let timeSlotSegment = await TimeSlotSegment.findOne({
            bookingId: booking._id
          });
          
          if (timeSlotSegment) {
            console.log(`Found segment ${timeSlotSegment._id} for booking ${booking._id}, marking as booked`);
            timeSlotSegment.isBooked = true;
            timeSlotSegment.isReserved = false; // Clear the reserved flag
            await timeSlotSegment.save();
            
            // Also update the parent time slot if all segments are booked
            const allSegments = await TimeSlotSegment.find({ timeSlotId: timeSlotSegment.timeSlotId });
            const allBooked = allSegments.every(seg => seg.isBooked);
            if (allBooked) {
              await mongoose.model('TimeSlot').findByIdAndUpdate(timeSlotSegment.timeSlotId, { 
                isBooked: true,
                isReserved: false // Clear the reserved flag on the parent time slot
              });
              console.log(`All segments booked, marking time slot ${timeSlotSegment.timeSlotId} as booked`);
            } else {
              // If not all segments are booked, check if the time slot should still be marked as reserved
              const anyReserved = allSegments.some(seg => seg.isReserved);
              if (!anyReserved) {
                // If no segments are reserved, clear the reserved flag on the parent time slot
                await mongoose.model('TimeSlot').findByIdAndUpdate(timeSlotSegment.timeSlotId, { 
                  isReserved: false 
                });
                console.log(`No segments reserved, clearing reserved flag on time slot ${timeSlotSegment.timeSlotId}`);
              }
            }
            
            console.log(`Segment ${timeSlotSegment._id} marked as booked for booking ${booking._id}`);
          } else {
            console.error(`No segment found for booking ${booking._id} by direct query`);
            
            // Try to find the segment by querying all segments
            const allSegments = await TimeSlotSegment.find({});
            console.log(`Found ${allSegments.length} total segments`);
            
            // Look for segments with this booking ID as a string
            const matchingSegments = allSegments.filter(seg => {
              if (!seg.bookingId) return false;
              const segBookingIdStr = seg.bookingId.toString();
              const isMatch = segBookingIdStr === bookingIdStr;
              console.log(`Comparing segment bookingId ${segBookingIdStr} with ${bookingIdStr}: ${isMatch}`);
              return isMatch;
            });
            
            if (matchingSegments.length > 0) {
              console.log(`Found ${matchingSegments.length} matching segments by string comparison`);
              const segment = matchingSegments[0];
              segment.isBooked = true;
              segment.isReserved = false;
              await segment.save();
              console.log(`Marked segment ${segment._id} as booked`);
            } else {
              console.error(`Could not find any segments for booking ${booking._id}`);
              
              // Last resort: try to find by booking ID in the Transaction collection
              const transaction = await mongoose.model('Transaction').findOne({ bookingId: booking._id });
              if (transaction) {
                console.log(`Found transaction for booking ${booking._id}`);
                
                // Get the booking to find the time slot
                const bookingDetails = await mongoose.model('Booking').findById(booking._id);
                if (bookingDetails) {
                  console.log(`Found booking details for ${booking._id}`);
                  
                  // Find all segments for the service's time slots
                  const timeSlots = await mongoose.model('TimeSlot').find({ 
                    serviceId: bookingDetails.serviceId,
                    providerId: bookingDetails.providerId
                  });
                  
                  if (timeSlots.length > 0) {
                    console.log(`Found ${timeSlots.length} time slots for the service`);
                    
                    // Get all segments for these time slots
                    const timeSlotIds = timeSlots.map(ts => ts._id);
                    const serviceSegments = await TimeSlotSegment.find({
                      timeSlotId: { $in: timeSlotIds }
                    });
                    
                    console.log(`Found ${serviceSegments.length} segments for the service's time slots`);
                    
                    // Find a segment that matches the booking time
                    const bookingDateTime = new Date(bookingDetails.dateTime);
                    const bookingHours = bookingDateTime.getHours();
                    const bookingMinutes = bookingDateTime.getMinutes();
                    const bookingTimeStr = `${bookingHours.toString().padStart(2, '0')}:${bookingMinutes.toString().padStart(2, '0')}`;
                    
                    console.log(`Looking for segment with start time around ${bookingTimeStr}`);
                    
                    // Find segments with matching start time
                    const timeMatchingSegments = serviceSegments.filter(seg => 
                      seg.startTime === bookingTimeStr || 
                      Math.abs(parseInt(seg.startTime.split(':')[0]) - bookingHours) <= 1
                    );
                    
                    if (timeMatchingSegments.length > 0) {
                      console.log(`Found ${timeMatchingSegments.length} segments with matching time`);
                      const segment = timeMatchingSegments[0];
                      segment.isBooked = true;
                      segment.isReserved = false;
                      segment.bookingId = booking._id;
                      await segment.save();
                      console.log(`Marked segment ${segment._id} as booked based on time match`);
                    } else {
                      console.error(`Could not find any segments with matching time`);
                    }
                  }
                }
              }
            }
          }
          
          // Transfer provider amount to provider's wallet
          const providerId = payment.providerId.toString();
          const providerAmount = payment.providerAmount;
          
          // Find or create provider wallet
          let providerWallet = await Wallet.findOne({ userId: providerId });
          
          if (!providerWallet) {
            providerWallet = await Wallet.create({
              userId: providerId,
              balance: 0,
              transactions: []
            });
          }

          // Add transaction to provider wallet
          providerWallet.transactions.push({
            amount: providerAmount,
            type: 'credit',
            description: `Payment for booking #${payment.bookingId}`,
            relatedEntityId: payment.bookingId,
            createdAt: new Date()
          });

          // Update provider wallet balance
          providerWallet.balance += providerAmount;
          await providerWallet.save();
          
          console.log(`Provider wallet updated for booking ${payment.bookingId}, added ${providerAmount}`);
        }
        break;

      case 'payment_intent.payment_failed':
        // Payment failed
        console.log('Payment failed:', event.data.object);
        
        // Get the payment intent
        const failedPaymentIntent = event.data.object;
        
        // Find the booking associated with this payment intent
        const failedPayment = await Payment.findOne({
          stripePaymentIntentId: failedPaymentIntent.id
        });
        
        if (failedPayment && failedPayment.bookingId) {
          // Find the segment that was reserved for this booking
          const reservedSegment = await mongoose.model('TimeSlotSegment').findOne({
            bookingId: failedPayment.bookingId
          });
          
          if (reservedSegment) {
            // Mark the segment as available again
            reservedSegment.isReserved = false;
            reservedSegment.bookingId = undefined;
            await reservedSegment.save();
            console.log(`Segment ${reservedSegment._id} marked as available again after payment failure`);
            
            // Check if any segments for this time slot are still reserved
            const timeSlotId = reservedSegment.timeSlotId;
            const allSegments = await mongoose.model('TimeSlotSegment').find({ timeSlotId });
            const anyReserved = allSegments.some(seg => seg.isReserved);
            
            if (!anyReserved) {
              // If no segments are reserved, clear the reserved flag on the parent time slot
              await mongoose.model('TimeSlot').findByIdAndUpdate(timeSlotId, { 
                isReserved: false 
              });
              console.log(`No segments reserved, clearing reserved flag on time slot ${timeSlotId}`);
            }
          }
          
          // Update booking status to cancelled
          await Booking.findByIdAndUpdate(
            failedPayment.bookingId,
            { status: 'cancelled' }
          );
          
          console.log(`Booking ${failedPayment.bookingId} cancelled due to payment failure`);
        }
        break;

      case 'charge.refunded':
        // Refund was processed
        console.log('Refund processed:', event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Error handling Stripe webhook:', error);
    return res.status(400).json({
      status: 'error',
      message: error.message || 'Webhook error'
    });
  }
};

/**
 * Manually trigger provider payouts (admin only)
 * @route POST /api/payments/process-payouts
 */
export const triggerProviderPayouts = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Only administrators can trigger provider payouts'
      });
    }

    // Process payouts
    await paymentService.processProviderPayouts();

    return res.status(200).json({
      status: 'success',
      message: 'Provider payouts processed successfully'
    });
  } catch (error: any) {
    console.error('Error triggering provider payouts:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};
