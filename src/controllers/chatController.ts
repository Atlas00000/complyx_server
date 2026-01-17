import { Request, Response } from 'express';
import { AIService } from '../services/ai/AIService';
import { RAGService } from '../services/knowledge/ragService';
import { buildConversationContext } from '../services/ai/utils/contextBuilder';
import { streamToSSE } from '../services/ai/utils/streamingHandler';
import type { Message } from '../services/ai/interfaces/AIProvider';

export interface ChatRequest {
  message: string;
  messages?: Message[];
  stream?: boolean;
  useRAG?: boolean; // Enable RAG for context-aware responses
  ragTopK?: number;
  ragMinScore?: number;
}

export class ChatController {
  private aiService: AIService;
  private ragService: RAGService;

  constructor(aiService?: AIService) {
    this.aiService = aiService || new AIService();
    this.ragService = new RAGService(this.aiService);
  }

  async chat(req: Request<{}, {}, ChatRequest>, res: Response): Promise<void> {
    try {
      const { message, messages = [], stream = false, useRAG = false, ragTopK = 5, ragMinScore = 0.5 } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      // Build conversation context
      const context = buildConversationContext(messages, message);

      // Check if AI service is available
      if (!this.aiService.isAvailable()) {
        res.status(503).json({ 
          error: 'AI service is not configured',
          provider: this.aiService.getProviderName()
        });
        return;
      }

      // Handle streaming response
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
          const stream = this.aiService.streamChat(context.messages);
          const sseStream = streamToSSE(stream);

          for await (const chunk of sseStream) {
            if (!res.writableEnded) {
              res.write(chunk);
            }
          }

          if (!res.writableEnded) {
            res.end();
          }
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
            res.end();
          }
        }
      } else {
        // Handle non-streaming response
        try {
          let response;
          let ragContext = undefined;

          // Use RAG if enabled
          if (useRAG) {
            const ragResponse = await this.ragService.generateResponse(
              message,
              context.messages,
              ragTopK,
              ragMinScore
            );
            response = {
              content: ragResponse.response,
              model: ragResponse.model,
              usage: undefined, // RAG doesn't return usage stats
            };
            ragContext = {
              citations: ragResponse.citations,
              relevantDocuments: ragResponse.context.relevantDocuments.length,
            };
          } else {
            response = await this.aiService.chat(context.messages);
          }

          res.json({
            message: response.content,
            model: response.model,
            usage: response.usage,
            ...(ragContext && { ragContext }),
          });
        } catch (error) {
          console.error('Chat error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Check for specific error types
          if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
            res.status(503).json({ 
              error: 'AI service is not configured',
              provider: this.aiService.getProviderName()
            });
          } else {
            res.status(500).json({ error: errorMessage });
          }
        }
      }
    } catch (error) {
      console.error('Chat controller error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }
}
