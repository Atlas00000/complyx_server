import { RAGContext, Citation } from './ragService';
import { SemanticSearchService, SearchQuery } from './semanticSearchService';

export interface CrossReference {
  sourceDocumentId: string;
  targetDocumentId: string;
  sourceSection?: string;
  targetSection?: string;
  referenceType: 'related' | 'follows' | 'supersedes' | 'amends' | 'cites';
  confidence: number;
}

export interface TemporalContext {
  documentDate?: Date;
  queryDate?: Date;
  isCurrent: boolean;
  isRelevant: boolean;
  relevanceReason?: string;
}

export interface SourceReliability {
  source: string;
  reliabilityScore: number; // 0-1 scale
  factors: {
    isOfficial?: boolean; // Official IFRS source
    isRecent?: boolean; // Recent publication
    isVerified?: boolean; // Verified by IFRS Foundation
    citationCount?: number; // Number of citations
  };
}

/**
 * Advanced RAG Features Service
 * Provides cross-reference linking, temporal knowledge, and confidence scoring
 */
export class AdvancedRAGFeatures {
  private searchService: SemanticSearchService;

  constructor(searchService?: SemanticSearchService) {
    if (!searchService) {
      this.searchService = new SemanticSearchService();
    } else {
      this.searchService = searchService;
    }
  }

  /**
   * Find cross-references between documents
   */
  async findCrossReferences(
    documentId: string,
    topK: number = 5
  ): Promise<CrossReference[]> {
    // Get document by ID to find related documents
    const searchQuery: SearchQuery = {
      query: documentId, // Use document ID as search query
      topK: topK * 2, // Get more results for better cross-reference detection
    };

    try {
      const searchResults = await this.searchService.search(searchQuery);

      // Filter to exclude the source document itself
      const relatedDocuments = searchResults.results.filter(
        result => result.metadata.documentId !== documentId
      );

      // Build cross-references
      const crossReferences: CrossReference[] = relatedDocuments.map((result, index) => {
        // Determine reference type based on metadata or content analysis
        let referenceType: CrossReference['referenceType'] = 'related';
        
        // Simple heuristic: check if document titles/sections suggest relationships
        const text = result.text.toLowerCase();
        const title = result.metadata.title?.toLowerCase() || '';
        
        if (title.includes('amendment') || title.includes('amends')) {
          referenceType = 'amends';
        } else if (title.includes('supersedes') || title.includes('replaces')) {
          referenceType = 'supersedes';
        } else if (text.includes('follows from') || text.includes('based on')) {
          referenceType = 'follows';
        } else if (text.includes('cited in') || text.includes('references')) {
          referenceType = 'cites';
        }

        // Calculate confidence based on relevance score
        const confidence = Math.min(result.score, 1.0);

        return {
          sourceDocumentId: documentId,
          targetDocumentId: result.metadata.documentId,
          sourceSection: undefined, // Would need to extract from context
          targetSection: result.metadata.section,
          referenceType,
          confidence,
        };
      });

      // Sort by confidence and return top K
      return crossReferences
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, topK);
    } catch (error) {
      console.error('Failed to find cross-references:', error);
      return [];
    }
  }

  /**
   * Add temporal context to documents
   */
  addTemporalContext(
    documents: RAGContext['relevantDocuments'],
    queryDate?: Date
  ): TemporalContext[] {
    const temporalContexts: TemporalContext[] = [];
    const now = new Date();
    const query = queryDate || now;

    for (const doc of documents) {
      // Extract date from metadata (if available)
      // For now, use document metadata or default to recent
      let documentDate: Date | undefined;
      
      // Try to extract from metadata (would need to be stored during ingestion)
      // For now, assume documents are current if no date available
      documentDate = undefined;

      const isCurrent = !documentDate || (now.getTime() - documentDate.getTime()) < (365 * 24 * 60 * 60 * 1000); // Within 1 year
      
      // Determine if document is relevant to query date
      let isRelevant = true;
      let relevanceReason: string | undefined;

      if (documentDate) {
        // Check if document date is relevant to query date
        const daysDiff = Math.abs(query.getTime() - documentDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 730) { // More than 2 years old
          isRelevant = false;
          relevanceReason = 'Document may be outdated (>2 years old)';
        } else if (daysDiff > 365) {
          relevanceReason = 'Document is older than 1 year - verify current requirements';
          isRelevant = true; // Still relevant but flag as potentially outdated
        } else {
          relevanceReason = 'Document is current';
        }
      } else {
        relevanceReason = 'Document date not available - assumed current';
      }

      temporalContexts.push({
        documentDate,
        queryDate: query,
        isCurrent,
        isRelevant,
        relevanceReason,
      });
    }

    return temporalContexts;
  }

  /**
   * Calculate source reliability scores
   */
  calculateSourceReliability(
    documents: RAGContext['relevantDocuments']
  ): Map<string, SourceReliability> {
    const sourceMap = new Map<string, SourceReliability>();

    // Known official sources (would be configurable)
    const officialSources = new Set([
      'IFRS Foundation',
      'ISSB',
      'IASB',
      'IFRS',
      'IAS',
    ]);

    for (const doc of documents) {
      const source = doc.metadata.source || 'unknown';
      
      if (!sourceMap.has(source)) {
        const isOfficial = officialSources.has(source);
        
        sourceMap.set(source, {
          source,
          reliabilityScore: isOfficial ? 0.95 : 0.75, // Official sources get higher score
          factors: {
            isOfficial,
            isRecent: true, // Would check actual date
            isVerified: isOfficial,
            citationCount: 1,
          },
        });
      } else {
        const reliability = sourceMap.get(source)!;
        reliability.factors.citationCount = (reliability.factors.citationCount || 0) + 1;
        
        // Boost reliability slightly with more citations
        if (reliability.factors.citationCount > 3) {
          reliability.reliabilityScore = Math.min(1.0, reliability.reliabilityScore + 0.05);
        }
      }
    }

    return sourceMap;
  }

  /**
   * Enhance citations with cross-references and temporal context
   */
  async enhanceCitations(
    citations: Citation[],
    queryDate?: Date
  ): Promise<Array<Citation & { crossReferences?: CrossReference[]; temporalContext?: TemporalContext }>> {
    const enhancedCitations: Array<Citation & { crossReferences?: CrossReference[]; temporalContext?: TemporalContext }> = [];

    for (const citation of citations) {
      // Find cross-references for this document
      const documentId = citation.title || citation.source;
      const crossReferences = await this.findCrossReferences(documentId, 3);

      // Add temporal context
      const temporalContext: TemporalContext = {
        queryDate: queryDate || new Date(),
        isCurrent: true, // Would check actual document date
        isRelevant: true,
        relevanceReason: 'Document is current',
      };

      enhancedCitations.push({
        ...citation,
        crossReferences: crossReferences.length > 0 ? crossReferences : undefined,
        temporalContext,
      });
    }

    return enhancedCitations;
  }

  /**
   * Calculate overall confidence score with source reliability
   */
  calculateEnhancedConfidence(
    documents: RAGContext['relevantDocuments'],
    sourceReliability: Map<string, SourceReliability>
  ): number {
    if (documents.length === 0) {
      return 0;
    }

    // Base confidence from document relevance
    let baseConfidence = documents.reduce((sum, doc) => sum + doc.score, 0) / documents.length;

    // Source reliability factor
    let reliabilityFactor = 0;
    let reliabilityCount = 0;

    for (const doc of documents) {
      const source = doc.metadata.source || 'unknown';
      const reliability = sourceReliability.get(source);
      
      if (reliability) {
        reliabilityFactor += reliability.reliabilityScore;
        reliabilityCount++;
      }
    }

    const avgReliability = reliabilityCount > 0 ? reliabilityFactor / reliabilityCount : 0.75;

    // Combine base confidence with source reliability (weighted average)
    const confidence = (baseConfidence * 0.7) + (avgReliability * 0.3);

    return Math.min(1.0, Math.max(0, confidence));
  }

  /**
   * Filter documents by temporal relevance
   */
  filterByTemporalRelevance(
    documents: RAGContext['relevantDocuments'],
    temporalContexts: TemporalContext[]
  ): RAGContext['relevantDocuments'] {
    const filtered: RAGContext['relevantDocuments'] = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const temporal = temporalContexts[i];

      if (temporal.isRelevant) {
        filtered.push(doc);
      }
    }

    return filtered;
  }
}

export const advancedRAGFeatures = new AdvancedRAGFeatures();
