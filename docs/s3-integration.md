# AWS S3 Integration for Media Storage

This document provides information on how the AWS S3 integration works in the Caregiving application for storing images, videos, and documents.

## Overview

The application uses AWS S3 (Simple Storage Service) to store media files uploaded by providers when creating services. This includes:

- Service images
- Provider documents
- Profile pictures

The integration provides a seamless way to store and retrieve these files from S3 while maintaining backward compatibility with local storage.

## Configuration

### Environment Variables

The following environment variables need to be set in the `.env` file:

```
AWS_ACCESS_KEY_ID="YOUR_AWS_ACCESS_KEY_ID"
AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_ACCESS_KEY"
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="caregiving-app-uploads"
USE_LOCAL_STORAGE="false"  # Set to "true" to use local storage instead of S3
```

### Setting Up AWS S3

1. **Create an AWS Account**: If you don't have one already, sign up at [aws.amazon.com](https://aws.amazon.com).

2. **Create an S3 Bucket**:
   - Go to the S3 service in the AWS Console
   - Click "Create bucket"
   - Choose a unique name for your bucket (e.g., "caregiving-app-uploads")
   - Select the region closest to your users
   - Configure bucket settings (public access, versioning, etc.)
   - Create the bucket

3. **Create IAM User with S3 Access**:
   - Go to the IAM service in the AWS Console
   - Create a new user with programmatic access
   - Attach the `AmazonS3FullAccess` policy (or create a custom policy with more restricted permissions)
   - Save the Access Key ID and Secret Access Key

4. **Update Environment Variables**:
   - Add the Access Key ID, Secret Access Key, region, and bucket name to your `.env` file
   - Set `USE_LOCAL_STORAGE` to `"false"` to enable S3 storage

## How It Works

### File Upload Flow

1. The client uploads files through the API
2. The `uploadMiddleware` processes the files:
   - If `USE_LOCAL_STORAGE` is `"true"`, files are stored locally
   - If `USE_LOCAL_STORAGE` is `"false"`, files are uploaded to S3
3. S3 URLs or local file paths are stored in the database

### S3 Service

The `S3Service` class provides methods for:

- Uploading files to S3
- Generating presigned URLs for secure access
- Deleting files from S3
- Extracting S3 keys from URLs

### Folder Structure in S3

Files are organized in the following folders within the S3 bucket:

- `uploads/services/` - Service images
- `uploads/documents/` - Provider documents
- `uploads/profiles/` - User profile pictures

## Fallback to Local Storage

The system is designed to fall back to local storage if:

1. S3 is not properly configured
2. `USE_LOCAL_STORAGE` is set to `"true"`

This ensures the application can run even without S3 access, which is useful for development and testing.

## Security Considerations

- S3 bucket should have appropriate access controls
- Consider setting up a CloudFront distribution for better performance and security
- Use presigned URLs for temporary access to private files
- Implement file type validation and size limits (already done in the middleware)

## Troubleshooting

If you encounter issues with S3 uploads:

1. Check that AWS credentials are correct
2. Ensure the S3 bucket exists and is accessible
3. Verify that the IAM user has appropriate permissions
4. Check network connectivity to AWS services
5. Look for errors in the application logs

## Future Improvements

- Add support for video uploads
- Implement image resizing and optimization
- Set up CloudFront for CDN capabilities
- Add file expiration policies
