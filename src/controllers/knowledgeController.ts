import { Request, Response } from 'express';
import { SemanticSearchService } from '../services/knowledge/semanticSearchService';
import { RAGService } from '../services/knowledge/ragService';
import { FAQService } from '../services/knowledge/faqService';
import type { Message } from '../services/ai/interfaces/AIProvider';

export class KnowledgeController {
  private searchService: SemanticSearchService;
  private ragService: RAGService;
  private faqService: FAQService;

  constructor() {
    this.searchService = new SemanticSearchService();
    this.ragService = new RAGService();
    this.faqService = new FAQService();
  }

  /**
   * POST /api/knowledge/search
   * Perform semantic search
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const { query, topK, minScore, filter } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          error: 'Missing required field: query',
        });
        return;
      }

      const searchResponse = await this.searchService.search({
        query,
        topK: topK || 10,
        minScore: minScore || 0.5,
        filter,
      });

      res.json(searchResponse);
    } catch (error) {
      console.error('Error performing semantic search:', error);
      res.status(500).json({
        error: 'Failed to perform semantic search',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/knowledge/rag
   * Generate RAG response
   */
  async rag(req: Request, res: Response): Promise<void> {
    try {
      const { query, conversationHistory, topK, minScore } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          error: 'Missing required field: query',
        });
        return;
      }

      const messages: Message[] = conversationHistory || [];
      const ragResponse = await this.ragService.generateResponse(
        query,
        messages,
        topK || 5,
        minScore || 0.5
      );

      res.json(ragResponse);
    } catch (error) {
      console.error('Error generating RAG response:', error);
      res.status(500).json({
        error: 'Failed to generate RAG response',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/knowledge/faqs
   * Get all FAQs or search FAQs
   */
  async getFAQs(req: Request, res: Response): Promise<void> {
    try {
      const { query, category } = req.query;

      if (query && typeof query === 'string') {
        const searchResult = this.faqService.searchFAQs(
          query,
          category as any
        );
        res.json(searchResult);
      } else {
        const faqs = this.faqService.getAllFAQs(category as any);
        res.json({ faqs, totalResults: faqs.length });
      }
    } catch (error) {
      console.error('Error getting FAQs:', error);
      res.status(500).json({
        error: 'Failed to get FAQs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/knowledge/faqs/:id
   * Get FAQ by ID
   */
  async getFAQ(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const faq = this.faqService.getFAQ(id);

      if (!faq) {
        res.status(404).json({ error: 'FAQ not found' });
        return;
      }

      const related = this.faqService.getRelatedFAQs(id, 5);
      res.json({ faq, related });
    } catch (error) {
      console.error('Error getting FAQ:', error);
      res.status(500).json({
        error: 'Failed to get FAQ',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/knowledge/resources
   * Get all resources or search resources
   */
  async getResources(req: Request, res: Response): Promise<void> {
    try {
      const { query, category, type } = req.query;

      if (query && typeof query === 'string') {
        const searchResult = this.faqService.searchResources(
          query,
          category as any,
          type as any
        );
        res.json(searchResult);
      } else {
        const resources = this.faqService.getAllResources(
          category as any,
          type as any
        );
        res.json({ resources, totalResults: resources.length });
      }
    } catch (error) {
      console.error('Error getting resources:', error);
      res.status(500).json({
        error: 'Failed to get resources',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/knowledge/resources/:id
   * Get resource by ID
   */
  async getResource(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const resource = this.faqService.getResource(id);

      if (!resource) {
        res.status(404).json({ error: 'Resource not found' });
        return;
      }

      res.json(resource);
    } catch (error) {
      console.error('Error getting resource:', error);
      res.status(500).json({
        error: 'Failed to get resource',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
