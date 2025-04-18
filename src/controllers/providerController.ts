import { Request, Response, NextFunction } from 'express';
import { User, ProviderProfile } from '../models/db';
import { createError } from '../middleware/errorHandler';
import * as admin from 'firebase-admin';

/**
 * @desc    Complete provider onboarding
 * @route   POST /api/providers/onboarding
 * @access  Private (Provider only)
 */
export const completeOnboarding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated and is a provider
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    if (req.user.role !== 'provider') {
      return next(createError.forbidden('Only providers can access this endpoint'));
    }

    const {
      bio,
      serviceCategories,
      certifications,
      yearsOfExperience,
      hourlyRate,
      serviceAreas,
      languagesSpoken,
      availability
    } = req.body;

    // Validate required fields
    if (!serviceCategories || !serviceCategories.length) {
      return next(createError.badRequest('Service categories are required'));
    }

    if (!yearsOfExperience) {
      return next(createError.badRequest('Years of experience is required'));
    }

    if (!hourlyRate) {
      return next(createError.badRequest('Hourly rate is required'));
    }

    if (!serviceAreas || !serviceAreas.length) {
      return next(createError.badRequest('Service areas are required'));
    }

    // Check if provider profile already exists
    let providerProfile = await ProviderProfile.findOne({ userId: req.user._id });

    if (!providerProfile) {
      // Create new provider profile
      providerProfile = await ProviderProfile.create({
        userId: req.user._id,
        bio: bio || '',
        serviceCategories,
        certifications: certifications || [],
        yearsOfExperience,
        hourlyRate,
        serviceAreas,
        availability: availability || [],
        backgroundCheckVerified: false,
        languagesSpoken: languagesSpoken || []
      });
    } else {
      // Update existing provider profile
      providerProfile.bio = bio || providerProfile.bio;
      providerProfile.serviceCategories = serviceCategories;
      providerProfile.certifications = certifications || providerProfile.certifications;
      providerProfile.yearsOfExperience = yearsOfExperience;
      providerProfile.hourlyRate = hourlyRate;
      providerProfile.serviceAreas = serviceAreas;
      providerProfile.availability = availability || providerProfile.availability;
      providerProfile.languagesSpoken = languagesSpoken || providerProfile.languagesSpoken;

      await providerProfile.save();
    }

    // Update user's verification status to pending review
    await User.findByIdAndUpdate(req.user._id, {
      verificationStatus: 'pending'
    });

    res.status(200).json({
      status: 'success',
      message: 'Provider onboarding completed successfully',
      data: {
        providerProfile
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload provider documents
 * @route   POST /api/providers/documents
 * @access  Private (Provider only)
 */
export const uploadDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated and is a provider
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    if (req.user.role !== 'provider') {
      return next(createError.forbidden('Only providers can access this endpoint'));
    }

    // Check if files were uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
      return next(createError.badRequest('No files were uploaded'));
    }

    // Get provider profile
    const providerProfile = await ProviderProfile.findOne({ userId: req.user._id });

    if (!providerProfile) {
      return next(createError.notFound('Provider profile not found'));
    }

    // Process uploaded files
    const files = req.files as Express.Multer.File[];
    const documentUrls = files.map(file => file.path);

    // Update provider profile with document URLs
    providerProfile.documents = documentUrls;
    await providerProfile.save();

    res.status(200).json({
      status: 'success',
      message: 'Documents uploaded successfully',
      data: {
        documents: documentUrls
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update provider profile picture
 * @route   POST /api/providers/profile-picture
 * @access  Private (Provider only)
 */
export const updateProfilePicture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Check if file was uploaded
    if (!req.file) {
      return next(createError.badRequest('No profile picture was uploaded'));
    }

    // Update user with profile picture URL
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: req.file.path },
      { new: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: updatedUser?.profilePicture
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update provider address
 * @route   POST /api/providers/address
 * @access  Private (Provider only)
 */
export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const { street, city, state, zipCode, country } = req.body;

    // Validate required fields
    if (!street || !city || !state || !zipCode) {
      return next(createError.badRequest('Street, city, state, and zip code are required'));
    }

    // Update user with address
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        address: {
          street,
          city,
          state,
          zipCode,
          country: country || ''
        }
      },
      { new: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Address updated successfully',
      data: {
        address: updatedUser?.address
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get provider onboarding status
 * @route   GET /api/providers/onboarding-status
 * @access  Private (Provider only)
 */
export const getOnboardingStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated and is a provider
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    if (req.user.role !== 'provider') {
      return next(createError.forbidden('Only providers can access this endpoint'));
    }

    // Get provider profile
    const providerProfile = await ProviderProfile.findOne({ userId: req.user._id });

    // Determine onboarding status
    let onboardingStatus = {
      profileComplete: false,
      documentsUploaded: false,
      addressProvided: false,
      profilePictureUploaded: false,
      verificationStatus: req.user.verificationStatus
    };

    // Check if profile is complete
    if (providerProfile) {
      onboardingStatus.profileComplete = !!(
        providerProfile.serviceCategories?.length &&
        providerProfile.yearsOfExperience &&
        providerProfile.hourlyRate &&
        providerProfile.serviceAreas?.length
      );

      // Check if documents are uploaded
      onboardingStatus.documentsUploaded = !!(providerProfile.documents && providerProfile.documents.length > 0);
    }

    // Check if address is provided
    onboardingStatus.addressProvided = !!(
      req.user.address &&
      req.user.address.street &&
      req.user.address.city &&
      req.user.address.state &&
      req.user.address.zipCode
    );

    // Check if profile picture is uploaded
    onboardingStatus.profilePictureUploaded = !!req.user.profilePicture;

    res.status(200).json({
      status: 'success',
      data: {
        onboardingStatus
      }
    });
  } catch (error) {
    next(error);
  }
};
