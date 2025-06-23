/**
 * Script to create an admin user for the admin dashboard
 * 
 * Usage:
 * node scripts/create-admin.js
 * 
 * This script will create an admin user in both Firebase Authentication
 * and in the database with the admin role.
 */

// Load environment variables
require('dotenv').config();

const admin = require('firebase-admin');
const mongoose = require('mongoose');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

// Path to service account file
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath)
  });
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  process.exit(1);
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to MongoDB
const connectToDatabase = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/caregiving';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB successfully');
    return true;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    return false;
  }
};

// Define User schema
const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, required: true, enum: ['user', 'provider', 'admin'] },
  verificationStatus: { type: String, default: 'pending', enum: ['pending', 'verified', 'rejected'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create User model
const User = mongoose.model('User', userSchema);

// Function to prompt for input
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Function to generate a secure password
const generateSecurePassword = () => {
  const length = 16;
