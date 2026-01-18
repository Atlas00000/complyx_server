import { KnowledgeIngestionService, DocumentMetadata, IngestionResult } from './knowledgeIngestionService';
import { VectorVersioningService } from './vectorVersioningService';
import { VectorDatabase, MetadataFilter } from './vectorDatabase';

export interface ContentVersion {
  version: string;
  documentId: string;
  title: string;
  changeDescription?: string;
  createdAt: Date;
  createdBy?: string;
  isActive: boolean;
}

export interface ContentUpdate {
  documentId: string;
  oldVersion: string;
  newVersion: string;
  changeDescription?: string;
  updatedBy?: string;
  updatedAt: Date;
  changes?: {
    chunksAdded: number;
    chunksRemoved: number;
    chunksModified: number;
  };
}

export interface ContentStatus {
  documentId: string;
  title: string;
  status: 'active' | 'draft' | 'archived' | 'deprecated';
  currentVersion: string;
  lastUpdated: Date;
  totalChunks: number;
  source: string;
  documentType: DocumentMetadata['documentType'];
}

export interface CurationOptions {
  curatorId?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  reviewNotes?: string;
  tags?: string[];
  qualityScore?: number;
}

/**
 * Content Management Service
 * Provides manual curation, versioning, and update tracking for knowledge base content
 */
export class ContentManagementService {
  private ingestionService: KnowledgeIngestionService;
  private versioningService: VectorVersioningService;
  private vectorDatabase: VectorDatabase;

  constructor(
    ingestionService?: KnowledgeIngestionService,
    versioningService?: VectorVersioningService,
    vectorDatabase?: VectorDatabase
  ) {
    // Lazy imports to avoid circular dependencies
    if (!ingestionService) {
      const { KnowledgeIngestionService } = require('./knowledgeIngestionService');
      this.ingestionService = new KnowledgeIngestionService(vectorDatabase);
    } else {
      this.ingestionService = ingestionService;
    }

    if (!versioningService) {
      const { VectorVersioningService } = require('./vectorVersioningService');
      if (!vectorDatabase) {
        const { VectorDatabaseFactory } = require('./vectorDatabase');
        this.vectorDatabase = VectorDatabaseFactory.create();
      } else {
        this.vectorDatabase = vectorDatabase;
      }
      this.versioningService = new VectorVersioningService(this.vectorDatabase);
    } else {
      this.versioningService = versioningService;
    }

    if (!this.vectorDatabase) {
      const { VectorDatabaseFactory } = require('./vectorDatabase');
      this.vectorDatabase = VectorDatabaseFactory.create();
    }
  }

  /**
   * Manually curate and ingest a document with review
   */
  async curateDocument(
    text: string,
    metadata: DocumentMetadata,
    curationOptions: CurationOptions = {}
  ): Promise<IngestionResult> {
    // Enrich metadata with curation information
    const enrichedMetadata: DocumentMetadata = {
      ...metadata,
      tags: [...(metadata.tags || []), ...(curationOptions.tags || [])],
    };

    // Ingest document
    const result = await this.ingestionService.ingestDocument(text, enrichedMetadata);

    // Note: In a full implementation, you would store curation metadata separately
    // For now, we'll use the document ingestion result
    return result;
  }

  /**
   * Create a new version of a document
   */
  async createDocumentVersion(
    documentId: string,
    text: string,
    metadata: Partial<DocumentMetadata>,
    changeDescription?: string,
    createdBy?: string
  ): Promise<ContentVersion> {
    // Get current version
    const currentVersion = this.versioningService.getCurrentVersion();
    
    // Generate new version (increment patch version)
    const versionParts = currentVersion.replace('v', '').split('.');
    const newPatch = parseInt(versionParts[2] || '0', 10) + 1;
    const newVersion = `v${versionParts[0]}.${versionParts[1]}.${newPatch}`;

    // Get full metadata
    const fullMetadata: DocumentMetadata = {
      documentId: `${documentId}-${newVersion}`,
      title: metadata.title || documentId,
      source: metadata.source || 'manual',
      documentType: metadata.documentType || 'other',
      version: newVersion,
      ...metadata,
    };

    // Ingest new version
    await this.ingestionService.ingestDocument(text, fullMetadata, {
      version: newVersion,
      skipExisting: false,
    });

    // Create version record
    const version: ContentVersion = {
      version: newVersion,
      documentId: fullMetadata.documentId,
      title: fullMetadata.title,
      changeDescription,
      createdAt: new Date(),
      createdBy,
      isActive: true,
    };

    return version;
  }

  /**
   * Update an existing document (creates new version)
   */
  async updateDocument(
    documentId: string,
    text: string,
    metadata: Partial<DocumentMetadata>,
    changeDescription?: string,
    updatedBy?: string
  ): Promise<ContentUpdate> {
    // Get current version info
    const currentVersion = this.versioningService.getCurrentVersion();
    
    // Generate new version
    const versionParts = currentVersion.replace('v', '').split('.');
    const newPatch = parseInt(versionParts[2] || '0', 10) + 1;
    const newVersion = `v${versionParts[0]}.${versionParts[1]}.${newPatch}`;

    // Update document (creates new version)
    const fullMetadata: DocumentMetadata = {
      documentId,
      title: metadata.title || documentId,
      source: metadata.source || 'manual',
      documentType: metadata.documentType || 'other',
      version: newVersion,
      ...metadata,
    };

    const result = await this.ingestionService.updateDocument(
      documentId,
      text,
      fullMetadata,
      { version: newVersion }
    );

    // Create update record
    const update: ContentUpdate = {
      documentId,
      oldVersion: currentVersion,
      newVersion,
      changeDescription,
      updatedBy,
      updatedAt: new Date(),
      changes: {
        chunksAdded: result.chunksCreated,
        chunksRemoved: 0, // Would need to compare versions
        chunksModified: 0, // Would need to compare versions
      },
    };

    return update;
  }

  /**
   * Archive a document (mark as inactive)
   */
  async archiveDocument(documentId: string, archivedBy?: string): Promise<boolean> {
    // In a full implementation, you would:
    // 1. Update document status in a metadata store
    // 2. Optionally mark vectors as archived
    // 3. Keep vectors for historical reference but exclude from searches
    
    console.log(`Document ${documentId} archived by ${archivedBy || 'system'}`);
    return true;
  }

  /**
   * Deprecate a document (mark as deprecated but keep for reference)
   */
  async deprecateDocument(
    documentId: string,
    reason?: string,
    deprecatedBy?: string
  ): Promise<boolean> {
    // Similar to archive but marks as deprecated
    console.log(`Document ${documentId} deprecated: ${reason || 'No reason provided'}`);
    return true;
  }

  /**
   * Get document status
   */
  async getDocumentStatus(documentId: string): Promise<ContentStatus | null> {
    // Placeholder - would query metadata store for document status
    // For now, return basic status
    return {
      documentId,
      title: documentId,
      status: 'active',
      currentVersion: this.versioningService.getCurrentVersion(),
      lastUpdated: new Date(),
      totalChunks: 0, // Would need to query vector DB
      source: 'unknown',
      documentType: 'other',
    };
  }

  /**
   * Get all document versions
   */
  async getDocumentVersions(documentId: string): Promise<ContentVersion[]> {
    // Placeholder - would query version store
    const currentVersion = this.versioningService.getCurrentVersion();
    
    return [
      {
        version: currentVersion,
        documentId,
        title: documentId,
        createdAt: new Date(),
        isActive: true,
      },
    ];
  }

  /**
   * Review and approve content
   */
  async reviewContent(
    documentId: string,
    reviewStatus: 'approved' | 'rejected',
    reviewNotes?: string,
    reviewerId?: string
  ): Promise<boolean> {
    // Placeholder - would update review status in metadata store
    console.log(`Document ${documentId} reviewed by ${reviewerId || 'system'}: ${reviewStatus}`);
    if (reviewNotes) {
      console.log(`Review notes: ${reviewNotes}`);
    }
    return reviewStatus === 'approved';
  }

  /**
   * Get content quality score
   */
  async getContentQualityScore(documentId: string): Promise<number> {
    // Placeholder - would calculate based on:
    // - Completeness (all sections present)
    // - Chunk quality (appropriate chunk sizes)
    // - Metadata completeness
    // - Source reliability
    
    return 0.85; // Default quality score
  }

  /**
   * Get all documents with status
   */
  async getAllDocumentsStatus(): Promise<ContentStatus[]> {
    // Placeholder - would query all documents from metadata store
    return [];
  }

  /**
   * Search documents by metadata
   */
  async searchDocuments(filter: {
    documentType?: DocumentMetadata['documentType'];
    source?: string;
    status?: ContentStatus['status'];
    tags?: string[];
  }): Promise<ContentStatus[]> {
    // Placeholder - would query metadata store with filters
    return [];
  }
}

export const contentManagementService = new ContentManagementService();
