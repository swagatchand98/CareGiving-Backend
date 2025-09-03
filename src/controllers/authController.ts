import { Request, Response, NextFunction } from 'express';
import { User, ProviderProfile } from '../models/db';
import { IUser } from '../models/db';
import { auth } from '../config/firebase-admin';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      decodedToken?: admin.auth.DecodedIdToken;
    }
  }
}

// Simple in-memory token store for developement
// in production, database or Redis needed
const tokenStore: Record<string, string> = {};

const generateSecureToken = (userId: string): string => {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const token = `${randomBytes}_${Date.now()}`;
  
  tokenStore[token] = userId;
  
  return token;
};

export const verifyToken = (token: string): string | null => {
  return tokenStore[token] || null;
};

// @route   POST /api/auth/register
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
      return res.status(401).json({ message: 'Firebase ID token required' });
    }

    const idToken = req.headers.authorization.split(' ')[1];
    
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      
      let user = await User.findOne({ firebaseUid: decodedToken.uid });
      
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }
      
      const firebaseUser = await auth.getUser(decodedToken.uid);
      
      const { firstName, lastName, role = 'user' } = req.body;
      
      let firstNameToUse = firstName;
      let lastNameToUse = lastName;
      
      if (!firstName && !lastName && firebaseUser.displayName) {
        const nameParts = firebaseUser.displayName.split(' ');
        firstNameToUse = nameParts[0] || 'User';
        lastNameToUse = nameParts.slice(1).join(' ') || '';
      }
      
      // Create user
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: firebaseUser.email || '',
        firstName: firstNameToUse || 'User',
        lastName: lastNameToUse || '',
        role,
        verificationStatus: firebaseUser.emailVerified ? 'verified' : 'pending'
      });
      
      await auth.setCustomUserClaims(decodedToken.uid, { role });

      const token = generateSecureToken(user.firebaseUid);
      
      
      return res.status(201).json({
        _id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        verificationStatus: user.verificationStatus,
        token: token,
        message: 'User registered successfully'
      });
    } catch (error: any) {
      console.error('Firebase token verification error:', error);
      
      if (error.code) {
        switch (error.code) {
          case 'auth/id-token-expired':
            return res.status(401).json({ message: 'Firebase token expired' });
          case 'auth/id-token-revoked':
            return res.status(401).json({ message: 'Firebase token revoked' });
          case 'auth/invalid-id-token':
            return res.status(401).json({ message: 'Invalid Firebase token' });
          default:
            return res.status(500).json({ message: error.message });
        }
      }
      
      return res.status(500).json({ message: 'Authentication failed' });
    }
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/register-provider
export const registerProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
      return res.status(401).json({ message: 'Firebase ID token required' });
    }

    const idToken = req.headers.authorization.split(' ')[1];
    
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      
      let user = await User.findOne({ firebaseUid: decodedToken.uid });
      
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }
      
      const firebaseUser = await auth.getUser(decodedToken.uid);
      
      const { firstName, lastName, phoneNumber } = req.body;
      
      let firstNameToUse = firstName;
      let lastNameToUse = lastName;
      
      if (!firstName && !lastName && firebaseUser.displayName) {
        const nameParts = firebaseUser.displayName.split(' ');
        firstNameToUse = nameParts[0] || 'Provider';
        lastNameToUse = nameParts.slice(1).join(' ') || '';
      }
      
      // Create user
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: firebaseUser.email || '',
        firstName: firstNameToUse || 'Provider',
        lastName: lastNameToUse || '',
        phoneNumber: phoneNumber || null,
        role: 'provider', // Set role as provider
        verificationStatus: 'pending' // Providers need verification
      });
      
      await auth.setCustomUserClaims(decodedToken.uid, { role: 'provider' });
      
      // minimal provider profile (will be completed during onboarding)
      const providerProfile = await ProviderProfile.create({
        userId: user._id,
        serviceCategories: [],
        bio: '',
        certifications: [],
        yearsOfExperience: 0,
        hourlyRate: 0,
        serviceAreas: [],
        availability: [], 
        backgroundCheckVerified: false,
        languagesSpoken: []
      });

      const token = generateSecureToken(user.firebaseUid);
      
      return res.status(201).json({
        _id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        verificationStatus: user.verificationStatus,
        onboardingRequired: true, 
        token: token,
        message: 'Provider registered successfully. Please complete the onboarding process.'
      });
    } catch (error: any) {
      console.error('Firebase token verification error:', error);
      
      if (error.code) {
        switch (error.code) {
          case 'auth/id-token-expired':
            return res.status(401).json({ message: 'Firebase token expired' });
          case 'auth/id-token-revoked':
            return res.status(401).json({ message: 'Firebase token revoked' });
          case 'auth/invalid-id-token':
            return res.status(401).json({ message: 'Invalid Firebase token' });
          default:
            return res.status(500).json({ message: error.message });
        }
      }
      
      return res.status(500).json({ message: 'Authentication failed' });
    }
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
      return res.status(401).json({ message: 'Firebase ID token required' });
    }

    const idToken = req.headers.authorization.split(' ')[1];
    
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      
      let user = await User.findOne({ firebaseUid: decodedToken.uid });
      
      if (!user) {
        // If the user doesn't exist in our database but exists in Firebase,
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
        
        console.log('Created new user from Firebase authentication:', user.email);
      }

      const token = generateSecureToken(user.firebaseUid);
      

      let providerProfile = null;
      if (user.role === 'provider') {
        providerProfile = await ProviderProfile.findOne({ userId: user._id });
      }

      const response: any = {
        _id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        verificationStatus: user.verificationStatus,
        token: token
      };
      
      // Include provider profile if available
      if (providerProfile) {
        response.providerProfile = {
          _id: providerProfile._id,
          bio: providerProfile.bio,
          serviceCategories: providerProfile.serviceCategories,
          yearsOfExperience: providerProfile.yearsOfExperience,
          hourlyRate: providerProfile.hourlyRate,
          backgroundCheckVerified: providerProfile.backgroundCheckVerified
        };
      }
      
      return res.json(response);
    } catch (error: any) {
      console.error('Firebase ID token verification error:', error);
      
      if (error.code) {
        switch (error.code) {
          case 'auth/id-token-expired':
            return res.status(401).json({ message: 'Firebase token expired' });
          case 'auth/id-token-revoked':
            return res.status(401).json({ message: 'Firebase token revoked' });
          case 'auth/invalid-id-token':
            return res.status(401).json({ message: 'Invalid Firebase token' });
          default:
            return res.status(500).json({ message: error.message });
        }
      }
      
      return res.status(401).json({ message: 'Authentication failed' });
    }
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/auth/me
export const getUserData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    let providerProfile = null;
    if (req.user.role === 'provider') {
      providerProfile = await ProviderProfile.findOne({ userId: req.user._id });
    }
    
    
    const response: any = {
      _id: req.user._id,
      firebaseUid: req.user.firebaseUid,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      role: req.user.role,
      verificationStatus: req.user.verificationStatus
    };
    
    if (providerProfile) {
      response.providerProfile = {
        _id: providerProfile._id,
        bio: providerProfile.bio,
        serviceCategories: providerProfile.serviceCategories,
        yearsOfExperience: providerProfile.yearsOfExperience,
        hourlyRate: providerProfile.hourlyRate,
        backgroundCheckVerified: providerProfile.backgroundCheckVerified
      };
    }
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/auth/me
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(req.user);
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In the hybrid approach, password reset is handled by Firebase client SDK
    // This endpoint is just for notification or logging purposes
    
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Log the request
    console.log(`Password reset requested for: ${email}`);
    
    // Return a generic message
    return res.json({ 
      message: 'Password reset request received. If an account exists with this email, a reset link will be sent.',
      note: 'Please check your email for the password reset link.'
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In the hybrid approach, password reset is handled by Firebase client SDK
    // This endpoint is just for confirmation
    
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/verify-email
export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
      return res.status(401).json({ message: 'Firebase ID token required' });
    }

    const idToken = req.headers.authorization.split(' ')[1];
    
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      
      // Get the latest user info from Firebase
      const firebaseUser = await auth.getUser(decodedToken.uid);
      
      if (firebaseUser.emailVerified) {
        // Update user verification status in our database
        await User.findOneAndUpdate(
          { firebaseUid: decodedToken.uid },
          { verificationStatus: 'verified' }
        );
        
        return res.json({ message: 'Email verified successfully' });
      } else {
        return res.status(400).json({ message: 'Email not verified yet' });
      }
    } catch (error: any) {
      console.error('Firebase token verification error:', error);
      return res.status(401).json({ message: 'Authentication failed' });
    }
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/auth/profile
export const getUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    let providerProfile = null;
    if (req.user.role === 'provider') {
      providerProfile = await ProviderProfile.findOne({ userId: req.user._id });
    }
    
    const response: any = req.user.toObject();
    
    if (providerProfile) {
      response.providerProfile = providerProfile;
    }
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/auth/profile
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.decodedToken) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    const { firstName, lastName, phoneNumber, address } = req.body;
    const uid = req.decodedToken.uid;
    
    try {
      await auth.updateUser(uid, {
        displayName: `${firstName} ${lastName}`
      });
    } catch (firebaseUpdateError) {
      console.error('Error updating Firebase user profile:', firebaseUpdateError);
    }
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        firstName,
        lastName,
        phoneNumber,
        address
      },
      { new: true }
    );
    
    // Update if provider profile
    if (req.user.role === 'provider') {
      const { 
        bio, 
        serviceCategories, 
        certifications, 
        yearsOfExperience,
        hourlyRate,
        serviceAreas,
        languagesSpoken
      } = req.body;
      
      const updateData: any = {};
      
      if (bio !== undefined) updateData.bio = bio;
      if (serviceCategories !== undefined) updateData.serviceCategories = serviceCategories;
      if (certifications !== undefined) updateData.certifications = certifications;
      if (yearsOfExperience !== undefined) updateData.yearsOfExperience = yearsOfExperience;
      if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;
      if (serviceAreas !== undefined) updateData.serviceAreas = serviceAreas;
      if (languagesSpoken !== undefined) updateData.languagesSpoken = languagesSpoken;
      
      // update if there are fields to update
      if (Object.keys(updateData).length > 0) {
        const updatedProviderProfile = await ProviderProfile.findOneAndUpdate(
          { userId: req.user._id },
          updateData,
          { new: true }
        );
        const response: any = updatedUser?.toObject() || {};
        response.providerProfile = updatedProviderProfile;
        
        return res.json(response);
      }
    }
    
    return res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/update-password
export const updateUserPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In the hybrid approach, password update is handled by Firebase client SDK
    // This endpoint is just for confirmation
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};
