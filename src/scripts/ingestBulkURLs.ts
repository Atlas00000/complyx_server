import { KnowledgeIngestionService, DocumentMetadata } from '../services/knowledge/knowledgeIngestionService';
import { URLParserService } from '../services/knowledge/urlParserService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Script to ingest multiple URLs into the knowledge base
 * 
 * Usage:
 *   pnpm ingest:bulk-urls <url1> <url2> ... <urlN>
 * 
 * Or with a file:
 *   pnpm ingest:bulk-urls --file urls.txt
 */

interface URLConfig {
  url: string;
  documentType?: DocumentMetadata['documentType'];
  source?: string;
  title?: string;
  priority?: 'high' | 'medium' | 'low';
  scope?: 's1' | 's2' | 'general' | 'accounting';
  tags?: string[];
}

interface IngestionResult {
  url: string;
  success: boolean;
  documentId?: string;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Detect document type from URL
 */
function detectDocumentType(url: string): DocumentMetadata['documentType'] {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('ifrs') || urlLower.includes('issb')) {
    return 'standard';
  }
  if (urlLower.includes('guidance') || urlLower.includes('guide')) {
    return 'guidance';
  }
  if (urlLower.includes('act') || urlLower.includes('law')) {
    return 'other';
  }
  if (urlLower.includes('ethics') || urlLower.includes('code-of-conduct')) {
    return 'other';
  }
  if (urlLower.includes('conceptual-framework')) {
    return 'standard';
  }
  if (urlLower.includes('accounting-basics') || urlLower.includes('accountingcoach')) {
    return 'guidance';
  }
  
  return 'other';
}

/**
 * Detect source from URL
 */
function detectSource(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    if (hostname.includes('ifrs.org')) {
      return 'IFRS Foundation';
    }
    if (hostname.includes('frcnigeria.gov.ng')) {
      return 'Financial Reporting Council of Nigeria';
    }
    if (hostname.includes('icanig.org')) {
      return 'Institute of Chartered Accountants of Nigeria';
    }
    if (hostname.includes('anan.org.ng')) {
      return 'Association of National Accountants of Nigeria';
    }
    if (hostname.includes('placng.org')) {
      return 'Nigerian Legal Database';
    }
    if (hostname.includes('cambridgeinternational.org')) {
      return 'Cambridge International';
    }
    if (hostname.includes('accountingcoach.com')) {
      return 'AccountingCoach';
    }
    if (hostname.includes('investopedia.com')) {
      return 'Investopedia';
    }
    if (hostname.includes('corporatefinanceinstitute.com')) {
      return 'Corporate Finance Institute';
    }
    
    return hostname;
  } catch {
    return 'Unknown Source';
  }
}

/**
 * Detect priority from URL
 */
function detectPriority(url: string): 'high' | 'medium' | 'low' {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('ifrs') || urlLower.includes('s1') || urlLower.includes('s2')) {
    return 'high';
  }
  if (urlLower.includes('frc') || urlLower.includes('act') || urlLower.includes('law')) {
    return 'high';
  }
  if (urlLower.includes('ethics') || urlLower.includes('code-of-conduct')) {
    return 'medium';
  }
  if (urlLower.includes('conceptual-framework')) {
    return 'high';
  }
  
  return 'medium';
}

/**
 * Detect scope from URL
 */
function detectScope(url: string): 's1' | 's2' | 'general' | 'accounting' {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('s1') || urlLower.includes('sustainability') && urlLower.includes('s1')) {
    return 's1';
  }
  if (urlLower.includes('s2') || urlLower.includes('climate')) {
    return 's2';
  }
  if (urlLower.includes('ifrs') || urlLower.includes('standard')) {
    return 'general';
  }
  
  return 'accounting';
}

/**
 * Process a single URL
 */
async function ingestURL(
  ingestionService: KnowledgeIngestionService,
  urlParser: URLParserService,
  config: URLConfig
): Promise<IngestionResult> {
  const startTime = Date.now();
  
  try {
    console.log(`\n📄 Processing: ${config.url}`);
    
    // Parse URL
    const urlResult = await urlParser.parseURL(config.url);
    
    if (!urlResult.text || urlResult.text.trim().length === 0) {
      throw new Error('No text content extracted from URL');
    }
    
    // Determine metadata
    const metadata: DocumentMetadata = {
      documentId: `url-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      title: config.title || urlResult.metadata?.title || config.url.split('/').pop() || 'Untitled Document',
      source: config.source || detectSource(config.url),
      url: config.url,
      documentType: config.documentType || detectDocumentType(config.url),
      version: process.env.KNOWLEDGE_BASE_VERSION || 'v1.0.0',
      language: urlResult.metadata?.language || 'en',
      tags: config.tags || [],
      priority: config.priority || detectPriority(config.url),
      scope: config.scope || detectScope(config.url),
      publishDate: urlResult.metadata?.publishDate || new Date(),
      trustedSource: true,
    };
    
    // Ingest document
    const result = await ingestionService.ingestDocument(urlResult.text, metadata, {
      chunkSize: 1000,
      chunkOverlap: 200,
      skipExisting: false,
    });
    
    const processingTime = Date.now() - startTime;
    
    console.log(`   ✅ Success! Document ID: ${result.documentId}`);
    console.log(`   ⏱️  Processing time: ${processingTime}ms`);
    
    return {
      url: config.url,
      success: true,
      documentId: result.documentId,
      processingTimeMs: processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.log(`   ❌ Failed: ${errorMessage}`);
    
    return {
      url: config.url,
      success: false,
      error: errorMessage,
      processingTimeMs: processingTime,
    };
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: No URLs provided');
    console.log('\nUsage:');
    console.log('  pnpm ingest:bulk-urls <url1> <url2> ... <urlN>');
    console.log('  pnpm ingest:bulk-urls --file urls.txt');
    process.exit(1);
  }
  
  const urls: string[] = [];
  
  // Check if reading from file
  if (args[0] === '--file' && args[1]) {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(args[1]);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: File not found: ${filePath}`);
      process.exit(1);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    urls.push(...lines);
  } else {
    urls.push(...args);
  }
  
  console.log(`\n🚀 Starting bulk URL ingestion...`);
  console.log(`   Total URLs: ${urls.length}`);
  console.log(`   ${'='.repeat(80)}\n`);
  
  // Initialize services
  const ingestionService = new KnowledgeIngestionService();
  const urlParser = new URLParserService();
  
  const results: IngestionResult[] = [];
  let successCount = 0;
  let failureCount = 0;
  
  // Process URLs sequentially to avoid rate limiting
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n[${i + 1}/${urls.length}] Processing URL...`);
    
    const result = await ingestURL(ingestionService, urlParser, { url });
    results.push(result);
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    // Add delay between requests to avoid rate limiting
    if (i < urls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  
  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`\n📊 Bulk Ingestion Summary`);
  console.log(`   ${'='.repeat(80)}`);
  console.log(`   Total URLs: ${urls.length}`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   Success Rate: ${((successCount / urls.length) * 100).toFixed(1)}%`);
  
  // Print failed URLs
  if (failureCount > 0) {
    console.log(`\n❌ Failed URLs:`);
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   - ${r.url}`);
        console.log(`     Error: ${r.error}`);
      });
  }
  
  // Print successful URLs
  if (successCount > 0) {
    console.log(`\n✅ Successfully Ingested URLs:`);
    results
      .filter(r => r.success)
      .forEach(r => {
        console.log(`   - ${r.url}`);
        console.log(`     Document ID: ${r.documentId}`);
      });
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
  
  process.exit(failureCount > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { ingestURL, main, detectDocumentType, detectSource, detectPriority, detectScope };
