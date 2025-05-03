# Provider Authentication Guide

This guide explains how to use the provider authentication API endpoints to register and login as a service provider in the Caregiving platform.

## Provider Registration

Providers need to register with additional information compared to regular users. The registration process creates both a user account and a provider profile.

### Endpoint

```
POST /api/auth/register-provider
```

### Headers

```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

### Request Body

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "bio": "Experienced caregiver with 10+ years of experience working with seniors.",
  "serviceCategories": ["60a1b2c3d4e5f6a7b8c9d0e1", "60a1b2c3d4e5f6a7b8c9d0e2"],
  "certifications": ["CPR Certified", "First Aid Certified"],
  "yearsOfExperience": 10,
  "hourlyRate": 25,
  "serviceAreas": [
    {
      "city": "New York",
      "state": "NY"
    },
    {
      "city": "Brooklyn",
      "state": "NY" 
    }
  ],
  "languagesSpoken": ["English", "Spanish"]
}
```

### Response

```json
{
  "_id": "60a1b2c3d4e5f6a7b8c9d0e1",
  "firebaseUid": "firebase-user-id",
  "email": "jane.smith@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "provider",
  "verificationStatus": "pending",
  "providerProfile": {
    "_id": "60a1b2c3d4e5f6a7b8c9d0e2",
    "bio": "Experienced caregiver with 10+ years of experience working with seniors.",
    "serviceCategories": ["60a1b2c3d4e5f6a7b8c9d0e1", "60a1b2c3d4e5f6a7b8c9d0e2"],
    "yearsOfExperience": 10,
    "hourlyRate": 25,
    "backgroundCheckVerified": false
  },
  "token": "secure-token",
  "message": "Provider registered successfully"
}
```

## Provider Login

Providers can use the same login endpoint as regular users. The system will automatically detect if the user is a provider and include the provider profile in the response.

### Endpoint

```
POST /api/auth/login
```

### Headers

```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

### Response for Providers

```json
{
  "_id": "60a1b2c3d4e5f6a7b8c9d0e1",
  "firebaseUid": "firebase-user-id",
  "email": "jane.smith@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "provider",
  "verificationStatus": "pending",
  "providerProfile": {
    "_id": "60a1b2c3d4e5f6a7b8c9d0e2",
    "bio": "Experienced caregiver with 10+ years of experience working with seniors.",
    "serviceCategories": ["60a1b2c3d4e5f6a7b8c9d0e1", "60a1b2c3d4e5f6a7b8c9d0e2"],
    "yearsOfExperience": 10,
    "hourlyRate": 25,
    "backgroundCheckVerified": false
  },
  "token": "secure-token"
}
```

## Get Provider Profile

Providers can get their profile information using the profile endpoint.

### Endpoint

```
GET /api/auth/profile
```

### Headers

```
Authorization: Bearer <secure-token>
```

### Response

```json
{
  "_id": "60a1b2c3d4e5f6a7b8c9d0e1",
  "firebaseUid": "firebase-user-id",
  "email": "jane.smith@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "provider",
  "verificationStatus": "pending",
  "providerProfile": {
    "_id": "60a1b2c3d4e5f6a7b8c9d0e2",
    "userId": "60a1b2c3d4e5f6a7b8c9d0e1",
    "bio": "Experienced caregiver with 10+ years of experience working with seniors.",
    "serviceCategories": ["60a1b2c3d4e5f6a7b8c9d0e1", "60a1b2c3d4e5f6a7b8c9d0e2"],
    "certifications": ["CPR Certified", "First Aid Certified"],
    "yearsOfExperience": 10,
    "hourlyRate": 25,
    "serviceAreas": [
      {
        "city": "New York",
        "state": "NY"
      },
      {
        "city": "Brooklyn",
        "state": "NY"
      }
    ],
    "availability": [],
    "backgroundCheckVerified": false,
    "languagesSpoken": ["English", "Spanish"]
  }
}
```

## Update Provider Profile

Providers can update their profile information using the profile update endpoint.

### Endpoint

```
PUT /api/auth/profile
```

### Headers

```
Authorization: Bearer <secure-token>
Content-Type: application/json
```

### Request Body

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "123-456-7890",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "bio": "Updated bio with additional qualifications.",
  "certifications": ["CPR Certified", "First Aid Certified", "Dementia Care Certified"],
  "yearsOfExperience": 12,
  "hourlyRate": 30,
  "serviceAreas": [
    {
      "city": "New York",
      "state": "NY"
    },
    {
      "city": "Brooklyn",
      "state": "NY"
    },
    {
      "city": "Queens",
      "state": "NY"
    }
  ],
  "languagesSpoken": ["English", "Spanish", "French"]
}
```

### Response

```json
{
  "_id": "60a1b2c3d4e5f6a7b8c9d0e1",
  "firebaseUid": "firebase-user-id",
  "email": "jane.smith@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "123-456-7890",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "role": "provider",
  "verificationStatus": "pending",
  "providerProfile": {
    "_id": "60a1b2c3d4e5f6a7b8c9d0e2",
    "userId": "60a1b2c3d4e5f6a7b8c9d0e1",
    "bio": "Updated bio with additional qualifications.",
    "serviceCategories": ["60a1b2c3d4e5f6a7b8c9d0e1", "60a1b2c3d4e5f6a7b8c9d0e2"],
    "certifications": ["CPR Certified", "First Aid Certified", "Dementia Care Certified"],
    "yearsOfExperience": 12,
    "hourlyRate": 30,
    "serviceAreas": [
      {
        "city": "New York",
        "state": "NY"
      },
      {
        "city": "Brooklyn",
        "state": "NY"
      },
      {
        "city": "Queens",
        "state": "NY"
      }
    ],
    "availability": [],
    "backgroundCheckVerified": false,
    "languagesSpoken": ["English", "Spanish", "French"]
  }
}
```

## Provider Verification Status

Providers start with a verification status of "pending". An admin must verify the provider before they can offer services. The verification status can be:

- `pending`: Provider has registered but not yet verified
- `verified`: Provider has been verified by an admin
- `rejected`: Provider verification has been rejected

## Firebase Authentication

The Caregiving platform uses Firebase Authentication for user management. To register or login, you need to:

1. Create a user in Firebase Authentication using the Firebase client SDK
2. Get the ID token from Firebase
3. Send the ID token in the Authorization header to the API

Example using Firebase JavaScript SDK:

```javascript
// Register a new user in Firebase
const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
const user = userCredential.user;

// Get the ID token
const idToken = await user.getIdToken();

// Register as a provider in the Caregiving platform
const response = await fetch('/api/auth/register-provider', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    firstName: 'Jane',
    lastName: 'Smith',
    // ... other provider details
  })
});

const data = await response.json();
// Store the secure token for future API calls
const secureToken = data.token;
```

## Role-Based Access Control

The system uses role-based access control to restrict access to certain endpoints. Providers have access to provider-specific endpoints that regular users don't have access to.

When a user registers as a provider, their role is set to "provider" in both the database and Firebase custom claims. This allows the system to verify the user's role during authentication.
