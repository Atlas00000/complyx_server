import { PrismaClient } from '@prisma/client';
import { authService as _authService } from './authService';

const prisma = new PrismaClient();

export interface SessionData {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActiveSession {
  id: string;
  userId: string;
  startedAt: Date;
  lastActive: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Authentication Session Management Service
 * Handles server-side session tracking for authenticated users
 */
export class SessionManagementService {
  /**
   * Create a new authentication session
   */
  async createSession(data: SessionData): Promise<string> {
    const session = await prisma.session.create({
      data: {
        userId: data.userId,
        isActive: true,
        startedAt: new Date(),
        lastActive: new Date(),
      },
    });

    // Log session creation in audit log
    await this.logSessionActivity(data.userId, 'session_created', {
      sessionId: session.id,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    return session.id;
  }

  /**
   * Update session last active timestamp
   */
  async updateLastActive(sessionId: string, userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: {
        id: sessionId,
        userId: userId,
        isActive: true,
      },
      data: {
        lastActive: new Date(),
      },
    });
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId: userId,
        isActive: true,
      },
      orderBy: {
        lastActive: 'desc',
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      startedAt: session.startedAt,
      lastActive: session.lastActive,
    }));
  }

  /**
   * Deactivate a specific session (logout)
   */
  async deactivateSession(sessionId: string, userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: {
        id: sessionId,
        userId: userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Log session deactivation
    await this.logSessionActivity(userId, 'session_deactivated', {
      sessionId: sessionId,
    });
  }

  /**
   * Deactivate all sessions for a user (logout from all devices)
   */
  async deactivateAllSessions(userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: {
        userId: userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Log all sessions deactivation
    await this.logSessionActivity(userId, 'all_sessions_deactivated', {});
  }

  /**
   * Clean up inactive sessions (older than specified days)
   */
  async cleanupInactiveSessions(daysInactive: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const result = await prisma.session.updateMany({
      where: {
        isActive: true,
        lastActive: {
          lt: cutoffDate,
        },
      },
      data: {
        isActive: false,
      },
    });

    return result.count;
  }

  /**
   * Check if a session is valid and active
   */
  async isSessionValid(sessionId: string, userId: string): Promise<boolean> {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: userId,
        isActive: true,
      },
    });

    if (!session) {
      return false;
    }

    // Update last active if session is valid
    await this.updateLastActive(sessionId, userId);

    return true;
  }

  /**
   * Get session count for a user
   */
  async getSessionCount(userId: string): Promise<number> {
    return prisma.session.count({
      where: {
        userId: userId,
        isActive: true,
      },
    });
  }

  /**
   * Log session activity to audit log
   */
  private async logSessionActivity(
    userId: string,
    action: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });

      await prisma.auditLog.create({
        data: {
          userId: userId,
          organizationId: user?.organizationId || null,
          action: action,
          resource: 'session',
          details: JSON.stringify(details),
        },
      });
    } catch (error) {
      // Don't throw error if audit logging fails
      console.error('Failed to log session activity:', error);
    }
  }
}

export const sessionManagementService = new SessionManagementService();
