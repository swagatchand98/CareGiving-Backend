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
import adminAuthRoutes from './routes/adminAuthRoutes';
import timeSlotRoutes from './routes/timeSlotRoutes';
import walletRoutes from './routes/walletRoutes';
import reviewRoutes from './routes/reviewRoutes';
import providerRoutes from './routes/providerRoutes';
import wishlistRoutes from './routes/wishlistRoutes';
import addressRoutes from './routes/addressRoutes';
import chatRoutes from './routes/chatRoutes';
import notificationRoutes from './routes/notificationRoutes';
import paymentRoutes from './routes/paymentRoutes';
import providerEarningsRoutes from './routes/providerEarningsRoutes';
import providerConnectRoutes from './routes/providerConnectRoutes';
import { connectDatabase } from './config/database';
import { loadEnvironmentVariables } from './config/env';
import './config/firebase-admin';

class App {
  public express: Express;

  constructor() {
    this.express = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares() {
  
    loadEnvironmentVariables();
    this.express.use(helmet());
    
    // Configure CORS
    if (process.env.NODE_ENV === 'development') {
      this.express.use(cors({
        origin: '*', // Allow all origins in development
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      }));
      console.log('⚠️ CORS configured for development (allowing all origins)');
    } else {
      this.express.use(cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
      }));
      console.log('🔒 CORS configured for production');
    }

    this.express.use(express.json({ limit: '10kb' }));
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(compression());
    
    this.express.set('json spaces', 2);

    this.express.use(mongoSanitize());

    // Rate limiting
    const publicLimiter = rateLimit({
      max: 300,
      windowMs: 15 * 60 * 1000, // 15 minutes
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
    });
    
    const authLimiter = rateLimit({
      max: 1200,
      windowMs: 15 * 60 * 1000, // 15 minutes
      message: 'Too many requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
    });

    // rate limiting to all routes (except provider routes and timeslot routes)
    this.express.use('/api', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/v1/providers/') || 
          (req.path.startsWith('/v1/timeslots/service/') && req.method === 'GET')) {
        return next();
      }
      
      if (req.headers.authorization) {
        // higher limit
        authLimiter(req, res, next);
      } else {
        // lower limit
        publicLimiter(req, res, next);
      }
    });

    // caching middleware
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CACHING === 'true') {
      const { cacheResponse } = require('./middleware/cacheMiddleware');
      
      // Cache service-related GET endpoints
      this.express.use('/api/v1/services', (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'GET') {
          // Cache for 5 minutes
          const ttl = req.path.includes('/categories') ? 3600 : 300; // Cache categories for 1 hour
          return cacheResponse(ttl)(req, res, next);
        }
        next();
      });
      
      // Cache booking-related GET endpoints (except for active bookings)
      this.express.use('/api/v1/bookings', (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'GET' && !req.path.includes('/active')) {
          // Cache for 2 minutes
          return cacheResponse(120)(req, res, next);
        }
        next();
      });
      
      // Cache provider-related GET endpoints
      this.express.use('/api/v1/providers', (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'GET') {
          // Cache for 5 minutes
          return cacheResponse(300)(req, res, next);
        }
        next();
      });
      
      // Cache review-related GET endpoints
      this.express.use('/api/v1/reviews', (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'GET') {
          // Cache for 10 minutes
          return cacheResponse(600)(req, res, next);
        }
        next();
      });
      
      // Cache timeslot-related GET endpoints
      this.express.use('/api/v1/timeslots', (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'GET') {
          // Cache for 5 minutes for public endpoints, 2 minutes for provider endpoints
          const ttl = req.path.includes('/service/') ? 300 : 120;
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
        message: 'CareCrew Platform API',
        status: 'Running',
        timestamp: new Date().toISOString()
      });
    });
    
    const { protect, restrictTo } = require('./middleware/authMiddleware');
    
    // Cache statistics route (admin only)
    this.express.get('/api/v1/admin/cache-stats', protect, restrictTo('admin'), (req: Request, res: Response) => {
      const { getCacheStats } = require('./middleware/cacheMiddleware');
      const stats = getCacheStats();
      
      res.status(200).json({
        stats,
        timestamp: new Date().toISOString()
      });
    });
    
    // Clear cache route (admin only)
    this.express.post('/api/v1/admin/clear-cache', protect, restrictTo('admin'), (req: Request, res: Response) => {
      const { clearCache } = require('./middleware/cacheMiddleware');
      
      const { pattern = '' } = req.body;
      
      // Clear cache
      clearCache(pattern);
      
      res.status(200).json({
        message: `Cache cleared for pattern: ${pattern || 'all'}`,
        timestamp: new Date().toISOString()
      });
    });

    // API Routes
    this.express.use('/api/v1/auth', authRoutes);
    this.express.use('/api/v1/services', serviceRoutes);
    this.express.use('/api/v1/bookings', bookingRoutes);
    this.express.use('/api/v1/admin', adminRoutes);
    this.express.use('/api/v1/admin/auth', adminAuthRoutes);
    this.express.use('/api/v1/timeslots', timeSlotRoutes);
    this.express.use('/api/v1/wallet', walletRoutes);
    this.express.use('/api/v1/reviews', reviewRoutes);
    this.express.use('/api/v1/providers', providerRoutes);
    this.express.use('/api/v1/wishlist', wishlistRoutes);
    this.express.use('/api/v1/addresses', addressRoutes);
    this.express.use('/api/v1/chats', chatRoutes);
    this.express.use('/api/v1/notifications', notificationRoutes);
    this.express.use('/api/v1/payments', paymentRoutes);
    
    // Provider specific routes
    this.express.use('/api/v1/providers/earnings', providerEarningsRoutes);
    
    // Provider connect routes
    this.express.use('/api/v1/providers/connect', providerConnectRoutes);
    
    // Debug route to check if provider connect routes are registered
    this.express.get('/api/v1/debug/routes', (req: Request, res: Response) => {
      const routes: any[] = [];
      
      // @ts-ignore - _router is not in the type definitions but exists at runtime
      this.express._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          // Routes registered directly on the app
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods)
          });
        } else if (middleware.name === 'router') {
          // Router middleware
          middleware.handle.stack.forEach((handler: any) => {
            if (handler.route) {
              const path = handler.route.path;
              const baseUrl = middleware.regexp.toString()
                .replace('\\^', '')
                .replace('\\/?(?=\\/|$)', '')
                .replace(/\\\//g, '/');
              
              routes.push({
                path: baseUrl + path,
                methods: Object.keys(handler.route.methods)
              });
            }
          });
        }
      });
      
      res.status(200).json({
        routes,
        connectRoutesRegistered: routes.some(r => r.path.includes('/api/v1/providers/connect'))
      });
    });

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
