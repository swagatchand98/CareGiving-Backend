import { Request, Response, NextFunction } from 'express';

// Async handler to catch errors in async functions
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

// Error handler middleware
export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Development error response (more details)
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  } 
  // Production error response (less details)
  else {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    } 
    // Programming or other unknown error: don't leak error details
    else {
      console.error('ERROR 💥', err);
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong'
      });
    }
  }
};

// Create error utility
export const createError = {
  badRequest: (message: string) => {
    const error: AppError = new Error(message);
    error.statusCode = 400;
    error.status = 'fail';
    error.isOperational = true;
    return error;
  },
  unauthorized: (message: string) => {
    const error: AppError = new Error(message);
    error.statusCode = 401;
    error.status = 'fail';
    error.isOperational = true;
    return error;
  },
  forbidden: (message: string) => {
    const error: AppError = new Error(message);
    error.statusCode = 403;
    error.status = 'fail';
    error.isOperational = true;
    return error;
  },
  notFound: (message: string) => {
    const error: AppError = new Error(message);
    error.statusCode = 404;
    error.status = 'fail';
    error.isOperational = true;
    return error;
  },
  conflict: (message: string) => {
    const error: AppError = new Error(message);
    error.statusCode = 409;
    error.status = 'fail';
    error.isOperational = true;
    return error;
  },
  serverError: (message: string) => {
    const error: AppError = new Error(message);
    error.statusCode = 500;
    error.status = 'error';
    error.isOperational = true;
    return error;
  }
};
