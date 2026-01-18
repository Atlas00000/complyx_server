import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import { authService } from './authService';
import { sessionManagementService } from './sessionManagementService';

const prisma = new PrismaClient();

export interface OAuthProfile {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  provider: 'google' | 'microsoft';
}

/**
 * OAuth Service
 * Handles Google and Microsoft SSO integration
 */
export class OAuthService {
  private googleClientId: string;
  private googleClientSecret: string;
  private microsoftClientId: string;
  private microsoftClientSecret: string;
  private callbackBaseUrl: string;

  constructor() {
    this.googleClientId = process.env.GOOGLE_CLIENT_ID || '';
    this.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.microsoftClientId = process.env.MICROSOFT_CLIENT_ID || '';
    this.microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
    this.callbackBaseUrl = process.env.APP_URL || process.env.SERVER_URL || 'http://localhost:3001';

    this.initializeStrategies();
  }

  /**
   * Initialize Passport strategies
   */
  private initializeStrategies(): void {
    // Google OAuth Strategy
    if (this.googleClientId && this.googleClientSecret) {
      passport.use(
        new GoogleStrategy(
          {
            clientID: this.googleClientId,
            clientSecret: this.googleClientSecret,
            callbackURL: `${this.callbackBaseUrl}/api/auth/google/callback`,
          },
          async (accessToken, refreshToken, profile, done) => {
            try {
              const oauthProfile: OAuthProfile = {
                id: profile.id,
                email: profile.emails?.[0]?.value || '',
                name: profile.displayName || profile.name?.givenName || undefined,
                picture: profile.photos?.[0]?.value || undefined,
                provider: 'google',
              };

              const user = await this.findOrCreateUser(oauthProfile);
              return done(null, user);
            } catch (error) {
              return done(error as Error, null);
            }
          }
        )
      );
    }

    // Microsoft OAuth Strategy
    if (this.microsoftClientId && this.microsoftClientSecret) {
      passport.use(
        new MicrosoftStrategy(
          {
            clientID: this.microsoftClientId,
            clientSecret: this.microsoftClientSecret,
            callbackURL: `${this.callbackBaseUrl}/api/auth/microsoft/callback`,
            tenant: 'common', // 'common' allows both personal and work/school accounts
          },
          async (accessToken, refreshToken, profile, done) => {
            try {
              const oauthProfile: OAuthProfile = {
                id: profile.id,
                email: profile.emails?.[0]?.value || '',
                name: profile.displayName || profile.name?.givenName || undefined,
                picture: profile.photos?.[0]?.value || undefined,
                provider: 'microsoft',
              };

              const user = await this.findOrCreateUser(oauthProfile);
              return done(null, user);
            } catch (error) {
              return done(error as Error, null);
            }
          }
        )
      );
    }
  }

  /**
   * Find or create user from OAuth profile
   */
  private async findOrCreateUser(profile: OAuthProfile) {
    if (!profile.email) {
      throw new Error('Email is required for OAuth authentication');
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: profile.email },
      include: { role: true, organization: true },
    });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name || null,
          emailVerified: true, // OAuth emails are pre-verified
          emailVerifiedAt: new Date(),
          passwordHash: null, // OAuth users don't have passwords
        },
        include: {
          role: true,
          organization: true,
        },
      });

      // Log user creation
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId || null,
          action: 'user_created',
          resource: 'user',
          resourceId: user.id,
          details: JSON.stringify({
            provider: profile.provider,
            method: 'oauth',
          }),
        },
      });
    } else {
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    return user;
  }

  /**
   * Generate tokens for OAuth user
   */
  async generateTokensForUser(user: any) {
    const payload = {
      userId: user.id,
      email: user.email,
      roleId: user.roleId || undefined,
      organizationId: user.organizationId || undefined,
    };

    const tokens = authService.generateTokens(payload);

    // Create session
    const sessionId = await sessionManagementService.createSession({
      userId: user.id,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        organizationId: user.organizationId,
        emailVerified: user.emailVerified,
      },
      sessionId,
    };
  }

  /**
   * Check if Google OAuth is configured
   */
  isGoogleConfigured(): boolean {
    return !!(this.googleClientId && this.googleClientSecret);
  }

  /**
   * Check if Microsoft OAuth is configured
   */
  isMicrosoftConfigured(): boolean {
    return !!(this.microsoftClientId && this.microsoftClientSecret);
  }

  /**
   * Get Google OAuth authentication URL
   */
  getGoogleAuthUrl(): string {
    if (!this.isGoogleConfigured()) {
      throw new Error('Google OAuth is not configured');
    }
    return `${this.callbackBaseUrl}/api/auth/google`;
  }

  /**
   * Get Microsoft OAuth authentication URL
   */
  getMicrosoftAuthUrl(): string {
    if (!this.isMicrosoftConfigured()) {
      throw new Error('Microsoft OAuth is not configured');
    }
    return `${this.callbackBaseUrl}/api/auth/microsoft`;
  }
}

export const oauthService = new OAuthService();

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true, organization: true },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
