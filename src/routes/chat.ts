import { Router } from 'express';
import { ChatController } from '../controllers/chatController';

const router = Router();

// Lazy initialization - create controller when first request is made
let chatController: ChatController | null = null;

const getChatController = (): ChatController => {
  if (!chatController) {
    chatController = new ChatController();
  }
  return chatController;
};

// Chat endpoint
router.post('/', (req, res) => {
  getChatController().chat(req, res);
});

export default router;
