import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

interface ValidationSchema {
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
}

/**
 * Middleware for validating request data
 * @param schema - Validation schema for request body, query, and params
 */
export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationSchema: Record<string, Joi.ObjectSchema> = {};
    
    // Create Joi schemas from the provided schema objects
    if (schema.body) {
      validationSchema.body = Joi.object(
        Object.entries(schema.body).reduce((acc, [key, value]) => {
          // Handle different validation types
          if (typeof value === 'object' && value !== null) {
            if (value.type === 'string') {
              let validator = Joi.string();
              
              if (value.required) validator = validator.required();
              if (value.min) validator = validator.min(value.min);
              if (value.max) validator = validator.max(value.max);
              if (value.enum) validator = validator.valid(...value.enum);
              
              acc[key] = validator;
            } else if (value.type === 'number') {
              let validator = Joi.number();
              
              if (value.required) validator = validator.required();
              if (value.min !== undefined) validator = validator.min(value.min);
              if (value.max !== undefined) validator = validator.max(value.max);
              
              acc[key] = validator;
            } else if (value.type === 'boolean') {
              let validator = Joi.boolean();
              
              if (value.required) validator = validator.required();
              
              acc[key] = validator;
            } else if (value.type === 'array') {
              let validator = Joi.array();
              
              if (value.required) validator = validator.required();
              if (value.min) validator = validator.min(value.min);
              if (value.max) validator = validator.max(value.max);
              
              acc[key] = validator;
            } else if (value.type === 'object') {
              let validator = Joi.object();
              
              if (value.required) validator = validator.required();
              
              acc[key] = validator;
            }
          } else {
            // Simple validation (e.g., { name: Joi.string().required() })
            acc[key] = value;
          }
          
          return acc;
        }, {} as Record<string, Joi.Schema>)
      );
    }
    
    if (schema.query) {
      validationSchema.query = Joi.object(schema.query);
    }
    
    if (schema.params) {
      validationSchema.params = Joi.object(schema.params);
    }
    
    // Validate request data
    const validationOptions = {
      abortEarly: false, // Include all errors
      allowUnknown: true, // Ignore unknown props
      stripUnknown: false // Keep unknown props
    };
    
    const errors: Record<string, string[]> = {};
    
    // Validate each part of the request
    Object.keys(validationSchema).forEach((key) => {
      const { error } = validationSchema[key].validate(
        req[key as keyof Request],
        validationOptions
      );
      
      if (error) {
        errors[key] = error.details.map((detail) => detail.message);
      }
    });
    
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors
      });
    }
    
    next();
  };
};
