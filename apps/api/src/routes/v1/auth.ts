import type { FastifyInstance } from 'fastify';
import {
  register,
  login,
  logout,
  validateSession,
  createPasswordResetToken,
  resetPassword,
  changePassword,
  AuthError,
} from '../../services/auth/index.js';

// Request body types
interface RegisterBody {
  email: string;
  password: string;
  name?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface ResetPasswordRequestBody {
  email: string;
}

interface ResetPasswordBody {
  token: string;
  password: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

// Cookie configuration
const SESSION_COOKIE_NAME = 'session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};

/**
 * Auth routes
 * POST /auth/register - Register new user
 * POST /auth/login - Login user
 * POST /auth/logout - Logout user
 * GET /auth/me - Get current user
 * POST /auth/forgot-password - Request password reset
 * POST /auth/reset-password - Reset password with token
 * POST /auth/change-password - Change password (authenticated)
 */
export default async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post<{ Body: RegisterBody }>(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await register(request.body);

        // Set session cookie
        reply.setCookie(SESSION_COOKIE_NAME, result.session.token, COOKIE_OPTIONS);

        return {
          user: result.user,
          message: 'Registration successful',
        };
      } catch (error) {
        if (error instanceof AuthError) {
          if (error.code === 'EMAIL_EXISTS') {
            return reply.status(409).send({
              error: error.code,
              message: error.message,
            });
          }
          if (error.code === 'WEAK_PASSWORD') {
            return reply.status(400).send({
              error: error.code,
              message: error.message,
            });
          }
        }
        throw error;
      }
    }
  );

  // Login
  fastify.post<{ Body: LoginBody }>(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await login(request.body);

        // Set session cookie
        reply.setCookie(SESSION_COOKIE_NAME, result.session.token, COOKIE_OPTIONS);

        return {
          user: result.user,
          message: 'Login successful',
        };
      } catch (error) {
        if (error instanceof AuthError) {
          if (error.code === 'INVALID_CREDENTIALS') {
            return reply.status(401).send({
              error: error.code,
              message: error.message,
            });
          }
          if (error.code === 'ACCOUNT_SUSPENDED') {
            return reply.status(403).send({
              error: error.code,
              message: error.message,
            });
          }
        }
        throw error;
      }
    }
  );

  // Logout
  fastify.post('/logout', async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];

    if (sessionToken) {
      await logout(sessionToken);
    }

    // Clear cookie
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

    return { message: 'Logout successful' };
  });

  // Get current user
  fastify.get('/me', async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];

    if (!sessionToken) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    const user = await validateSession(sessionToken);

    if (!user) {
      reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      return reply.status(401).send({
        error: 'SESSION_EXPIRED',
        message: 'Session expired or invalid',
      });
    }

    return { user };
  });

  // Request password reset
  fastify.post<{ Body: ResetPasswordRequestBody }>(
    '/forgot-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (request) => {
      const token = await createPasswordResetToken(request.body.email);

      // In production, send email with token
      // For now, log it (only in development)
      if (token && process.env.NODE_ENV === 'development') {
        console.log(`Password reset token for ${request.body.email}: ${token}`);
      }

      // Always return success to prevent email enumeration
      return {
        message: 'If an account exists with this email, a password reset link has been sent',
      };
    }
  );

  // Reset password with token
  fastify.post<{ Body: ResetPasswordBody }>(
    '/reset-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const success = await resetPassword(request.body.token, request.body.password);

        if (!success) {
          return reply.status(400).send({
            error: 'INVALID_TOKEN',
            message: 'Invalid or expired reset token',
          });
        }

        return { message: 'Password reset successful. Please login with your new password.' };
      } catch (error) {
        if (error instanceof AuthError && error.code === 'WEAK_PASSWORD') {
          return reply.status(400).send({
            error: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Change password (requires authentication)
  fastify.post<{ Body: ChangePasswordBody }>(
    '/change-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      const sessionToken = request.cookies[SESSION_COOKIE_NAME];

      if (!sessionToken) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }

      const user = await validateSession(sessionToken);

      if (!user) {
        return reply.status(401).send({
          error: 'SESSION_EXPIRED',
          message: 'Session expired or invalid',
        });
      }

      try {
        await changePassword(
          user.id,
          request.body.currentPassword,
          request.body.newPassword
        );

        return { message: 'Password changed successfully' };
      } catch (error) {
        if (error instanceof AuthError) {
          if (error.code === 'INVALID_PASSWORD') {
            return reply.status(400).send({
              error: error.code,
              message: error.message,
            });
          }
          if (error.code === 'WEAK_PASSWORD') {
            return reply.status(400).send({
              error: error.code,
              message: error.message,
            });
          }
        }
        throw error;
      }
    }
  );
}
