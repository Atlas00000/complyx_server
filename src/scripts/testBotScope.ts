import dotenv from 'dotenv';
import { RAGService } from '../services/knowledge/ragService';

// Load environment variables
dotenv.config();

/**
 * Test script for bot scope expansion
 * Tests various query types to verify expanded scope works correctly
 */

interface TestQuery {
  query: string;
  expectedScope: 's1/s2' | 'general-ifrs' | 'accounting';
  description: string;
}

const testQueries: TestQuery[] = [
  // S1/S2 related queries (should prioritize S1/S2)
  {
    query: 'What are the requirements for IFRS S1 sustainability disclosures?',
    expectedScope: 's1/s2',
    description: 'S1-specific query - should prioritize S1/S2 documents',
  },
  {
    query: 'How do IFRS S1 and S2 relate to each other?',
    expectedScope: 's1/s2',
    description: 'S1/S2 relationship query - should prioritize S1/S2 documents',
  },
  {
    query: 'What are the climate-related disclosure requirements?',
    expectedScope: 's1/s2',
    description: 'Climate disclosure query - should prioritize S2 documents',
  },
  
  // General IFRS queries (should retrieve general IFRS content)
  {
    query: 'Explain IFRS 17 insurance contracts',
    expectedScope: 'general-ifrs',
    description: 'IFRS 17 query - should retrieve general IFRS content',
  },
  {
    query: 'What is IFRS 10 about?',
    expectedScope: 'general-ifrs',
    description: 'IFRS 10 query - should retrieve general IFRS content',
  },
  {
    query: 'How does consolidation work under IFRS standards?',
    expectedScope: 'general-ifrs',
    description: 'General IFRS consolidation query',
  },
  
  // General accounting queries (should retrieve accounting knowledge)
  {
    query: 'What are the principles of fair value measurement?',
    expectedScope: 'accounting',
    description: 'General accounting query - should retrieve accounting content',
  },
  {
    query: 'Explain the difference between revenue recognition methods',
    expectedScope: 'accounting',
    description: 'Revenue recognition query - general accounting',
  },
];

async function testQuery(ragService: RAGService, testQuery: TestQuery, index: number) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test ${index + 1}/${testQueries.length}: ${testQuery.description}`);
  console.log(`Query: "${testQuery.query}"`);
  console.log(`Expected Scope: ${testQuery.expectedScope}`);
  console.log(`-`.repeat(80));

  try {
    const startTime = Date.now();
    const response = await ragService.generateResponse(testQuery.query, undefined, 5, 0.3, 3);
    const processingTime = Date.now() - startTime;

    console.log(`✅ Response generated in ${processingTime}ms`);
    console.log(`   Confidence: ${response.confidence?.toFixed(2) || 'N/A'}`);
    console.log(`   Documents retrieved: ${response.context.relevantDocuments.length}`);
    
    // Show retrieved documents
    console.log(`\n   Retrieved Documents:`);
    response.context.relevantDocuments.slice(0, 3).forEach((doc, idx) => {
      const title = doc.metadata.title || doc.metadata.documentId;
      const priority = (doc.metadata as any).priority || 'unknown';
      const scope = (doc.metadata as any).scope || 'unknown';
      console.log(`     ${idx + 1}. ${title} (score: ${doc.score.toFixed(3)}, priority: ${priority}, scope: ${scope})`);
    });

    // Show citations
    if (response.citations.length > 0) {
      console.log(`\n   Citations (${response.citations.length}):`);
      response.citations.slice(0, 3).forEach((citation, idx) => {
        console.log(`     ${idx + 1}. ${citation.title}${citation.section ? ` - ${citation.section}` : ''}`);
      });
    }

    // Check response quality
    const responsePreview = response.response.substring(0, 200).replace(/\n/g, ' ');
    console.log(`\n   Response Preview: ${responsePreview}...`);

    // Validate scope match
    const responseLower = response.response.toLowerCase();
    const contextLower = response.context.contextText.toLowerCase();
    
    if (testQuery.expectedScope === 's1/s2') {
      const hasSustainabilityContent = 
        contextLower.includes('s1') || contextLower.includes('s2') || 
        contextLower.includes('sustainability') || contextLower.includes('climate');
      if (!hasSustainabilityContent) {
        console.log(`   ⚠️  Warning: Expected S1/S2 content but may have retrieved general content`);
      } else {
        console.log(`   ✅ Retrieved S1/S2 content as expected`);
      }
    }

    if (testQuery.expectedScope === 'general-ifrs') {
      const hasGeneralContent = 
        contextLower.includes('ifrs') || contextLower.includes('accounting') ||
        responseLower.includes('ifrs') || responseLower.includes('standard');
      if (!hasGeneralContent) {
        console.log(`   ⚠️  Warning: Expected general IFRS content but may have limited retrieval`);
      } else {
        console.log(`   ✅ Retrieved general IFRS content`);
      }
    }

    // Check if response avoids S1/S2-only redirect
    if (responseLower.includes('only') && 
        (responseLower.includes('s1') || responseLower.includes('s2')) &&
        responseLower.includes('focus')) {
      console.log(`   ❌ Issue: Response may still redirect to S1/S2 only`);
    } else if (response.response.length > 50) {
      console.log(`   ✅ Response provides substantive answer (not just redirect)`);
    }

    return {
      success: true,
      query: testQuery.query,
      documentsRetrieved: response.context.relevantDocuments.length,
      processingTime,
    };
  } catch (error) {
    console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      query: testQuery.query,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Bot Scope Expansion - Hybrid Retrieval Method');
  console.log('='.repeat(80));

  const ragService = new RAGService();

  const results: Array<{
    success: boolean;
    query: string;
    documentsRetrieved?: number;
    processingTime?: number;
    error?: string;
  }> = [];

  // Run tests with delays to avoid rate limits
  for (let i = 0; i < testQueries.length; i++) {
    const result = await testQuery(ragService, testQueries[i], i);
    results.push(result);

    // Add delay between tests (except last one)
    if (i < testQueries.length - 1) {
      console.log(`\n⏳ Waiting 10 seconds before next test...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 Test Summary');
  console.log('='.repeat(80));
  
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const avgDocuments = results
    .filter((r) => r.documentsRetrieved !== undefined)
    .reduce((sum, r) => sum + (r.documentsRetrieved || 0), 0) / successful;
  const avgTime = results
    .filter((r) => r.processingTime !== undefined)
    .reduce((sum, r) => sum + (r.processingTime || 0), 0) / successful;

  console.log(`Total Tests: ${testQueries.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📄 Average Documents Retrieved: ${avgDocuments.toFixed(1)}`);
  console.log(`⏱️  Average Processing Time: ${avgTime.toFixed(0)}ms`);

  // Detailed results
  console.log(`\nDetailed Results:`);
  results.forEach((result, idx) => {
    const status = result.success ? '✅' : '❌';
    const details = result.success
      ? `(${result.documentsRetrieved} docs, ${result.processingTime}ms)`
      : `(Error: ${result.error})`;
    console.log(`  ${status} Test ${idx + 1}: ${result.query.substring(0, 50)}... ${details}`);
  });

  console.log(`\n${'='.repeat(80)}`);
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite error:', error);
  process.exit(1);
});
