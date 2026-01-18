import { Request, Response } from 'express';
import { adminService } from '../services/admin/adminService';
import { authService } from '../services/auth/authService';
import { rbacService } from '../services/auth/rbacService';
import { auditService } from '../services/auth/auditService';

/**
 * Middleware to check if user is admin
 */
async function requireAdmin(req: Request, res: Response, next: () => void): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = authService.verifyToken(token);
    
    // Check if user has admin permission
    const hasAdminAccess = await rbacService.hasPermission({
      userId: payload.userId,
      resource: 'admin',
      action: 'access',
    });

    if (!hasAdminAccess) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Attach user info to request
    (req as any).user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export class AdminController {
  /**
   * Get admin dashboard statistics
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await adminService.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting admin stats:', error);
      res.status(500).json({ error: 'Failed to get admin statistics' });
    }
  }

  /**
   * Get all users with pagination
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const organizationId = req.query.organizationId as string | undefined;
      const roleId = req.query.roleId as string | undefined;

      const result = await adminService.getAllUsers(
        page,
        limit,
        search,
        organizationId,
        roleId
      );

      res.json(result);
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await adminService.getAllUsers(1, 1, undefined, undefined, undefined);
      
      const foundUser = user.users.find((u) => u.id === userId);
      if (!foundUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(foundUser);
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }

  /**
   * Update user (admin)
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { name, email, roleId, organizationId, emailVerified } = req.body;
      const adminUser = (req as any).user;

      // Check permission
      const canUpdate = await rbacService.hasPermission({
        userId: adminUser.userId,
        resource: 'users',
        action: 'update',
      });

      if (!canUpdate) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const updatedUser = await adminService.updateUser(userId, {
        name,
        email,
        roleId,
        organizationId,
        emailVerified,
      });

      // Log action
      await auditService.logUserAction(
        adminUser.userId,
        'user_updated',
        'user',
        userId,
        { updatedFields: Object.keys(req.body) },
        req.ip,
        req.get('user-agent') || undefined
      );

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  /**
   * Delete user (admin)
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminUser = (req as any).user;

      // Check permission
      const canDelete = await rbacService.hasPermission({
        userId: adminUser.userId,
        resource: 'users',
        action: 'delete',
      });

      if (!canDelete) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      await adminService.deleteUser(userId);

      // Log action
      await auditService.logUserAction(
        adminUser.userId,
        'user_deleted',
        'user',
        userId,
        {},
        req.ip,
        req.get('user-agent') || undefined
      );

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  /**
   * Get all organizations
   */
  async getOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await adminService.getAllOrganizations(page, limit);
      res.json(result);
    } catch (error) {
      console.error('Error getting organizations:', error);
      res.status(500).json({ error: 'Failed to get organizations' });
    }
  }

  /**
   * Get system analytics
   */
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const analytics = await adminService.getSystemAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error('Error getting analytics:', error);
      res.status(500).json({ error: 'Failed to get system analytics' });
    }
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const userId = req.query.userId as string | undefined;
      const organizationId = req.query.organizationId as string | undefined;
      const resource = req.query.resource as string | undefined;
      const action = req.query.action as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const result = await adminService.getAdminAuditLogs(page, limit, {
        userId,
        organizationId,
        resource,
        action,
        startDate,
        endDate,
      });

      res.json(result);
    } catch (error) {
      console.error('Error getting audit logs:', error);
      res.status(500).json({ error: 'Failed to get audit logs' });
    }
  }

  /**
   * Get content items
   */
  async getContentItems(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string | undefined;

      const result = await adminService.getContentItems(page, limit, type);
      res.json(result);
    } catch (error) {
      console.error('Error getting content items:', error);
      res.status(500).json({ error: 'Failed to get content items' });
    }
  }
}

// Export middleware
export { requireAdmin };
