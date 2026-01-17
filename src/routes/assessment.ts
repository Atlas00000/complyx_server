import { Router } from 'express';
import { AssessmentController } from '../controllers/assessmentController';
import { SessionController } from '../controllers/sessionController';

const router = Router();
const assessmentController = new AssessmentController();
const sessionController = new SessionController();

// Calculate assessment scores
router.post('/scores/calculate', (req, res) => {
  assessmentController.calculateScores(req, res);
});

// Get scores for an assessment
router.get('/scores/:assessmentId', (req, res) => {
  assessmentController.getScores(req, res);
});

// Calculate progress
router.post('/progress/calculate', (req, res) => {
  assessmentController.calculateProgress(req, res);
});

// Update assessment progress
router.put('/progress/:assessmentId', (req, res) => {
  assessmentController.updateProgress(req, res);
});

// Mark assessment as completed
router.post('/:assessmentId/complete', (req, res) => {
  assessmentController.completeAssessment(req, res);
});

// Pause assessment
router.post('/:assessmentId/pause', (req, res) => {
  assessmentController.pauseAssessment(req, res);
});

// Resume assessment
router.post('/:assessmentId/resume', (req, res) => {
  assessmentController.resumeAssessment(req, res);
});

// Session management routes
// Save session
router.post('/session/save', (req, res) => {
  sessionController.saveSession(req, res);
});

// Restore session
router.get('/session/:assessmentId', (req, res) => {
  sessionController.restoreSession(req, res);
});

// Get user assessments
router.get('/user/:userId/assessments', (req, res) => {
  sessionController.getUserAssessments(req, res);
});

// Auto-save
router.post('/session/autosave', (req, res) => {
  sessionController.autoSave(req, res);
});

// Delete session
router.delete('/session/:assessmentId', (req, res) => {
  sessionController.deleteSession(req, res);
});

export default router;
