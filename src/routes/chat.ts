import { Router } from 'express';
import { ChatController } from '../controllers/chatController';
import { ChatHistoryController } from '../controllers/chatHistoryController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();
const historyController = new ChatHistoryController();

// Lazy initialization - create controller when first request is made
let chatController: ChatController | null = null;

const getChatController = (): ChatController => {
  if (!chatController) {
    chatController = new ChatController();
  }
  return chatController;
};

// Chat endpoint (no auth required for anonymous chat)
router.post('/', (req, res) => {
  getChatController().chat(req, res);
});

// Chat history (logged-in users only)
router.get('/sessions', requireAuth, (req, res) => {
  historyController.listSessions(req, res);
});
router.post('/sessions', requireAuth, (req, res) => {
  historyController.createOrGetSession(req, res);
});
router.get('/sessions/:sessionId/messages', requireAuth, (req, res) => {
  historyController.getMessages(req, res);
});
router.post('/sessions/:sessionId/messages', requireAuth, (req, res) => {
  historyController.saveMessage(req, res);
});

export default router;
