import { Router } from 'express';
import { AdminController, requireAdmin } from '../controllers/adminController';

const router = Router();

// Lazy initialization - create controller when first request is made
let adminController: AdminController | null = null;

const getAdminController = (): AdminController => {
  if (!adminController) {
    adminController = new AdminController();
  }
  return adminController;
};

// All admin routes require admin authentication
router.use(requireAdmin);

// Admin dashboard statistics
router.get('/stats', (req, res) => {
  getAdminController().getStats(req, res);
});

// User management endpoints
router.get('/users', (req, res) => {
  getAdminController().getUsers(req, res);
});

router.get('/users/:userId', (req, res) => {
  getAdminController().getUserById(req, res);
});

router.put('/users/:userId', (req, res) => {
  getAdminController().updateUser(req, res);
});

router.delete('/users/:userId', (req, res) => {
  getAdminController().deleteUser(req, res);
});

// Organization management endpoints
router.get('/organizations', (req, res) => {
  getAdminController().getOrganizations(req, res);
});

// System analytics
router.get('/analytics', (req, res) => {
  getAdminController().getAnalytics(req, res);
});

// Audit logs
router.get('/audit-logs', (req, res) => {
  getAdminController().getAuditLogs(req, res);
});

// Content management endpoints
router.get('/content', (req, res) => {
  getAdminController().getContentItems(req, res);
});

export default router;
