import { AIService } from '../ai/AIService';
import { SemanticSearchService, SearchQuery } from './semanticSearchService';
import type { Message } from '../ai/interfaces/AIProvider';

export interface RAGContext {
  query: string;
  relevantDocuments: Array<{
    id: string;
    text: string;
    metadata: {
      documentId: string;
      section?: string;
      title?: string;
      source?: string;
      url?: string;
      chunkIndex?: number;
      page?: number;
    };
    score: number;
    rank: number; // Ranking position (1 = most relevant)
  }>;
  contextText: string; // Combined context from relevant documents
  sourceRanking: Array<{
    source: string;
    documentCount: number;
    averageScore: number;
    documents: string[]; // Document IDs
  }>;
}

export interface Citation {
  text: string; // Citation text
  url?: string; // Source URL
  source: string; // Document source
  title: string; // Document title
  section?: string; // Section reference
  page?: number; // Page number
  chunkIndex?: number; // Chunk index
  score: number; // Relevance score
}

export interface RAGResponse {
  response: string;
  context: RAGContext;
  citations: Citation[]; // Enhanced citations with metadata
  model: string;
  confidence?: number; // Overall confidence score
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
   * Generate a response using RAG with multi-document retrieval
   */
  async generateResponse(
    query: string,
    conversationHistory?: Message[],
    topK: number = 5,
    minScore: number = 0.5,
    maxDocuments?: number // Maximum unique documents to retrieve
  ): Promise<RAGResponse> {
    try {
      // Step 1: Perform semantic search to retrieve relevant context
      const searchQuery: SearchQuery = {
        query,
        topK,
        minScore,
      };

      // Step 1: Perform semantic search (get more results for multi-document ranking)
      const searchK = maxDocuments ? topK * 2 : topK;
      searchQuery.topK = searchK;
      const searchResults = await this.searchService.search(searchQuery);

      // Step 2: Rank and select documents with source ranking and priority-aware boosting
      const rankedResults = this.rankDocumentsBySource(searchResults.results, maxDocuments || topK, query);

      // Step 3: Build context from ranked search results
      const context = this.buildContext(query, rankedResults);

      // Step 4: Build prompt with context
      const prompt = this.buildRAGPrompt(query, context.contextText, conversationHistory);

      // Step 5: Generate response using AI
      const messages: Message[] = conversationHistory || [];
      messages.push({
        role: 'user',
        content: prompt,
      });

      const aiResponse = await this.aiService.chat(messages);

      // Step 6: Extract enhanced citations with page/section references
      const citations = this.extractEnhancedCitations(context.relevantDocuments);

      // Step 7: Calculate overall confidence score
      const confidence = this.calculateConfidenceScore(context.relevantDocuments);

      return {
        response: aiResponse.content,
        context,
        citations,
        model: aiResponse.model,
        confidence,
      };
    } catch (error) {
      throw new Error(`RAG generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rank documents by source and relevance
   */
  private rankDocumentsBySource(
    results: Array<{
      text: string;
      metadata: {
        documentId: string;
        section?: string;
        title?: string;
        source?: string;
        url?: string;
        chunkIndex?: number;
        page?: number;
        priority?: 'high' | 'medium' | 'low';
        scope?: 's1' | 's2' | 'general' | 'accounting';
      };
      score: number;
    }>,
    maxDocuments: number,
    query?: string
  ): Array<{
      text: string;
      metadata: {
        documentId: string;
        section?: string;
        title?: string;
        source?: string;
        url?: string;
        chunkIndex?: number;
        page?: number;
      };
      score: number;
    }> {
    // Detect query context (sustainability-related queries should prioritize S1/S2)
    const queryContext = this.detectQueryContext(query || '');

    // Group by document ID (to get best chunk per document)
    const documentMap = new Map<string, typeof results[0] & { count: number }>();

    for (const result of results) {
      const docId = result.metadata.documentId;
      const existing = documentMap.get(docId);

      // Calculate adjusted score with priority boost
      const adjustedScore = this.calculateAdjustedScore(result.score, result.metadata, queryContext);

      if (!existing || adjustedScore > this.calculateAdjustedScore(existing.score, existing.metadata, queryContext)) {
        // Keep the highest scoring chunk per document with adjusted score
        documentMap.set(docId, { ...result, score: adjustedScore, count: 1 });
      } else if (existing) {
        existing.count = (existing.count || 1) + 1;
      }
    }

    // Convert to array and sort by adjusted score
    const ranked = Array.from(documentMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, maxDocuments);

    // Restore original scores for display (but ranking is based on adjusted scores)
    return ranked.map(result => ({
      ...result,
      score: results.find(r => r.metadata.documentId === result.metadata.documentId)?.score || result.score,
    }));
  }

  /**
   * Detect query context (sustainability vs general IFRS/accounting)
   */
  private detectQueryContext(query: string): 'sustainability' | 'general' {
    const queryLower = query.toLowerCase();
    
    // Sustainability-related keywords
    const sustainabilityKeywords = [
      's1', 's2', 'sustainability', 'climate', 'esg', 'environmental', 'social', 'governance',
      'sustainability-related', 'climate-related', 'green', 'emission', 'carbon', 'disclosure',
      'sustainability reporting', 'ifrs s1', 'ifrs s2',
    ];

    // Check if query contains sustainability keywords
    for (const keyword of sustainabilityKeywords) {
      if (queryLower.includes(keyword)) {
        return 'sustainability';
      }
    }

    return 'general';
  }

  /**
   * Calculate adjusted score with priority and context-based boosting
   */
  private calculateAdjustedScore(
    baseScore: number,
    metadata: {
      priority?: 'high' | 'medium' | 'low';
      scope?: 's1' | 's2' | 'general' | 'accounting';
      title?: string;
    },
    queryContext: 'sustainability' | 'general'
  ): number {
    let adjustedScore = baseScore;

    // Priority-based boost
    if (metadata.priority === 'high') {
      adjustedScore *= 1.3; // Boost high priority documents (S1/S2)
    } else if (metadata.priority === 'medium') {
      adjustedScore *= 1.1; // Slight boost for medium priority (general IFRS)
    }

    // Context-based boost (boost S1/S2 when query is sustainability-related)
    if (queryContext === 'sustainability') {
      if (metadata.scope === 's1' || metadata.scope === 's2') {
        adjustedScore *= 1.4; // Strong boost for S1/S2 in sustainability queries
      }
    }

    // Boost based on title relevance (S1/S2 in title)
    if (metadata.title) {
      const titleLower = metadata.title.toLowerCase();
      if (queryContext === 'sustainability' && (titleLower.includes('s1') || titleLower.includes('s2'))) {
        adjustedScore *= 1.2; // Additional boost for S1/S2 titles
      }
    }

    return adjustedScore;
  }

  /**
   * Build context from search results with source ranking
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
        chunkIndex?: number;
        page?: number;
      };
      score: number;
    }>
  ): RAGContext {
    // Build source ranking
    const sourceMap = new Map<string, { documents: Set<string>; scores: number[] }>();
    
    for (const result of searchResults) {
      const source = result.metadata.source || 'unknown';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { documents: new Set(), scores: [] });
      }
      const sourceData = sourceMap.get(source)!;
      sourceData.documents.add(result.metadata.documentId);
      sourceData.scores.push(result.score);
    }

    const sourceRanking = Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        source,
        documentCount: data.documents.size,
        averageScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        documents: Array.from(data.documents),
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    // Combine relevant document texts with ranking info
    const contextText = searchResults
      .map((result, index) => {
        let text = `[Document ${index + 1} - Rank ${index + 1}]`;
        if (result.metadata.title) {
          text += ` ${result.metadata.title}`;
        }
        if (result.metadata.section) {
          text += ` (Section: ${result.metadata.section})`;
        }
        if (result.metadata.page) {
          text += ` [Page ${result.metadata.page}]`;
        }
        text += `\n${result.text}\n`;
        return text;
      })
      .join('\n---\n\n');

    return {
      query,
      relevantDocuments: searchResults.map((result, index) => ({
        id: `${result.metadata.documentId}-chunk-${result.metadata.chunkIndex || index}`,
        text: result.text,
        metadata: {
          documentId: result.metadata.documentId,
          section: result.metadata.section,
          title: result.metadata.title,
          source: result.metadata.source,
          url: result.metadata.url,
          chunkIndex: result.metadata.chunkIndex,
          page: result.metadata.page,
        },
        score: result.score,
        rank: index + 1,
      })),
      contextText,
      sourceRanking,
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
    let prompt = `You are Complyx, an AI assistant specialized in IFRS standards and general accounting knowledge, with particular expertise in IFRS S1 (Sustainability-related Financial Information Disclosures) and IFRS S2 (Climate-related Disclosures).

Use the following context from IFRS documentation and accounting resources to answer the user's question accurately and comprehensively.

Context:
${contextText}

User Question: ${query}

Instructions:
1. Answer the question based on the provided context
2. If the context contains IFRS S1 or S2 information and the query relates to sustainability, prioritize that information
3. If the context doesn't contain relevant information, say so clearly - you can answer general IFRS and accounting questions beyond S1/S2
4. Cite specific sections or documents when referencing information from the context
5. Provide clear, actionable guidance
6. Maintain a professional yet approachable tone

Answer:`;

    return prompt;
  }

  /**
   * Extract enhanced citations with page/section references
   */
  private extractEnhancedCitations(documents: RAGContext['relevantDocuments']): Citation[] {
    const citations: Citation[] = [];
    const citationMap = new Map<string, Citation>();

    for (const doc of documents) {
      // Create citation key (document + section)
      const citationKey = `${doc.metadata.documentId}-${doc.metadata.section || 'default'}`;

      // Build citation text
      let citationText = '';
      if (doc.metadata.title) {
        citationText = doc.metadata.title;
      } else if (doc.metadata.source) {
        citationText = doc.metadata.source;
      } else {
        citationText = doc.metadata.documentId;
      }

      // Add section reference
      if (doc.metadata.section) {
        citationText += `, Section ${doc.metadata.section}`;
      }

      // Add page reference
      if (doc.metadata.page) {
        citationText += `, Page ${doc.metadata.page}`;
      }

      // Create or update citation
      const existingCitation = citationMap.get(citationKey);
      if (!existingCitation) {
        citationMap.set(citationKey, {
          text: citationText,
          url: doc.metadata.url,
          source: doc.metadata.source || 'unknown',
          title: doc.metadata.title || doc.metadata.documentId,
          section: doc.metadata.section,
          page: doc.metadata.page,
          chunkIndex: doc.metadata.chunkIndex,
          score: doc.score,
        });
      } else {
        // Update with highest score if this document has better relevance
        if (doc.score > existingCitation.score) {
          existingCitation.score = doc.score;
        }
      }
    }

    // Convert to array and sort by score (most relevant first)
    return Array.from(citationMap.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate overall confidence score based on source reliability and relevance
   */
  private calculateConfidenceScore(documents: RAGContext['relevantDocuments']): number {
    if (documents.length === 0) {
      return 0;
    }

    // Average relevance score
    const avgScore = documents.reduce((sum, doc) => sum + doc.score, 0) / documents.length;

    // Source diversity bonus (multiple sources = higher confidence)
    const uniqueSources = new Set(documents.map(doc => doc.metadata.source)).size;
    const diversityBonus = Math.min(uniqueSources / 3, 0.1); // Max 0.1 bonus for 3+ sources

    // Number of documents bonus
    const documentBonus = Math.min(documents.length / 5, 0.1); // Max 0.1 bonus for 5+ documents

    // Combine factors (normalize to 0-1 range)
    const confidence = Math.min(1, avgScore + diversityBonus + documentBonus);

    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
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
