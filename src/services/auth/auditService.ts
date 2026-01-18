import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  organizationId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface CreateAuditLogData {
  userId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilter {
  userId?: string;
  organizationId?: string;
  resource?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit Service
 * Handles audit logging for access control and change tracking
 */
export class AuditService {
  /**
   * Create audit log entry
   */
  async createAuditLog(data: CreateAuditLogData): Promise<AuditLogEntry> {
    const auditLog = await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        organizationId: data.organizationId || null,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId || null,
        details: data.details ? JSON.stringify(data.details) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });

    return this.mapToAuditLogEntry(auditLog);
  }

  /**
   * Log user action
   */
  async logUserAction(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    await this.createAuditLog({
      userId,
      organizationId: user?.organizationId || undefined,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log access attempt
   */
  async logAccessAttempt(
    userId: string | undefined,
    resource: string,
    action: string,
    allowed: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const user = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true },
        })
      : null;

    await this.createAuditLog({
      userId: userId || undefined,
      organizationId: user?.organizationId || undefined,
      action: allowed ? `${action}_allowed` : `${action}_denied`,
      resource,
      details: {
        allowed,
        timestamp: new Date().toISOString(),
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log resource access
   */
  async logResourceAccess(
    userId: string,
    resource: string,
    resourceId: string,
    action: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logUserAction(
      userId,
      `${resource}_${action}`,
      resource,
      resourceId,
      { action },
      ipAddress,
      userAgent
    );
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(filter: AuditLogFilter): Promise<{
    logs: AuditLogEntry[];
    total: number;
  }> {
    const where: any = {};

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.organizationId) {
      where.organizationId = filter.organizationId;
    }

    if (filter.resource) {
      where.resource = filter.resource;
    }

    if (filter.action) {
      where.action = filter.action;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.createdAt.lte = filter.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: filter.limit || 100,
        skip: filter.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => this.mapToAuditLogEntry(log)),
      total,
    };
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(
    userId: string,
    limit: number = 100
  ): Promise<AuditLogEntry[]> {
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return logs.map((log) => this.mapToAuditLogEntry(log));
  }

  /**
   * Get audit logs for a specific organization
   */
  async getOrganizationAuditLogs(
    organizationId: string,
    limit: number = 100
  ): Promise<AuditLogEntry[]> {
    const logs = await prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return logs.map((log) => this.mapToAuditLogEntry(log));
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceAuditLogs(
    resource: string,
    resourceId: string,
    limit: number = 100
  ): Promise<AuditLogEntry[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        resource,
        resourceId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return logs.map((log) => this.mapToAuditLogEntry(log));
  }

  /**
   * Clean up old audit logs (older than specified days)
   */
  async cleanupOldAuditLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(organizationId?: string): Promise<{
    totalLogs: number;
    logsByAction: Record<string, number>;
    logsByResource: Record<string, number>;
    recentActivity: number;
  }> {
    const where: any = organizationId ? { organizationId } : {};

    const [totalLogs, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        select: {
          action: true,
          resource: true,
          createdAt: true,
        },
      }),
    ]);

    const logsByAction: Record<string, number> = {};
    const logsByResource: Record<string, number> = {};
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    let recentActivity = 0;

    for (const log of logs) {
      // Count by action
      logsByAction[log.action] = (logsByAction[log.action] || 0) + 1;

      // Count by resource
      logsByResource[log.resource] = (logsByResource[log.resource] || 0) + 1;

      // Count recent activity
      if (log.createdAt > oneDayAgo) {
        recentActivity++;
      }
    }

    return {
      totalLogs,
      logsByAction,
      logsByResource,
      recentActivity,
    };
  }

  /**
   * Map Prisma audit log to AuditLogEntry
   */
  private mapToAuditLogEntry(log: any): AuditLogEntry {
    return {
      id: log.id,
      userId: log.userId,
      organizationId: log.organizationId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      details: log.details ? JSON.parse(log.details) : null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    };
  }
}

export const auditService = new AuditService();
