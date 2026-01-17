import { Router } from 'express';
import { KnowledgeController } from '../controllers/knowledgeController';

const router = Router();
const knowledgeController = new KnowledgeController();

// Semantic search
router.post('/search', (req, res) => {
  knowledgeController.search(req, res);
});

// RAG (Retrieval-Augmented Generation)
router.post('/rag', (req, res) => {
  knowledgeController.rag(req, res);
});

// Get all FAQs or search FAQs
router.get('/faqs', (req, res) => {
  knowledgeController.getFAQs(req, res);
});

// Get FAQ by ID
router.get('/faqs/:id', (req, res) => {
  knowledgeController.getFAQ(req, res);
});

// Get all resources or search resources
router.get('/resources', (req, res) => {
  knowledgeController.getResources(req, res);
});

// Get resource by ID
router.get('/resources/:id', (req, res) => {
  knowledgeController.getResource(req, res);
});

export default router;
