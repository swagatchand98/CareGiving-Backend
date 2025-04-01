import { Request, Response, NextFunction } from 'express';
import { User } from '../models/db';
import { IUser } from '../models/db';
import { auth } from '../config/firebase-admin';
import { verifyToken } from '../controllers/authController';
import * as admin from 'firebase-admin';

// Extend Request interface to include user and decodedToken
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      decodedToken?: admin.auth.DecodedIdToken;
    }
  }
}

/**
 * Authentication middleware using Firebase Admin SDK
 * Verifies the token and attaches the user to the request
 */
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let token;

  // Check for token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // First, try to verify with our secure token system
      const firebaseUid = verifyToken(token);
      if (firebaseUid) {
        // Find user in our database
        const user = await User.findOne({ firebaseUid }).select('-password');

        if (!user) {
          res.status(401).json({ message: 'User not found in database' });
          return;
        }

        // Set user in request
        req.user = user;
        
        next();
        return;
      }

      // For mock tokens (for testing)
      if (token.startsWith('mock-token-')) {
        // Extract the UID from the token
        const uidMatch = token.match(/mock-token-(.*)/);
        const uid = uidMatch ? uidMatch[1] : 'mock-uid';
        
        // Find user in our database
        const user = await User.findOne({ firebaseUid: uid }).select('-password');

        if (!user) {
          res.status(401).json({ message: 'User not found in database' });
          return;
        }

        // Set user in request
        req.user = user;
        
        next();
        return;
      }

      // For Firebase ID tokens (from client-side auth)
      try {
        // Verify token with Firebase Admin SDK
        const decodedToken = await auth.verifyIdToken(token);
        
        // Check if token is expired
        const currentTime = Math.floor(Date.now() / 1000);
        if (decodedToken.exp < currentTime) {
          res.status(401).json({ message: 'Token expired, please login again' });
          return;
        }
        
        // Find user in our database
        const user = await User.findOne({ firebaseUid: decodedToken.uid }).select('-password');

        if (!user) {
          res.status(401).json({ message: 'User not found in database' });
          return;
        }

        // Set user and decoded token in request
        req.user = user;
        req.decodedToken = decodedToken;
        
        next();
      } catch (verifyError) {
        console.error('ID token verification error:', verifyError);
        
        // Try to use the token directly as a Firebase UID (last resort fallback)
        try {
          // Find user in our database
          const user = await User.findOne({ firebaseUid: token }).select('-password');

          if (user) {
            // Set user in request
            req.user = user;
            next();
            return;
          }
        } catch (fallbackError) {
          console.error('Fallback authentication error:', fallbackError);
        }
        
        res.status(401).json({ message: 'Not authorized, invalid token' });
        return;
      }
    } catch (error) {
      console.error('General authentication error:', error);
      res.status(401).json({ message: 'Authentication failed' });
      return;
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token provided' });
    return;
  }
};

// Role-based authorization middleware
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'You do not have permission to perform this action' });
      return;
    }

    next();
  };
};
