import { VectorDatabase } from './vectorDatabase';
import { SemanticSearchService, SearchResult } from './semanticSearchService';
import { ContentStatus } from './contentManagementService';

export interface ContentQualityScore {
  documentId: string;
  overallScore: number; // 0-1 scale
  factors: {
    completeness: number; // Document completeness (all sections present)
    chunkQuality: number; // Chunk quality (appropriate sizes)
    metadataCompleteness: number; // Metadata completeness
    sourceReliability: number; // Source reliability
    freshness: number; // Document freshness (recent updates)
  };
}

export interface UsageAnalytics {
  documentId: string;
  title: string;
  searchCount: number; // Number of times retrieved in searches
  citationCount: number; // Number of times cited in responses
  averageRelevanceScore: number; // Average relevance score
  lastAccessed?: Date; // Last time document was accessed
  popularityRank: number; // Popularity ranking (1 = most popular)
}

export interface KnowledgeBaseStats {
  totalDocuments: number;
  totalChunks: number;
  totalVectors: number;
  byDocumentType: Record<string, number>;
  bySource: Record<string, number>;
  averageQualityScore: number;
  mostUsedDocuments: UsageAnalytics[];
  recentlyAccessed: UsageAnalytics[];
}

export interface RefreshSchedule {
  documentId: string;
  sourceUrl: string;
  refreshInterval: number; // Hours between refreshes
  lastRefreshed?: Date;
  nextRefresh?: Date;
  enabled: boolean;
}

/**
 * Knowledge Base Management & Analytics Service
 * Provides content quality scoring, usage analytics, and refresh scheduling
 */
export class KnowledgeAnalyticsService {
  private vectorDatabase: VectorDatabase;
  private searchService: SemanticSearchService;
  
  // Usage tracking (in production, would use persistent storage)
  private usageTracking: Map<string, {
    searchCount: number;
    citationCount: number;
    relevanceScores: number[];
    lastAccessed?: Date;
  }> = new Map();

  // Refresh schedules (in production, would use persistent storage)
  private refreshSchedules: Map<string, RefreshSchedule> = new Map();

  constructor(
    vectorDatabase?: VectorDatabase,
    searchService?: SemanticSearchService
  ) {
    // Lazy imports to avoid circular dependencies
    if (!vectorDatabase) {
      const { VectorDatabaseFactory } = require('./vectorDatabase');
      this.vectorDatabase = VectorDatabaseFactory.create();
    } else {
      this.vectorDatabase = vectorDatabase;
    }

    if (!searchService) {
      this.searchService = new SemanticSearchService();
    } else {
      this.searchService = searchService;
    }
  }

  /**
   * Track document usage
   */
  trackDocumentUsage(
    documentId: string,
    relevanceScore: number,
    wasCited: boolean = false
  ): void {
    if (!this.usageTracking.has(documentId)) {
      this.usageTracking.set(documentId, {
        searchCount: 0,
        citationCount: 0,
        relevanceScores: [],
      });
    }

    const usage = this.usageTracking.get(documentId)!;
    usage.searchCount++;
    usage.relevanceScores.push(relevanceScore);
    usage.lastAccessed = new Date();

    if (wasCited) {
      usage.citationCount++;
    }

    // Keep only last 100 relevance scores to avoid memory bloat
    if (usage.relevanceScores.length > 100) {
      usage.relevanceScores = usage.relevanceScores.slice(-100);
    }
  }

  /**
   * Calculate content quality score for a document
   */
  async calculateContentQualityScore(documentId: string): Promise<ContentQualityScore> {
    // Placeholder implementation
    // In production, would:
    // 1. Query vector DB for all chunks of document
    // 2. Analyze chunk sizes and quality
    // 3. Check metadata completeness
    // 4. Verify source reliability
    // 5. Check document freshness

    const factors = {
      completeness: 0.85, // Would check if all sections present
      chunkQuality: 0.80, // Would analyze chunk sizes
      metadataCompleteness: 0.90, // Would check metadata fields
      sourceReliability: 0.95, // Would check source
      freshness: 0.75, // Would check last update date
    };

    const overallScore = Object.values(factors).reduce((sum, score) => sum + score, 0) / Object.values(factors).length;

    return {
      documentId,
      overallScore: Math.round(overallScore * 100) / 100,
      factors,
    };
  }

  /**
   * Get usage analytics for documents
   */
  getUsageAnalytics(limit: number = 10): UsageAnalytics[] {
    const analytics: UsageAnalytics[] = [];

    for (const [documentId, usage] of this.usageTracking.entries()) {
      const averageRelevanceScore = usage.relevanceScores.length > 0
        ? usage.relevanceScores.reduce((sum, score) => sum + score, 0) / usage.relevanceScores.length
        : 0;

      analytics.push({
        documentId,
        title: documentId, // Would get from metadata
        searchCount: usage.searchCount,
        citationCount: usage.citationCount,
        averageRelevanceScore,
        lastAccessed: usage.lastAccessed,
        popularityRank: 0, // Will be set after sorting
      });
    }

    // Sort by popularity (combination of search count and citation count)
    analytics.sort((a, b) => {
      const aPopularity = a.searchCount + (a.citationCount * 2); // Citations weighted higher
      const bPopularity = b.searchCount + (b.citationCount * 2);
      return bPopularity - aPopularity;
    });

    // Assign popularity ranks
    analytics.forEach((item, index) => {
      item.popularityRank = index + 1;
    });

    return analytics.slice(0, limit);
  }

  /**
   * Get knowledge base statistics
   */
  async getKnowledgeBaseStats(): Promise<KnowledgeBaseStats> {
    // Placeholder implementation
    // In production, would query vector DB for statistics

    const stats: KnowledgeBaseStats = {
      totalDocuments: 0, // Would count unique document IDs
      totalChunks: 0, // Would count all chunks
      totalVectors: 0, // Would count all vectors
      byDocumentType: {}, // Would group by document type
      bySource: {}, // Would group by source
      averageQualityScore: 0.80, // Would calculate from all documents
      mostUsedDocuments: this.getUsageAnalytics(10),
      recentlyAccessed: this.getUsageAnalytics(10).sort((a, b) => {
        if (!a.lastAccessed || !b.lastAccessed) return 0;
        return b.lastAccessed.getTime() - a.lastAccessed.getTime();
      }).slice(0, 10),
    };

    return stats;
  }

  /**
   * Schedule automatic content refresh
   */
  scheduleContentRefresh(
    documentId: string,
    sourceUrl: string,
    refreshIntervalHours: number,
    enabled: boolean = true
  ): RefreshSchedule {
    const now = new Date();
    const nextRefresh = new Date(now.getTime() + refreshIntervalHours * 60 * 60 * 1000);

    const schedule: RefreshSchedule = {
      documentId,
      sourceUrl,
      refreshInterval: refreshIntervalHours,
      lastRefreshed: undefined,
      nextRefresh,
      enabled,
    };

    this.refreshSchedules.set(documentId, schedule);
    return schedule;
  }

  /**
   * Get refresh schedules due for refresh
   */
  getSchedulesDueForRefresh(): RefreshSchedule[] {
    const now = new Date();
    const due: RefreshSchedule[] = [];

    for (const schedule of this.refreshSchedules.values()) {
      if (!schedule.enabled) continue;
      
      if (!schedule.nextRefresh || schedule.nextRefresh <= now) {
        due.push(schedule);
      }
    }

    return due;
  }

  /**
   * Mark schedule as refreshed
   */
  markScheduleRefreshed(documentId: string): void {
    const schedule = this.refreshSchedules.get(documentId);
    if (schedule) {
      const now = new Date();
      schedule.lastRefreshed = now;
      schedule.nextRefresh = new Date(now.getTime() + schedule.refreshInterval * 60 * 60 * 1000);
    }
  }

  /**
   * Get all refresh schedules
   */
  getAllRefreshSchedules(): RefreshSchedule[] {
    return Array.from(this.refreshSchedules.values());
  }

  /**
   * Enable/disable refresh schedule
   */
  toggleRefreshSchedule(documentId: string, enabled: boolean): boolean {
    const schedule = this.refreshSchedules.get(documentId);
    if (schedule) {
      schedule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Get document health metrics
   */
  async getDocumentHealth(documentId: string): Promise<{
    quality: ContentQualityScore;
    usage: UsageAnalytics | null;
    refreshSchedule?: RefreshSchedule;
    healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
  }> {
    const quality = await this.calculateContentQualityScore(documentId);
    const usage = this.usageTracking.has(documentId)
      ? this.getUsageAnalytics(1000).find(a => a.documentId === documentId) || null
      : null;
    const refreshSchedule = this.refreshSchedules.get(documentId);

    // Determine health status
    let healthStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
    
    if (quality.overallScore >= 0.9) {
      healthStatus = 'excellent';
    } else if (quality.overallScore >= 0.75) {
      healthStatus = 'good';
    } else if (quality.overallScore >= 0.6) {
      healthStatus = 'fair';
    } else {
      healthStatus = 'poor';
    }

    return {
      quality,
      usage,
      refreshSchedule,
      healthStatus,
    };
  }

  /**
   * Get recommendations for improving knowledge base
   */
  async getRecommendations(): Promise<{
    lowQualityDocuments: string[];
    outdatedDocuments: string[];
    unusedDocuments: string[];
    recommendations: string[];
  }> {
    // Placeholder - would analyze quality scores, usage, and freshness
    return {
      lowQualityDocuments: [],
      outdatedDocuments: [],
      unusedDocuments: [],
      recommendations: [
        'Regular content refresh recommended for frequently accessed documents',
        'Consider enhancing metadata for better searchability',
        'Review unused documents and consider archiving',
      ],
    };
  }
}

export const knowledgeAnalyticsService = new KnowledgeAnalyticsService();
