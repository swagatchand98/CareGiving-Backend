# Testing the Hybrid Authentication Approach with Postman

This guide explains how to test the hybrid authentication approach using Postman.

## Overview

In the hybrid authentication approach:
1. The client authenticates with Firebase directly
2. Firebase returns an ID token
3. The client sends this ID token to our backend
4. Our backend verifies the token and returns a custom token

When testing with Postman, you'll need to simulate this flow.

## Option 1: Using Firebase ID Tokens

### Step 1: Get a Firebase ID Token

You need a valid Firebase ID token to test the API. There are several ways to get one:

1. **Using the Firebase REST API**:
   ```
   POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=[API_KEY]
   
   {
     "email": "user@example.com",
     "password": "password123",
     "returnSecureToken": true
   }
   ```
   The response will include an `idToken` field.

2. **Using the Firebase Auth Emulator**:
   If you're using the Firebase Auth Emulator, you can get tokens from the emulator UI.

3. **From a web browser**:
   - Open the example HTML file we created
   - Login with a test account
   - Open browser developer tools
   - In the console, run: `await firebase.auth().currentUser.getIdToken()`
   - Copy the returned token

### Step 2: Use the ID Token in Postman

1. Create a new request in Postman
2. Set the method to POST
3. Enter the URL: `http://localhost:5000/api/v1/auth/login`
4. In the Headers tab, add:
   - Key: `Authorization`
   - Value: `Bearer [YOUR_FIREBASE_ID_TOKEN]`
5. Send the request

The response should include user information and a custom token from your backend.

## Option 2: Using Development Mode with Mock Tokens

For development and testing, you can also use mock tokens:

1. Create a new request in Postman
2. Set the method to POST
3. Enter the URL: `http://localhost:5000/api/v1/auth/login`
4. In the Headers tab, add:
   - Key: `Authorization`
   - Value: `Bearer mock-token-[FIREBASE_UID]`
   
   Replace `[FIREBASE_UID]` with a valid Firebase UID from your database.

5. Send the request

This approach uses the mock token support in the middleware for easier testing.

## Testing Other Endpoints

Once you have obtained a token from the `/auth/login` endpoint, you can use that token to test other protected endpoints:

1. Copy the `token` value from the login response
2. Create a new request in Postman
3. Set the appropriate method (GET, POST, etc.)
4. Enter the URL for the endpoint you want to test
5. In the Headers tab, add:
   - Key: `Authorization`
   - Value: `Bearer [YOUR_BACKEND_TOKEN]`
6. Add any required request body
7. Send the request

## Example Postman Collection

Here's a sample Postman collection structure for testing:

1. **Authentication**
   - Login (POST /api/v1/auth/login)
   - Register (POST /api/v1/auth/register)

2. **User Profile**
   - Get Profile (GET /api/v1/auth/profile)
   - Update Profile (PUT /api/v1/auth/profile)
   - Verify Email (POST /api/v1/auth/verify-email)

3. **Services**
   - Get Services (GET /api/v1/services)
   - Get Service by ID (GET /api/v1/services/:id)

4. **Bookings**
   - Create Booking (POST /api/v1/bookings)
   - Get User Bookings (GET /api/v1/bookings)

## Environment Variables

Set up Postman environment variables to make testing easier:

- `base_url`: http://localhost:5000/api/v1
- `firebase_id_token`: [Your Firebase ID Token]
- `backend_token`: [Your Backend Token]

Then use these variables in your requests:
- URL: `{{base_url}}/auth/login`
- Authorization: `Bearer {{backend_token}}`

## Testing Admin Routes

To test admin routes, you need a user with admin role:

1. Create a user with admin role in your database
2. Get a token for this user using one of the methods above
3. Use this token to access admin endpoints like:
   - GET /api/v1/admin/users
   - GET /api/v1/admin/services
