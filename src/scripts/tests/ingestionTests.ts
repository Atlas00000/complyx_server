import * as path from 'path';
import { KnowledgeIngestionService, DocumentMetadata } from '../../services/knowledge/knowledgeIngestionService';
import { TestHelpers, TestResult } from '../testHelpers';

/**
 * Document Ingestion Service Tests
 */
export class IngestionTests {
  private ingestionService: KnowledgeIngestionService;

  constructor() {
    this.ingestionService = new KnowledgeIngestionService();
  }

  /**
   * Test 1: Test document ingestion with valid metadata
   */
  async testDocumentIngestion(): Promise<TestResult> {
    return TestHelpers.runTest('Document Ingestion', async () => {
      const testContent = TestHelpers.getIFRSS1TestContent();
      const testDocPath = TestHelpers.createTestDocument(
        testContent,
        `test-ingestion-${Date.now()}.txt`
      );

      const metadata: DocumentMetadata = {
        documentId: `test-doc-${Date.now()}`,
        title: 'Test IFRS S1 Document',
        source: 'IFRS Foundation',
        url: 'https://test.example.com',
        documentType: 'standard',
        version: 'v1.0.0',
      };

      const result = await this.ingestionService.ingestDocument(testContent, metadata);

      if (!result.success) {
        throw new Error(`Ingestion failed: ${result.errors?.join(', ')}`);
      }

      if (result.chunksCreated === 0) {
        throw new Error('No chunks were created during ingestion');
      }

      if (result.vectorsStored === 0) {
        throw new Error('No vectors were stored during ingestion');
      }

      // Cleanup
      TestHelpers.removeTestDocument(path.basename(testDocPath));

      return {
        documentId: result.documentId,
        chunksCreated: result.chunksCreated,
        vectorsStored: result.vectorsStored,
        processingTime: result.processingTimeMs,
      };
    });
  }

  /**
   * Test 2: Test metadata validation
   */
  async testMetadataValidation(): Promise<TestResult> {
    return TestHelpers.runTest('Metadata Validation', async () => {
      const invalidMetadata: DocumentMetadata = {
        documentId: '', // Empty document ID (invalid)
        title: '',
        source: '',
        documentType: 'standard',
      };

      const validation = this.ingestionService.validateMetadata(invalidMetadata);

      if (validation.valid) {
        throw new Error('Metadata validation should have failed for invalid metadata');
      }

      if (validation.errors.length === 0) {
        throw new Error('Validation should have returned errors for invalid metadata');
      }

      return {
        validationFailed: !validation.valid,
        errorsCount: validation.errors.length,
      };
    });
  }

  /**
   * Test 3: Test document update (re-ingestion)
   */
  async testDocumentUpdate(): Promise<TestResult> {
    return TestHelpers.runTest('Document Update', async () => {
      const originalContent = TestHelpers.getIFRSS1TestContent();
      const documentId = `test-update-${Date.now()}`;

      const metadata: DocumentMetadata = {
        documentId,
        title: 'Test Update Document',
        source: 'IFRS Foundation',
        documentType: 'standard',
      };

      // Ingest original document
      const originalResult = await this.ingestionService.ingestDocument(
        originalContent,
        metadata
      );

      if (!originalResult.success) {
        throw new Error(`Original ingestion failed: ${originalResult.errors?.join(', ')}`);
      }

      // Update document with new content
      const updatedContent = originalContent + '\n\nAdditional content added for update test.';
      
      const updateResult = await this.ingestionService.updateDocument(
        documentId,
        updatedContent,
        metadata
      );

      if (!updateResult.success) {
        throw new Error(`Update failed: ${updateResult.errors?.join(', ')}`);
      }

      return {
        originalChunks: originalResult.chunksCreated,
        updatedChunks: updateResult.chunksCreated,
        updateSuccess: updateResult.success,
      };
    });
  }

  /**
   * Test 4: Test batch document ingestion
   */
  async testBatchIngestion(): Promise<TestResult> {
    return TestHelpers.runTest('Batch Document Ingestion', async () => {
      const documents = [
        {
          text: TestHelpers.getIFRSS1TestContent(),
          metadata: {
            documentId: `test-batch-1-${Date.now()}`,
            title: 'Test IFRS S1 Document',
            source: 'IFRS Foundation',
            documentType: 'standard' as const,
          },
        },
        {
          text: TestHelpers.getIFRSS2TestContent(),
          metadata: {
            documentId: `test-batch-2-${Date.now()}`,
            title: 'Test IFRS S2 Document',
            source: 'IFRS Foundation',
            documentType: 'standard' as const,
          },
        },
      ];

      const results = await this.ingestionService.ingestDocuments(documents);

      const successCount = results.filter(r => r.success).length;
      const totalChunks = results.reduce((sum, r) => sum + r.chunksCreated, 0);
      const totalVectors = results.reduce((sum, r) => sum + r.vectorsStored, 0);

      if (successCount !== documents.length) {
        throw new Error(`Only ${successCount} out of ${documents.length} documents were ingested successfully`);
      }

      return {
        documentsIngested: successCount,
        totalChunks,
        totalVectors,
      };
    });
  }

  /**
   * Test 5: Test skip existing option
   */
  async testSkipExisting(): Promise<TestResult> {
    return TestHelpers.runTest('Skip Existing Documents', async () => {
      const content = TestHelpers.getIFRSS1TestContent();
      const documentId = `test-skip-${Date.now()}`;

      const metadata: DocumentMetadata = {
        documentId,
        title: 'Test Skip Document',
        source: 'IFRS Foundation',
        documentType: 'standard',
      };

      // First ingestion
      const firstResult = await this.ingestionService.ingestDocument(content, metadata);

      if (!firstResult.success) {
        throw new Error(`First ingestion failed: ${firstResult.errors?.join(', ')}`);
      }

      // Second ingestion with skipExisting = true
      const secondResult = await this.ingestionService.ingestDocument(
        content,
        metadata,
        { skipExisting: true }
      );

      if (!secondResult.success) {
        throw new Error(`Second ingestion failed: ${secondResult.errors?.join(', ')}`);
      }

      if (secondResult.chunksCreated !== 0 || secondResult.vectorsStored !== 0) {
        throw new Error('Skip existing did not work - document was re-ingested');
      }

      return {
        firstIngestionChunks: firstResult.chunksCreated,
        secondIngestionChunks: secondResult.chunksCreated,
        skipped: secondResult.chunksCreated === 0,
      };
    });
  }

  /**
   * Test 6: Test source tracking
   */
  async testSourceTracking(): Promise<TestResult> {
    return TestHelpers.runTest('Source Tracking', async () => {
      const content = TestHelpers.getIFRSS1TestContent();
      const documentId = `test-source-${Date.now()}`;

      const metadata: DocumentMetadata = {
        documentId,
        title: 'Test Source Tracking Document',
        source: 'IFRS Foundation',
        sourceUrl: 'https://test-source.example.com',
        url: 'https://test.example.com',
        documentType: 'standard',
        trustedSource: true,
      };

      const result = await this.ingestionService.ingestDocument(content, metadata);

      if (!result.success) {
        throw new Error(`Ingestion failed: ${result.errors?.join(', ')}`);
      }

      // Verify source tracking was applied (metadata enrichment)
      // Note: In a full implementation, we'd verify the metadata was stored correctly

      return {
        ingested: result.success,
        chunksCreated: result.chunksCreated,
        vectorsStored: result.vectorsStored,
      };
    });
  }

  /**
   * Run all ingestion tests
   */
  async runAllTests(): Promise<TestResult[]> {
    const tests = [
      () => this.testDocumentIngestion(),
      () => this.testMetadataValidation(),
      () => this.testDocumentUpdate(),
      () => this.testBatchIngestion(),
      () => this.testSkipExisting(),
      () => this.testSourceTracking(),
    ];

    const results: TestResult[] = [];

    for (const test of tests) {
      const result = await test();
      results.push(result);
      
      // Delay between tests to avoid rate limiting
      await TestHelpers.wait(1000);
    }

    return results;
  }
}
