import { VectorDatabase, VectorEmbedding, MetadataFilter } from './vectorDatabase';
import { EmbeddingService, DocumentChunk } from './embeddingService';
import { VectorVersioningService } from './vectorVersioningService';

export interface DocumentMetadata {
  documentId: string;
  title: string;
  source: string;
  url?: string;
  section?: string;
  documentType: 'standard' | 'guidance' | 'exposure-draft' | 'webinar' | 'case-study' | 'audit-guide' | 'faq' | 'other';
  publishDate?: Date;
  version?: string;
  language?: string;
  tags?: string[];
  // Source tracking fields
  sourceUrl?: string;
  ingestionDate?: Date;
  lastModified?: Date;
  checksum?: string; // For detecting changes
  trustedSource?: boolean; // Whether source is trusted
  // Priority and scope fields
  priority?: 'high' | 'medium' | 'low'; // Priority for ranking (S1/S2 = high, general IFRS = medium)
  scope?: 's1' | 's2' | 'general' | 'accounting'; // Document scope for context-aware retrieval
}

export interface IngestionResult {
  documentId: string;
  chunksCreated: number;
  vectorsStored: number;
  success: boolean;
  errors?: string[];
  processingTimeMs?: number;
}

export interface IngestionOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  skipExisting?: boolean;
  version?: string;
}

/**
 * Knowledge Ingestion Service
 * Handles document processing, chunking, embedding generation, and vector storage
 */
export class KnowledgeIngestionService {
  private vectorDatabase: VectorDatabase;
  private embeddingService: EmbeddingService;
  private versioningService: VectorVersioningService;

  constructor(
    vectorDatabase?: VectorDatabase,
    embeddingService?: EmbeddingService,
    versioningService?: VectorVersioningService
  ) {
    // Lazy imports to avoid circular dependencies
    if (!vectorDatabase) {
      const { VectorDatabaseFactory } = require('./vectorDatabase');
      this.vectorDatabase = VectorDatabaseFactory.create();
    } else {
      this.vectorDatabase = vectorDatabase;
    }

    if (!embeddingService) {
      this.embeddingService = new EmbeddingService();
    } else {
      this.embeddingService = embeddingService;
    }

    if (!versioningService) {
      const { VectorVersioningService } = require('./vectorVersioningService');
      this.versioningService = new VectorVersioningService(this.vectorDatabase);
    } else {
      this.versioningService = versioningService;
    }

    // Ensure vector database is connected
    if (!this.vectorDatabase.isConnected()) {
      this.vectorDatabase.connect().catch(console.error);
    }
  }

  /**
   * Generate checksum for document content (simple hash)
   */
  private generateChecksum(text: string): string {
    // Simple hash function for change detection
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Track source information for document
   */
  private enrichMetadata(metadata: DocumentMetadata, text: string): DocumentMetadata {
    // Determine priority and scope based on document type and title
    const priority = this.determinePriority(metadata);
    const scope = this.determineScope(metadata, text);

    return {
      ...metadata,
      ingestionDate: metadata.ingestionDate || new Date(),
      lastModified: metadata.lastModified || new Date(),
      checksum: metadata.checksum || this.generateChecksum(text),
      trustedSource: metadata.trustedSource !== undefined ? metadata.trustedSource : true,
      sourceUrl: metadata.sourceUrl || metadata.url,
      priority: metadata.priority || priority,
      scope: metadata.scope || scope,
    };
  }

  /**
   * Determine document priority for ranking (S1/S2 = high, general IFRS = medium)
   */
  private determinePriority(metadata: DocumentMetadata): 'high' | 'medium' | 'low' {
    // If explicitly set, use that
    if (metadata.priority) {
      return metadata.priority;
    }

    const titleLower = (metadata.title || '').toLowerCase();
    const docType = metadata.documentType || 'other';

    // High priority: S1, S2, or sustainability-related documents
    if (
      titleLower.includes('ifrs s1') ||
      titleLower.includes('ifrs s2') ||
      titleLower.includes('sustainability') ||
      docType === 'standard' && (titleLower.includes('s1') || titleLower.includes('s2'))
    ) {
      return 'high';
    }

    // Medium priority: Other IFRS standards, guidance, official documents
    if (
      titleLower.includes('ifrs') ||
      titleLower.includes('ias') ||
      docType === 'standard' ||
      docType === 'guidance'
    ) {
      return 'medium';
    }

    // Low priority: Other documents
    return 'low';
  }

  /**
   * Determine document scope for context-aware retrieval
   */
  private determineScope(metadata: DocumentMetadata, text: string): 's1' | 's2' | 'general' | 'accounting' {
    // If explicitly set, use that
    if (metadata.scope) {
      return metadata.scope;
    }

    const titleLower = (metadata.title || '').toLowerCase();
    const textLower = text.substring(0, 1000).toLowerCase(); // Check first 1000 chars
    const combined = `${titleLower} ${textLower}`;

    // S1 scope: Sustainability disclosures, general requirements
    if (
      combined.includes('ifrs s1') ||
      combined.includes('sustainability-related financial information') ||
      combined.includes('general requirements') && combined.includes('sustainability')
    ) {
      return 's1';
    }

    // S2 scope: Climate-related disclosures
    if (
      combined.includes('ifrs s2') ||
      combined.includes('climate-related') ||
      combined.includes('climate disclosure')
    ) {
      return 's2';
    }

    // General IFRS: Other IFRS standards
    if (combined.includes('ifrs') || combined.includes('ias')) {
      return 'general';
    }

    // Accounting: General accounting knowledge
    return 'accounting';
  }

  /**
   * Ingest a document into the knowledge base
   */
  async ingestDocument(
    text: string,
    metadata: DocumentMetadata,
    options: IngestionOptions = {}
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const chunkSize = options.chunkSize || 500;
      const chunkOverlap = options.chunkOverlap || 50;
      const version = options.version || this.versioningService.getCurrentVersion();

      // Step 0: Enrich metadata with source tracking
      const enrichedMetadata = this.enrichMetadata(metadata, text);

      // Step 1: Chunk the document
      const chunks = this.embeddingService.chunkDocument(
        enrichedMetadata.documentId,
        text,
        chunkSize,
        chunkOverlap,
        {
          section: enrichedMetadata.section,
          title: enrichedMetadata.title,
          source: enrichedMetadata.source,
          url: enrichedMetadata.url || enrichedMetadata.sourceUrl,
        }
      );

      // Step 2: Check for existing vectors if skipExisting is true
      if (options.skipExisting) {
        const existingCount = await this.getExistingChunkCount(enrichedMetadata.documentId);
        if (existingCount > 0) {
          // Optionally check if document has changed using checksum
          // For now, skip if exists
          return {
            documentId: enrichedMetadata.documentId,
            chunksCreated: 0,
            vectorsStored: 0,
            success: true,
            errors: [`Document ${enrichedMetadata.documentId} already exists. Skipped.`],
            processingTimeMs: Date.now() - startTime,
          };
        }
      }

      // Step 3: Generate embeddings for chunks
      const texts = chunks.map(chunk => chunk.text);
      let embeddings;
      try {
        embeddings = await this.embeddingService.generateEmbeddings(texts);
      } catch (error) {
        errors.push(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }

      // Step 4: Create vector embeddings with metadata
      const vectors: VectorEmbedding[] = chunks.map((chunk, index) => {
        const vector = embeddings[index];

        return {
          id: `${enrichedMetadata.documentId}-chunk-${chunk.chunkIndex}`,
          vector: vector.embedding,
          metadata: {
            text: chunk.text,
            documentId: enrichedMetadata.documentId,
            section: enrichedMetadata.section || chunk.metadata?.section,
            title: enrichedMetadata.title,
            source: enrichedMetadata.source,
            url: enrichedMetadata.url || enrichedMetadata.sourceUrl || chunk.metadata?.url,
            chunkIndex: chunk.chunkIndex,
            version: version,
            createdAt: enrichedMetadata.ingestionDate?.toISOString() || new Date().toISOString(),
            updatedAt: enrichedMetadata.lastModified?.toISOString() || new Date().toISOString(),
          },
        };
      });

      // Step 5: Store vectors in database
      let vectorsStored = 0;
      try {
        // Store in batches to avoid overwhelming the database
        const batchSize = 100;
        for (let i = 0; i < vectors.length; i += batchSize) {
          const batch = vectors.slice(i, i + batchSize);
          await this.vectorDatabase.insertBatch(batch);
          vectorsStored += batch.length;
        }
      } catch (error) {
        errors.push(`Failed to store vectors: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }

      const processingTime = Date.now() - startTime;

      return {
        documentId: enrichedMetadata.documentId,
        chunksCreated: chunks.length,
        vectorsStored,
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      return {
        documentId: metadata.documentId,
        chunksCreated: 0,
        vectorsStored: 0,
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Ingest multiple documents
   */
  async ingestDocuments(
    documents: Array<{ text: string; metadata: DocumentMetadata }>,
    options: IngestionOptions = {}
  ): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];

    for (const doc of documents) {
      const result = await this.ingestDocument(doc.text, doc.metadata, options);
      results.push(result);

      // Small delay between documents to avoid rate limiting
      if (results.length < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Update an existing document (re-ingest with new content)
   */
  async updateDocument(
    documentId: string,
    text: string,
    metadata: Partial<DocumentMetadata>,
    options: IngestionOptions = {}
  ): Promise<IngestionResult> {
    // Step 1: Delete existing vectors for this document
    await this.deleteDocument(documentId);

    // Step 2: Get full metadata
    const fullMetadata: DocumentMetadata = {
      documentId,
      title: metadata.title || documentId,
      source: metadata.source || 'unknown',
      documentType: metadata.documentType || 'other',
      ...metadata,
    };

    // Step 3: Re-ingest with new content
    return this.ingestDocument(text, fullMetadata, {
      ...options,
      skipExisting: false, // Force re-ingestion
    });
  }

  /**
   * Delete a document and all its chunks from the knowledge base
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      // Get all chunk IDs for this document
      // Note: This is a simplified approach - in production, you might want to
      // maintain an index of document IDs to chunk IDs
      
      // For now, we'll use a pattern-based approach
      // The pattern is: {documentId}-chunk-{index}
      // In production, you might want to query by metadata filter
      
      // This is a placeholder - would need to query vector DB by metadata filter
      // to get all chunks for a document
      console.log(`⚠️  Document deletion for ${documentId} requires metadata filtering support`);
      return true;
    } catch (error) {
      console.error(`Failed to delete document ${documentId}:`, error);
      return false;
    }
  }

  /**
   * Get count of existing chunks for a document
   */
  private async getExistingChunkCount(documentId: string): Promise<number> {
    try {
      // Ensure vector database is connected
      if (!this.vectorDatabase.isConnected()) {
        await this.vectorDatabase.connect();
      }

      // Create a dummy query vector to search
      // We'll use metadata filtering to find all chunks for this document
      const dimension = parseInt(process.env.EMBEDDING_DIMENSION || '768', 10);
      const queryVector = new Array(dimension).fill(0); // Dummy vector

      // Filter by documentId to get all chunks for this document
      const filter = {
        documentId: documentId,
      };

      // Search with filter to get all chunks for this document
      // We use a high topK value to get all chunks
      const results = await this.vectorDatabase.search(queryVector, 1000, filter);

      // Return count of results
      return results.length;
    } catch (error) {
      // If filtering is not supported or fails, return 0 (assume no existing chunks)
      console.warn(`Failed to get existing chunk count for ${documentId}:`, error instanceof Error ? error.message : 'Unknown error');
      return 0;
    }
  }

  /**
   * Validate document metadata
   */
  validateMetadata(metadata: DocumentMetadata): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!metadata.documentId || metadata.documentId.trim().length === 0) {
      errors.push('Document ID is required');
    }

    if (!metadata.title || metadata.title.trim().length === 0) {
      errors.push('Document title is required');
    }

    if (!metadata.source || metadata.source.trim().length === 0) {
      errors.push('Document source is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get ingestion statistics
   */
  async getIngestionStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalVectors: number;
    byDocumentType: Record<string, number>;
  }> {
    // Placeholder - would need to query vector DB for statistics
    // This would require aggregation capabilities
    return {
      totalDocuments: 0,
      totalChunks: 0,
      totalVectors: 0,
      byDocumentType: {},
    };
  }
}

export const knowledgeIngestionService = new KnowledgeIngestionService();
