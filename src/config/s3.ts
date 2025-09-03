import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET_NAME'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.warn(`Warning: Environment variable ${varName} is not set. S3 functionality may not work properly.`);
  }
});

// S3 configuration
export const s3Config = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },
  region: process.env.AWS_REGION || 'us-east-1',
  bucketName: process.env.AWS_S3_BUCKET_NAME || 'caregiving-app-uploads'
};

// S3 client instance
export const s3Client = new S3Client({
  credentials: s3Config.credentials,
  region: s3Config.region
});

export const bucketName = s3Config.bucketName;

export const s3BaseUrl = `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com`;
