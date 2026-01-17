import { AIService } from '../ai/AIService';
import { SemanticSearchService, SearchQuery } from './semanticSearchService';
import type { Message } from '../ai/interfaces/AIProvider';

export interface RAGContext {
  query: string;
  relevantDocuments: Array<{
    text: string;
    metadata: {
      documentId: string;
      section?: string;
      title?: string;
      source?: string;
      url?: string;
    };
    score: number;
  }>;
  contextText: string; // Combined context from relevant documents
}

export interface RAGResponse {
  response: string;
  context: RAGContext;
  citations: string[]; // Source citations
  model: string;
}

/**
 * RAG Service (Retrieval-Augmented Generation)
 * Combines semantic search with AI generation to provide context-aware responses
 */
export class RAGService {
  private aiService: AIService;
  private searchService: SemanticSearchService;

  constructor(aiService?: AIService, searchService?: SemanticSearchService) {
    this.aiService = aiService || new AIService();
    this.searchService = searchService || new SemanticSearchService();
  }

  /**
   * Generate a response using RAG
   */
  async generateResponse(
    query: string,
    conversationHistory?: Message[],
    topK: number = 5,
    minScore: number = 0.5
  ): Promise<RAGResponse> {
    try {
      // Step 1: Perform semantic search to retrieve relevant context
      const searchQuery: SearchQuery = {
        query,
        topK,
        minScore,
      };

      const searchResults = await this.searchService.search(searchQuery);

      // Step 2: Build context from search results
      const context = this.buildContext(query, searchResults.results);

      // Step 3: Build prompt with context
      const prompt = this.buildRAGPrompt(query, context.contextText, conversationHistory);

      // Step 4: Generate response using AI
      const messages: Message[] = conversationHistory || [];
      messages.push({
        role: 'user',
        content: prompt,
      });

      const aiResponse = await this.aiService.chat(messages);

      // Step 5: Extract citations from context
      const citations = this.extractCitations(context.relevantDocuments);

      return {
        response: aiResponse.content,
        context,
        citations,
        model: aiResponse.model,
      };
    } catch (error) {
      throw new Error(`RAG generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build context from search results
   */
  private buildContext(
    query: string,
    searchResults: Array<{
      text: string;
      metadata: {
        documentId: string;
        section?: string;
        title?: string;
        source?: string;
        url?: string;
      };
      score: number;
    }>
  ): RAGContext {
    // Combine relevant document texts
    const contextText = searchResults
      .map((result, index) => {
        let text = `[Document ${index + 1}]`;
        if (result.metadata.title) {
          text += ` ${result.metadata.title}`;
        }
        if (result.metadata.section) {
          text += ` (${result.metadata.section})`;
        }
        text += `\n${result.text}\n`;
        return text;
      })
      .join('\n---\n\n');

    return {
      query,
      relevantDocuments: searchResults.map(result => ({
        text: result.text,
        metadata: {
          documentId: result.metadata.documentId,
          section: result.metadata.section,
          title: result.metadata.title,
          source: result.metadata.source,
          url: result.metadata.url,
        },
        score: result.score,
      })),
      contextText,
    };
  }

  /**
   * Build RAG prompt with context
   */
  private buildRAGPrompt(
    query: string,
    contextText: string,
    conversationHistory?: Message[]
  ): string {
    let prompt = `You are Complyx, an AI assistant specialized in IFRS S1 & S2 compliance.

Use the following context from IFRS documentation to answer the user's question accurately and comprehensively.

Context:
${contextText}

User Question: ${query}

Instructions:
1. Answer the question based on the provided context
2. If the context doesn't contain relevant information, say so clearly
3. Cite specific sections or documents when referencing information from the context
4. Provide clear, actionable guidance
5. Maintain a professional yet approachable tone

Answer:`;

    return prompt;
  }

  /**
   * Extract citations from context documents
   */
  private extractCitations(documents: RAGContext['relevantDocuments']): string[] {
    const citations: string[] = [];

    for (const doc of documents) {
      if (doc.metadata.url) {
        citations.push(doc.metadata.url);
      } else if (doc.metadata.source && doc.metadata.section) {
        citations.push(`${doc.metadata.source} - ${doc.metadata.section}`);
      } else if (doc.metadata.title) {
        citations.push(doc.metadata.title);
      }
    }

    return [...new Set(citations)]; // Remove duplicates
  }

  /**
   * Generate streaming response using RAG
   */
  async *generateStreamingResponse(
    query: string,
    conversationHistory?: Message[],
    topK: number = 5,
    minScore: number = 0.5
  ): AsyncIterable<{ content: string; done: boolean; context?: RAGContext }> {
    try {
      // Step 1: Perform semantic search
      const searchQuery: SearchQuery = {
        query,
        topK,
        minScore,
      };

      const searchResults = await this.searchService.search(searchQuery);

      // Step 2: Build context
      const context = this.buildContext(query, searchResults.results);

      // Step 3: Build prompt
      const prompt = this.buildRAGPrompt(query, context.contextText, conversationHistory);

      // Step 4: Stream response
      const messages: Message[] = conversationHistory || [];
      messages.push({
        role: 'user',
        content: prompt,
      });

      // First yield context
      yield { content: '', done: false, context };

      // Then stream AI response
      const stream = this.aiService.streamChat(messages);
      for await (const chunk of stream) {
        yield { content: chunk.content, done: chunk.done };
      }
    } catch (error) {
      throw new Error(`RAG streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
