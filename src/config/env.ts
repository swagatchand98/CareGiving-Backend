import dotenv from 'dotenv';

dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '5000',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
};

export function loadEnvironmentVariables() {
  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }
  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
}