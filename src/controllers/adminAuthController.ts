import { Request, Response, NextFunction } from 'express';
import { User } from '../models/db';
import { auth } from '../config/firebase-admin';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import admin from 'firebase-admin';

const JWT_SECRET = process.env.JWT_SECRET || 'admin-jwt-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Admin token blacklist for logout functionality
const tokenBlacklist = new Set<string>();

/**
 * @route   POST /api/admin/auth/login
 */
export const 
adminLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Admin login request received:', req.body);
    const { email, password, firebaseUid } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    try {
      const user = await User.findOne({ email });
      console.log('User found:', user ? 'Yes' : 'No');

      if (!user || user.role !== 'admin') {
        return res.status(401).json({ message: 'Invalid credentials or not authorized as admin' });
      }

      // Verify Firebase UID
      if (firebaseUid && user.firebaseUid !== firebaseUid) {
        console.warn(`Firebase UID mismatch: ${firebaseUid} vs ${user.firebaseUid}`);
      }

      // JWT token with user information
      const token = jwt.sign(
        { 
          id: user._id,
          firebaseUid: user.firebaseUid,
          email: user.email,
          role: user.role,
          tokenType: 'admin'
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // HTTP-only cookie with the token
      res.cookie('adminToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 
      });

      console.log('Login successful, returning token');
      
      return res.json({
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        token
      });
    } catch (error: any) {
      console.error('Admin login error:', error);
      return res.status(401).json({ message: 'Authentication failed' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/admin/auth/logout
 */
export const adminLogout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // Add token to blacklist
      tokenBlacklist.add(token);
      
      res.clearCookie('adminToken');
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/admin/auth/me
 */
export const getCurrentAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }

    res.json({
      _id: (req as any).user._id,
      email: (req as any).user.email,
      firstName: (req as any).user.firstName,
      lastName: (req as any).user.lastName,
      role: (req as any).user.role
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/admin/auth/verify-token
 */
export const verifyAdminToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    try {
      // Check if token is blacklisted
      // if (tokenBlacklist.has(token)) {
      //   return res.status(401).json({ message: 'Token has been invalidated' });
      // }

      const decodedToken = await admin.auth().verifyIdToken(token);
      if (!decodedToken) {
        return res.status(401).json({ message: 'Invalid Firebase token' });
      }
      
      // For Firebase tokens, new JWT token without verification
      if (req.body.tokenType === 'firebase') {
        console.log('Creating new JWT token for Firebase user');
        const email = req.body.email;
        
        if (!email) {
          return res.status(400).json({ message: 'Email is required for token exchange' });
        }
        
        const user = await User.findOne({ email }).select('-password');
        
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ message: 'Not authorized as admin' });
        }
        
        // new JWT token for the admin
        const jwtToken = jwt.sign(
          { 
            id: user._id,
            firebaseUid: user.firebaseUid,
            email: user.email,
            role: user.role,
            tokenType: 'admin'
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        return res.json({ valid: true, user, token: jwtToken });
      }
      
      console.log('Verifying JWT token');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (decoded.role !== 'admin' || decoded.tokenType !== 'admin') {
        return res.status(403).json({ message: 'Not authorized as admin' });
      }

      const user = await User.findById(decoded.id).select('-password');

      if (!user || user.role !== 'admin') {
        return res.status(404).json({ message: 'User not found or not an admin' });
      }

      return res.json({ valid: true, user });
    } catch (error: any) {
      console.error('Token verification error:', error);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      
      return res.status(401).json({ message: 'Invalid token' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Simple in-memory rate limiter for login attempts
 * Limits login attempts to 5 per 15 minutes from the same IP
 */
const loginAttempts = new Map<string, { count: number, resetTime: number }>();

export const loginRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  // Get current attempts for this IP
  const attempts = loginAttempts.get(ip) || { count: 0, resetTime: now + windowMs };

  if (attempts.resetTime < now) {
    attempts.count = 0;
    attempts.resetTime = now + windowMs;
  }

  // Check if max attempts reached
  if (attempts.count >= maxAttempts) {
    res.status(429).json({ 
      message: 'Too many login attempts, please try again after 15 minutes',
      retryAfter: Math.ceil((attempts.resetTime - now) / 1000 / 60) // minutes
    });
    return;
  }

  // Increment attempts
  attempts.count++;
  loginAttempts.set(ip, attempts);

  // Clean up old entries periodically
  if (loginAttempts.size > 100) {
    const oldEntries = [...loginAttempts.entries()]
      .filter(([_, data]) => data.resetTime < now);
    
    for (const [key] of oldEntries) {
      loginAttempts.delete(key);
    }
  }

  next();
};

/**
 * Admin authentication middleware
 * Verifies the JWT token and checks if the user is an admin
 */
export const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('🟡 Token received:', token);
    } else if (req.cookies && req.cookies.adminToken) {
      token = req.cookies.adminToken;
      console.log('🟠 Token from cookie:', token);
    }

    if (!token) {
      console.log('❌ No token provided');
      res.status(401).json({ message: 'Not authorized, no token provided' });
      return;
    }

    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      console.log('⛔ Token is blacklisted');
      res.status(401).json({ message: 'Token has been invalidated, please login again' });
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log('✅ Decoded token:', decoded);

      if (decoded.role !== 'admin' || decoded.tokenType !== 'admin') {
        console.log('❌ Token role or type is invalid:', decoded.role, decoded.tokenType);
        res.status(403).json({ message: 'Not authorized as admin' });
        return;
      }

      const user = await User.findById(decoded.id).select('-password');
      console.log('👤 User found:', user);

      if (!user || user.role !== 'admin') {
        console.log('❌ User not found or not admin');
        res.status(404).json({ message: 'User not found or not an admin' });
        return;
      }

      (req as any).user = user;

      console.log('✅ Admin authenticated');
      next();
    } catch (error: any) {
      console.error('❗ Admin auth middleware error:', error);

      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ message: 'Token expired, please login again' });
        return;
      }

      res.status(401).json({ message: 'Not authorized, invalid token' });
      return;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/admin/auth/create-admin
 */
export const createAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    try {
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create user in Firebase
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`,
        emailVerified: true
      });

      // Set custom claims for admin role
      await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });

      // Create user in our database
      const user = await User.create({
        firebaseUid: userRecord.uid,
        email,
        firstName,
        lastName,
        role: 'admin',
        verificationStatus: 'verified'
      });

      res.status(201).json({
        message: 'Admin user created successfully',
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error: any) {
      console.error('Create admin error:', error);
      
      if (error.code === 'auth/email-already-exists') {
        return res.status(400).json({ message: 'Email already exists in Firebase' });
      }
      
      return res.status(500).json({ message: 'Failed to create admin user' });
    }
  } catch (error) {
    next(error);
  }
};

// Clean up expired tokens from blacklist periodically
setInterval(() => {
  // in production, use Redis or a database for token blacklisting
  console.log(`Cleaning up token blacklist. Current size: ${tokenBlacklist.size}`);
}, 24 * 60 * 60 * 1000); // Run once a day
