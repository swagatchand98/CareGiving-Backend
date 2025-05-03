import { auth } from '../config/firebase-admin';
import { User, ProviderProfile } from '../models/db';
import { Types } from 'mongoose';

/**
 * Find a user by email
 * @param email - User email
 * @returns User document or null if not found
 */
export const findUserByEmail = async (email: string) => {
  return User.findOne({ email });
};

/**
 * Find a user by Firebase UID
 * @param firebaseUid - Firebase user ID
 * @returns User document or null if not found
 */
export const findUserByFirebaseUid = async (firebaseUid: string) => {
  return User.findOne({ firebaseUid }).select('-password');
};

/**
 * Find a user by ID
 * @param id - User ID
 * @returns User document or null if not found
 */
export const findUserById = async (id: string) => {
  return User.findById(id).select('-password');
};

/**
 * Create a new user
 * @param userData - User data including email, firebaseUid, firstName, lastName
 * @returns Created user document
 */
export const createUser = async (userData: {
  email: string;
  firebaseUid: string;
  firstName: string;
  lastName: string;
  role?: string;
}) => {
  // Create user in our database
  return User.create({
    ...userData,
    role: userData.role || 'user'
  });
};

/**
 * Create a new provider
 * @param userData - User data including email, firebaseUid, firstName, lastName
 * @param providerData - Provider profile data
 * @returns Created user document with provider profile
 */
export const createProvider = async (
  userData: {
    email: string;
    firebaseUid: string;
    firstName: string;
    lastName: string;
  },
  providerData: {
    bio?: string;
    serviceCategories?: Types.ObjectId[];
    certifications?: string[];
    yearsOfExperience?: number;
    hourlyRate?: number;
    serviceAreas?: { city: string; state: string }[];
    languagesSpoken?: string[];
  }
) => {
  // Create user with provider role
  const user = await User.create({
    ...userData,
    role: 'provider',
    verificationStatus: 'pending' // Providers need verification
  });

  // Create provider profile
  const providerProfile = await ProviderProfile.create({
    userId: user._id,
    serviceCategories: providerData.serviceCategories || [],
    bio: providerData.bio || '',
    certifications: providerData.certifications || [],
    yearsOfExperience: providerData.yearsOfExperience || 0,
    hourlyRate: providerData.hourlyRate || 0,
    serviceAreas: providerData.serviceAreas || [],
    availability: [], // Default empty availability
    backgroundCheckVerified: false, // Default to false until verified
    languagesSpoken: providerData.languagesSpoken || []
  });

  // Set custom claims for role-based access
  await auth.setCustomUserClaims(userData.firebaseUid, { role: 'provider' });

  return { user, providerProfile };
};

/**
 * Find provider profile by user ID
 * @param userId - User ID
 * @returns Provider profile document or null if not found
 */
export const findProviderProfileByUserId = async (userId: string) => {
  return ProviderProfile.findOne({ userId });
};

/**
 * Update provider profile
 * @param userId - User ID
 * @param updateData - Data to update
 * @returns Updated provider profile
 */
export const updateProviderProfile = async (userId: string, updateData: any) => {
  return ProviderProfile.findOneAndUpdate(
    { userId },
    updateData,
    { new: true }
  );
};

/**
 * Generate a custom token for a user
 * @param firebaseUid - Firebase user ID
 * @returns Custom token
 */
export const generateCustomToken = async (firebaseUid: string): Promise<string> => {
  return auth.createCustomToken(firebaseUid);
};

/**
 * Verify an ID token
 * @param idToken - Firebase ID token
 * @returns Decoded token or null if invalid
 */
export const verifyIdToken = async (idToken: string) => {
  try {
    return await auth.verifyIdToken(idToken);
  } catch (error) {
    return null;
  }
};

/**
 * Set custom claims for a user
 * @param firebaseUid - Firebase user ID
 * @param claims - Custom claims to set
 */
export const setCustomClaims = async (firebaseUid: string, claims: object) => {
  return auth.setCustomUserClaims(firebaseUid, claims);
};

/**
 * Generate an email verification link
 * @param email - User email
 * @returns Email verification link
 */
export const generateEmailVerificationLink = async (email: string) => {
  return auth.generateEmailVerificationLink(email);
};

/**
 * Generate a password reset link
 * @param email - User email
 * @returns Password reset link
 */
export const generatePasswordResetLink = async (email: string) => {
  return auth.generatePasswordResetLink(email);
};

/**
 * Update user in Firebase
 * @param firebaseUid - Firebase user ID
 * @param userData - User data to update
 * @returns Updated user record
 */
export const updateFirebaseUser = async (firebaseUid: string, userData: any) => {
  return auth.updateUser(firebaseUid, userData);
};

/**
 * Update user verification status
 * @param userId - User ID
 * @param status - Verification status
 * @returns Updated user document
 */
export const updateVerificationStatus = async (userId: string, status: 'pending' | 'verified' | 'rejected') => {
  return User.findByIdAndUpdate(
    userId,
    { verificationStatus: status },
    { new: true }
  ).select('-password');
};

/**
 * Delete a user
 * @param firebaseUid - Firebase user ID
 */
export const deleteUser = async (firebaseUid: string) => {
  // Delete user from Firebase
  await auth.deleteUser(firebaseUid);
  
  // Find user in our database
  const user = await User.findOne({ firebaseUid });
  
  if (user) {
    // If user is a provider, delete provider profile
    if (user.role === 'provider') {
      await ProviderProfile.findOneAndDelete({ userId: user._id });
    }
    
    // Delete user from our database
    await User.findOneAndDelete({ firebaseUid });
  }
  
  return true;
};
