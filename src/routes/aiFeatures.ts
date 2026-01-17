import { Router } from 'express';
import { AIFeaturesController } from '../controllers/aiFeaturesController';

const router = Router();
const aiFeaturesController = new AIFeaturesController();

// Generate personalized recommendations
router.post('/recommendations', (req, res) => {
  aiFeaturesController.getRecommendations(req, res);
});

// Extract citations from text
router.post('/citations', (req, res) => {
  aiFeaturesController.getCitations(req, res);
});

// Get industry-specific guidance
router.get('/guidance/industry/:industry', (req, res) => {
  aiFeaturesController.getIndustryGuidance(req, res);
});

// Get contextual guidance
router.post('/guidance/contextual', (req, res) => {
  aiFeaturesController.getContextualGuidance(req, res);
});

export default router;
