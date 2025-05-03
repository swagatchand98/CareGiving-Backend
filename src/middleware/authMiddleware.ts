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
 * Authentication middleware for the hybrid approach
 * Verifies either Firebase ID tokens or our custom tokens
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
        
        // Also set decodedToken with minimal required properties
        req.decodedToken = {
          uid: firebaseUid,
          // Add other required properties with default values
          auth_time: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          iat: Math.floor(Date.now() / 1000),
          sub: firebaseUid,
          email: user.email || '',
          email_verified: false
        } as admin.auth.DecodedIdToken;
        
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
        
        // Also set decodedToken with minimal required properties
        req.decodedToken = {
          uid: uid,
          // Add other required properties with default values
          auth_time: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          iat: Math.floor(Date.now() / 1000),
          sub: uid,
          email: user.email || '',
          email_verified: false
        } as admin.auth.DecodedIdToken;
        
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
        let user = await User.findOne({ firebaseUid: decodedToken.uid }).select('-password');

        if (!user) {
          // If user doesn't exist in our database but exists in Firebase,
          // create a new user record in our database
          const firebaseUser = await auth.getUser(decodedToken.uid);
          
          // Extract name parts from displayName or use email as fallback
          let firstName = 'User';
          let lastName = '';
          
          if (firebaseUser.displayName) {
            const nameParts = firebaseUser.displayName.split(' ');
            firstName = nameParts[0] || 'User';
            lastName = nameParts.slice(1).join(' ') || '';
          }
          
          user = await User.create({
            firebaseUid: decodedToken.uid,
            email: firebaseUser.email || '',
            firstName,
            lastName,
            role: 'user', // Default role
            verificationStatus: firebaseUser.emailVerified ? 'verified' : 'pending'
          });
          
          console.log('Created new user from Firebase authentication in middleware:', user.email);
        }

        // Set user and decoded token in request
        req.user = user;
        req.decodedToken = decodedToken;
        
        next();
      } catch (verifyError) {
        console.error('ID token verification error:', verifyError);
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
