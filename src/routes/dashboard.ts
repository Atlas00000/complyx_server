import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';

const router = Router();
const dashboardController = new DashboardController();

// Get comprehensive dashboard data (all metrics)
router.get('/data', (req, res) => {
  dashboardController.getDashboardData(req, res);
});

// Get readiness score only (lightweight endpoint)
router.get('/score', (req, res) => {
  dashboardController.getReadinessScore(req, res);
});

// Get progress data only (lightweight endpoint)
router.get('/progress', (req, res) => {
  dashboardController.getProgress(req, res);
});

// Get gap analysis only (lightweight endpoint)
router.get('/gaps', (req, res) => {
  dashboardController.getGapAnalysis(req, res);
});

// Get compliance matrix only (lightweight endpoint)
router.get('/compliance', (req, res) => {
  dashboardController.getComplianceMatrix(req, res);
});

// Get dashboard data for a specific user (by userId param)
router.get('/user/:userId/data', (req, res) => {
  dashboardController.getDashboardData(req, res);
});

// Get readiness score for a specific user
router.get('/user/:userId/score', (req, res) => {
  dashboardController.getReadinessScore(req, res);
});

// Get progress for a specific user
router.get('/user/:userId/progress', (req, res) => {
  dashboardController.getProgress(req, res);
});

// Get gap analysis for a specific user
router.get('/user/:userId/gaps', (req, res) => {
  dashboardController.getGapAnalysis(req, res);
});

// Get compliance matrix for a specific user
router.get('/user/:userId/compliance', (req, res) => {
  dashboardController.getComplianceMatrix(req, res);
});

export default router;
