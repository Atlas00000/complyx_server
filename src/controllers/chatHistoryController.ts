import { Request, Response } from 'express';
import {
  createOrGetSession,
  listSessions,
  getMessages,
  saveMessage,
} from '../services/chat/chatHistoryService';

export class ChatHistoryController {
  async listSessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const { sessions, total } = await listSessions(userId, limit, offset);
      res.json({ sessions, total });
    } catch (err) {
      console.error('List chat sessions error:', err);
      res.status(500).json({ error: 'Failed to list chat sessions' });
    }
  }

  async createOrGetSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const sessionId = req.body?.sessionId as string | undefined;
      const title = req.body?.title as string | undefined;
      const session = await createOrGetSession(userId, sessionId ?? null, title ?? null);
      res.json({ session });
    } catch (err) {
      console.error('Create/get chat session error:', err);
      res.status(500).json({ error: 'Failed to create or get chat session' });
    }
  }

  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const sessionId = req.params.sessionId;
      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const cursor = (req.query.cursor as string) || undefined;
      const { messages, nextCursor } = await getMessages(sessionId, userId, limit, cursor ?? null);
      res.json({ messages, nextCursor });
    } catch (err) {
      console.error('Get chat messages error:', err);
      res.status(500).json({ error: 'Failed to get chat messages' });
    }
  }

  async saveMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const sessionId = req.params.sessionId;
      const { role, content, metadata } = req.body ?? {};
      if (!sessionId || !role || typeof content !== 'string') {
        res.status(400).json({ error: 'sessionId, role, and content are required' });
        return;
      }
      const message = await saveMessage(sessionId, userId, role, content, metadata);
      if (!message) {
        res.status(404).json({ error: 'Session not found or access denied' });
        return;
      }
      res.status(201).json({ message });
    } catch (err) {
      console.error('Save chat message error:', err);
      res.status(500).json({ error: 'Failed to save chat message' });
    }
  }
}
