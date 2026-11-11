/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cryptography Service (Universal: Browser, Node.js, and Apps Script V8 compatible)
 * - PBKDF2-HMAC-SHA256 for user passwords with unique per-user random salt
 * - HMAC-SHA256 for Customer Email OTP hashes
 */

import CryptoJS from 'crypto-js';

// Default OTP secret for local/mock development (Script Properties will hold production value)
export const DEFAULT_OTP_HMAC_SECRET = 'savor_restaurant_32byte_secure_secret_key_2026';

/**
 * Generates a random 6-digit OTP string between 100000 and 999999
 */
export function generateRandomOTP(): string {
  const min = 100000;
  const max = 999999;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/**
 * Generates an HMAC-SHA256 hex hash of the OTP using the secret
 */
export function hashOTP(otp: string, secret: string = DEFAULT_OTP_HMAC_SECRET): string {
  return CryptoJS.HmacSHA256(otp.trim(), secret).toString(CryptoJS.enc.Hex);
}

/**
 * Verifies an OTP against a stored HMAC-SHA256 hash using timing-safe comparison
 */
export function verifyOTPHash(
  inputOtp: string,
  storedHash: string,
  secret: string = DEFAULT_OTP_HMAC_SECRET
): boolean {
  if (!inputOtp || !storedHash) return false;
  const computedHash = hashOTP(inputOtp, secret);
  return timingSafeEqualStr(computedHash.toLowerCase(), storedHash.toLowerCase());
}

/**
 * Generates a random 16-byte hex salt for user passwords
 */
export function generateSalt(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const array = new Uint8Array(16);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Fallback
  return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
}

/**
 * Hashes a password using PBKDF2-HMAC-SHA256
 * 1,000 iterations for smooth browser and Apps Script V8 execution
 */
export function hashPassword(
  password: string,
  salt: string,
  iterations = 1000
): string {
  return CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(salt), {
    keySize: 256 / 32, // 32 bytes (256 bits)
    iterations,
    hasher: CryptoJS.algo.SHA256,
  }).toString(CryptoJS.enc.Hex);
}

/**
 * Verifies a password against a stored PBKDF2 hash and salt using timing-safe comparison
 */
export function verifyPassword(
  passwordAttempt: string,
  storedHash: string,
  salt: string,
  iterations = 1000
): boolean {
  if (!passwordAttempt || !storedHash || !salt) return false;
  const computedHash = hashPassword(passwordAttempt, salt, iterations);
  return timingSafeEqualStr(computedHash.toLowerCase(), storedHash.toLowerCase());
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generates a secure random session ID token
 */
export function generateSessionToken(prefix = 'sess'): string {
  const randomHex = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
  return `${prefix}_${Date.now()}_${randomHex}`;
}
