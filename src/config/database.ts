import mongoose from 'mongoose';
import { config } from './env';

export async function connectDatabase() {
  try {
    await mongoose.connect(config.DATABASE_URL);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}