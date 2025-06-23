// Test script to verify the import of paymentService.ts
console.log('Testing import of paymentService.ts...');

try {
  // Import the module to test if it can be loaded without errors
  const paymentService = require('./src/services/paymentService');
  
  // If we get here, the import was successful
  console.log('Successfully imported paymentService module!');
  console.log('The fix for the ProviderConnectAccount import issue has worked.');
  
  // Check if the createPaymentIntent function exists
  if (typeof paymentService.createPaymentIntent === 'function') {
    console.log('createPaymentIntent function is available.');
  } else {
    console.log('createPaymentIntent function is not available.');
  }
} catch (error) {
  console.error('Error importing paymentService module:', error);
  console.error('The fix for the ProviderConnectAccount import issue did not work.');
}
