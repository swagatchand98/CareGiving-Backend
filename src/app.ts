import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import serviceRoutes from './routes/serviceRoutes';
import bookingRoutes from './routes/bookingRoutes';
import adminRoutes from './routes/adminRoutes';
import timeSlotRoutes from './routes/timeSlotRoutes';
import walletRoutes from './routes/walletRoutes';
import reviewRoutes from './routes/reviewRoutes';
import providerRoutes from './routes/providerRoutes';
import { connectDatabase } from './config/database';
import { loadEnvironmentVariables } from './config/env';
import './config/firebase-admin'; // Initialize Firebase Admin SDK

class App {
  public express: Express;

  constructor() {
    this.express = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares() {
    // Environment configuration
    loadEnvironmentVariables();

    // Security middlewares
    this.express.use(helmet());
    this.express.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }));

    // Request parsing and compression
    this.express.use(express.json({ limit: '10kb' }));
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(compression());
    
    // Fix JSON response formatting
    this.express.set('json spaces', 2);

    // Data sanitization against NoSQL query injection
    this.express.use(mongoSanitize());

    // Rate limiting - different limits for authenticated and unauthenticated users
    const publicLimiter = rateLimit({
      max: 100, // limit each IP to 100 requests per windowMs
      windowMs: 15 * 60 * 1000, // 15 minutes
      message: 'Too many requests from this IP, please try again later',
      skip: (req) => !!req.headers.authorization // Skip rate limiting for authenticated users
    });
    
    const authLimiter = rateLimit({
      max: 600, // Increased limit for authenticated users
      windowMs: 15 * 60 * 1000, // 15 minutes
      message: 'Too many requests, please try again later',
      skip: (req) => !req.headers.authorization // Skip rate limiting for unauthenticated users
    });
    
    // Apply rate limiting to all routes except provider-specific routes
    this.express.use('/api', (req: Request, res: Response, next: NextFunction) => {
      // Skip rate limiting for provider-specific routes
      if (req.path.startsWith('/v1/providers/')) {
        return next();
      }
      
      // Apply rate limiting for other routes
      publicLimiter(req, res, (err: any) => {
        if (err) return next(err);
        authLimiter(req, res, next);
      });
    });

    // Apply caching middleware to frequently accessed routes
    if (process.env.NODE_ENV === 'production') {
      const { cacheResponse } = require('./middleware/cacheMiddleware');
      
      // Cache service-related GET endpoints
      this.express.use('/api/v1/services', (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'GET') {
          // Cache for 5 minutes by default
          const ttl = req.path.includes('/categories') ? 3600 : 300; // Cache categories for 1 hour
          return cacheResponse(ttl)(req, res, next);
        }
        next();
      });
    }

    // Request logging middleware (development only)
    if (process.env.NODE_ENV === 'development') {
      const morgan = require('morgan');
      this.express.use(morgan('dev'));
    }
  }

  private initializeRoutes() {
    // Base route
    this.express.get('/api/v1', (req: Request, res: Response) => {
      res.status(200).json({
        message: 'Caregiving Platform API',
        status: 'Running',
        timestamp: new Date().toISOString()
      });
    });

    // API Routes
    this.express.use('/api/v1/auth', authRoutes);
    this.express.use('/api/v1/services', serviceRoutes);
    this.express.use('/api/v1/bookings', bookingRoutes);
    this.express.use('/api/v1/admin', adminRoutes);
    this.express.use('/api/v1/timeslots', timeSlotRoutes);
    this.express.use('/api/v1/wallet', walletRoutes);
    this.express.use('/api/v1/reviews', reviewRoutes);
    this.express.use('/api/v1/providers', providerRoutes);

    // 404 handler for undefined routes
    this.express.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        status: 'error',
        message: 'Route not found'
      });
    });
  }

  private initializeErrorHandling() {
    // Global error handler
    this.express.use(errorHandler);
  }

  public async initialize() {
    try {
      // Connect to database
      await connectDatabase();
      console.log('✅ Database connection successful');
      
      // Ensure default service categories exist
      const { ServiceCategory } = require('./models/db');
      await ServiceCategory.ensureDefaultCategories();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  }
}

export default App;
