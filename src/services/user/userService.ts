import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateUserData {
  email: string;
  name?: string;
  passwordHash?: string;
  organizationId?: string;
  roleId?: string;
  emailVerified?: boolean;
}

export interface UpdateUserData {
  name?: string;
  organizationId?: string;
  roleId?: string;
  emailVerified?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string | null;
  roleId: string | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  role?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export interface CreateOrganizationData {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateOrganizationData {
  name?: string;
  description?: string;
}

/**
 * User Service
 * Handles user profiles, organization management, and multi-tenant support
 */
export class UserService {
  /**
   * Create a new user
   */
  async createUser(data: CreateUserData): Promise<UserProfile> {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name || null,
        passwordHash: data.passwordHash || null,
        organizationId: data.organizationId || null,
        roleId: data.roleId || null,
        emailVerified: data.emailVerified || false,
        emailVerifiedAt: data.emailVerified ? new Date() : null,
      },
      include: {
        organization: true,
        role: true,
      },
    });

    return this.mapToUserProfile(user);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        role: true,
      },
    });

    if (!user) {
      return null;
    }

    return this.mapToUserProfile(user);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true,
        role: true,
      },
    });

    if (!user) {
      return null;
    }

    return this.mapToUserProfile(user);
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, data: UpdateUserData): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        organizationId: data.organizationId !== undefined ? data.organizationId : undefined,
        roleId: data.roleId !== undefined ? data.roleId : undefined,
        emailVerified: data.emailVerified !== undefined ? data.emailVerified : undefined,
      },
      include: {
        organization: true,
        role: true,
      },
    });

    return this.mapToUserProfile(user);
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Get all users in an organization
   */
  async getUsersByOrganization(organizationId: string): Promise<UserProfile[]> {
    const users = await prisma.user.findMany({
      where: { organizationId },
      include: {
        organization: true,
        role: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((user) => this.mapToUserProfile(user));
  }

  /**
   * Create a new organization
   */
  async createOrganization(data: CreateOrganizationData): Promise<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    // Generate slug if not provided
    const slug = data.slug || this.generateSlug(data.name);

    // Check if slug already exists
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new Error('Organization slug already exists');
    }

    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        slug: slug,
        description: data.description || null,
      },
    });

    return organization;
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(organizationId: string) {
    return prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get organization by slug
   */
  async getOrganizationBySlug(slug: string) {
    return prisma.organization.findUnique({
      where: { slug },
      include: {
        users: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Update organization
   */
  async updateOrganization(
    organizationId: string,
    data: UpdateOrganizationData
  ) {
    return prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  /**
   * Delete organization
   */
  async deleteOrganization(organizationId: string): Promise<void> {
    await prisma.organization.delete({
      where: { id: organizationId },
    });
  }

  /**
   * Assign user to organization
   */
  async assignUserToOrganization(userId: string, organizationId: string): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: organizationId,
      },
      include: {
        organization: true,
        role: true,
      },
    });

    return this.mapToUserProfile(user);
  }

  /**
   * Remove user from organization
   */
  async removeUserFromOrganization(userId: string): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
      },
      include: {
        organization: true,
        role: true,
      },
    });

    return this.mapToUserProfile(user);
  }

  /**
   * Check if user belongs to organization
   */
  async userBelongsToOrganization(userId: string, organizationId: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: organizationId,
      },
    });

    return !!user;
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: string, roleId: string): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        roleId: roleId,
      },
      include: {
        organization: true,
        role: true,
      },
    });

    return this.mapToUserProfile(user);
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        roleId: null,
      },
      include: {
        organization: true,
        role: true,
      },
    });

    return this.mapToUserProfile(user);
  }

  /**
   * Get users by role
   */
  async getUsersByRole(roleId: string): Promise<UserProfile[]> {
    const users = await prisma.user.findMany({
      where: { roleId },
      include: {
        organization: true,
        role: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((user) => this.mapToUserProfile(user));
  }

  /**
   * Get team members for an organization
   */
  async getTeamMembers(organizationId: string): Promise<UserProfile[]> {
    return this.getUsersByOrganization(organizationId);
  }

  /**
   * Check if user can manage another user (for team management)
   */
  async canManageUser(managerId: string, targetUserId: string): Promise<boolean> {
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      include: { role: true, organization: true },
    });

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { role: true, organization: true },
    });

    if (!manager || !target) {
      return false;
    }

    // Same organization check
    if (manager.organizationId !== target.organizationId) {
      return false;
    }

    // Role hierarchy check (Admin > Manager > User > Viewer)
    const roleHierarchy: Record<string, number> = {
      Admin: 4,
      Manager: 3,
      User: 2,
      Viewer: 1,
    };

    const managerLevel = manager.role ? roleHierarchy[manager.role.name] || 0 : 0;
    const targetLevel = target.role ? roleHierarchy[target.role.name] || 0 : 0;

    return managerLevel > targetLevel;
  }

  /**
   * Update user preferences (stored as JSON in a field or separate table)
   * For now, we'll use a simple approach - this can be extended later
   */
  async updateUserPreferences(
    userId: string,
    preferences: Record<string, any>
  ): Promise<void> {
    // Note: This is a placeholder. In a full implementation, you might want
    // to create a separate UserPreferences model or store in a JSON field
    // For now, we'll just log it - this can be extended when we add preferences to schema
    console.log(`Updating preferences for user ${userId}:`, preferences);
    
    // TODO: Add UserPreferences model to schema or extend User model with preferences JSON field
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(_userId: string): Promise<Record<string, any>> {
    // Placeholder - to be implemented when preferences are added to schema
    return {};
  }

  /**
   * Map Prisma user to UserProfile
   */
  private mapToUserProfile(user: any): UserProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizationId: user.organizationId,
      roleId: user.roleId,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            slug: user.organization.slug,
          }
        : null,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            description: user.role.description,
          }
        : null,
    };
  }
}

export const userService = new UserService();
