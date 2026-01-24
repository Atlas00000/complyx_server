import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
}

export interface CheckPermissionParams {
  userId: string;
  resource: string;
  action: string;
  resourceId?: string;
  organizationId?: string;
}

/**
 * Role-Based Access Control (RBAC) Service
 * Handles roles, permissions, and access control
 */
export class RBACService {
  /**
   * Initialize default roles and permissions
   */
  async initializeDefaultRolesAndPermissions(): Promise<void> {
    // Check if roles already exist
    const existingRoles = await prisma.role.findMany();
    if (existingRoles.length > 0) {
      return; // Already initialized
    }

    // Create default permissions
    const permissions = await this.createDefaultPermissions();

    // Create default roles
    await this.createDefaultRoles(permissions);
  }

  /**
   * Create default permissions
   */
  private async createDefaultPermissions(): Promise<Permission[]> {
    const permissionDefinitions = [
      // User permissions
      { name: 'users:create', resource: 'users', action: 'create', description: 'Create new users' },
      { name: 'users:read', resource: 'users', action: 'read', description: 'View users' },
      { name: 'users:update', resource: 'users', action: 'update', description: 'Update users' },
      { name: 'users:delete', resource: 'users', action: 'delete', description: 'Delete users' },
      
      // Assessment permissions
      { name: 'assessments:create', resource: 'assessments', action: 'create', description: 'Create assessments' },
      { name: 'assessments:read', resource: 'assessments', action: 'read', description: 'View assessments' },
      { name: 'assessments:update', resource: 'assessments', action: 'update', description: 'Update assessments' },
      { name: 'assessments:delete', resource: 'assessments', action: 'delete', description: 'Delete assessments' },
      { name: 'assessments:export', resource: 'assessments', action: 'export', description: 'Export assessments' },
      
      // Organization permissions
      { name: 'organizations:create', resource: 'organizations', action: 'create', description: 'Create organizations' },
      { name: 'organizations:read', resource: 'organizations', action: 'read', description: 'View organizations' },
      { name: 'organizations:update', resource: 'organizations', action: 'update', description: 'Update organizations' },
      { name: 'organizations:delete', resource: 'organizations', action: 'delete', description: 'Delete organizations' },
      { name: 'organizations:manage', resource: 'organizations', action: 'manage', description: 'Manage organization settings' },
      
      // Content permissions
      { name: 'content:create', resource: 'content', action: 'create', description: 'Create content' },
      { name: 'content:read', resource: 'content', action: 'read', description: 'View content' },
      { name: 'content:update', resource: 'content', action: 'update', description: 'Update content' },
      { name: 'content:delete', resource: 'content', action: 'delete', description: 'Delete content' },
      
      // Admin permissions
      { name: 'admin:access', resource: 'admin', action: 'access', description: 'Access admin panel' },
      { name: 'admin:users', resource: 'admin', action: 'users', description: 'Manage all users' },
      { name: 'admin:system', resource: 'admin', action: 'system', description: 'Manage system settings' },
      { name: 'admin:analytics', resource: 'admin', action: 'analytics', description: 'View analytics' },
    ];

    const createdPermissions: Permission[] = [];

    for (const permDef of permissionDefinitions) {
      const permission = await prisma.permission.create({
        data: permDef,
      });
      createdPermissions.push({
        id: permission.id,
        name: permission.name,
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      });
    }

    return createdPermissions;
  }

  /**
   * Create default roles
   */
  private async createDefaultRoles(permissions: Permission[]): Promise<void> {
    // Admin role - all permissions
    await prisma.role.create({
      data: {
        name: 'Admin',
        description: 'Full system access',
        permissions: {
          create: permissions.map((perm) => ({
            permissionId: perm.id,
          })),
        },
      },
    });

    // Manager role - most permissions except admin
    const managerPerms = permissions.filter(
      (p) => !p.name.startsWith('admin:') && p.name !== 'organizations:delete'
    );
    await prisma.role.create({
      data: {
        name: 'Manager',
        description: 'Can manage team and assessments',
        permissions: {
          create: managerPerms.map((perm) => ({
            permissionId: perm.id,
          })),
        },
      },
    });

    // User role - basic permissions
    const userPerms = permissions.filter(
      (p) =>
        p.name.startsWith('assessments:') &&
        (p.action === 'create' || p.action === 'read' || p.action === 'update')
    );
    await prisma.role.create({
      data: {
        name: 'User',
        description: 'Can create and manage own assessments',
        permissions: {
          create: userPerms.map((perm) => ({
            permissionId: perm.id,
          })),
        },
      },
    });

    // Viewer role - read-only
    const viewerPerms = permissions.filter(
      (p) => p.action === 'read' && !p.name.startsWith('admin:')
    );
    await prisma.role.create({
      data: {
        name: 'Viewer',
        description: 'Read-only access',
        permissions: {
          create: viewerPerms.map((perm) => ({
            permissionId: perm.id,
          })),
        },
      },
    });
  }

  /**
   * Check if user has permission
   */
  async hasPermission(params: CheckPermissionParams): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        organization: true,
      },
    });

    if (!user || !user.role) {
      return false;
    }

    // Check organization context if provided
    if (params.organizationId && user.organizationId !== params.organizationId) {
      return false;
    }

    // Check if role has the required permission
    const hasPermission = user.role.permissions.some(
      (rp) =>
        rp.permission.resource === params.resource &&
        rp.permission.action === params.action
    );

    return hasPermission;
  }

  /**
   * Get user's permissions
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.role) {
      return [];
    }

    return user.role.permissions.map((rp) => ({
      id: rp.permission.id,
      name: rp.permission.name,
      resource: rp.permission.resource,
      action: rp.permission.action,
      description: rp.permission.description,
    }));
  }

  /**
   * Get user's role
   */
  async getUserRole(userId: string): Promise<Role | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.role) {
      return null;
    }

    return {
      id: user.role.id,
      name: user.role.name,
      description: user.role.description,
      permissions: user.role.permissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
    };
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
    }));
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    const permissions = await prisma.permission.findMany();

    return permissions.map((perm) => ({
      id: perm.id,
      name: perm.name,
      resource: perm.resource,
      action: perm.action,
      description: perm.description,
    }));
  }

  /**
   * Add permission to role
   */
  async addPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
      },
    });
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId,
      },
    });
  }

  /**
   * Check if user can access resource
   */
  async canAccessResource(
    userId: string,
    resource: string,
    action: string,
    resourceId?: string,
    organizationId?: string
  ): Promise<boolean> {
    return this.hasPermission({
      userId,
      resource,
      action,
      resourceId,
      organizationId,
    });
  }
}

export const rbacService = new RBACService();
