import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Wallet, User, Transaction } from '../models/db';
import { createError } from '../middleware/errorHandler';

/**
 * @desc    Get user wallet
 * @route   GET /api/wallet
 * @access  Private
 */
export const getWallet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find or create wallet
    let wallet = await Wallet.findOne({ userId: req.user._id });
    
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user._id,
        balance: 0,
        transactions: []
      });
    }

    res.status(200).json({
      status: 'success',
      data: { wallet }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add funds to wallet
 * @route   POST /api/wallet/add-funds
 * @access  Private
 */
export const addFunds = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return next(createError.badRequest('Valid amount is required'));
    }

    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find or create wallet
    let wallet = await Wallet.findOne({ userId: req.user._id });
    
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user._id,
        balance: 0,
        transactions: []
      });
    }

    // Add transaction to wallet
    wallet.transactions.push({
      amount,
      type: 'credit',
      description: 'Added funds to wallet',
      createdAt: new Date()
    });

    // Update balance
    wallet.balance += amount;

    await wallet.save();

    res.status(200).json({
      status: 'success',
      data: { wallet }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Pay for booking with wallet
 * @route   POST /api/wallet/pay/:bookingId
 * @access  Private
 */
export const payWithWallet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId } = req.params;

    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find booking
    const booking = await mongoose.model('Booking').findById(bookingId);
    if (!booking) {
      return next(createError.notFound('Booking not found'));
    }

    // Check if user is authorized to pay for this booking
    if (booking.userId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('You are not authorized to pay for this booking'));
    }

    // Check if booking is already paid
    const transaction = await Transaction.findOne({ bookingId });
    if (transaction && transaction.status === 'completed') {
      return next(createError.badRequest('This booking is already paid'));
    }

    // Find wallet
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
      return next(createError.badRequest('Wallet not found. Please add funds first.'));
    }

    // Check if wallet has enough balance
    if (wallet.balance < booking.totalPrice) {
      return next(createError.badRequest('Insufficient wallet balance. Please add more funds.'));
    }

    // Update wallet
    wallet.transactions.push({
      amount: booking.totalPrice,
      type: 'debit',
      description: `Payment for booking #${bookingId}`,
      relatedEntityId: new mongoose.Types.ObjectId(bookingId),
      createdAt: new Date()
    });

    wallet.balance -= booking.totalPrice;
    await wallet.save();

    // Update transaction status
    if (transaction) {
      transaction.status = 'completed';
      await transaction.save();
    } else {
      // Create a new transaction if one doesn't exist
      await Transaction.create({
        bookingId,
        userId: req.user._id,
        providerId: booking.providerId,
        amount: booking.totalPrice,
        platformCommission: booking.totalPrice * 0.1, // Assuming 10% platform commission
        paymentMethod: 'wallet',
        status: 'completed'
      });
    }

    // Update booking status to confirmed
    booking.status = 'confirmed';
    await booking.save();

    res.status(200).json({
      status: 'success',
      data: { 
        wallet,
        booking
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get wallet transaction history
 * @route   GET /api/wallet/transactions
 * @access  Private
 */
export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find wallet
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
      return res.status(200).json({
        status: 'success',
        data: { transactions: [] }
      });
    }

    // Sort transactions by date (newest first)
    const transactions = wallet.transactions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.status(200).json({
      status: 'success',
      results: transactions.length,
      data: { transactions }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Transfer funds to provider wallet
 * @route   POST /api/wallet/transfer/:providerId
 * @access  Private (Admin only)
 */
export const transferToProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const { amount, bookingId } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return next(createError.badRequest('Valid amount is required'));
    }

    // Ensure user is authenticated and is an admin
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    if (req.user.role !== 'admin') {
      return next(createError.forbidden('Only admins can transfer funds to providers'));
    }

    // Find provider
    const provider = await User.findById(providerId);
    if (!provider || provider.role !== 'provider') {
      return next(createError.notFound('Provider not found'));
    }

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
      amount,
      type: 'credit',
      description: bookingId 
        ? `Payment for booking #${bookingId}` 
        : 'Funds transfer from platform',
      relatedEntityId: bookingId ? new mongoose.Types.ObjectId(bookingId) : undefined,
      createdAt: new Date()
    });

    // Update provider wallet balance
    providerWallet.balance += amount;
    await providerWallet.save();

    res.status(200).json({
      status: 'success',
      data: { providerWallet }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Withdraw funds from wallet
 * @route   POST /api/wallet/withdraw
 * @access  Private
 */
export const withdrawFunds = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, paymentMethod } = req.body;

    // Validate amount and payment method
    if (!amount || amount <= 0) {
      return next(createError.badRequest('Valid amount is required'));
    }

    if (!paymentMethod) {
      return next(createError.badRequest('Payment method is required'));
    }

    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find wallet
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
      return next(createError.badRequest('Wallet not found'));
    }

    // Check if wallet has enough balance
    if (wallet.balance < amount) {
      return next(createError.badRequest('Insufficient wallet balance'));
    }

    // Add transaction to wallet
    wallet.transactions.push({
      amount,
      type: 'debit',
      description: `Withdrawal to ${paymentMethod}`,
      createdAt: new Date()
    });

    // Update balance
    wallet.balance -= amount;
    await wallet.save();

    // In a real app, you would initiate a transfer to the user's payment method here

    res.status(200).json({
      status: 'success',
      data: { 
        wallet,
        message: `Withdrawal of $${amount} initiated to ${paymentMethod}`
      }
    });
  } catch (error) {
    next(error);
  }
};
