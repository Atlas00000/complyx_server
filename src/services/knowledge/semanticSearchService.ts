import { VectorDatabase } from './vectorDatabase';
import { EmbeddingService } from './embeddingService';

export interface SearchQuery {
  query: string;
  topK?: number;
  minScore?: number;
  filter?: {
    documentId?: string;
    section?: string;
    source?: string;
  };
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: {
    documentId: string;
    section?: string;
    title?: string;
    source?: string;
    url?: string;
    chunkIndex?: number;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
  processingTimeMs?: number;
}

/**
 * Semantic Search Service
 * Provides semantic search over document embeddings
 */
export class SemanticSearchService {
  private vectorDatabase: VectorDatabase;
  private embeddingService: EmbeddingService;

  constructor(vectorDatabase?: VectorDatabase, embeddingService?: EmbeddingService) {
    this.vectorDatabase = vectorDatabase || require('./vectorDatabase').VectorDatabaseFactory.create();
    this.embeddingService = embeddingService || new EmbeddingService();
  }

  /**
   * Perform semantic search
   */
  async search(searchQuery: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.generateEmbedding(searchQuery.query);

      // Build filter for vector database
      const filter = searchQuery.filter ? {
        ...(searchQuery.filter.documentId && { documentId: searchQuery.filter.documentId }),
        ...(searchQuery.filter.section && { section: searchQuery.filter.section }),
        ...(searchQuery.filter.source && { source: searchQuery.filter.source }),
      } : undefined;

      // Search in vector database
      const topK = searchQuery.topK || 10;
      const vectorResults = await this.vectorDatabase.search(
        queryEmbedding.embedding,
        topK,
        filter
      );

      // Filter by minimum score
      const minScore = searchQuery.minScore || 0;
      const filteredResults = vectorResults.filter(result => result.score >= minScore);

      // Convert to search results
      const results: SearchResult[] = filteredResults.map(result => ({
        id: result.id,
        text: result.metadata.text,
        score: result.score,
        metadata: {
          documentId: result.metadata.documentId,
          section: result.metadata.section,
          title: result.metadata.title,
          source: result.metadata.source,
          url: result.metadata.url,
          chunkIndex: result.metadata.chunkIndex,
        },
      }));

      // Rank and reorder results (already sorted by similarity, but can add custom ranking)
      const rankedResults = this.rankResults(results, searchQuery.query);

      const processingTime = Date.now() - startTime;

      return {
        results: rankedResults,
        totalResults: rankedResults.length,
        query: searchQuery.query,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      throw new Error(`Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rank search results based on relevance factors
   */
  private rankResults(results: SearchResult[], query: string): SearchResult[] {
    const queryLower = query.toLowerCase();

    // Calculate relevance boost based on keyword matching
    const boostedResults = results.map(result => {
      let boost = 1.0;

      // Boost if query keywords appear in title
      if (result.metadata.title) {
        const titleLower = result.metadata.title.toLowerCase();
        const matchingKeywords = queryLower
          .split(/\s+/)
          .filter(keyword => titleLower.includes(keyword.toLowerCase())).length;
        boost += matchingKeywords * 0.2;
      }

      // Boost if query keywords appear in text
      const textLower = result.text.toLowerCase();
      const matchingKeywords = textLower
        .split(/\s+/)
        .filter(keyword => queryLower.includes(keyword.toLowerCase())).length;
      boost += matchingKeywords * 0.1;

      // Boost if section matches query context
      if (result.metadata.section && queryLower.includes(result.metadata.section.toLowerCase())) {
        boost += 0.3;
      }

      return {
        ...result,
        score: result.score * boost,
      };
    });

    // Re-sort by boosted score
    return boostedResults.sort((a, b) => b.score - a.score);
  }

  /**
   * Search by document ID
   */
  async searchByDocument(documentId: string, query: string, topK: number = 5): Promise<SearchResponse> {
    return this.search({
      query,
      topK,
      filter: { documentId },
    });
  }

  /**
   * Search by section
   */
  async searchBySection(section: string, query: string, topK: number = 5): Promise<SearchResponse> {
    return this.search({
      query,
      topK,
      filter: { section },
    });
  }

  /**
   * Hybrid search: combine semantic and keyword search
   * Enhanced implementation with better ranking and keyword extraction
   */
  async hybridSearch(
    query: string,
    topK: number = 10,
    semanticWeight: number = 0.7,
    keywordWeight: number = 0.3,
    filter?: {
      documentId?: string;
      section?: string;
      source?: string;
    }
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    // Normalize weights to ensure they sum to 1
    const totalWeight = semanticWeight + keywordWeight;
    const normalizedSemanticWeight = semanticWeight / totalWeight;
    const normalizedKeywordWeight = keywordWeight / totalWeight;

    // Step 1: Perform semantic search
    const semanticResults = await this.search({
      query,
      topK: topK * 2, // Get more results for better keyword matching
      filter,
    });

    // Step 2: Perform keyword search on all available vectors
    const keywordResults = await this.performKeywordSearch(query, filter, topK * 2);

    // Step 3: Combine results with weighted scores
    const combinedResults = new Map<string, SearchResult>();

    // Add semantic results with normalized weight
    for (const result of semanticResults.results) {
      const existing = combinedResults.get(result.id);
      if (existing) {
        // Average weighted score
        existing.score = existing.score + (result.score * normalizedSemanticWeight);
      } else {
        combinedResults.set(result.id, {
          ...result,
          score: result.score * normalizedSemanticWeight,
        });
      }
    }

    // Add keyword results with normalized weight
    for (const result of keywordResults) {
      const existing = combinedResults.get(result.id);
      if (existing) {
        // Combine scores: weighted average
        existing.score = existing.score + (result.score * normalizedKeywordWeight);
      } else {
        combinedResults.set(result.id, {
          ...result,
          score: result.score * normalizedKeywordWeight,
        });
      }
    }

    // Step 4: Apply additional ranking factors
    const rankedResults = this.rankHybridResults(
      Array.from(combinedResults.values()),
      query
    )
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const processingTime = Date.now() - startTime;

    return {
      results: rankedResults,
      totalResults: rankedResults.length,
      query,
      processingTimeMs: processingTime,
    };
  }

  /**
   * Perform keyword search across all vectors
   * Enhanced implementation with better keyword matching
   */
  private async performKeywordSearch(
    query: string,
    filter?: {
      documentId?: string;
      section?: string;
      source?: string;
    },
    topK: number = 10
  ): Promise<SearchResult[]> {
    // Extract meaningful keywords (filter out stop words, short words)
    const keywords = this.extractKeywords(query);
    
    if (keywords.length === 0) {
      return [];
    }

    // Get all vectors from database (this might need optimization for large datasets)
    // For now, we'll search semantically and then filter by keywords
    const semanticResults = await this.search({
      query,
      topK: topK * 3, // Get more candidates for keyword filtering
      filter,
    });

    // Score results based on keyword matches
    const keywordResults = semanticResults.results.map(result => {
      const textContent = `${result.text} ${result.metadata.title || ''} ${result.metadata.section || ''}`.toLowerCase();
      
      let matchScore = 0;
      let exactMatches = 0;
      let partialMatches = 0;

      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        
        // Exact match (full word)
        const exactMatchRegex = new RegExp(`\\b${keywordLower}\\b`, 'gi');
        if (exactMatchRegex.test(textContent)) {
          exactMatches++;
          matchScore += 2; // Higher weight for exact matches
        }
        // Partial match
        else if (textContent.includes(keywordLower)) {
          partialMatches++;
          matchScore += 1; // Lower weight for partial matches
        }
      }

      // Normalize score based on number of keywords
      const normalizedScore = matchScore / (keywords.length * 2);

      return {
        ...result,
        score: normalizedScore,
      };
    });

    // Filter out results with no matches and sort by score
    return keywordResults
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Extract meaningful keywords from query
   */
  private extractKeywords(query: string): string[] {
    // Common stop words to filter out
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'where',
      'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'about', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out',
      'off', 'over', 'under', 'again', 'further', 'then', 'once',
    ]);

    // Split query into words and filter
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, '')) // Remove punctuation
      .filter(word => word.length > 2) // Keep words longer than 2 characters
      .filter(word => !stopWords.has(word)); // Remove stop words

    // Remove duplicates and return
    return Array.from(new Set(words));
  }

  /**
   * Enhanced ranking for hybrid search results
   */
  private rankHybridResults(results: SearchResult[], query: string): SearchResult[] {
    const queryLower = query.toLowerCase();
    const keywords = this.extractKeywords(query);

    return results.map(result => {
      let boost = 1.0;
      const textLower = result.text.toLowerCase();
      const titleLower = result.metadata.title?.toLowerCase() || '';

      // Boost for title matches (strong signal)
      for (const keyword of keywords) {
        if (titleLower.includes(keyword)) {
          boost += 0.3;
        }
      }

      // Boost for exact phrase matches
      if (textLower.includes(queryLower)) {
        boost += 0.4;
      }

      // Boost for section relevance
      if (result.metadata.section) {
        const sectionLower = result.metadata.section.toLowerCase();
        for (const keyword of keywords) {
          if (sectionLower.includes(keyword)) {
            boost += 0.2;
          }
        }
      }

      // Boost for source relevance (if source matches query context)
      if (result.metadata.source && queryLower.includes(result.metadata.source.toLowerCase())) {
        boost += 0.15;
      }

      // Decay for low semantic similarity scores
      if (result.score < 0.5) {
        boost *= 0.8;
      }

      return {
        ...result,
        score: result.score * Math.min(boost, 2.0), // Cap boost at 2x
      };
    });
  }

  /**
   * Simple keyword search within results (for future use)
   */
  // @ts-expect-error - Method prepared for future keyword search functionality
  private _keywordSearch(results: SearchResult[], query: string): SearchResult[] {
    const queryKeywords = query.toLowerCase().split(/\s+/).filter((k: string) => k.length > 2);

    return results.map((result: SearchResult) => {
      const textLower = result.text.toLowerCase();
      let matchCount = 0;

      for (const keyword of queryKeywords) {
        if (textLower.includes(keyword)) {
          matchCount++;
        }
      }

      const score = matchCount / queryKeywords.length;
      return {
        ...result,
        score,
      };
    }).filter((result: SearchResult & { score: number }) => result.score > 0);
  }
}
