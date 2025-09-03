import { auth } from "../config/firebase-admin";
import { User, ProviderProfile } from "../models/db";
import { Types } from "mongoose";

/**
 * Find a user by email
 */
export const findUserByEmail = async (email: string) => {
  return User.findOne({ email });
};

/**
 * Find a user by Firebase UID
 */
export const findUserByFirebaseUid = async (firebaseUid: string) => {
  return User.findOne({ firebaseUid }).select("-password");
};

/**
 * Find a user by ID
 */
export const findUserById = async (id: string) => {
  return User.findById(id).select("-password");
};

/**
 * Create a new user
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
    role: userData.role || "user",
  });
};

/**
 * Create a new provider
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
    role: "provider",
    verificationStatus: "pending", // Providers need verification
  });

  // Create provider profile
  const providerProfile = await ProviderProfile.create({
    userId: user._id,
    serviceCategories: providerData.serviceCategories || [],
    bio: providerData.bio || "",
    certifications: providerData.certifications || [],
    yearsOfExperience: providerData.yearsOfExperience || 0,
    hourlyRate: providerData.hourlyRate || 0,
    serviceAreas: providerData.serviceAreas || [],
    availability: [], // Default empty availability
    backgroundCheckVerified: false, // Default to false until verified
    languagesSpoken: providerData.languagesSpoken || [],
  });

  // Set custom claims for role-based access
  await auth.setCustomUserClaims(userData.firebaseUid, { role: "provider" });

  return { user, providerProfile };
};

/**
 * Find provider profile by user ID
 */
export const findProviderProfileByUserId = async (userId: string) => {
  return ProviderProfile.findOne({ userId });
};

/**
 * Update provider profile
 */
export const updateProviderProfile = async (
  userId: string,
  updateData: any
) => {
  return ProviderProfile.findOneAndUpdate({ userId }, updateData, {
    new: true,
  });
};

/**
 * Generate a custom token for a user
 */
export const generateCustomToken = async (
  firebaseUid: string
): Promise<string> => {
  return auth.createCustomToken(firebaseUid);
};

/**
 * Verify an ID token
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
 */
export const setCustomClaims = async (firebaseUid: string, claims: object) => {
  return auth.setCustomUserClaims(firebaseUid, claims);
};

/**
 * Generate an email verification link
 */
export const generateEmailVerificationLink = async (email: string) => {
  return auth.generateEmailVerificationLink(email);
};

/**
 * Generate a password reset link
 */
export const generatePasswordResetLink = async (email: string) => {
  return auth.generatePasswordResetLink(email);
};

/**
 * Update user in Firebase
 */
export const updateFirebaseUser = async (
  firebaseUid: string,
  userData: any
) => {
  return auth.updateUser(firebaseUid, userData);
};

/**
 * Update user verification status
 */
export const updateVerificationStatus = async (
  userId: string,
  status: "pending" | "verified" | "rejected"
) => {
  return User.findByIdAndUpdate(
    userId,
    { verificationStatus: status },
    { new: true }
  ).select("-password");
};

/**
 * Delete a user
 */
export const deleteUser = async (firebaseUid: string) => {
  // Delete user from Firebase
  await auth.deleteUser(firebaseUid);

  // Find user in our database
  const user = await User.findOne({ firebaseUid });

  if (user) {
    // If user is a provider, delete provider profile
    if (user.role === "provider") {
      await ProviderProfile.findOneAndDelete({ userId: user._id });
    }

    // Delete user from our database
    await User.findOneAndDelete({ firebaseUid });
  }

  return true;
};
