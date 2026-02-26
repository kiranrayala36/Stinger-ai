/**
 * Environment Variable Verification Script
 * Run with: node verify-env.js
 */

require('dotenv').config();

console.log('\n🔍 Checking environment variables...\n');

const variables = [
  { name: 'EXPO_PUBLIC_SUPABASE_URL', public: true },
  { name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY', public: true },
  { name: 'OPENROUTER_API_KEY', public: false },
];

let hasErrors = false;
let configuredCount = 0;

for (const variable of variables) {
  const value = process.env[variable.name];
  const status = value ? '✅ Configured' : '❌ Missing';
  
  if (value) {
    configuredCount++;
    // For security, don't show the actual values, just that they exist
    const displayValue = variable.public 
      ? value.substring(0, 8) + '...' 
      : '[HIDDEN]';
    
    console.log(`${status}: ${variable.name} = ${displayValue}`);
  } else {
    hasErrors = true;
    console.log(`${status}: ${variable.name}`);
  }
}

console.log(`\n🔑 ${configuredCount} of ${variables.length} environment variables configured.\n`);

if (hasErrors) {
  console.log('⚠️  Some environment variables are missing. Please check your .env file.');
  console.log('Add the missing variables to your .env file in the project root:\n');
  
  for (const variable of variables) {
    if (!process.env[variable.name]) {
      console.log(`${variable.name}=your_${variable.name.toLowerCase()}_here`);
    }
  }
  
  console.log('\nRefer to the documentation for details on obtaining these values.');
} else {
  console.log('🎉 All required environment variables are configured correctly!');
}

console.log('\n'); 