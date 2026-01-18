import { KnowledgeIngestionService } from '../../services/knowledge/knowledgeIngestionService';
import { SemanticSearchService, SearchQuery } from '../../services/knowledge/semanticSearchService';
import { TestHelpers } from '../testHelpers';

/**
 * Debug script to investigate RAG test failure
 * Tests document ingestion and search directly
 */
async function debugRAGTest() {
  console.log('\n🔍 Debugging RAG Response Generation Test\n');

  // Step 1: Test document ingestion
  console.log('📥 Step 1: Ingesting test documents...');
  const ingestionService = new KnowledgeIngestionService();
  
  const testDocuments = [
    {
      text: TestHelpers.getIFRSS1TestContent(),
      metadata: {
        documentId: `debug-test-s1-${Date.now()}`,
        title: 'Debug Test IFRS S1 Document',
        source: 'IFRS Foundation',
        documentType: 'standard' as const,
      },
    },
  ];

  const ingestionResult = await ingestionService.ingestDocument(
    testDocuments[0].text,
    testDocuments[0].metadata
  );

  console.log(`✅ Ingestion result:`);
  console.log(`   Document ID: ${ingestionResult.documentId}`);
  console.log(`   Chunks created: ${ingestionResult.chunksCreated}`);
  console.log(`   Vectors stored: ${ingestionResult.vectorsStored}`);
  console.log(`   Success: ${ingestionResult.success}`);

  if (!ingestionResult.success) {
    console.error(`❌ Ingestion failed: ${ingestionResult.errors?.join(', ')}`);
    return;
  }

  // Step 2: Wait for indexing
  console.log('\n⏳ Step 2: Waiting for vectors to be indexed...');
  await TestHelpers.wait(10000);
  console.log('✅ Wait complete');

  // Step 3: Test search directly
  console.log('\n🔍 Step 3: Testing semantic search directly...');
  const searchService = new SemanticSearchService();

  const testQueries = [
    'What are the general requirements for disclosure of sustainability-related financial information?',
    'What are the requirements for IFRS S1?',
    'IFRS S1 general requirements',
    'sustainability-related financial information',
    'disclosure requirements',
  ];

  for (const query of testQueries) {
    console.log(`\n   Testing query: "${query}"`);
    
    const searchQuery: SearchQuery = {
      query,
      topK: 5,
      minScore: 0.3, // Same threshold as in tests
    };

    try {
      const searchResults = await searchService.search(searchQuery);
      
      console.log(`   Results: ${searchResults.results.length} documents found`);
      console.log(`   Total results: ${searchResults.totalResults}`);
      console.log(`   Processing time: ${searchResults.processingTimeMs}ms`);

      if (searchResults.results.length > 0) {
        console.log(`   ✅ Documents found!`);
        console.log(`   Top result:`);
        console.log(`     - Score: ${searchResults.results[0].score}`);
        console.log(`     - Document ID: ${searchResults.results[0].metadata.documentId}`);
        console.log(`     - Title: ${searchResults.results[0].metadata.title}`);
        console.log(`     - Text preview: ${searchResults.results[0].text.substring(0, 100)}...`);
      } else {
        console.log(`   ⚠️  No documents found with score >= 0.3`);
      }
    } catch (error) {
      console.error(`   ❌ Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Small delay between queries
    await TestHelpers.wait(1000);
  }

  // Step 4: Check all results with lower threshold
  console.log('\n🔍 Step 4: Testing with lower threshold (0.0) to see all documents...');
  const broadQuery: SearchQuery = {
    query: 'What are the general requirements for disclosure of sustainability-related financial information?',
    topK: 10,
    minScore: 0.0, // No threshold - get all results
  };

  try {
    const broadResults = await searchService.search(broadQuery);
    console.log(`   Results with threshold 0.0: ${broadResults.results.length} documents`);
    
    if (broadResults.results.length > 0) {
      console.log(`   Score distribution:`);
      broadResults.results.forEach((result, index) => {
        console.log(`     ${index + 1}. Score: ${result.score.toFixed(4)} - ${result.metadata.documentId}`);
      });
    }
  } catch (error) {
    console.error(`   ❌ Broad search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n✅ Debug complete\n');
}

// Run debug
debugRAGTest().catch((error) => {
  console.error('\n❌ Debug failed:', error);
  process.exit(1);
});
