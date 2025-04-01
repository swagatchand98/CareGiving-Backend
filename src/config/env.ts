import dotenv from 'dotenv';

dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '5000',
  DATABASE_URL: process.env.DATABASE_URL || '',
};

export function loadEnvironmentVariables() {
  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }
}
