import { VectorDatabase, MetadataFilter } from './vectorDatabase';
import { SemanticSearchService } from './semanticSearchService';

export interface Facet {
  field: string;
  values: Array<{
    value: string;
    count: number;
  }>;
}

export interface FacetedSearchQuery {
  query: string;
  topK?: number;
  facets?: string[]; // Fields to facet on: 'source', 'section', 'documentId', etc.
  filters?: MetadataFilter;
}

export interface FacetedSearchResult {
  results: Array<{
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
  }>;
  facets: Facet[];
  totalResults: number;
  query: string;
}

/**
 * Faceted Search Service
 * Provides faceted search capabilities for filtering and exploring search results
 */
export class FacetedSearchService {
  private semanticSearchService: SemanticSearchService;
  // @ts-expect-error - Reserved for future faceted search operations
  private _vectorDatabase: VectorDatabase;

  constructor(
    semanticSearchService?: SemanticSearchService,
    vectorDatabase?: VectorDatabase
  ) {
    // Lazy import to avoid circular dependencies
    if (!semanticSearchService) {
      const { SemanticSearchService } = require('./semanticSearchService');
      this.semanticSearchService = new SemanticSearchService(vectorDatabase);
    } else {
      this.semanticSearchService = semanticSearchService;
    }

    if (!vectorDatabase) {
      const { VectorDatabaseFactory } = require('./vectorDatabase');
      this._vectorDatabase = VectorDatabaseFactory.create();
    } else {
      this._vectorDatabase = vectorDatabase;
    }
  }

  /**
   * Perform faceted search
   */
  async facetedSearch(searchQuery: FacetedSearchQuery): Promise<FacetedSearchResult> {
    // Step 1: Perform initial search (hybrid search for better results)
    const searchResults = await this.semanticSearchService.hybridSearch(
      searchQuery.query,
      searchQuery.topK || 50, // Get more results for faceting
      undefined, // Use default weights
      undefined, // Use default weights
      searchQuery.filters ? {
        documentId: Array.isArray(searchQuery.filters.documentId) 
          ? searchQuery.filters.documentId[0] 
          : searchQuery.filters.documentId,
        section: Array.isArray(searchQuery.filters.section)
          ? searchQuery.filters.section[0]
          : searchQuery.filters.section,
        source: Array.isArray(searchQuery.filters.source)
          ? searchQuery.filters.source[0]
          : searchQuery.filters.source,
      } : undefined
    );

    // Step 2: Extract facets from search results
    const facets = this.extractFacets(searchResults.results, searchQuery.facets || []);

    // Step 3: Return results with facets
    return {
      results: searchResults.results.slice(0, searchQuery.topK || 10),
      facets,
      totalResults: searchResults.totalResults,
      query: searchQuery.query,
    };
  }

  /**
   * Extract facet information from search results
   */
  private extractFacets(results: any[], facetFields: string[]): Facet[] {
    const facets: Facet[] = [];

    for (const field of facetFields) {
      const facetMap = new Map<string, number>();

      // Count occurrences of each value for this field
      for (const result of results) {
        const value = this.getFieldValue(result, field);
        if (value !== undefined && value !== null) {
          const valueStr = String(value);
          facetMap.set(valueStr, (facetMap.get(valueStr) || 0) + 1);
        }
      }

      // Convert to facet format
      const facet: Facet = {
        field,
        values: Array.from(facetMap.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count), // Sort by count descending
      };

      facets.push(facet);
    }

    return facets;
  }

  /**
   * Get field value from result metadata
   */
  private getFieldValue(result: any, field: string): any {
    // Try metadata fields first
    if (result.metadata && result.metadata[field]) {
      return result.metadata[field];
    }

    // Try direct fields
    if (result[field]) {
      return result[field];
    }

    return undefined;
  }

  /**
   * Get available facet values for a field (all values, not just from search results)
   * This requires querying the vector database directly
   */
  async getAvailableFacets(field: string): Promise<Facet> {
    // Note: This is a simplified implementation
    // In production, you'd want to query the vector database for all unique values
    // For now, we'll extract from current search results

    // For a full implementation, we'd need to:
    // 1. Query all vectors (or sample them)
    // 2. Extract unique values for the field
    // 3. Count occurrences

    // Placeholder implementation
    return {
      field,
      values: [],
    };
  }

  /**
   * Filter search results by facet values
   */
  applyFacetFilter(
    results: any[],
    facetField: string,
    facetValues: string[]
  ): any[] {
    return results.filter(result => {
      const value = this.getFieldValue(result, facetField);
      return value && facetValues.includes(String(value));
    });
  }

  /**
   * Combine multiple facet filters (AND operation)
   */
  applyMultipleFacetFilters(
    results: any[],
    facetFilters: Record<string, string[]>
  ): any[] {
    let filteredResults = results;

    for (const [field, values] of Object.entries(facetFilters)) {
      filteredResults = this.applyFacetFilter(filteredResults, field, values);
    }

    return filteredResults;
  }
}

export const facetedSearchService = new FacetedSearchService();
