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
  };
}

export interface VectorSearchResult {
  id: string;
  score: number; // Similarity score (0-1)
  metadata: VectorEmbedding['metadata'];
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
   * Search for similar vectors
   */
  search(queryVector: number[], topK?: number, filter?: Record<string, any>): Promise<VectorSearchResult[]>;

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
    _filter?: Record<string, any>
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

    // Sort by score (descending) and return top K
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
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
 * Vector Database Factory
 * Creates appropriate vector database instance based on configuration
 */
export class VectorDatabaseFactory {
  static create(): VectorDatabase {
    // For now, use in-memory implementation
    // In production, check environment variables to use Pinecone/Weaviate
    const vectorDbType = process.env.VECTOR_DB_TYPE || 'memory';

    switch (vectorDbType.toLowerCase()) {
      case 'memory':
        return new InMemoryVectorDatabase();
      
      // Future implementations
      // case 'pinecone':
      //   return new PineconeVectorDatabase();
      // case 'weaviate':
      //   return new WeaviateVectorDatabase();
      
      default:
        console.warn(`Unknown vector DB type: ${vectorDbType}, defaulting to memory`);
        return new InMemoryVectorDatabase();
    }
  }
}
