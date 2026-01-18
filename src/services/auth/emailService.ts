import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EmailConfig {
  from: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

/**
 * Email Service for Authentication
 * Handles email verification and password reset emails
 */
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;
  private baseUrl: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@complyx.com';
    this.baseUrl = process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:3000';

    // Initialize email transporter
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter based on environment variables
   */
  private initializeTransporter(): void {
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

    if (emailProvider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      });
    } else if (emailProvider === 'sendgrid') {
      // SendGrid can be configured here if needed
      // For now, using SMTP
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY || '',
        },
      });
    }

    // In development, use console logging if no email config
    if (!this.transporter && process.env.NODE_ENV === 'development') {
      console.warn('Email service not configured. Emails will be logged to console.');
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(userId: string, email: string, token: string): Promise<void> {
    const verificationUrl = `${this.baseUrl}/auth/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Email - Complyx</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Verify Your Email Address</h1>
            <p>Thank you for signing up for Complyx! Please verify your email address to complete your registration.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Verify Email</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">This link will expire in 24 hours. If you didn't create an account, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
      Verify Your Email Address - Complyx
      
      Thank you for signing up for Complyx! Please verify your email address to complete your registration.
      
      Click this link to verify your email: ${verificationUrl}
      
      This link will expire in 24 hours. If you didn't create an account, please ignore this email.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address - Complyx',
      html,
      text,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userId: string, email: string, token: string): Promise<void> {
    const resetUrl = `${this.baseUrl}/auth/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password - Complyx</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Reset Your Password</h1>
            <p>We received a request to reset your password for your Complyx account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
      Reset Your Password - Complyx
      
      We received a request to reset your password for your Complyx account.
      
      Click this link to reset your password: ${resetUrl}
      
      This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password - Complyx',
      html,
      text,
    });
  }

  /**
   * Send welcome email after email verification
   */
  async sendWelcomeEmail(email: string, name?: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Complyx</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Welcome to Complyx!</h1>
            <p>Hi ${name || 'there'},</p>
            <p>Your email has been verified and your account is now active. You can start using Complyx to assess your IFRS S1 & S2 compliance.</p>
            <p>Get started by:</p>
            <ul>
              <li>Exploring the dashboard</li>
              <li>Starting a new assessment</li>
              <li>Chatting with our AI assistant</li>
            </ul>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The Complyx Team</p>
          </div>
        </body>
      </html>
    `;

    const text = `
      Welcome to Complyx!
      
      Hi ${name || 'there'},
      
      Your email has been verified and your account is now active. You can start using Complyx to assess your IFRS S1 & S2 compliance.
      
      Get started by exploring the dashboard, starting a new assessment, or chatting with our AI assistant.
      
      If you have any questions, feel free to reach out to our support team.
      
      Best regards,
      The Complyx Team
    `;

    await this.sendEmail({
      to: email,
      subject: 'Welcome to Complyx!',
      html,
      text,
    });
  }

  /**
   * Generic email sending method
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    if (!this.transporter) {
      // In development, log email to console
      if (process.env.NODE_ENV === 'development') {
        console.log('=== EMAIL (Development Mode) ===');
        console.log('To:', options.to);
        console.log('Subject:', options.subject);
        console.log('Text:', options.text);
        console.log('===============================');
        return;
      }
      throw new Error('Email transporter not configured');
    }

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Generate and store verification token for user
   */
  async generateVerificationToken(userId: string): Promise<string> {
    const { authService } = await import('./authService');
    const token = authService.generateSecureToken();

    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationToken: token,
      },
    });

    return token;
  }

  /**
   * Generate and store password reset token for user
   */
  async generatePasswordResetToken(userId: string): Promise<string> {
    const { authService } = await import('./authService');
    const token = authService.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    await prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: token,
        resetTokenExpires: expiresAt,
      },
    });

    return token;
  }

  /**
   * Verify email verification token
   */
  async verifyEmailToken(token: string): Promise<{ userId: string; email: string } | null> {
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
      select: { id: true, email: true },
    });

    if (!user) {
      return null;
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        verificationToken: null, // Clear token after use
      },
    });

    return { userId: user.id, email: user.email };
  }

  /**
   * Verify password reset token
   */
  async verifyPasswordResetToken(token: string): Promise<{ userId: string; email: string } | null> {
    const user = await prisma.user.findUnique({
      where: { resetToken: token },
      select: { id: true, email: true, resetTokenExpires: true },
    });

    if (!user || !user.resetTokenExpires) {
      return null;
    }

    // Check if token has expired
    if (new Date() > user.resetTokenExpires) {
      // Clear expired token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: null,
          resetTokenExpires: null,
        },
      });
      return null;
    }

    return { userId: user.id, email: user.email };
  }

  /**
   * Clear password reset token after use
   */
  async clearPasswordResetToken(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: null,
        resetTokenExpires: null,
      },
    });
  }
}

export const emailService = new EmailService();
