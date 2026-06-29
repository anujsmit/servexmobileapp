// lib/config.ts

// Use the environment variable from .env
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// For debugging
console.log('🔍 API_BASE_URL:', API_BASE_URL);