import * as fs from 'fs';
import * as path from 'path';

// pdf-parse 2.4.5 uses PDFParse class
const { PDFParse } = require('pdf-parse');

export interface PDFParseResult {
  text: string;
  numPages: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
  pages?: Array<{
    pageNumber: number;
    text: string;
  }>;
}

export interface PDFParseOptions {
  extractPages?: boolean; // Extract text per page
  preserveStructure?: boolean; // Preserve headings, paragraphs
  maxPages?: number; // Limit number of pages to process
}

/**
 * PDF Parser Service
 * Handles PDF file parsing and text extraction
 */
export class PDFParserService {
  /**
   * Check if file is a PDF
   */
  isPDF(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.pdf';
  }

  /**
   * Validate PDF file exists and is readable
   */
  async validatePDF(filePath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          valid: false,
          error: `PDF file not found: ${filePath}`,
        };
      }

      // Check if file is readable
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return {
          valid: false,
          error: `PDF file is empty: ${filePath}`,
        };
      }

      return {
        valid: true,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error validating PDF',
      };
    }
  }

  /**
   * Parse PDF file and extract text
   */
  async parsePDF(
    filePath: string,
    options: PDFParseOptions = {}
  ): Promise<PDFParseResult> {
    // Validate PDF file
    const validation = await this.validatePDF(filePath);
    if (!validation.valid) {
      throw new Error(validation.error || 'PDF validation failed');
    }

    try {
      // Read PDF file
      const dataBuffer = fs.readFileSync(filePath);

      // Parse PDF with options
      // pdf-parse 2.4.5 uses PDFParse class
      const parser = new PDFParse({
        data: dataBuffer,
        max: options.maxPages,
      });

      // Get text from PDF
      const textResult = await parser.getText({
        lineEnforce: true,
        pageJoiner: '\n',
      });

      // Get info/metadata
      const infoResult = await parser.getInfo();

      // Extract basic text
      let text = textResult.text || '';

      // Handle encoding issues (clean up common encoding problems)
      text = this.cleanText(text);

      // Extract metadata
      const metadata = this.extractMetadata(infoResult.info);

      // Extract pages if requested
      let pages: PDFParseResult['pages'] | undefined;
      if (options.extractPages && textResult.total) {
        // Use per-page text from textResult.pages if available
        if (textResult.pages && textResult.pages.length > 0) {
          pages = textResult.pages.map((page: any) => ({
            pageNumber: page.num,
            text: page.text || '',
          }));
        } else {
          // Fallback: approximate split
          pages = this.extractPagesFromText(text, textResult.total);
        }
      }

      // Preserve structure if requested
      if (options.preserveStructure) {
        text = this.preserveStructure(text);
      }

      return {
        text,
        numPages: textResult.total || 0,
        metadata,
        pages: options.extractPages ? pages : undefined,
      };
    } catch (error) {
      // Handle corrupted PDFs and other errors
      if (error instanceof Error && error.message.includes('Invalid PDF')) {
        throw new Error(`Corrupted or invalid PDF file: ${filePath}`);
      }
      
      throw new Error(
        `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clean text to handle encoding issues
   */
  private cleanText(text: string): string {
    // Remove null bytes
    text = text.replace(/\0/g, '');
    
    // Fix common encoding issues
    text = text.replace(/â€™/g, "'"); // Smart quote
    text = text.replace(/â€œ/g, '"'); // Opening quote
    text = text.replace(/â€/g, '"'); // Closing quote
    text = text.replace(/â€"/g, '—'); // Em dash
    text = text.replace(/â€"/g, '–'); // En dash
    
    // Remove excessive whitespace but preserve structure
    text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs
    text = text.replace(/\n{3,}/g, '\n\n'); // Multiple newlines
    
    return text.trim();
  }

  /**
   * Extract metadata from PDF info
   */
  private extractMetadata(info: any): PDFParseResult['metadata'] {
    if (!info) {
      return undefined;
    }

    return {
      title: info.Title,
      author: info.Author,
      subject: info.Subject,
      creator: info.Creator,
      producer: info.Producer,
      creationDate: info.CreationDate ? new Date(info.CreationDate) : undefined,
      modificationDate: info.ModDate ? new Date(info.ModDate) : undefined,
    };
  }

  /**
   * Extract pages from text (approximate - pdf-parse doesn't provide per-page text)
   */
  private extractPagesFromText(text: string, numPages: number): PDFParseResult['pages'] {
    // Simple approximation: split text roughly evenly across pages
    // In production, you might want to use pdf.js for accurate per-page extraction
    const pages: PDFParseResult['pages'] = [];
    const textLength = text.length;
    const approxCharsPerPage = Math.ceil(textLength / numPages);

    for (let i = 0; i < numPages; i++) {
      const start = i * approxCharsPerPage;
      const end = Math.min(start + approxCharsPerPage, textLength);
      const pageText = text.substring(start, end);

      pages.push({
        pageNumber: i + 1,
        text: pageText,
      });
    }

    return pages;
  }

  /**
   * Preserve structure in text (headings, paragraphs)
   */
  private preserveStructure(text: string): string {
    // Preserve paragraph breaks (double newlines)
    text = text.replace(/\n\n+/g, '\n\n');
    
    // Preserve single newlines within paragraphs
    // (pdf-parse often splits lines, we want to keep them for now)
    
    // Note: Full structure preservation would require:
    // - Font size detection (for headings)
    // - Layout analysis (for multi-column)
    // - Table detection
    // This is a basic implementation
    
    return text;
  }

  /**
   * Get PDF file size
   */
  getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }
}

export const pdfParserService = new PDFParserService();
