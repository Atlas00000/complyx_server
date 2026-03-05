import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();
const dashboardController = new DashboardController();

// All dashboard routes require authentication
router.get('/data', requireAuth, (req, res) => {
  dashboardController.getDashboardData(req, res);
});

router.get('/score', requireAuth, (req, res) => {
  dashboardController.getReadinessScore(req, res);
});

router.get('/progress', requireAuth, (req, res) => {
  dashboardController.getProgress(req, res);
});

router.get('/gaps', requireAuth, (req, res) => {
  dashboardController.getGapAnalysis(req, res);
});

router.get('/compliance', requireAuth, (req, res) => {
  dashboardController.getComplianceMatrix(req, res);
});

// User-scoped routes: requireAuth ensures req.user; controller validates userId matches
router.get('/user/:userId/data', requireAuth, (req, res) => {
  dashboardController.getDashboardData(req, res);
});

router.get('/user/:userId/score', requireAuth, (req, res) => {
  dashboardController.getReadinessScore(req, res);
});

router.get('/user/:userId/progress', requireAuth, (req, res) => {
  dashboardController.getProgress(req, res);
});

router.get('/user/:userId/gaps', requireAuth, (req, res) => {
  dashboardController.getGapAnalysis(req, res);
});

router.get('/user/:userId/compliance', requireAuth, (req, res) => {
  dashboardController.getComplianceMatrix(req, res);
});

export default router;
