import { VectorDatabase, VectorSearchResult } from './vectorDatabase';
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
   */
  async hybridSearch(
    query: string,
    topK: number = 10,
    semanticWeight: number = 0.7,
    keywordWeight: number = 0.3
  ): Promise<SearchResponse> {
    // Perform semantic search
    const semanticResults = await this.search({ query, topK: topK * 2 });

    // Perform keyword search (simple text matching)
    const keywordResults = this.keywordSearch(semanticResults.results, query);

    // Combine results with weighted scores
    const combinedResults = new Map<string, SearchResult>();

    // Add semantic results with weight
    for (const result of semanticResults.results) {
      const existing = combinedResults.get(result.id);
      if (existing) {
        existing.score = existing.score * keywordWeight + result.score * semanticWeight;
      } else {
        combinedResults.set(result.id, {
          ...result,
          score: result.score * semanticWeight,
        });
      }
    }

    // Add keyword results with weight
    for (const result of keywordResults) {
      const existing = combinedResults.get(result.id);
      if (existing) {
        existing.score = existing.score + result.score * keywordWeight;
      } else {
        combinedResults.set(result.id, {
          ...result,
          score: result.score * keywordWeight,
        });
      }
    }

    // Sort by combined score
    const rankedResults = Array.from(combinedResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      results: rankedResults,
      totalResults: rankedResults.length,
      query,
    };
  }

  /**
   * Simple keyword search within results
   */
  private keywordSearch(results: SearchResult[], query: string): SearchResult[] {
    const queryKeywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);

    return results.map(result => {
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
    }).filter(result => result.score > 0);
  }
}
