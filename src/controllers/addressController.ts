import { Request, Response, NextFunction } from 'express';
import { Address } from '../models/addressModel';
import { createError } from '../middleware/errorHandler';

/**
 * @route   GET /api/addresses
 */
export const getUserAddresses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const addresses = await Address.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: addresses.length,
      data: { addresses }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/addresses/:id
 */
export const getAddressById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const address = await Address.findOne({ _id: req.params.id, userId: req.user._id });

    if (!address) {
      return next(createError.notFound('Address not found'));
    }

    res.status(200).json({
      status: 'success',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/addresses
 */
export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const {
      type,
      name,
      street,
      city,
      state,
      zipCode,
      country,
      isDefault,
      landmark,
      instructions
    } = req.body;

    if (!name || !street || !city || !state || !zipCode) {
      return next(createError.badRequest('Please provide all required fields'));
    }

    // address
    const address = await Address.create({
      userId: req.user._id,
      type: type || 'home',
      name,
      street,
      city,
      state,
      zipCode,
      country: country || 'India',
      isDefault: isDefault || false,
      landmark,
      instructions
    });

    res.status(201).json({
      status: 'success',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/addresses/:id
 */
export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    const {
      type,
      name,
      street,
      city,
      state,
      zipCode,
      country,
      isDefault,
      landmark,
      instructions
    } = req.body;

    // Find address
    const address = await Address.findOne({ _id: req.params.id, userId: req.user._id });

    if (!address) {
      return next(createError.notFound('Address not found'));
    }

    // Update fields
    if (type) address.type = type;
    if (name) address.name = name;
    if (street) address.street = street;
    if (city) address.city = city;
    if (state) address.state = state;
    if (zipCode) address.zipCode = zipCode;
    if (country) address.country = country;
    if (landmark !== undefined) address.landmark = landmark;
    if (instructions !== undefined) address.instructions = instructions;
    if (isDefault !== undefined) address.isDefault = isDefault;

    await address.save();

    res.status(200).json({
      status: 'success',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/addresses/:id
 */
export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find and delete address
    const address = await Address.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

    if (!address) {
      return next(createError.notFound('Address not found'));
    }

    // If the deleted address was the default, set another address as default
    if (address.isDefault) {
      const nextAddress = await Address.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Address deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/addresses/:id/default
 */
export const setDefaultAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find address
    const address = await Address.findOne({ _id: req.params.id, userId: req.user._id });

    if (!address) {
      return next(createError.notFound('Address not found'));
    }

    // Set as default
    address.isDefault = true;
    await address.save();

    res.status(200).json({
      status: 'success',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/addresses/default
 */
export const getDefaultAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(createError.unauthorized('User not authenticated'));
    }

    // Find default address
    const address = await Address.findOne({ userId: req.user._id, isDefault: true });

    if (!address) {
      // If no default address, get the most recently created one
      const mostRecent = await Address.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
      
      if (!mostRecent) {
        return res.status(200).json({
          status: 'success',
          data: { address: null }
        });
      }
      
      return res.status(200).json({
        status: 'success',
        data: { address: mostRecent }
      });
    }

    res.status(200).json({
      status: 'success',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
};
