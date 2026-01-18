import { VectorDatabaseFactory, VectorDatabase } from '../../services/knowledge/vectorDatabase';
import { TestHelpers, TestResult } from '../testHelpers';

/**
 * Vector Database Connection and Migration Tests
 */
export class VectorDatabaseTests {
  private vectorDatabase: VectorDatabase;

  constructor() {
    this.vectorDatabase = VectorDatabaseFactory.create();
  }

  /**
   * Test 1: Verify vector database configuration
   */
  async testConfiguration(): Promise<TestResult> {
    return TestHelpers.runTest('Vector Database Configuration', async () => {
      const vectorDbType = process.env.VECTOR_DB_TYPE || 'memory';
      
      if (vectorDbType !== 'pinecone') {
        throw new Error(`VECTOR_DB_TYPE is set to ${vectorDbType}, expected 'pinecone'`);
      }

      const apiKey = process.env.PINECONE_API_KEY;
      if (!apiKey || apiKey.trim().length === 0) {
        throw new Error('PINECONE_API_KEY is not set');
      }

      const dimension = parseInt(process.env.EMBEDDING_DIMENSION || '768', 10);
      if (dimension !== 768) {
        throw new Error(`EMBEDDING_DIMENSION is ${dimension}, expected 768`);
      }

      return {
        vectorDbType,
        dimension,
        apiKeySet: !!apiKey,
      };
    });
  }

  /**
   * Test 2: Test vector database connection
   */
  async testConnection(): Promise<TestResult> {
    return TestHelpers.runTest('Vector Database Connection', async () => {
      if (!this.vectorDatabase.isConnected()) {
        await this.vectorDatabase.connect();
      }

      if (!this.vectorDatabase.isConnected()) {
        throw new Error('Failed to connect to vector database');
      }

      return {
        connected: true,
        type: process.env.VECTOR_DB_TYPE || 'memory',
      };
    });
  }

  /**
   * Test 3: Test vector insertion
   */
  async testVectorInsertion(): Promise<TestResult> {
    return TestHelpers.runTest('Vector Insertion', async () => {
      if (!this.vectorDatabase.isConnected()) {
        await this.vectorDatabase.connect();
      }

      const testVector = {
        id: `test-vector-${Date.now()}`,
        vector: new Array(768).fill(0).map(() => Math.random()),
        metadata: {
          text: 'Test document chunk',
          documentId: 'test-doc-1',
          section: 'test-section',
          title: 'Test Document',
          source: 'test',
        },
      };

      await this.vectorDatabase.insert(testVector);

      // Verify insertion by getting the vector
      const retrieved = await this.vectorDatabase.get(testVector.id);
      
      if (!retrieved) {
        throw new Error('Vector was not found after insertion');
      }

      if (retrieved.id !== testVector.id) {
        throw new Error('Retrieved vector ID does not match inserted vector ID');
      }

      // Cleanup
      await this.vectorDatabase.delete([testVector.id]);

      return {
        inserted: true,
        verified: true,
      };
    });
  }

  /**
   * Test 4: Test vector batch insertion
   */
  async testBatchInsertion(): Promise<TestResult> {
    return TestHelpers.runTest('Batch Vector Insertion', async () => {
      if (!this.vectorDatabase.isConnected()) {
        await this.vectorDatabase.connect();
      }

      const testVectors = Array.from({ length: 5 }, (_, i) => ({
        id: `test-batch-${Date.now()}-${i}`,
        vector: new Array(768).fill(0).map(() => Math.random()),
        metadata: {
          text: `Test document chunk ${i}`,
          documentId: 'test-doc-batch',
          section: 'test-section',
          title: 'Test Batch Document',
          source: 'test',
        },
      }));

      await this.vectorDatabase.insertBatch(testVectors);

      // Verify all vectors were inserted
      const allInserted = await Promise.all(
        testVectors.map(v => this.vectorDatabase.get(v.id))
      );

      const insertedCount = allInserted.filter(v => v !== null).length;
      
      if (insertedCount !== testVectors.length) {
        throw new Error(`Only ${insertedCount} out of ${testVectors.length} vectors were inserted`);
      }

      // Cleanup
      await this.vectorDatabase.delete(testVectors.map(v => v.id));

      return {
        batchSize: testVectors.length,
        insertedCount,
      };
    });
  }

  /**
   * Test 5: Test vector search
   */
  async testVectorSearch(): Promise<TestResult> {
    return TestHelpers.runTest('Vector Search', async () => {
      if (!this.vectorDatabase.isConnected()) {
        await this.vectorDatabase.connect();
      }

      // Insert test vectors
      const testVectors = Array.from({ length: 3 }, (_, i) => ({
        id: `test-search-${Date.now()}-${i}`,
        vector: new Array(768).fill(0).map(() => Math.random()),
        metadata: {
          text: `Test search document ${i}`,
          documentId: `test-search-doc-${i}`,
          section: 'test-section',
          title: 'Test Search Document',
          source: 'test',
        },
      }));

      await this.vectorDatabase.insertBatch(testVectors);

      // Perform search
      const queryVector = new Array(768).fill(0).map(() => Math.random());
      const results = await this.vectorDatabase.search(queryVector, 5);

      if (results.length === 0) {
        throw new Error('Search returned no results');
      }

      // Verify results have required fields
      for (const result of results) {
        if (!result.id || !result.metadata || typeof result.score !== 'number') {
          throw new Error('Search result missing required fields');
        }
      }

      // Cleanup
      await this.vectorDatabase.delete(testVectors.map(v => v.id));

      return {
        resultsCount: results.length,
        hasResults: results.length > 0,
        topScore: results.length > 0 ? results[0].score : 0,
      };
    });
  }

  /**
   * Test 6: Test metadata filtering
   */
  async testMetadataFiltering(): Promise<TestResult> {
    return TestHelpers.runTest('Metadata Filtering', async () => {
      if (!this.vectorDatabase.isConnected()) {
        await this.vectorDatabase.connect();
      }

      // Insert test vectors with different metadata
      const testVectors = [
        {
          id: `test-filter-${Date.now()}-1`,
          vector: new Array(768).fill(0).map(() => Math.random()),
          metadata: {
            text: 'Filter test document 1',
            documentId: 'filter-doc-1',
            section: 'section-a',
            title: 'Filter Test Doc 1',
            source: 'test-source-1',
          },
        },
        {
          id: `test-filter-${Date.now()}-2`,
          vector: new Array(768).fill(0).map(() => Math.random()),
          metadata: {
            text: 'Filter test document 2',
            documentId: 'filter-doc-2',
            section: 'section-b',
            title: 'Filter Test Doc 2',
            source: 'test-source-2',
          },
        },
      ];

      await this.vectorDatabase.insertBatch(testVectors);

      // Search with filter
      const queryVector = new Array(768).fill(0).map(() => Math.random());
      const filter = {
        documentId: 'filter-doc-1',
      };

      const results = await this.vectorDatabase.search(queryVector, 10, filter);

      // Verify filtered results
      const filteredResults = results.filter(r => r.metadata.documentId === 'filter-doc-1');
      
      if (filteredResults.length === 0) {
        throw new Error('Metadata filtering did not return any results');
      }

      // Cleanup
      await this.vectorDatabase.delete(testVectors.map(v => v.id));

      return {
        filteredResultsCount: filteredResults.length,
        filterApplied: true,
      };
    });
  }

  /**
   * Run all vector database tests
   */
  async runAllTests(): Promise<TestResult[]> {
    const tests = [
      () => this.testConfiguration(),
      () => this.testConnection(),
      () => this.testVectorInsertion(),
      () => this.testBatchInsertion(),
      () => this.testVectorSearch(),
      () => this.testMetadataFiltering(),
    ];

    const results: TestResult[] = [];

    for (const test of tests) {
      const result = await test();
      results.push(result);
      
      // Small delay between tests
      await TestHelpers.wait(500);
    }

    return results;
  }

  /**
   * Cleanup test data
   */
  async cleanup(): Promise<void> {
    if (this.vectorDatabase.isConnected()) {
      // Note: In production, you'd clean up test vectors here
      // For now, tests clean up after themselves
    }
  }
}
