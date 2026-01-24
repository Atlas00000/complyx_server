/**
 * Vector Database Interface
 * Abstract interface for vector database operations
 * Can be implemented with Pinecone, Weaviate, or in-memory storage
 */

export interface VectorEmbedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    documentId: string;
    section?: string;
    title?: string;
    source?: string;
    url?: string;
    chunkIndex?: number;
    version?: string; // Knowledge base version
    createdAt?: string; // ISO date string
    updatedAt?: string; // ISO date string
  };
}

export interface VectorSearchResult {
  id: string;
  score: number; // Similarity score (0-1)
  metadata: VectorEmbedding['metadata'];
}

export interface MetadataFilter {
  // Exact match filters
  documentId?: string | string[];
  section?: string | string[];
  source?: string | string[];
  title?: string | string[];
  
  // Range filters (for numeric metadata like chunkIndex)
  chunkIndex?: number | { min?: number; max?: number };
  
  // Date filters (if we add date metadata later)
  createdAt?: { min?: Date; max?: Date };
  updatedAt?: { min?: Date; max?: Date };
  
  // Text search in metadata fields
  textContains?: string;
  titleContains?: string;
  
  // Complex filters
  $or?: MetadataFilter[];
  $and?: MetadataFilter[];
  $not?: MetadataFilter;
}

export interface VectorDatabase {
  /**
   * Insert a vector embedding
   */
  insert(vector: VectorEmbedding): Promise<void>;

  /**
   * Insert multiple vector embeddings
   */
  insertBatch(vectors: VectorEmbedding[]): Promise<void>;

  /**
   * Search for similar vectors with enhanced metadata filtering
   */
  search(queryVector: number[], topK?: number, filter?: MetadataFilter): Promise<VectorSearchResult[]>;

  /**
   * Delete vectors by ID
   */
  delete(ids: string[]): Promise<void>;

  /**
   * Get vector by ID
   */
  get(id: string): Promise<VectorEmbedding | null>;

  /**
   * Check if database is connected
   */
  isConnected(): boolean;

  /**
   * Initialize database connection
   */
  connect(): Promise<void>;

  /**
   * Close database connection
   */
  disconnect(): Promise<void>;
}

/**
 * In-Memory Vector Database Implementation
 * Simple implementation for development/testing
 * Can be replaced with Pinecone/Weaviate for production
 */
export class InMemoryVectorDatabase implements VectorDatabase {
  private vectors: Map<string, VectorEmbedding> = new Map();
  private connected: boolean = false;

  async insert(vector: VectorEmbedding): Promise<void> {
    this.vectors.set(vector.id, vector);
  }

  async insertBatch(vectors: VectorEmbedding[]): Promise<void> {
    for (const vector of vectors) {
      await this.insert(vector);
    }
  }

  async search(
    queryVector: number[],
    topK: number = 10,
    filter?: MetadataFilter
  ): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    // Calculate cosine similarity for each vector
    for (const [id, vector] of this.vectors.entries()) {
      const similarity = this.cosineSimilarity(queryVector, vector.vector);
      results.push({
        id,
        score: similarity,
        metadata: vector.metadata,
      });
    }

    // Apply metadata filtering
    const filteredResults = filter ? this.applyMetadataFilter(results, filter) : results;

    // Sort by score (descending) and return top K
    return filteredResults.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Apply metadata filter to search results
   */
  private applyMetadataFilter(results: VectorSearchResult[], filter: MetadataFilter): VectorSearchResult[] {
    return results.filter(result => {
      const metadata = result.metadata;

      // Handle $and conditions
      if (filter.$and) {
        return filter.$and.every(subFilter => {
          const filtered = this.applyMetadataFilter([result], subFilter);
          return filtered.length > 0;
        });
      }

      // Handle $or conditions
      if (filter.$or) {
        return filter.$or.some(subFilter => {
          const filtered = this.applyMetadataFilter([result], subFilter);
          return filtered.length > 0;
        });
      }

      // Handle $not conditions
      if (filter.$not) {
        const filtered = this.applyMetadataFilter([result], filter.$not);
        return filtered.length === 0;
      }

      // Exact match filters
      if (filter.documentId) {
        const documentIds = Array.isArray(filter.documentId) ? filter.documentId : [filter.documentId];
        if (!documentIds.includes(metadata.documentId)) {
          return false;
        }
      }

      if (filter.section) {
        const sections = Array.isArray(filter.section) ? filter.section : [filter.section];
        if (!metadata.section || !sections.includes(metadata.section)) {
          return false;
        }
      }

      if (filter.source) {
        const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
        if (!metadata.source || !sources.includes(metadata.source)) {
          return false;
        }
      }

      if (filter.title) {
        const titles = Array.isArray(filter.title) ? filter.title : [filter.title];
        if (!metadata.title || !titles.includes(metadata.title)) {
          return false;
        }
      }

      // Range filters
      if (filter.chunkIndex !== undefined) {
        if (typeof filter.chunkIndex === 'number') {
          if (metadata.chunkIndex !== filter.chunkIndex) {
            return false;
          }
        } else {
          if (filter.chunkIndex.min !== undefined && (metadata.chunkIndex || 0) < filter.chunkIndex.min) {
            return false;
          }
          if (filter.chunkIndex.max !== undefined && (metadata.chunkIndex || 0) > filter.chunkIndex.max) {
            return false;
          }
        }
      }

      // Text contains filters
      if (filter.textContains) {
        const searchText = filter.textContains.toLowerCase();
        if (!metadata.text.toLowerCase().includes(searchText)) {
          return false;
        }
      }

      if (filter.titleContains && metadata.title) {
        const searchText = filter.titleContains.toLowerCase();
        if (!metadata.title.toLowerCase().includes(searchText)) {
          return false;
        }
      }

      return true;
    });
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.vectors.delete(id);
    }
  }

  async get(id: string): Promise<VectorEmbedding | null> {
    return this.vectors.get(id) || null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Get all vectors (for testing/debugging)
   */
  getAll(): VectorEmbedding[] {
    return Array.from(this.vectors.values());
  }

  /**
   * Clear all vectors (for testing/debugging)
   */
  clear(): void {
    this.vectors.clear();
  }

  /**
   * Get total vector count
   */
  count(): number {
    return this.vectors.size;
  }
}

/**
 * Pinecone Vector Database Implementation
 * Production-ready vector database using Pinecone
 */
export class PineconeVectorDatabase implements VectorDatabase {
  private client: any = null;
  private index: any = null;
  private indexName: string;
  private apiKey: string;
  private _environment: string;
  private dimension: number;
  private connected: boolean = false;

  constructor() {
    this.apiKey = process.env.PINECONE_API_KEY || '';
    // Environment stored for future use (intentionally unused for now)
    this._environment = process.env.PINECONE_ENVIRONMENT || '';
    void this._environment; // Mark as intentionally used
    this.indexName = process.env.PINECONE_INDEX_NAME || 'complyx-knowledge';
    this.dimension = parseInt(process.env.EMBEDDING_DIMENSION || '768', 10);

    if (!this.apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }
  }

  async connect(): Promise<void> {
    try {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      
      this.client = new Pinecone({
        apiKey: this.apiKey,
      });

      // Get or create index
      const indexList = await this.client.listIndexes();
      const indexExists = indexList.indexes?.some((idx: any) => idx.name === this.indexName);

      if (!indexExists) {
        // Create index if it doesn't exist
        await this.client.createIndex({
          name: this.indexName,
          dimension: this.dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1',
            },
          },
        });

        // Wait for index to be ready
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      this.index = this.client.index(this.indexName);
      this.connected = true;
      console.log(`✅ Connected to Pinecone index: ${this.indexName}`);
    } catch (error) {
      console.error('❌ Failed to connect to Pinecone:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.index = null;
    this.client = null;
  }

  isConnected(): boolean {
    return this.connected && this.index !== null;
  }

  async insert(vector: VectorEmbedding): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }

    try {
      await this.index.upsert([
        {
          id: vector.id,
          values: vector.vector,
          metadata: {
            text: vector.metadata.text,
            documentId: vector.metadata.documentId,
            section: vector.metadata.section || '',
            title: vector.metadata.title || '',
            source: vector.metadata.source || '',
            url: vector.metadata.url || '',
            chunkIndex: vector.metadata.chunkIndex || 0,
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to insert vector:', error);
      throw error;
    }
  }

  async insertBatch(vectors: VectorEmbedding[]): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }

    try {
      // Pinecone supports batch upsert
      const records = vectors.map((vector) => ({
        id: vector.id,
        values: vector.vector,
        metadata: {
          text: vector.metadata.text,
          documentId: vector.metadata.documentId,
          section: vector.metadata.section || '',
          title: vector.metadata.title || '',
          source: vector.metadata.source || '',
          url: vector.metadata.url || '',
          chunkIndex: vector.metadata.chunkIndex || 0,
        },
      }));

      // Pinecone recommends batches of 100
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await this.index.upsert(batch);
      }
    } catch (error) {
      console.error('Failed to insert batch:', error);
      throw error;
    }
  }

  async search(
    queryVector: number[],
    topK: number = 10,
    filter?: MetadataFilter
  ): Promise<VectorSearchResult[]> {
    if (!this.isConnected()) {
      await this.connect();
    }

    try {
      const queryOptions: any = {
        vector: queryVector,
        topK,
        includeMetadata: true,
      };

      // Convert MetadataFilter to Pinecone filter format
      if (filter && Object.keys(filter).length > 0) {
        queryOptions.filter = this.convertFilterToPineconeFormat(filter);
      }

      const queryResponse = await this.index.query(queryOptions);

      const results: VectorSearchResult[] = (queryResponse.matches || []).map((match: any) => ({
        id: match.id,
        score: match.score || 0,
        metadata: {
          text: match.metadata?.text || '',
          documentId: match.metadata?.documentId || '',
          section: match.metadata?.section,
          title: match.metadata?.title,
          source: match.metadata?.source,
          url: match.metadata?.url,
          chunkIndex: match.metadata?.chunkIndex,
        },
      }));

      return results;
    } catch (error) {
      console.error('Failed to search vectors:', error);
      throw error;
    }
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }

    try {
      await this.index.deleteMany(ids);
    } catch (error) {
      console.error('Failed to delete vectors:', error);
      throw error;
    }
  }

  async get(id: string): Promise<VectorEmbedding | null> {
    if (!this.isConnected()) {
      await this.connect();
    }

    try {
      const fetchResponse = await this.index.fetch([id]);
      const record = fetchResponse.records?.[id];

      if (!record) {
        return null;
      }

      return {
        id: record.id,
        vector: record.values,
        metadata: {
          text: record.metadata?.text || '',
          documentId: record.metadata?.documentId || '',
          section: record.metadata?.section,
          title: record.metadata?.title,
          source: record.metadata?.source,
          url: record.metadata?.url,
          chunkIndex: record.metadata?.chunkIndex,
        },
      };
    } catch (error) {
      console.error('Failed to get vector:', error);
      return null;
    }
  }

  /**
   * Convert MetadataFilter to Pinecone filter format
   * Pinecone uses a specific filter format with operators
   */
  private convertFilterToPineconeFormat(filter: MetadataFilter): any {
    const pineconeFilter: any = {};

    // Document ID filter
    if (filter.documentId) {
      const ids = Array.isArray(filter.documentId) ? filter.documentId : [filter.documentId];
      if (ids.length === 1) {
        pineconeFilter.documentId = { $eq: ids[0] };
      } else {
        pineconeFilter.documentId = { $in: ids };
      }
    }

    // Section filter
    if (filter.section) {
      const sections = Array.isArray(filter.section) ? filter.section : [filter.section];
      if (sections.length === 1) {
        pineconeFilter.section = { $eq: sections[0] };
      } else {
        pineconeFilter.section = { $in: sections };
      }
    }

    // Source filter
    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      if (sources.length === 1) {
        pineconeFilter.source = { $eq: sources[0] };
      } else {
        pineconeFilter.source = { $in: sources };
      }
    }

    // Title filter
    if (filter.title) {
      const titles = Array.isArray(filter.title) ? filter.title : [filter.title];
      if (titles.length === 1) {
        pineconeFilter.title = { $eq: titles[0] };
      } else {
        pineconeFilter.title = { $in: titles };
      }
    }

    // Chunk index range
    if (filter.chunkIndex !== undefined) {
      if (typeof filter.chunkIndex === 'number') {
        pineconeFilter.chunkIndex = { $eq: filter.chunkIndex };
      } else {
        const rangeFilter: any = {};
        if (filter.chunkIndex.min !== undefined) {
          rangeFilter.$gte = filter.chunkIndex.min;
        }
        if (filter.chunkIndex.max !== undefined) {
          rangeFilter.$lte = filter.chunkIndex.max;
        }
        if (Object.keys(rangeFilter).length > 0) {
          pineconeFilter.chunkIndex = rangeFilter;
        }
      }
    }

    // Handle $and, $or, $not (convert to Pinecone format)
    if (filter.$and && filter.$and.length > 0) {
      pineconeFilter.$and = filter.$and.map(subFilter => this.convertFilterToPineconeFormat(subFilter));
    }

    if (filter.$or && filter.$or.length > 0) {
      pineconeFilter.$or = filter.$or.map(subFilter => this.convertFilterToPineconeFormat(subFilter));
    }

    if (filter.$not) {
      pineconeFilter.$not = this.convertFilterToPineconeFormat(filter.$not);
    }

    return Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined;
  }
}

/**
 * Vector Database Factory
 * Creates appropriate vector database instance based on configuration
 */
export class VectorDatabaseFactory {
  static create(): VectorDatabase {
    const vectorDbType = process.env.VECTOR_DB_TYPE || 'memory';

    switch (vectorDbType.toLowerCase()) {
      case 'memory':
        return new InMemoryVectorDatabase();
      
      case 'pinecone':
        return new PineconeVectorDatabase();
      
      // Future implementation
      // case 'weaviate':
      //   return new WeaviateVectorDatabase();
      
      default:
        console.warn(`Unknown vector DB type: ${vectorDbType}, defaulting to memory`);
        return new InMemoryVectorDatabase();
    }
  }
}
