import { PrismaClient } from '@prisma/client';
import { userService as _userService } from '../user/userService';
import { rbacService as _rbacService } from '../auth/rbacService';
import { auditService } from '../auth/auditService';

const prisma = new PrismaClient();

export interface AdminStats {
  totalUsers: number;
  totalOrganizations: number;
  totalAssessments: number;
  activeUsers: number;
  recentRegistrations: number;
  systemHealth: {
    database: 'healthy' | 'degraded' | 'down';
    redis: 'healthy' | 'degraded' | 'down';
  };
}

export interface UserManagementData {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  organizationId: string | null;
  roleId: string | null;
  organization?: {
    id: string;
    name: string;
  } | null;
  role?: {
    id: string;
    name: string;
  } | null;
}

export interface ContentManagementData {
  id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Admin Service
 * Handles administrative operations for user management, content management, and system monitoring
 */
export class AdminService {
  /**
   * Get admin dashboard statistics
   */
  async getAdminStats(): Promise<AdminStats> {
    const [
      totalUsers,
      totalOrganizations,
      totalAssessments,
      activeUsers,
      recentRegistrations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.assessment.count(),
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    // Check system health
    const systemHealth = await this.checkSystemHealth();

    return {
      totalUsers,
      totalOrganizations,
      totalAssessments,
      activeUsers,
      recentRegistrations,
      systemHealth,
    };
  }

  /**
   * Check system health
   */
  private async checkSystemHealth(): Promise<AdminStats['systemHealth']> {
    let database: 'healthy' | 'degraded' | 'down' = 'healthy';
    let redis: 'healthy' | 'degraded' | 'down' = 'healthy';

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      database = 'down';
    }

    // Check Redis (placeholder - would need Redis client)
    // For now, assume healthy if we can't check
    try {
      // TODO: Add actual Redis health check
      redis = 'healthy';
    } catch (error) {
      redis = 'degraded';
    }

    return { database, redis };
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    organizationId?: string,
    roleId?: string
  ): Promise<{
    users: UserManagementData[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (roleId) {
      where.roleId = roleId;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        organizationId: user.organizationId,
        roleId: user.roleId,
        organization: user.organization,
        role: user.role,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update user (admin)
   */
  async updateUser(
    userId: string,
    data: {
      name?: string;
      email?: string;
      roleId?: string;
      organizationId?: string;
      emailVerified?: boolean;
    }
  ): Promise<UserManagementData> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email,
        roleId: data.roleId,
        organizationId: data.organizationId,
        emailVerified: data.emailVerified,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      organizationId: user.organizationId,
      roleId: user.roleId,
      organization: user.organization,
      role: user.role,
    };
  }

  /**
   * Delete user (admin)
   */
  async deleteUser(userId: string): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Get all organizations
   */
  async getAllOrganizations(
    page: number = 1,
    limit: number = 20
  ): Promise<{
    organizations: Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      userCount: number;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          users: {
            select: {
              id: true,
            },
          },
        },
      }),
      prisma.organization.count(),
    ]);

    return {
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        userCount: org.users.length,
        createdAt: org.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get system analytics
   */
  async getSystemAnalytics(): Promise<{
    userActivity: {
      registrations: Array<{ date: string; count: number }>;
      logins: Array<{ date: string; count: number }>;
    };
    assessmentActivity: {
      created: Array<{ date: string; count: number }>;
      completed: Array<{ date: string; count: number }>;
    };
    topUsers: Array<{
      userId: string;
      email: string;
      name: string | null;
      assessmentCount: number;
      lastActivity: Date | null;
    }>;
  }> {
    // Get user registrations by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const registrations = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Get logins by date (last 30 days)
    const logins = await prisma.user.findMany({
      where: {
        lastLoginAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        lastLoginAt: true,
      },
    });

    // Get assessments created (last 30 days)
    const assessmentsCreated = await prisma.assessment.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Get assessments completed (last 30 days)
    const assessmentsCompleted = await prisma.assessment.findMany({
      where: {
        completedAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        completedAt: true,
      },
    });

    // Get top users by assessment count
    const topUsers = await prisma.user.findMany({
      include: {
        assessments: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        assessments: {
          _count: 'desc',
        },
      },
      take: 10,
    });

    // Group by date
    const groupByDate = (items: Array<{ createdAt?: Date; lastLoginAt?: Date; completedAt?: Date }>, dateField: string) => {
      const grouped: Record<string, number> = {};
      items.forEach((item) => {
        const date = new Date(item[dateField as keyof typeof item] as Date);
        const dateStr = date.toISOString().split('T')[0];
        grouped[dateStr] = (grouped[dateStr] || 0) + 1;
      });
      return Object.entries(grouped).map(([date, count]) => ({ date, count }));
    };

    return {
      userActivity: {
        registrations: groupByDate(registrations.map(r => ({ createdAt: r.createdAt })), 'createdAt'),
        logins: groupByDate(logins.map(l => ({ lastLoginAt: l.lastLoginAt || undefined })), 'lastLoginAt'),
      },
      assessmentActivity: {
        created: groupByDate(assessmentsCreated.map(a => ({ createdAt: a.createdAt })), 'createdAt'),
        completed: groupByDate(assessmentsCompleted.map(a => ({ completedAt: a.completedAt || undefined })), 'completedAt'),
      },
      topUsers: topUsers.map((user) => ({
        userId: user.id,
        email: user.email,
        name: user.name,
        assessmentCount: user.assessments.length,
        lastActivity: user.lastLoginAt,
      })),
    };
  }

  /**
   * Get audit logs for admin
   */
  async getAdminAuditLogs(
    page: number = 1,
    limit: number = 50,
    filters?: {
      userId?: string;
      organizationId?: string;
      resource?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    return auditService.getAuditLogs({
      ...filters,
      limit,
      offset: (page - 1) * limit,
    });
  }

  /**
   * Get content management data
   * Note: This is a placeholder - content management would depend on your content model
   */
  async getContentItems(
    page: number = 1,
    limit: number = 20,
    _type?: string
  ): Promise<{
    items: ContentManagementData[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Placeholder - would need actual content model
    // This could be for FAQ items, knowledge base entries, etc.
    return {
      items: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }
}

export const adminService = new AdminService();
