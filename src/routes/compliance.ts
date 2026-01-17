import { Router } from 'express';
import { ComplianceController } from '../controllers/complianceController';

const router = Router();
const complianceController = new ComplianceController();

// Generate compliance matrix
router.post('/matrix', (req, res) => {
  complianceController.getComplianceMatrix(req, res);
});

// Identify compliance gaps
router.post('/gaps', (req, res) => {
  complianceController.identifyGaps(req, res);
});

// Get supported industries
router.get('/industries', (req, res) => {
  complianceController.getIndustries(req, res);
});

// Get industry-specific context
router.get('/industry/:industry', (req, res) => {
  complianceController.getIndustryContext(req, res);
});

export default router;
