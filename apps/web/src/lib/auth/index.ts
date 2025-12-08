import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  users,
  sessions,
  passwordResetTokens,
  emailVerificationTokens,
} from '../db/schema';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
  generateId,
} from './crypto';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PASSWORD_RESET_DURATION_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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
    role: 'user' | 'admin' | 'superadmin';
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
  role: 'user' | 'admin' | 'superadmin';
  plan: 'free' | 'pro' | 'premium';
  createdAt: number;
}

export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const db = getDb();
  const { email, password, name } = input;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  // Only block if user exists and is not deleted
  if (existing && existing.status !== 'deleted') {
    throw new AuthError(
      'EMAIL_EXISTS',
      'An account with this email already exists'
    );
  }

  // If a deleted account exists with this email, remove it first
  if (existing && existing.status === 'deleted') {
    await db.delete(users).where(eq(users.id, existing.id));
  }

  if (password.length < 8) {
    throw new AuthError(
      'WEAK_PASSWORD',
      'Password must be at least 8 characters'
    );
  }

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

  const sessionToken = generateToken();
  const sessionTokenHash = hashToken(sessionToken);
  const sessionId = generateId();
  const expiresAt = now + SESSION_DURATION_MS;

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    token: sessionTokenHash,
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
      role: 'user',
    },
    session: {
      token: sessionToken,
      expiresAt,
    },
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const db = getDb();
  const { email, password } = input;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (!user) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.status === 'suspended') {
    throw new AuthError('ACCOUNT_SUSPENDED', 'Your account has been suspended');
  }
  if (user.status === 'deleted') {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const now = Date.now();
  await db
    .update(users)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(users.id, user.id));

  const sessionToken = generateToken();
  const sessionTokenHash = hashToken(sessionToken);
  const sessionId = generateId();
  const expiresAt = now + SESSION_DURATION_MS;

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    token: sessionTokenHash,
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
      role: user.role as 'user' | 'admin' | 'superadmin',
    },
    session: {
      token: sessionToken,
      expiresAt,
    },
  };
}

export async function logout(sessionToken: string): Promise<void> {
  const db = getDb();
  const tokenHash = hashToken(sessionToken);
  await db.delete(sessions).where(eq(sessions.token, tokenHash));
}

export async function validateSession(
  sessionToken: string
): Promise<User | null> {
  const db = getDb();
  const tokenHash = hashToken(sessionToken);
  const now = Date.now();

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, tokenHash));

  if (!session || session.expiresAt < now) {
    if (session) {
      await db.delete(sessions).where(eq(sessions.id, session.id));
    }
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));

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
    role: user.role as 'user' | 'admin' | 'superadmin',
    plan: user.plan as 'free' | 'pro' | 'premium',
    createdAt: user.createdAt,
  };
}

export async function createPasswordResetToken(
  email: string
): Promise<string | null> {
  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (!user || user.status !== 'active') {
    return null;
  }

  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));

  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = now + PASSWORD_RESET_DURATION_MS;

  await db.insert(passwordResetTokens).values({
    id: generateId(),
    userId: user.id,
    token: tokenHash,
    expiresAt,
    createdAt: now,
  });

  return token;
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<boolean> {
  const db = getDb();
  const tokenHash = hashToken(token);
  const now = Date.now();

  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, tokenHash));

  if (!resetToken || resetToken.expiresAt < now || resetToken.usedAt) {
    return false;
  }

  if (newPassword.length < 8) {
    throw new AuthError(
      'WEAK_PASSWORD',
      'Password must be at least 8 characters'
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, resetToken.userId));

  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, resetToken.id));

  await db.delete(sessions).where(eq(sessions.userId, resetToken.userId));

  return true;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) {
    return false;
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AuthError('INVALID_PASSWORD', 'Current password is incorrect');
  }

  if (newPassword.length < 8) {
    throw new AuthError(
      'WEAK_PASSWORD',
      'Password must be at least 8 characters'
    );
  }

  const passwordHash = await hashPassword(newPassword);
  const now = Date.now();

  await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, userId));

  return true;
}

export async function createEmailVerificationToken(
  userId: string
): Promise<string | null> {
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user || user.status !== 'active' || user.emailVerified) {
    return null;
  }

  // Delete any existing tokens for this user
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));

  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = now + EMAIL_VERIFICATION_DURATION_MS;

  await db.insert(emailVerificationTokens).values({
    id: generateId(),
    userId,
    email: user.email,
    token: tokenHash,
    expiresAt,
    createdAt: now,
  });

  return token;
}

export async function verifyEmail(token: string): Promise<boolean> {
  const db = getDb();
  const tokenHash = hashToken(token);
  const now = Date.now();

  console.log('[verifyEmail] Looking up token...');

  const [verificationToken] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, tokenHash));

  if (!verificationToken) {
    console.log('[verifyEmail] Token not found in database');
    return false;
  }

  if (verificationToken.expiresAt < now) {
    console.log('[verifyEmail] Token expired');
    return false;
  }

  if (verificationToken.usedAt) {
    console.log('[verifyEmail] Token already used');
    return false;
  }

  console.log('[verifyEmail] Token valid, updating user:', verificationToken.userId);

  // Mark email as verified
  await db
    .update(users)
    .set({ emailVerified: true, emailVerifiedAt: now, updatedAt: now })
    .where(eq(users.id, verificationToken.userId));

  // Mark token as used
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(eq(emailVerificationTokens.id, verificationToken.id));

  // Verify the update worked
  const [updatedUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, verificationToken.userId));

  console.log('[verifyEmail] User emailVerified after update:', updatedUser?.emailVerified);

  return true;
}
