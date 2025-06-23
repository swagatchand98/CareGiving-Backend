import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import S3Service from '../services/s3Service';

// Memory storage for multer (files will be in memory before uploading to S3)
const memoryStorage = multer.memoryStorage();

// Fallback to local storage if S3 is not configured
const useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true';

// Create upload directories if they don't exist (for local storage fallback)
const createUploadDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure multer storage for services
const serviceStorage = useLocalStorage 
  ? multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = 'uploads/services/';
        createUploadDir(uploadDir);
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
      }
    })
  : memoryStorage;

// Configure multer storage for provider documents
const documentStorage = useLocalStorage
  ? multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = 'uploads/documents/';
        createUploadDir(uploadDir);
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
      }
    })
  : memoryStorage;

// Configure multer storage for profile pictures
const profilePictureStorage = useLocalStorage
  ? multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = 'uploads/profiles/';
        createUploadDir(uploadDir);
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
      }
    })
  : memoryStorage;

// Image and video file filter for services
const serviceMediaFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mov|avi/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /image\/|video\//.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'));
  }
};

// Image file filter
const imageFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed.'));
  }
};

// Document file filter
const documentFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  
  if (extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and documents (PDF, DOC, DOCX) are allowed.'));
  }
};

// Configure multer uploads
const serviceUpload = multer({
  storage: serviceStorage,
  fileFilter: serviceMediaFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit for videos
});

const documentUpload = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB file size limit
});

const profilePictureUpload = multer({
  storage: profilePictureStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB file size limit
});

// Helper function to process files and upload to S3 if needed
const processUploadedFiles = async (
  req: Request, 
  res: Response, 
  next: NextFunction,
  folder: string
) => {
  if (useLocalStorage || !req.files) {
    return next();
  }

  try {
    // Type assertion to Express.Multer.File[]
    const files = Array.isArray(req.files) 
      ? req.files as Express.Multer.File[]
      : [req.files as any];
    
    const s3Urls: string[] = [];

    for (const file of files) {
      const s3Url = await S3Service.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        folder
      );
      s3Urls.push(s3Url);
    }

    // Replace the file paths with S3 URLs
    req.body.s3Urls = s3Urls;
    next();
  } catch (error) {
    next(error);
  }
};

// Helper function to process a single file and upload to S3 if needed
const processUploadedFile = async (
  req: Request, 
  res: Response, 
  next: NextFunction,
  folder: string
) => {
  if (useLocalStorage || !req.file) {
    return next();
  }

  try {
    const file = req.file;
    // Ensure file has the expected properties
    if (!file.buffer || !file.originalname || !file.mimetype) {
      return next();
    }
    
    const s3Url = await S3Service.uploadFile(
      file.buffer as Buffer,
      file.originalname as string,
      file.mimetype as string,
      folder
    );

    // Replace the file path with S3 URL
    req.body.s3Url = s3Url;
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to upload service images
export const uploadServiceImages = (req: Request, res: Response, next: NextFunction) => {
  serviceUpload.array('images', 5)(req, res, (err) => {
    if (err) {
      return next(err);
    }
    processUploadedFiles(req, res, next, 'services');
  });
};

// Middleware to upload provider documents
export const uploadDocuments = (fieldName: string, maxCount: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    documentUpload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        return next(err);
      }
      processUploadedFiles(req, res, next, 'documents');
    });
  };
};

// Middleware to upload profile picture
export const uploadProfilePicture = (fieldName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    profilePictureUpload.single(fieldName)(req, res, (err) => {
      if (err) {
        return next(err);
      }
      processUploadedFile(req, res, next, 'profiles');
    });
  };
};
