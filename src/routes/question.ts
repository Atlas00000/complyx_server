import { Router } from 'express';
import { QuestionController } from '../controllers/questionController';

const router = Router();
const questionController = new QuestionController();

// Get all questions
router.get('/', (req, res) => {
  questionController.getQuestions(req, res);
});

// Get all categories
router.get('/categories', (req, res) => {
  questionController.getCategories(req, res);
});

// Get phase information (must come before /:id route)
router.get('/phases', (req, res) => {
  questionController.getPhaseInfo(req, res);
});

// Get questions for a specific phase (must come before /:id route)
router.get('/phases/:phase', (req, res) => {
  questionController.getPhaseQuestions(req, res);
});

// Get next question (adaptive)
router.post('/next', (req, res) => {
  questionController.getNextQuestion(req, res);
});

// Get progress
router.post('/progress', (req, res) => {
  questionController.getProgress(req, res);
});

// Get question by ID (must be last to avoid matching /phases)
router.get('/:id', (req, res) => {
  questionController.getQuestionById(req, res);
});

export default router;
