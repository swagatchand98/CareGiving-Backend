# Comprehensive API Testing Guide for Urban-Company Caregiving Platform

This guide provides detailed instructions for testing all API endpoints of the Urban-Company Caregiving Platform using Postman.

## Table of Contents

1. [Setup](#setup)
2. [Authentication](#authentication)
3. [Auth Routes](#auth-routes)
4. [Service Routes](#service-routes)
5. [Booking Routes](#booking-routes)
6. [Time Slot Routes](#time-slot-routes)
7. [Review Routes](#review-routes)
8. [Wallet Routes](#wallet-routes)
9. [Provider Routes](#provider-routes)
10. [Admin Routes](#admin-routes)
11. [Testing Workflows](#testing-workflows)

## Setup

### Postman Environment

Create a Postman environment with the following variables:

- `base_url`: http://localhost:5000/api/v1
- `firebase_id_token`: [Your Firebase ID Token]
- `backend_token`: [Your Backend Token]
- `user_id`: [A User ID]
- `provider_id`: [A Provider ID]
- `service_id`: [A Service ID]
- `booking_id`: [A Booking ID]
- `timeslot_id`: [A Time Slot ID]
- `review_id`: [A Review ID]

### Getting a Firebase ID Token

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

2. **Using Development Mode with Mock Tokens**:
   For development and testing, you can use mock tokens:
   - `mock-token-[FIREBASE_UID]` - Replace `[FIREBASE_UID]` with a valid Firebase UID

## Authentication

Most endpoints require authentication. After obtaining a token from the `/auth/login` endpoint, use it in subsequent requests:

1. Set the Authorization header:
   - Key: `Authorization`
   - Value: `Bearer {{backend_token}}`

## Auth Routes

### Register a New User

```
POST {{base_url}}/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```

### Register a Provider

```
POST {{base_url}}/auth/register-provider
Content-Type: application/json

{
  "email": "provider@example.com",
  "password": "Password123!",
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "+1234567891",
  "serviceCategories": ["child-care", "elder-care"],
  "experience": 5,
  "bio": "Experienced caregiver with 5 years of experience"
}
```

### Login

```
POST {{base_url}}/auth/login
Authorization: Bearer {{firebase_id_token}}
```

### Forgot Password

```
POST {{base_url}}/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Reset Password

```
POST {{base_url}}/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token",
  "password": "NewPassword123!"
}
```

### Get Current User

```
GET {{base_url}}/auth/me
Authorization: Bearer {{backend_token}}
```

### Update Password

```
POST {{base_url}}/auth/update-password
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "currentPassword": "Password123!",
  "newPassword": "NewPassword123!"
}
```

### Verify Email

```
POST {{base_url}}/auth/verify-email
Authorization: Bearer {{backend_token}}
```

### Get User Profile

```
GET {{base_url}}/auth/profile
Authorization: Bearer {{backend_token}}
```

### Update User Profile

```
PUT {{base_url}}/auth/profile
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "address": "123 Main St, City, State, 12345"
}
```

## Service Routes

### Get All Services

```
GET {{base_url}}/services
```

### Search Services

```
GET {{base_url}}/services/search?query=babysitting&category=child-care
```

### Get Service Categories

```
GET {{base_url}}/services/categories
```

### Get Service Category by ID

```
GET {{base_url}}/services/categories/{{category_id}}
```

### Get Services by Category

```
GET {{base_url}}/services/category/{{category_id}}
```

### Get Service by ID

```
GET {{base_url}}/services/{{service_id}}
```

### Create Service (Provider Only)

```
POST {{base_url}}/services
Authorization: Bearer {{backend_token}}
Content-Type: multipart/form-data

title: Babysitting Service
description: Professional babysitting service for children of all ages
price[amount]: 25
price[type]: hourly
duration: 60
categoryId: {{category_id}}
images: [Attach files]
additionalDetails[includedServices]: ["Meal preparation", "Homework help"]
additionalDetails[specialRequirements]: "Please provide any dietary restrictions"
```

### Update Service (Provider Only)

```
PATCH {{base_url}}/services/{{service_id}}
Authorization: Bearer {{backend_token}}
Content-Type: multipart/form-data

title: Updated Babysitting Service
description: Professional babysitting service with additional features
price[amount]: 30
price[type]: hourly
duration: 120
images: [Attach files]
```

### Delete Service (Provider Only)

```
DELETE {{base_url}}/services/{{service_id}}
Authorization: Bearer {{backend_token}}
```

## Booking Routes

### Create Booking

```
POST {{base_url}}/bookings
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "serviceId": "{{service_id}}",
  "timeSlotId": "{{timeslot_id}}",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "United States"
  },
  "specialInstructions": "Please call when you arrive"
}
```

### Get User Bookings

```
GET {{base_url}}/bookings/user
Authorization: Bearer {{backend_token}}
```

### Get Provider Bookings (Provider Only)

```
GET {{base_url}}/bookings/provider
Authorization: Bearer {{backend_token}}
```

### Get Booking by ID

```
GET {{base_url}}/bookings/{{booking_id}}
Authorization: Bearer {{backend_token}}
```

### Update Booking Status (Provider or User)

```
PATCH {{base_url}}/bookings/{{booking_id}}/status
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "status": "completed"
}
```

### Cancel Booking

```
DELETE {{base_url}}/bookings/{{booking_id}}
Authorization: Bearer {{backend_token}}
```

## Time Slot Routes

### Get Service Time Slots

```
GET {{base_url}}/timeslots/service/{{service_id}}?startDate=2025-04-01&endDate=2025-04-30
```

### Book Time Slot

```
POST {{base_url}}/timeslots/{{timeslot_id}}/book
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "United States"
  },
  "specialInstructions": "Please call when you arrive"
}
```

### Create Time Slots (Provider Only)

```
POST {{base_url}}/timeslots
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "serviceId": "{{service_id}}",
  "slots": [
    {
      "date": "2025-04-15",
      "startTime": "09:00",
      "endTime": "10:00"
    },
    {
      "date": "2025-04-15",
      "startTime": "11:00",
      "endTime": "12:00"
    }
  ]
}
```

### Get Provider Time Slots (Provider Only)

```
GET {{base_url}}/timeslots/provider?serviceId={{service_id}}&startDate=2025-04-01&endDate=2025-04-30
Authorization: Bearer {{backend_token}}
```

### Update Time Slot (Provider Only)

```
PATCH {{base_url}}/timeslots/{{timeslot_id}}
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "startTime": "10:00",
  "endTime": "11:00"
}
```

### Delete Time Slot (Provider Only)

```
DELETE {{base_url}}/timeslots/{{timeslot_id}}
Authorization: Bearer {{backend_token}}
```

## Review Routes

### Get Provider Reviews

```
GET {{base_url}}/reviews/provider/{{provider_id}}
```

### Get Service Reviews

```
GET {{base_url}}/reviews/service/{{service_id}}
```

### Get Review by ID

```
GET {{base_url}}/reviews/{{review_id}}
```

### Create Review

```
POST {{base_url}}/reviews
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "serviceId": "{{service_id}}",
  "bookingId": "{{booking_id}}",
  "rating": 5,
  "comment": "Excellent service! Highly recommended."
}
```

### Get User Reviews

```
GET {{base_url}}/reviews/user
Authorization: Bearer {{backend_token}}
```

### Update Review

```
PATCH {{base_url}}/reviews/{{review_id}}
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "rating": 4,
  "comment": "Updated review: Very good service."
}
```

### Delete Review

```
DELETE {{base_url}}/reviews/{{review_id}}
Authorization: Bearer {{backend_token}}
```

## Wallet Routes

### Get Wallet

```
GET {{base_url}}/wallet
Authorization: Bearer {{backend_token}}
```

### Add Funds

```
POST {{base_url}}/wallet/add-funds
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "amount": 100,
  "paymentMethod": "credit_card",
  "paymentDetails": {
    "cardNumber": "4111111111111111",
    "expiryMonth": "12",
    "expiryYear": "2025",
    "cvv": "123"
  }
}
```

### Pay with Wallet

```
POST {{base_url}}/wallet/pay/{{booking_id}}
Authorization: Bearer {{backend_token}}
```

### Get Transactions

```
GET {{base_url}}/wallet/transactions
Authorization: Bearer {{backend_token}}
```

### Withdraw Funds

```
POST {{base_url}}/wallet/withdraw
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "amount": 50,
  "bankDetails": {
    "accountNumber": "1234567890",
    "routingNumber": "123456789",
    "accountHolderName": "John Doe"
  }
}
```

### Transfer to Provider (Admin Only)

```
POST {{base_url}}/wallet/transfer/{{provider_id}}
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "amount": 75,
  "description": "Payment for services rendered"
}
```

## Provider Routes

### Complete Onboarding

```
POST {{base_url}}/providers/onboarding
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "bio": "Experienced caregiver with 5 years of experience",
  "experience": 5,
  "serviceCategories": ["child-care", "elder-care"],
  "qualifications": ["CPR Certified", "First Aid Trained"],
  "availability": {
    "monday": ["09:00-17:00"],
    "tuesday": ["09:00-17:00"],
    "wednesday": ["09:00-17:00"],
    "thursday": ["09:00-17:00"],
    "friday": ["09:00-17:00"]
  }
}
```

### Get Onboarding Status

```
GET {{base_url}}/providers/onboarding-status
Authorization: Bearer {{backend_token}}
```

### Upload Documents

```
POST {{base_url}}/providers/documents
Authorization: Bearer {{backend_token}}
Content-Type: multipart/form-data

documentType: identification
documents: [Attach files]
```

### Update Profile Picture

```
POST {{base_url}}/providers/profile-picture
Authorization: Bearer {{backend_token}}
Content-Type: multipart/form-data

profilePicture: [Attach file]
```

### Update Address

```
POST {{base_url}}/providers/address
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "street": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "United States"
}
```

### Get Provider Services

```
GET {{base_url}}/providers/services
Authorization: Bearer {{backend_token}}
```

## Admin Routes

### Get All Users (Admin Only)

```
GET {{base_url}}/admin/users
Authorization: Bearer {{backend_token}}
```

### Get User by ID (Admin Only)

```
GET {{base_url}}/admin/users/{{user_id}}
Authorization: Bearer {{backend_token}}
```

### Update User Status (Admin Only)

```
PATCH {{base_url}}/admin/users/{{user_id}}/status
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "status": "active"
}
```

### Suspend User (Admin Only)

```
POST {{base_url}}/admin/users/{{user_id}}/suspend
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "reason": "Violation of terms of service"
}
```

### Activate User (Admin Only)

```
POST {{base_url}}/admin/users/{{user_id}}/activate
Authorization: Bearer {{backend_token}}
```

### Get All Services (Admin Only)

```
GET {{base_url}}/admin/services
Authorization: Bearer {{backend_token}}
```

### Manage Service Categories (Admin Only)

```
POST {{base_url}}/admin/service-categories
Authorization: Bearer {{backend_token}}
Content-Type: application/json

{
  "action": "create",
  "category": {
    "name": "Special Needs Care",
    "description": "Care services for individuals with special needs",
    "icon": "special-needs-icon"
  }
}
```

### Get All Bookings (Admin Only)

```
GET {{base_url}}/admin/bookings
Authorization: Bearer {{backend_token}}
```

### Generate Reports (Admin Only)

```
GET {{base_url}}/admin/reports?type=revenue&startDate=2025-01-01&endDate=2025-04-30
Authorization: Bearer {{backend_token}}
```

## Testing Workflows

### User Registration and Booking Flow

1. Register a new user
2. Login with the user
3. Browse services
4. View service details
5. View available time slots
6. Book a time slot
7. Add funds to wallet
8. Pay for booking
9. Leave a review

### Provider Registration and Service Management Flow

1. Register a new provider
2. Login with the provider
3. Complete onboarding
4. Upload documents
5. Create a service
6. Add time slots
7. View bookings
8. Update booking status
9. Withdraw funds

### Admin Management Flow

1. Login as admin
2. View all users
3. View all services
4. View all bookings
5. Generate reports
6. Manage service categories
7. Transfer funds to provider

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Ensure your token is valid and not expired
   - Check that you're using the correct token type (Firebase ID token vs. backend token)

2. **Permission Errors**:
   - Verify that your user has the correct role for the endpoint
   - Admin endpoints require admin role
   - Provider endpoints require provider role

3. **Request Format Errors**:
   - Double-check your request body format
   - Ensure all required fields are included
   - Validate data types (e.g., numbers for amounts, valid dates)

4. **File Upload Issues**:
   - Use multipart/form-data for file uploads
   - Check file size limits
   - Verify supported file formats

### Getting Help

If you encounter issues not covered in this guide, please:

1. Check the server logs for detailed error messages
2. Review the API documentation for endpoint-specific requirements
3. Contact the development team with the specific error message and request details
