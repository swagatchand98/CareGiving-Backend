import { auth } from '../config/firebase-admin';
import { User } from '../models/db';

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
  
  // Delete user from our database
  return User.findOneAndDelete({ firebaseUid });
};
