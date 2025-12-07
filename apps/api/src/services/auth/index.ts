import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  users,
  sessions,
  passwordResetTokens,
  emailVerificationTokens,
} from '../../db/schema';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
  generateId,
} from './crypto';
import { seedDefaultCategoriesForUser } from '../categories/index.js';

// Session duration: 30 days
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
// Password reset token duration: 1 hour
const PASSWORD_RESET_DURATION_MS = 60 * 60 * 1000;
// Email verification token duration: 24 hours
const EMAIL_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1000;

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    plan: 'free' | 'pro' | 'premium';
  };
  session: {
    token: string;
    expiresAt: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  status: 'active' | 'suspended' | 'deleted';
  plan: 'free' | 'pro' | 'premium';
  createdAt: number;
}

/**
 * Register a new user
 */
export async function register(input: RegisterInput): Promise<AuthResult> {
  const db = await getDb();
  const { email, password, name } = input;

  // Check if user already exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();

  if (existing) {
    throw new AuthError(
      'EMAIL_EXISTS',
      'An account with this email already exists'
    );
  }

  // Validate password strength
  if (password.length < 8) {
    throw new AuthError(
      'WEAK_PASSWORD',
      'Password must be at least 8 characters'
    );
  }

  // Create user
  const userId = generateId();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    name: name || null,
    emailVerified: false,
    status: 'active',
    plan: 'free',
    createdAt: now,
    updatedAt: now,
  });

  // Create default categories for the new user (async, don't block registration)
  seedDefaultCategoriesForUser(userId).catch((err) => {
    console.error('Failed to seed default categories:', err);
  });

  // Create session
  const sessionToken = generateToken();
  const sessionTokenHash = hashToken(sessionToken);
  const sessionId = generateId();
  const expiresAt = now + SESSION_DURATION_MS;

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    token: sessionTokenHash, // Store hashed token for security
    expiresAt,
    createdAt: now,
  });

  return {
    user: {
      id: userId,
      email: email.toLowerCase(),
      name: name || null,
      emailVerified: false,
      plan: 'free',
    },
    session: {
      token: sessionToken,
      expiresAt,
    },
  };
}

/**
 * Login a user
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const db = await getDb();
  const { email, password } = input;

  // Find user
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();

  if (!user) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Check status
  if (user.status === 'suspended') {
    throw new AuthError('ACCOUNT_SUSPENDED', 'Your account has been suspended');
  }
  if (user.status === 'deleted') {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Update last login
  const now = Date.now();
  await db
    .update(users)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(users.id, user.id));

  // Create session
  const sessionToken = generateToken();
  const sessionTokenHash = hashToken(sessionToken);
  const sessionId = generateId();
  const expiresAt = now + SESSION_DURATION_MS;

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    token: sessionTokenHash, // Store hashed token for security
    expiresAt,
    createdAt: now,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      plan: user.plan as 'free' | 'pro' | 'premium',
    },
    session: {
      token: sessionToken,
      expiresAt,
    },
  };
}

/**
 * Logout a user (invalidate session)
 */
export async function logout(sessionToken: string): Promise<void> {
  const db = await getDb();
  const tokenHash = hashToken(sessionToken);

  await db.delete(sessions).where(eq(sessions.token, tokenHash));
}

/**
 * Validate a session token and return the user
 */
export async function validateSession(
  sessionToken: string
): Promise<User | null> {
  const db = await getDb();
  const tokenHash = hashToken(sessionToken);
  const now = Date.now();

  // Find session
  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, tokenHash))
    .get();

  if (!session || session.expiresAt < now) {
    // Delete expired session if found
    if (session) {
      await db.delete(sessions).where(eq(sessions.id, session.id));
    }
    return null;
  }

  // Find user
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (!user || user.status !== 'active') {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    status: user.status as 'active' | 'suspended' | 'deleted',
    plan: user.plan as 'free' | 'pro' | 'premium',
    createdAt: user.createdAt,
  };
}

/**
 * Create a password reset token
 */
export async function createPasswordResetToken(
  email: string
): Promise<string | null> {
  const db = await getDb();

  // Find user
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();

  if (!user || user.status !== 'active') {
    // Don't reveal if user exists
    return null;
  }

  // Delete any existing tokens for this user
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));

  // Create new token
  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = now + PASSWORD_RESET_DURATION_MS;

  await db.insert(passwordResetTokens).values({
    id: generateId(),
    userId: user.id,
    token: tokenHash, // Store hashed token for security
    expiresAt,
    createdAt: now,
  });

  return token;
}

/**
 * Reset password using a token
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<boolean> {
  const db = await getDb();
  const tokenHash = hashToken(token);
  const now = Date.now();

  // Find token
  const resetToken = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, tokenHash))
    .get();

  if (!resetToken || resetToken.expiresAt < now || resetToken.usedAt) {
    return false;
  }

  // Validate password strength
  if (newPassword.length < 8) {
    throw new AuthError(
      'WEAK_PASSWORD',
      'Password must be at least 8 characters'
    );
  }

  // Update password
  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, resetToken.userId));

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, resetToken.id));

  // Invalidate all sessions for this user
  await db.delete(sessions).where(eq(sessions.userId, resetToken.userId));

  return true;
}

/**
 * Create email verification token
 */
export async function createEmailVerificationToken(
  userId: string
): Promise<string> {
  const db = await getDb();

  // Delete any existing tokens for this user
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));

  // Create new token
  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = now + EMAIL_VERIFICATION_DURATION_MS;

  await db.insert(emailVerificationTokens).values({
    id: generateId(),
    userId,
    token: tokenHash, // Store hashed token for security
    email: '', // Will be populated when we know the email
    expiresAt,
    createdAt: now,
  });

  return token;
}

/**
 * Verify email using a token
 */
export async function verifyEmail(token: string): Promise<boolean> {
  const db = await getDb();
  const tokenHash = hashToken(token);
  const now = Date.now();

  // Find token
  const verificationToken = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, tokenHash))
    .get();

  if (!verificationToken || verificationToken.expiresAt < now) {
    return false;
  }

  // Update user
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: now })
    .where(eq(users.id, verificationToken.userId));

  // Delete token
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.id, verificationToken.id));

  return true;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const db = await getDb();

  const user = await db.select().from(users).where(eq(users.id, userId)).get();

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    status: user.status as 'active' | 'suspended' | 'deleted',
    plan: user.plan as 'free' | 'pro' | 'premium',
    createdAt: user.createdAt,
  };
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  updates: { name?: string; avatarUrl?: string }
): Promise<User | null> {
  const db = await getDb();
  const now = Date.now();

  await db
    .update(users)
    .set({ ...updates, updatedAt: now })
    .where(eq(users.id, userId));

  return getUserById(userId);
}

/**
 * Change password (requires current password)
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const db = await getDb();

  // Get user
  const user = await db.select().from(users).where(eq(users.id, userId)).get();

  if (!user) {
    return false;
  }

  // Verify current password
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AuthError('INVALID_PASSWORD', 'Current password is incorrect');
  }

  // Validate new password strength
  if (newPassword.length < 8) {
    throw new AuthError(
      'WEAK_PASSWORD',
      'Password must be at least 8 characters'
    );
  }

  // Update password
  const passwordHash = await hashPassword(newPassword);
  const now = Date.now();

  await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, userId));

  return true;
}

/**
 * Delete all sessions for a user (logout everywhere)
 */
export async function logoutAll(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Custom auth error class
 */
export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
