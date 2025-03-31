import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/db';
import { config } from '../config/env';

/**
 * Generate JWT token for user authentication
 * @param userId - The user ID to include in the token
 * @returns JWT token string
 */
export const generateToken = (userId: string): string => {
  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
  return jwt.sign({ id: userId }, config.JWT_SECRET, {
    expiresIn: '30d'
  });
};

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Verify a password against a hashed password
 * @param plainPassword - Plain text password
 * @param hashedPassword - Hashed password to compare against
 * @returns Boolean indicating if passwords match
 */
export const verifyPassword = async (
  plainPassword: string, 
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Find a user by email
 * @param email - User email
 * @returns User document or null if not found
 */
export const findUserByEmail = async (email: string) => {
  return User.findOne({ email });
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
 * @param userData - User data including email, password, firstName, lastName
 * @returns Created user document
 */
export const createUser = async (userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
}) => {
  // Hash password
  const hashedPassword = await hashPassword(userData.password);
  
  // Create user
  return User.create({
    ...userData,
    password: hashedPassword
  });
};

/**
 * Generate a password reset token
 * @param userId - User ID
 * @returns Reset token
 */
export const generatePasswordResetToken = (userId: string): string => {
  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
  return jwt.sign({ id: userId }, config.JWT_SECRET, {
    expiresIn: '1h'
  });
};

/**
 * Verify a token (for password reset or email verification)
 * @param token - JWT token
 * @returns Decoded token payload or null if invalid
 */
export const verifyToken = (token: string): { id: string } | null => {
  try {
    if (!config.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }
    return jwt.verify(token, config.JWT_SECRET) as { id: string };
  } catch (error) {
    return null;
  }
};

/**
 * Update user password
 * @param userId - User ID
 * @param newPassword - New password (plain text)
 * @returns Updated user document
 */
export const updateUserPassword = async (userId: string, newPassword: string) => {
  const hashedPassword = await hashPassword(newPassword);
  return User.findByIdAndUpdate(
    userId,
    { password: hashedPassword },
    { new: true }
  ).select('-password');
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
