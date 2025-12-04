import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token (for sessions, password resets, etc.)
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Hash a token for secure storage (using SHA-256)
 * We store hashed tokens in the database so if the DB is compromised,
 * the tokens are not directly usable
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a unique ID (UUID v4 style)
 */
export function generateId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate a short numeric code (for email verification, 2FA, etc.)
 */
export function generateNumericCode(length: number = 6): string {
  const max = Math.pow(10, length);
  const randomNum = Math.floor(Math.random() * max);
  return randomNum.toString().padStart(length, '0');
}
