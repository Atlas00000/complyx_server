import { KnowledgeIngestionService, DocumentMetadata } from '../services/knowledge/knowledgeIngestionService';
import { PDFParserService } from '../services/knowledge/pdfParserService';
import { URLParserService } from '../services/knowledge/urlParserService';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

/**
 * Script to ingest IFRS S1 & S2 documents into the knowledge base
 * 
 * Usage:
 *   pnpm ingest:ifrs-docs <document-type> <file-path>
 * 
 * Document types:
 *   - s1: IFRS S1 Standard
 *   - s2: IFRS S2 Standard
 *   - guidance: ISSB Implementation Guidance
 *   - exposure-draft: Exposure Drafts
 *   - regulatory: Regulatory interpretations
 *   - webinar: IFRS Foundation webinars
 *   - case-study: Case studies
 *   - audit-guide: Audit guides
 */

interface DocumentConfig {
  documentType: DocumentMetadata['documentType'];
  source: string;
  defaultTitle: string;
  defaultUrl?: string;
}

const DOCUMENT_CONFIGS: Record<string, DocumentConfig> = {
  's1': {
    documentType: 'standard',
    source: 'IFRS Foundation',
    defaultTitle: 'IFRS S1: General Requirements for Disclosure of Sustainability-related Financial Information',
    defaultUrl: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards/ifrs-s1-general-requirements-for-disclosure-of-sustainability-related-financial-information/',
  },
  's2': {
    documentType: 'standard',
    source: 'IFRS Foundation',
    defaultTitle: 'IFRS S2: Climate-related Disclosures',
    defaultUrl: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards/ifrs-s2-climate-related-disclosures/',
  },
  'guidance': {
    documentType: 'guidance',
    source: 'ISSB',
    defaultTitle: 'ISSB Implementation Guidance',
    defaultUrl: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards/',
  },
  'exposure-draft': {
    documentType: 'exposure-draft',
    source: 'IFRS Foundation',
    defaultTitle: 'IFRS Exposure Draft',
  },
  'regulatory': {
    documentType: 'other',
    source: 'IFRS Foundation',
    defaultTitle: 'Regulatory Interpretation',
  },
  'webinar': {
    documentType: 'webinar',
    source: 'IFRS Foundation',
    defaultTitle: 'IFRS Foundation Webinar',
  },
  'case-study': {
    documentType: 'case-study',
    source: 'IFRS Foundation',
    defaultTitle: 'Case Study',
  },
  'audit-guide': {
    documentType: 'audit-guide',
    source: 'IFRS Foundation',
    defaultTitle: 'Audit Guide',
  },
  'other': {
    documentType: 'other',
    source: 'IFRS Foundation',
    defaultTitle: 'IFRS Document',
  },
};

/**
 * Check if input is a URL
 */
function isURL(input: string): boolean {
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Read file, PDF, or URL
 */
async function readInput(input: string): Promise<{ text: string; isPDF: boolean; isURL: boolean; metadata?: any }> {
  // Check if input is a URL
  if (isURL(input)) {
    console.log('   Detected URL, fetching content...');
    const urlParser = new URLParserService();
    
    // Validate URL
    const validation = urlParser.validateURL(input);
    if (!validation.valid) {
      throw new Error(validation.error || 'URL validation failed');
    }

    // Parse URL
    const urlResult = await urlParser.parseURL(input, {
      extractMetadata: true,
      removeScripts: true,
      removeStyles: true,
    });

    return {
      text: urlResult.text,
      isPDF: urlResult.type === 'pdf',
      isURL: true,
      metadata: {
        url: urlResult.url,
        type: urlResult.type,
        title: urlResult.metadata?.title,
        contentType: urlResult.metadata?.contentType,
        numPages: urlResult.numPages,
        ...urlResult.metadata,
      },
    };
  }

  // Handle file path
  const fullPath = path.resolve(input);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  const pdfParser = new PDFParserService();

  // Check if file is PDF
  if (pdfParser.isPDF(fullPath)) {
    console.log('   Detected PDF file, extracting text...');
    
    // Parse PDF and extract text
    const pdfResult = await pdfParser.parsePDF(fullPath, {
      extractPages: false, // Extract pages if needed later
      preserveStructure: true,
    });

    return {
      text: pdfResult.text,
      isPDF: true,
      isURL: false,
      metadata: {
        numPages: pdfResult.numPages,
        pdfMetadata: pdfResult.metadata,
      },
    };
  } else {
    // Read as text file
    const content = fs.readFileSync(fullPath, 'utf-8');
    return {
      text: content,
      isPDF: false,
      isURL: false,
    };
  }
}

/**
 * Read file, PDF, or URL (legacy function for backward compatibility)
 */
async function readFile(filePath: string): Promise<{ text: string; isPDF: boolean; metadata?: any }> {
  const fullPath = path.resolve(filePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  const pdfParser = new PDFParserService();

  // Check if file is PDF
  if (pdfParser.isPDF(fullPath)) {
    console.log('   Detected PDF file, extracting text...');
    
    // Parse PDF and extract text
    const pdfResult = await pdfParser.parsePDF(fullPath, {
      extractPages: false, // Extract pages if needed later
      preserveStructure: true,
    });

    return {
      text: pdfResult.text,
      isPDF: true,
      metadata: {
        numPages: pdfResult.numPages,
        pdfMetadata: pdfResult.metadata,
      },
    };
  } else {
    // Read as text file
    const content = fs.readFileSync(fullPath, 'utf-8');
    return {
      text: content,
      isPDF: false,
    };
  }
}

/**
 * Ingest a single document
 */
async function ingestDocument(
  documentType: string,
  filePath: string,
  options: {
    documentId?: string;
    title?: string;
    section?: string;
    url?: string;
    version?: string;
  } = {}
): Promise<void> {
  console.log(`\n📄 Processing document: ${filePath}`);
  console.log(`   Type: ${documentType}`);

  // Get document config
  const config = DOCUMENT_CONFIGS[documentType.toLowerCase()];
  if (!config) {
    throw new Error(`Unknown document type: ${documentType}. Available types: ${Object.keys(DOCUMENT_CONFIGS).join(', ')}`);
  }

  // Read file or URL content (supports text files, PDFs, and URLs)
  const isURLInput = isURL(filePath);
  console.log(isURLInput ? '   Fetching URL content...' : '   Reading file...');
  const inputResult = await readInput(filePath);

  if (inputResult.text.trim().length === 0) {
    throw new Error('Input is empty or contains no extractable text');
  }

  const text = inputResult.text;
  let fileSize: string;
  
  if (inputResult.isURL) {
    fileSize = inputResult.isPDF
      ? `${(inputResult.metadata?.contentLength || 0) / 1024} KB (PDF with ${inputResult.metadata?.numPages || 0} pages)`
      : `${text.length} characters (from ${inputResult.metadata?.url})`;
    console.log(`   Content type: ${inputResult.metadata?.type || 'unknown'}`);
    if (inputResult.metadata?.title) {
      console.log(`   Page title: ${inputResult.metadata.title}`);
    }
  } else if (inputResult.isPDF) {
    fileSize = `${(fs.statSync(path.resolve(filePath)).size / 1024).toFixed(2)} KB (PDF with ${inputResult.metadata?.numPages || 0} pages)`;
  } else {
    fileSize = `${text.length} characters`;
  }

  console.log(`   Content size: ${fileSize}`);
  if (inputResult.isPDF && inputResult.metadata?.numPages) {
    console.log(`   PDF pages: ${inputResult.metadata.numPages}`);
  }

  // Generate document ID
  let documentId: string;
  if (isURL(filePath)) {
    try {
      const urlObj = new URL(filePath);
      const hostname = urlObj.hostname.replace(/\./g, '-');
      const pathname = urlObj.pathname.split('/').pop() || 'page';
      documentId = options.documentId || 
        `${documentType}-${hostname}-${pathname}-${Date.now()}`.replace(/[^a-zA-Z0-9-_]/g, '-');
    } catch {
      documentId = options.documentId || 
        `${documentType}-url-${Date.now()}`;
    }
  } else {
    documentId = options.documentId || 
      `${documentType}-${path.basename(filePath, path.extname(filePath))}-${Date.now()}`;
  }

  // Prepare metadata
  const metadata: DocumentMetadata = {
    documentId,
    title: options.title || inputResult.metadata?.title || config.defaultTitle,
    source: config.source,
    url: isURLInput ? filePath : (options.url || config.defaultUrl),
    section: options.section,
    documentType: config.documentType,
    version: options.version || process.env.KNOWLEDGE_BASE_VERSION || 'v1.0.0',
    publishDate: inputResult.metadata?.publishedDate ? new Date(inputResult.metadata.publishedDate) : new Date(),
    language: inputResult.metadata?.language || 'en',
  };

  // Validate metadata
  const ingestionService = new KnowledgeIngestionService();
  const validation = ingestionService.validateMetadata(metadata);
  
  if (!validation.valid) {
    throw new Error(`Invalid metadata: ${validation.errors.join(', ')}`);
  }

  // Ingest document
  console.log('   Generating embeddings and storing vectors...');
  const result = await ingestionService.ingestDocument(text, metadata, {
    chunkSize: 500,
    chunkOverlap: 50,
    skipExisting: false,
  });

  // Display results
  if (result.success) {
    console.log(`\n✅ Document ingested successfully!`);
    console.log(`   Document ID: ${result.documentId}`);
    console.log(`   Chunks created: ${result.chunksCreated}`);
    console.log(`   Vectors stored: ${result.vectorsStored}`);
    console.log(`   Processing time: ${result.processingTimeMs}ms`);
  } else {
    console.error(`\n❌ Document ingestion failed!`);
    console.error(`   Errors: ${result.errors?.join(', ')}`);
    throw new Error('Ingestion failed');
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: pnpm ingest:ifrs-docs <document-type> <file-path> [options]');
    console.log('\nDocument types:');
    Object.keys(DOCUMENT_CONFIGS).forEach(type => {
      const config = DOCUMENT_CONFIGS[type];
      console.log(`  - ${type}: ${config.defaultTitle}`);
    });
    console.log('\nExamples:');
    console.log('  pnpm ingest:ifrs-docs s1 ./documents/ifrs-s1.txt');
    console.log('  pnpm ingest:ifrs-docs s2 ./documents/ifrs-s2.txt --title "IFRS S2 Climate Disclosures"');
    process.exit(1);
  }

  const [documentType, filePath] = args;

  // Parse additional options (simple parsing for now)
  const options: any = {};
  for (let i = 2; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    if (key && value) {
      options[key] = value;
    }
  }

  try {
    await ingestDocument(documentType, filePath, options);
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { ingestDocument, readFile, readInput, isURL };
