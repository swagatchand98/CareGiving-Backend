import dotenv from 'dotenv';

dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '5000',
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // JWT configuration
  JWT_SECRET: process.env.JWT_SECRET || 'default_jwt_secret_for_development',
  
  // Email configuration
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'Urban Caregiving <noreply@urbancaregiving.com>',
  
  // Frontend URL for email links
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Stripe configuration
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  
  // Stripe Connect configuration
  STRIPE_CONNECT_CLIENT_ID: process.env.STRIPE_CONNECT_CLIENT_ID || '',
  STRIPE_CONNECT_WEBHOOK_SECRET: process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '',
};

export function loadEnvironmentVariables() {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_CONNECT_CLIENT_ID'];
  const missingVars = requiredVars.filter(varName => !config[varName as keyof typeof config]);
  
  if (missingVars.length > 0) {
    throw new Error(`Required environment variables are not defined: ${missingVars.join(', ')}`);
  }
  
  // Warn about missing email configuration
  if (!config.EMAIL_USER || !config.EMAIL_PASSWORD) {
    console.warn('Email configuration is incomplete. Email notifications may not work properly.');
  }
  
  // Warn about missing Stripe webhook secret
  if (!config.STRIPE_WEBHOOK_SECRET) {
    console.warn('Stripe webhook secret is not defined. Webhook verification will not work properly.');
  }
  
  // Warn about missing Stripe Connect webhook secret
  if (!config.STRIPE_CONNECT_WEBHOOK_SECRET) {
    console.warn('Stripe Connect webhook secret is not defined. Connect webhook verification will not work properly.');
  }
}
