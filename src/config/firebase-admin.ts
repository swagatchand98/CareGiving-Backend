import * as admin from 'firebase-admin';
import * as path from 'path';

// Use the service account JSON file directly
const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');

let auth: admin.auth.Auth;
let app: admin.app.App;

try {
  // Initialize Firebase Admin SDK with service account file
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath)
  });

  console.log('Firebase Admin SDK initialized with service account file');
  
  auth = app.auth();
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  
  // Create a mock auth implementation for development
  console.warn('Using mock Firebase Auth implementation for development');
  
  const mockAuth = {
    createUser: async () => ({ uid: 'mock-uid' }),
    setCustomUserClaims: async () => {},
    generateEmailVerificationLink: async () => 'https://example.com/verify-email',
    createCustomToken: async () => 'mock-token',
    verifyIdToken: async () => ({ 
      uid: 'mock-uid',
      email: 'mock@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    }),
    getUser: async () => ({ emailVerified: true }),
    updateUser: async () => ({})
  };
  
  auth = mockAuth as any;
  app = { name: 'mock-firebase-app' } as any;
}

export { auth, app };
