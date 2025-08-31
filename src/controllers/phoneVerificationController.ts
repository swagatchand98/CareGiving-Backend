import { Request, Response, NextFunction } from 'express';
import { User } from '../models/db';
import { IUser } from '../models/userModel';
import * as crypto from 'crypto';

// Simple in-memory OTP store (for development only)
// In production, use a proper database or Redis with expiration
interface OTPRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
}

const otpStore: Record<string, OTPRecord> = {};

// Generate a random 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Send OTP to user's phone number
// @route   POST /api/auth/send-otp
export const sendOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Generate a new OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (10 minutes)
    const expiresAt = Date.now() + 10 * 60 * 1000;
    otpStore[phoneNumber] = {
      otp,
      expiresAt,
      attempts: 0
    };

    // In a real implementation, you would send the OTP via SMS using a service like Twilio
    // For development, we'll just log it
    console.log(`OTP for ${phoneNumber}: ${otp}`);

    // Update user's phone number if it's different
    if (req.user.phoneNumber !== phoneNumber) {
      await User.findByIdAndUpdate(req.user._id, { phoneNumber });
    }

    return res.json({
      success: true,
      message: 'OTP sent successfully',
      // Include the OTP in development mode only
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and mark phone as verified
// @route   POST /api/auth/verify-otp
export const verifyOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    // Check if OTP exists and is valid
    const otpRecord = otpStore[phoneNumber];
    
    if (!otpRecord) {
      return res.status(400).json({ 
        success: false,
        message: 'No OTP found for this phone number. Please request a new OTP.' 
      });
    }

    // Check if OTP is expired
    if (Date.now() > otpRecord.expiresAt) {
      delete otpStore[phoneNumber];
      return res.status(400).json({ 
        success: false,
        message: 'OTP has expired. Please request a new OTP.' 
      });
    }

    // Increment attempts
    otpRecord.attempts += 1;

    // Check if max attempts reached (5 attempts)
    if (otpRecord.attempts > 5) {
      delete otpStore[phoneNumber];
      return res.status(400).json({ 
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.' 
      });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid OTP. Please try again.' 
      });
    }

    // OTP is valid, mark phone as verified
    await User.findByIdAndUpdate(req.user._id, { 
      phoneNumber,
      phoneVerified: true
    } as Partial<IUser>);

    // Remove OTP from store
    delete otpStore[phoneNumber];

    return res.json({
      success: true,
      message: 'Phone number verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if user's phone is verified
// @route   GET /api/auth/phone-verification-status
export const getPhoneVerificationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Fetch the latest user data to ensure we have the most up-to-date phoneVerified status
    const user = await User.findById(req.user._id).lean();
    
    return res.json({
      isVerified: user ? (user as any).phoneVerified || false : false,
      phoneNumber: user?.phoneNumber || null
    });
  } catch (error) {
    next(error);
  }
};
