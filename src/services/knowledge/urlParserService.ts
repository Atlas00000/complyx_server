import { URLFetcherService, URLFetchResult } from './urlFetcherService';
import { HTMLParserService } from './htmlParserService';
import { PDFParserService } from './pdfParserService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface URLParseResult {
  url: string;
  type: 'html' | 'pdf' | 'unknown';
  text: string;
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    keywords?: string[];
    contentType?: string;
    contentLength?: number;
    language?: string;
    publishedDate?: string;
    modifiedDate?: string;
  };
  numPages?: number; // For PDFs
}

export interface URLParseOptions {
  timeout?: number;
  maxSize?: number;
  extractMetadata?: boolean;
  removeScripts?: boolean;
  removeStyles?: boolean;
}

/**
 * URL Parser Service
 * Main service that coordinates URL fetching, HTML parsing, and PDF parsing
 */
export class URLParserService {
  private urlFetcher: URLFetcherService;
  private htmlParser: HTMLParserService;
  private pdfParser: PDFParserService;
  private tempDir: string;

  constructor() {
    this.urlFetcher = new URLFetcherService();
    this.htmlParser = new HTMLParserService();
    this.pdfParser = new PDFParserService();
    this.tempDir = path.join(os.tmpdir(), 'complyx-url-parser');
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Parse URL and extract content
   */
  async parseURL(url: string, options: URLParseOptions = {}): Promise<URLParseResult> {
    // Fetch URL content
    const fetchResult = await this.urlFetcher.fetchURL(url, {
      timeout: options.timeout,
      maxSize: options.maxSize,
    });

    // Determine content type
    const contentType = fetchResult.contentType.toLowerCase();
    const isPDF = contentType.includes('pdf') || this.urlFetcher.isPDFURL(url);

    if (isPDF) {
      // Handle PDF
      return this.parsePDFFromBuffer(fetchResult, url, options);
    } else if (contentType.includes('html') || contentType.includes('text')) {
      // Handle HTML
      return this.parseHTMLFromBuffer(fetchResult, url, options);
    } else {
      // Unknown content type - try to parse as text
      return this.parseTextFromBuffer(fetchResult, url, options);
    }
  }

  /**
   * Parse PDF from buffer
   */
  private async parsePDFFromBuffer(
    fetchResult: URLFetchResult,
    url: string,
    _options: URLParseOptions
  ): Promise<URLParseResult> {
    // Save buffer to temporary file for PDF parser
    const tempFilePath = path.join(this.tempDir, `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
    
    try {
      fs.writeFileSync(tempFilePath, fetchResult.content);

      // Parse PDF
      const pdfResult = await this.pdfParser.parsePDF(tempFilePath, {
        extractPages: false,
        preserveStructure: true,
      });

      // Extract metadata
      const metadata: URLParseResult['metadata'] = {
        contentType: fetchResult.contentType,
        contentLength: fetchResult.contentLength,
        ...pdfResult.metadata,
        title: pdfResult.metadata?.title || this.extractTitleFromURL(url),
      };

      return {
        url,
        type: 'pdf',
        text: pdfResult.text,
        metadata,
        numPages: pdfResult.numPages,
      };
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  /**
   * Parse HTML from buffer
   */
  private parseHTMLFromBuffer(
    fetchResult: URLFetchResult,
    url: string,
    options: URLParseOptions
  ): Promise<URLParseResult> {
    const htmlContent = fetchResult.content.toString('utf-8');

    // Parse HTML
    const htmlResult = this.htmlParser.parseHTML(htmlContent, {
      removeScripts: options.removeScripts !== false,
      removeStyles: options.removeStyles !== false,
      extractMetadata: options.extractMetadata !== false,
    });

    // Build metadata
    const metadata: URLParseResult['metadata'] = {
      contentType: fetchResult.contentType,
      contentLength: fetchResult.contentLength,
      title: htmlResult.title || this.extractTitleFromURL(url),
      description: htmlResult.description,
      author: htmlResult.author,
      keywords: htmlResult.keywords,
      language: htmlResult.metadata?.language,
      publishedDate: htmlResult.metadata?.publishedDate,
      modifiedDate: htmlResult.metadata?.modifiedDate,
    };

    return Promise.resolve({
      url,
      type: 'html',
      text: htmlResult.text,
      metadata,
    });
  }

  /**
   * Parse text from buffer (fallback for unknown content types)
   */
  private parseTextFromBuffer(
    fetchResult: URLFetchResult,
    url: string,
    _options: URLParseOptions
  ): Promise<URLParseResult> {
    const text = fetchResult.content.toString('utf-8');

    const metadata: URLParseResult['metadata'] = {
      contentType: fetchResult.contentType,
      contentLength: fetchResult.contentLength,
      title: this.extractTitleFromURL(url),
    };

    return Promise.resolve({
      url,
      type: 'unknown',
      text,
      metadata,
    });
  }

  /**
   * Extract title from URL (fallback)
   */
  private extractTitleFromURL(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        // Remove file extension
        return lastPart.replace(/\.(html?|pdf|xml|txt)$/i, '').replace(/[-_]/g, ' ');
      }
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Validate URL before parsing
   */
  validateURL(url: string): { valid: boolean; error?: string } {
    return this.urlFetcher.validateURL(url);
  }
}

export const urlParserService = new URLParserService();
