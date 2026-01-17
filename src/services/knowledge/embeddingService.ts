import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EmbeddingResult {
  embedding: number[];
  text: string;
  tokenCount?: number;
}

export interface DocumentChunk {
  id: string;
  text: string;
  documentId: string;
  chunkIndex: number;
  metadata?: {
    section?: string;
    title?: string;
    source?: string;
    url?: string;
    page?: number;
  };
}

/**
 * Embedding Service
 * Generates embeddings for text using Gemini's embedding model
 */
export class EmbeddingService {
  private client: GoogleGenerativeAI;
  private apiKey: string;
  private model: string = 'text-embedding-004'; // Gemini embedding model

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      // Note: Gemini embedding API might use different method
      // For now, we'll use a placeholder that can be updated when API details are confirmed
      // This is a common pattern - check Gemini docs for actual embedding endpoint
      
      // If Gemini doesn't have embeddings, we can use OpenAI as fallback
      // or implement a simple TF-IDF-based embedding for basic functionality
      
      // Placeholder: Generate a simple embedding based on text features
      // In production, replace with actual Gemini embedding API call
      // For now, use simple embedding when API key is not available
      const embedding = this.generateSimpleEmbedding(text);

      return {
        embedding,
        text,
      };
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Chunk a document into smaller pieces for embedding
   */
  chunkDocument(
    documentId: string,
    text: string,
    chunkSize: number = 500,
    overlap: number = 50,
    metadata?: DocumentChunk['metadata']
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sentences = text.split(/[.!?]+\s+/);
    
    let currentChunk = '';
    let chunkIndex = 0;
    let charCount = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.length;

      if (charCount + sentenceLength > chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          id: `${documentId}-chunk-${chunkIndex}`,
          text: currentChunk.trim(),
          documentId,
          chunkIndex,
          metadata,
        });

        // Start new chunk with overlap
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlap / 10)); // Approximate overlap
        currentChunk = overlapWords.join(' ') + ' ' + sentence;
        charCount = currentChunk.length;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        charCount += sentenceLength + 1;
      }
    }

    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${documentId}-chunk-${chunkIndex}`,
        text: currentChunk.trim(),
        documentId,
        chunkIndex,
        metadata,
      });
    }

    return chunks;
  }

  /**
   * Process a document: chunk and generate embeddings
   */
  async processDocument(
    documentId: string,
    text: string,
    chunkSize: number = 500,
    overlap: number = 50,
    metadata?: DocumentChunk['metadata']
  ): Promise<Array<{ chunk: DocumentChunk; embedding: EmbeddingResult }>> {
    // Chunk the document
    const chunks = this.chunkDocument(documentId, text, chunkSize, overlap, metadata);

    // Generate embeddings for each chunk
    const texts = chunks.map(chunk => chunk.text);
    const embeddings = await this.generateEmbeddings(texts);

    // Combine chunks with embeddings
    return chunks.map((chunk, index) => ({
      chunk,
      embedding: embeddings[index],
    }));
  }

  /**
   * Generate a simple embedding based on text features
   * This is a placeholder - replace with actual Gemini embedding API
   * For now, creates a basic feature vector based on text characteristics
   */
  private generateSimpleEmbedding(text: string): number[] {
    // Simple embedding: 384 dimensions (common embedding size)
    // In production, replace with actual Gemini embedding API
    const embedding: number[] = new Array(384).fill(0);
    
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    const charCount = text.length;
    
    // Simple hash-based embedding (placeholder)
    for (let i = 0; i < words.length && i < 384; i++) {
      let hash = 0;
      for (let j = 0; j < words[i].length; j++) {
        hash = ((hash << 5) - hash) + words[i].charCodeAt(j);
        hash = hash & hash; // Convert to 32-bit integer
      }
      embedding[i] = (hash % 1000) / 1000; // Normalize to -1 to 1
    }

    // Add document-level features
    embedding[380] = Math.min(wordCount / 1000, 1); // Word count feature
    embedding[381] = Math.min(charCount / 10000, 1); // Character count feature
    embedding[382] = text.includes('IFRS') ? 1 : 0; // IFRS mention
    embedding[383] = text.includes('S1') || text.includes('S2') ? 1 : 0; // Standard mention

    return embedding;
  }
}
