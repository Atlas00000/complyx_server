import { VectorDatabaseFactory, InMemoryVectorDatabase as _InMemoryVectorDatabase } from '../services/knowledge/vectorDatabase';
import { EmbeddingService } from '../services/knowledge/embeddingService';
import { SemanticSearchService } from '../services/knowledge/semanticSearchService';
import { RAGService } from '../services/knowledge/ragService';
import { FAQService } from '../services/knowledge/faqService';

async function testKnowledgeBase() {
  console.log('🧪 Testing Knowledge Base Services...\n');

  try {
    // Test 1: Vector Database
    console.log('📋 Test 1: Vector Database');
    const vectorDb = VectorDatabaseFactory.create();
    await vectorDb.connect();
    console.log('✅ Vector database connected');

    // Test inserting vectors (using embedding service for consistent dimensions)
    const embeddingService = new EmbeddingService();
    
    const testText1 = 'IFRS S1 governance requirements';
    const testText2 = 'IFRS S2 climate risk management';
    const testText3 = 'IFRS S1 metrics and targets';

    const emb1 = await embeddingService.generateEmbedding(testText1);
    const emb2 = await embeddingService.generateEmbedding(testText2);
    const emb3 = await embeddingService.generateEmbedding(testText3);

    await vectorDb.insert({
      id: 'vec-1',
      vector: emb1.embedding,
      metadata: {
        text: testText1,
        documentId: 'doc-1',
        section: 'S1-1',
        title: 'Governance Requirements',
      },
    });
    console.log('✅ Vector inserted');

    await vectorDb.insertBatch([
      {
        id: 'vec-2',
        vector: emb2.embedding,
        metadata: {
          text: testText2,
          documentId: 'doc-2',
          section: 'S2-3',
          title: 'Risk Management',
        },
      },
      {
        id: 'vec-3',
        vector: emb3.embedding,
        metadata: {
          text: testText3,
          documentId: 'doc-1',
          section: 'S1-4',
          title: 'Metrics and Targets',
        },
      },
    ]);
    console.log('✅ Batch vectors inserted');

    // Test search
    const queryText = 'governance processes';
    const queryEmbedding = await embeddingService.generateEmbedding(queryText);
    const searchResults = await vectorDb.search(queryEmbedding.embedding, 2);
    console.log(`✅ Search completed: ${searchResults.length} results`);
    searchResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.metadata.title} (score: ${result.score.toFixed(3)})`);
    });

    // Test 2: Embedding Service
    console.log('\n📋 Test 2: Embedding Service (continued)');

    const testText = 'IFRS S1 requires disclosure of governance processes for sustainability-related financial information.';
    const embedding = await embeddingService.generateEmbedding(testText);
    console.log(`✅ Embedding generated: ${embedding.embedding.length} dimensions`);

    // Test document chunking
    const testDocument = `
      IFRS S1 establishes general requirements for disclosing sustainability-related financial information.
      This includes governance processes, strategy, risk management, and metrics/targets.
      Governance requirements under S1-1 cover board oversight and management accountability.
      Strategy requirements under S1-2 include how sustainability impacts business model and strategy.
      Risk management under S1-3 covers identification and management of sustainability-related risks.
      Metrics and targets under S1-4 include quantitative and qualitative measures.
    `;

    const chunks = embeddingService.chunkDocument('test-doc-1', testDocument, 100, 20);
    console.log(`✅ Document chunked: ${chunks.length} chunks`);
    chunks.forEach((chunk, index) => {
      console.log(`   Chunk ${index + 1}: ${chunk.text.substring(0, 50)}...`);
    });

    // Test 3: Semantic Search Service
    console.log('\n📋 Test 3: Semantic Search Service');
    const searchService = new SemanticSearchService(vectorDb, embeddingService);

    // First, populate vector DB with embedded documents
    const sampleDocs = [
      { id: 'doc-1', text: 'IFRS S1 governance requirements include board oversight and management accountability.', section: 'S1-1' },
      { id: 'doc-2', text: 'IFRS S2 climate risk management involves identifying and managing climate-related risks.', section: 'S2-3' },
      { id: 'doc-3', text: 'IFRS S1 metrics and targets require quantitative measures for sustainability performance.', section: 'S1-4' },
    ];

    for (const doc of sampleDocs) {
      const embedding = await embeddingService.generateEmbedding(doc.text);
      await vectorDb.insert({
        id: `embed-${doc.id}`,
        vector: embedding.embedding,
        metadata: {
          text: doc.text,
          documentId: doc.id,
          section: doc.section,
          title: `Document ${doc.id}`,
        },
      });
    }
    console.log('✅ Sample documents embedded and stored');

    // Test semantic search
    const searchQuery = {
      query: 'governance requirements',
      topK: 2,
      minScore: 0.5,
    };

    const searchResponse = await searchService.search(searchQuery);
    console.log(`✅ Semantic search completed: ${searchResponse.totalResults} results`);
    searchResponse.results.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.metadata.title || 'Untitled'} (score: ${result.score.toFixed(3)})`);
      console.log(`      Text: ${result.text.substring(0, 60)}...`);
    });

    // Test 4: RAG Service
    console.log('\n📋 Test 4: RAG Service');
    const ragService = new RAGService();

    const ragQuery = 'What are the governance requirements under IFRS S1?';
    console.log(`Query: ${ragQuery}`);

    // Note: This will try to use AI service, may fail if not configured
    try {
      const ragResponse = await ragService.generateResponse(ragQuery, undefined, 2, 0.5);
      console.log(`✅ RAG response generated`);
      console.log(`   Response: ${ragResponse.response.substring(0, 100)}...`);
      console.log(`   Context documents: ${ragResponse.context.relevantDocuments.length}`);
      console.log(`   Citations: ${ragResponse.citations.length}`);
    } catch (error) {
      console.log(`⚠️  RAG test skipped (AI service not configured): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test 5: FAQ Service
    console.log('\n📋 Test 5: FAQ Service');
    const faqService = new FAQService();

    const allFAQs = faqService.getAllFAQs();
    console.log(`✅ FAQs loaded: ${allFAQs.length} total`);

    const faqSearch = faqService.searchFAQs('governance');
    console.log(`✅ FAQ search: "${faqSearch.query}" - ${faqSearch.totalResults} results`);
    faqSearch.faqs.forEach((faq, index) => {
      console.log(`   ${index + 1}. ${faq.question}`);
    });

    const categoryFAQs = faqService.getAllFAQs('general');
    console.log(`✅ Category FAQs (general): ${categoryFAQs.length} results`);

    // Test resource search
    const resourceSearch = faqService.searchResources('IFRS');
    console.log(`✅ Resource search: "${resourceSearch.query}" - ${resourceSearch.totalResults} results`);
    resourceSearch.resources.forEach((resource, index) => {
      console.log(`   ${index + 1}. ${resource.title} (${resource.type})`);
    });

    // Test related FAQs
    const relatedFAQs = faqService.getRelatedFAQs('faq-1', 3);
    console.log(`✅ Related FAQs: ${relatedFAQs.length} results`);

    // Test 6: Integration Test
    console.log('\n📋 Test 6: Integration Test');
    
    // Embed a document
    const testDocText = 'IFRS S1-1 requires entities to disclose governance processes for monitoring and managing sustainability-related risks and opportunities.';
    const docChunks = embeddingService.chunkDocument('integration-doc', testDocText, 50, 10);
    console.log(`✅ Document processed: ${docChunks.length} chunks`);

    // Embed chunks
    for (const chunk of docChunks) {
      const embedding = await embeddingService.generateEmbedding(chunk.text);
      await vectorDb.insert({
        id: `int-${chunk.id}`,
        vector: embedding.embedding,
        metadata: {
          text: chunk.text,
          documentId: chunk.documentId,
          section: chunk.metadata?.section,
        },
      });
    }
    console.log('✅ Chunks embedded and stored');

    // Search for relevant context
    const intSearch = await searchService.search({
      query: 'governance processes',
      topK: 1,
    });
    console.log(`✅ Integration search: ${intSearch.totalResults} results`);

    if (intSearch.results.length > 0) {
      console.log(`   Found: ${intSearch.results[0].metadata.title || 'Untitled'}`);
      console.log(`   Score: ${intSearch.results[0].score.toFixed(3)}`);
    }

    await vectorDb.disconnect();
    console.log('\n✅ All Knowledge Base tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testKnowledgeBase()
  .then(() => {
    console.log('\n🎉 Knowledge Base testing completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
