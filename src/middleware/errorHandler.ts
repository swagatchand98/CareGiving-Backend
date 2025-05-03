import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

// Custom error class for application-specific errors
class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
interface ErrorResponse {
  status: string;
  statusCode: number;
  message: string;
  stack?: string;
}

// Error handling middleware
const errorHandler = (
  err: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  let error: ErrorResponse = {
    status: 'error',
    statusCode: 500,
    message: 'Internal Server Error'
  };

  // Mongoose Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    const validationErrors = Object.values(err.errors)
      .map(error => error.message)
      .join(', ');

    error = {
      status: 'fail',
      statusCode: 400,
      message: `Invalid input data: ${validationErrors}`
    };
  }

  // Mongoose Duplicate Key Error
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    error = {
      status: 'fail',
      statusCode: 400,
      message: 'Duplicate field value entered'
    };
  }

  // Mongoose Cast Error (Invalid ID)
  if (err instanceof mongoose.Error.CastError) {
    error = {
      status: 'fail',
      statusCode: 400,
      message: `Invalid ${err.path}: ${err.value}`
    };
  }

  // Firebase Authentication Errors
  if (err.name === 'FirebaseAuthError' || (err as any).code?.startsWith('auth/')) {
    const code = (err as any).code;
    let message = 'Authentication failed';
    
    // Handle specific Firebase Auth error codes
    switch (code) {
      case 'auth/id-token-expired':
        message = 'Your token has expired. Please log in again';
        break;
      case 'auth/id-token-revoked':
        message = 'Your token has been revoked. Please log in again';
        break;
      case 'auth/invalid-id-token':
        message = 'Invalid token. Please log in again';
        break;
      case 'auth/user-disabled':
        message = 'Your account has been disabled';
        break;
      case 'auth/user-not-found':
        message = 'User not found';
        break;
      case 'auth/invalid-email':
        message = 'Invalid email format';
        break;
      case 'auth/email-already-exists':
        message = 'Email already in use';
        break;
      case 'auth/invalid-password':
        message = 'Password must be at least 6 characters';
        break;
      default:
        message = err.message || 'Authentication failed';
    }
    
    error = {
      status: 'fail',
      statusCode: 401,
      message
    };
  }

  // Custom App Error
  if (err instanceof AppError) {
    error = {
      status: err.status,
      statusCode: err.statusCode,
      message: err.message
    };
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    error.stack = err.stack;
  }

  // Log error for server-side tracking
  console.error('💥 Error:', {
    message: error.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });

  // Send error response
  res.status(error.statusCode).json({
    status: error.status,
    message: error.message,
    ...(error.stack && { stack: error.stack })
  });
};

// Error creation utility functions
const createError = {
  badRequest: (message: string) => 
    new AppError(message, 400),

  unauthorized: (message: string = 'Unauthorized') => 
    new AppError(message, 401),

  forbidden: (message: string = 'Forbidden') => 
    new AppError(message, 403),

  notFound: (message: string = 'Not Found') => 
    new AppError(message, 404),

  conflict: (message: string = 'Conflict') => 
    new AppError(message, 409),

  unprocessableEntity: (message: string = 'Unprocessable Entity') => 
    new AppError(message, 422),

  internalServer: (message: string = 'Internal Server Error') => 
    new AppError(message, 500)
};

// Async error handler wrapper
const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

export {
  errorHandler,
  AppError,
  createError,
  catchAsync
};
