import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  S3ServiceException,
  ObjectCannedACL
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, bucketName, s3BaseUrl } from '../config/s3';
import path from 'path';
import crypto from 'crypto';

/**
 * Service for handling AWS S3 operations
 */
export class S3Service {
  /**
   * Upload a file buffer to S3
   * @param fileBuffer - The file buffer to upload
   * @param fileName - Original file name
   * @param contentType - MIME type of the file
   * @param folder - Optional folder path within the bucket
   * @returns The S3 URL of the uploaded file
   */
  static async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string,
    folder: string = 'uploads'
  ): Promise<string> {
    try {
      // Generate a unique file name to prevent overwriting
      const uniqueFileName = this.generateUniqueFileName(fileName);
      
      // Create the full key (path) in S3
      const key = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
      
      // Set up the S3 upload parameters
      const params = {
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: ObjectCannedACL.public_read // Make the file publicly readable
      };
      
      // Upload the file to S3
      const command = new PutObjectCommand(params);
      await s3Client.send(command);
      
      // Return the URL to the uploaded file
      return `${s3BaseUrl}/${key}`;
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error('Failed to upload file to S3');
    }
  }
  
  /**
   * Generate a presigned URL for downloading a file
   * @param key - The S3 key (path) of the file
   * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns A presigned URL for temporary access to the file
   */
  static async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key
      });
      
      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error('Failed to generate signed URL');
    }
  }
  
  /**
   * Delete a file from S3
   * @param key - The S3 key (path) of the file to delete
   * @returns True if deletion was successful
   */
  static async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key
      });
      
      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      return false;
    }
  }
  
  /**
   * Extract the S3 key from a full S3 URL
   * @param url - The full S3 URL
   * @returns The S3 key (path)
   */
  static getKeyFromUrl(url: string): string {
    if (!url) return '';
    
    // Remove the base URL part to get just the key
    return url.replace(`${s3BaseUrl}/`, '');
  }
  
  /**
   * Generate a unique filename to prevent overwriting existing files
   * @param originalName - The original filename
   * @returns A unique filename with timestamp and random string
   */
  private static generateUniqueFileName(originalName: string): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    return `${baseName}-${timestamp}-${randomString}${extension}`;
  }
  
  /**
   * Check if a URL is an S3 URL
   * @param url - The URL to check
   * @returns True if the URL is an S3 URL
   */
  static isS3Url(url: string): boolean {
    return !!url && url.startsWith(s3BaseUrl);
  }
}

export default S3Service;
