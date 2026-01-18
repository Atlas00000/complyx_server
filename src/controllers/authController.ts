import { Request, Response } from 'express';
import { authService } from '../services/auth/authService';
import { userService } from '../services/user/userService';
import { emailService } from '../services/auth/emailService';
import { sessionManagementService } from '../services/auth/sessionManagementService';
import { auditService } from '../services/auth/auditService';
import { rbacService } from '../services/auth/rbacService';

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  organizationId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export class AuthController {
  /**
   * Register a new user
   */
  async register(req: Request<{}, {}, RegisterRequest>, res: Response): Promise<void> {
    try {
      const { email, password, name, organizationId } = req.body;

      // Validate input
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      // Validate password strength
      const passwordValidation = authService.validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        res.status(400).json({
          error: 'Password does not meet requirements',
          details: passwordValidation.errors,
        });
        return;
      }

      // Check if user already exists
      const existingUser = await userService.getUserByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: 'User with this email already exists' });
        return;
      }

      // Hash password
      const passwordHash = await authService.hashPassword(password);

      // Create user
      const user = await userService.createUser({
        email,
        name,
        passwordHash,
        organizationId,
        emailVerified: false,
      });

      // Generate verification token and send email
      const verificationToken = await emailService.generateVerificationToken(user.id);
      await emailService.sendVerificationEmail(user.id, email, verificationToken);

      // Log registration
      await auditService.logUserAction(
        user.id,
        'user_registered',
        'user',
        user.id,
        { email, organizationId },
        req.ip,
        req.get('user-agent') || undefined
      );

      res.status(201).json({
        message: 'User registered successfully. Please check your email to verify your account.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  }

  /**
   * Login user
   */
  async login(req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Get user by email
      const user = await userService.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Get user with password hash for verification
      const userWithPassword = await userService.getUserById(user.id);
      if (!userWithPassword) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Verify password (we need to get the actual user from DB with passwordHash)
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, passwordHash: true, roleId: true, organizationId: true },
      });

      if (!dbUser || !dbUser.passwordHash) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const passwordValid = await authService.verifyPassword(password, dbUser.passwordHash);
      if (!passwordValid) {
        // Log failed login attempt
        await auditService.logAccessAttempt(
          user.id,
          'login',
          'login',
          false,
          req.ip,
          req.get('user-agent') || undefined
        );

        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Check if email is verified
      if (!user.emailVerified) {
        res.status(403).json({
          error: 'Email not verified',
          message: 'Please verify your email before logging in',
        });
        return;
      }

      // Update last login
      await userService.updateLastLogin(user.id);

      // Create session
      const sessionId = await sessionManagementService.createSession({
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });

      // Generate tokens
      const tokens = authService.generateTokens({
        userId: user.id,
        email: user.email,
        roleId: user.roleId || undefined,
        organizationId: user.organizationId || undefined,
      });

      // Get user role and permissions
      const role = await rbacService.getUserRole(user.id);

      // Log successful login
      await auditService.logAccessAttempt(
        user.id,
        'login',
        'login',
        true,
        req.ip,
        req.get('user-agent') || undefined
      );

      res.json({
        message: 'Login successful',
        tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          roleId: user.roleId,
          organizationId: user.organizationId,
          role: role ? { name: role.name, permissions: role.permissions } : null,
        },
        sessionId,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Failed to login' });
    }
  }

  /**
   * Logout user
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authService.extractTokenFromHeader(authHeader);

      if (token) {
        try {
          const payload = authService.verifyToken(token);
          const sessionId = req.body.sessionId || req.query.sessionId;

          if (sessionId && typeof sessionId === 'string') {
            await sessionManagementService.deactivateSession(sessionId, payload.userId);
          }

          // Log logout
          await auditService.logUserAction(
            payload.userId,
            'logout',
            'session',
            sessionId || undefined,
            {},
            req.ip,
            req.get('user-agent') || undefined
          );
        } catch (error) {
          // Token invalid, but still return success
        }
      }

      res.json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Failed to logout' });
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        res.status(400).json({ error: 'Verification token is required' });
        return;
      }

      const result = await emailService.verifyEmailToken(token);
      if (!result) {
        res.status(400).json({ error: 'Invalid or expired verification token' });
        return;
      }

      // Send welcome email
      const user = await userService.getUserById(result.userId);
      if (user) {
        await emailService.sendWelcomeEmail(result.email, user.name || undefined);
      }

      // Log email verification
      await auditService.logUserAction(
        result.userId,
        'email_verified',
        'user',
        result.userId,
        {},
        req.ip,
        req.get('user-agent') || undefined
      );

      res.json({
        message: 'Email verified successfully',
        user: {
          id: result.userId,
          email: result.email,
        },
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ error: 'Failed to verify email' });
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(req: Request<{}, {}, ForgotPasswordRequest>, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      const user = await userService.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists for security
        res.json({
          message: 'If an account exists with this email, a password reset link has been sent.',
        });
        return;
      }

      // Generate reset token
      const resetToken = await emailService.generatePasswordResetToken(user.id);
      await emailService.sendPasswordResetEmail(user.id, email, resetToken);

      // Log password reset request
      await auditService.logUserAction(
        user.id,
        'password_reset_requested',
        'user',
        user.id,
        {},
        req.ip,
        req.get('user-agent') || undefined
      );

      res.json({
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req: Request<{}, {}, ResetPasswordRequest>, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({ error: 'Token and new password are required' });
        return;
      }

      // Validate password strength
      const passwordValidation = authService.validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        res.status(400).json({
          error: 'Password does not meet requirements',
          details: passwordValidation.errors,
        });
        return;
      }

      // Verify reset token
      const result = await emailService.verifyPasswordResetToken(token);
      if (!result) {
        res.status(400).json({ error: 'Invalid or expired reset token' });
        return;
      }

      // Hash new password
      const passwordHash = await authService.hashPassword(newPassword);

      // Update user password
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.user.update({
        where: { id: result.userId },
        data: {
          passwordHash,
        },
      });

      // Clear reset token
      await emailService.clearPasswordResetToken(result.userId);

      // Log password reset
      await auditService.logUserAction(
        result.userId,
        'password_reset',
        'user',
        result.userId,
        {},
        req.ip,
        req.get('user-agent') || undefined
      );

      res.json({
        message: 'Password reset successfully',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authService.extractTokenFromHeader(authHeader);

      if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const payload = authService.verifyToken(token);
      const user = await userService.getUserById(payload.userId);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const role = await rbacService.getUserRole(user.id);
      const permissions = await rbacService.getUserPermissions(user.id);

      res.json({
        user: {
          ...user,
          role: role ? { name: role.name, permissions: role.permissions } : null,
          permissions,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('expired')) {
        res.status(401).json({ error: 'Token expired' });
        return;
      }
      res.status(401).json({ error: 'Invalid token' });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      const payload = authService.verifyToken(refreshToken);
      const user = await userService.getUserById(payload.userId);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Generate new tokens
      const tokens = authService.generateTokens({
        userId: user.id,
        email: user.email,
        roleId: user.roleId || undefined,
        organizationId: user.organizationId || undefined,
      });

      res.json({
        tokens,
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }
}
