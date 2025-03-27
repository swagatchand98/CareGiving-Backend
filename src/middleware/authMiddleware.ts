import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/db';
import { IUser } from '../models/db';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

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

      // Verify token
      if (!process.env.JWT_SECRET) {
        res.status(500).json({ message: 'Server configuration error' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };

      // Find user and attach to request, excluding password
      req.user = await User.findById(decoded.id).select('-password') as IUser;

      if (!req.user) {
        res.status(401).json({ message: 'Not authorized' });
        return;
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized' });
    }
    return;
  }

  if (!token) {
    res.status(401).json({ message: 'No token, authorization denied' });
  }
};

// Optional: Role-based authorization middleware
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