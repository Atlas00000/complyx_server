import { Request, Response } from 'express';
import { uploadMiddleware } from '../middleware/uploadMiddleware';
import { KnowledgeIngestionService, DocumentMetadata } from '../services/knowledge/knowledgeIngestionService';
import { PDFParserService } from '../services/knowledge/pdfParserService';
import { URLParserService } from '../services/knowledge/urlParserService';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadRequest extends Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

/**
 * Upload Controller
 * Handles file upload and ingestion
 */
export class UploadController {
  private ingestionService: KnowledgeIngestionService;
  private pdfParser: PDFParserService;
  private urlParser: URLParserService;

  constructor() {
    this.ingestionService = new KnowledgeIngestionService();
    this.pdfParser = new PDFParserService();
    this.urlParser = new URLParserService();
  }

  /**
   * Handle single file upload
   */
  async uploadFile(req: UploadRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
        return;
      }

      // Validate file
      const validation = uploadMiddleware.validateFile(req.file);
      if (!validation.valid) {
        // Cleanup file
        uploadMiddleware.cleanupFile(req.file.path);
        res.status(400).json({
          success: false,
          error: validation.error || 'File validation failed',
        });
        return;
      }

      const file = req.file;
      const { documentType = 'other', title, section, url, version } = req.body;

      console.log(`📤 Uploading file: ${file.originalname}`);
      console.log(`   Type: ${documentType}`);
      console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);

      // Read file content
      let text: string;
      let metadata: any = {};

      if (this.pdfParser.isPDF(file.path)) {
        console.log('   Detected PDF file, extracting text...');
        const pdfResult = await this.pdfParser.parsePDF(file.path, {
          extractPages: false,
          preserveStructure: true,
        });
        text = pdfResult.text;
        metadata = {
          numPages: pdfResult.numPages,
          pdfMetadata: pdfResult.metadata,
        };
      } else {
        // Read as text file
        text = fs.readFileSync(file.path, 'utf-8');
      }

      if (!text || text.trim().length === 0) {
        uploadMiddleware.cleanupFile(file.path);
        res.status(400).json({
          success: false,
          error: 'File is empty or contains no extractable text',
        });
        return;
      }

      // Prepare document metadata
      const documentMetadata: DocumentMetadata = {
        documentId: `${documentType}-${path.basename(file.originalname, path.extname(file.originalname))}-${Date.now()}`,
        title: title || file.originalname || metadata.pdfMetadata?.title || 'Uploaded Document',
        source: req.body.source || 'User Upload',
        url: url || undefined,
        section: section || undefined,
        documentType: (documentType as DocumentMetadata['documentType']) || 'other',
        version: version || process.env.KNOWLEDGE_BASE_VERSION || 'v1.0.0',
        publishDate: metadata.pdfMetadata?.creationDate ? new Date(metadata.pdfMetadata.creationDate) : new Date(),
        language: metadata.pdfMetadata?.language || 'en',
      };

      // Validate metadata
      const metadataValidation = this.ingestionService.validateMetadata(documentMetadata);
      if (!metadataValidation.valid) {
        uploadMiddleware.cleanupFile(file.path);
        res.status(400).json({
          success: false,
          error: `Invalid metadata: ${metadataValidation.errors.join(', ')}`,
        });
        return;
      }

      // Ingest document
      console.log('   Ingesting document...');
      const startTime = Date.now();
      const result = await this.ingestionService.ingestDocument(text, documentMetadata, {
        chunkSize: parseInt(req.body.chunkSize || '1000', 10),
        chunkOverlap: parseInt(req.body.chunkOverlap || '200', 10),
        skipExisting: req.body.skipExisting === 'true',
      });

      // Cleanup uploaded file
      uploadMiddleware.cleanupFile(file.path);

      const processingTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        message: 'File uploaded and ingested successfully',
        data: {
          documentId: result.documentId,
          chunksCreated: result.chunksCreated,
          vectorsStored: result.vectorsStored,
          processingTimeMs: processingTime,
          metadata: documentMetadata,
        },
      });
    } catch (error) {
      // Cleanup file on error
      if (req.file?.path) {
        uploadMiddleware.cleanupFile(req.file.path);
      }

      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload and ingest file',
      });
    }
  }

  /**
   * Handle bulk file upload
   */
  async uploadBulk(req: UploadRequest, res: Response): Promise<void> {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No files uploaded',
        });
        return;
      }

      const files = req.files;
      const { documentType = 'other', source, version } = req.body;

      console.log(`📤 Bulk uploading ${files.length} files`);

      const results: Array<{
        file: string;
        success: boolean;
        documentId?: string;
        chunksCreated?: number;
        vectorsStored?: number;
        error?: string;
      }> = [];

      // Process each file
      for (const file of files) {
        try {
          // Validate file
          const validation = uploadMiddleware.validateFile(file);
          if (!validation.valid) {
            uploadMiddleware.cleanupFile(file.path);
            results.push({
              file: file.originalname,
              success: false,
              error: validation.error || 'File validation failed',
            });
            continue;
          }

          // Read file content
          let text: string;
          let metadata: any = {};

          if (this.pdfParser.isPDF(file.path)) {
            const pdfResult = await this.pdfParser.parsePDF(file.path, {
              extractPages: false,
              preserveStructure: true,
            });
            text = pdfResult.text;
            metadata = {
              numPages: pdfResult.numPages,
              pdfMetadata: pdfResult.metadata,
            };
          } else {
            text = fs.readFileSync(file.path, 'utf-8');
          }

          if (!text || text.trim().length === 0) {
            uploadMiddleware.cleanupFile(file.path);
            results.push({
              file: file.originalname,
              success: false,
              error: 'File is empty or contains no extractable text',
            });
            continue;
          }

          // Prepare document metadata
          const documentMetadata: DocumentMetadata = {
            documentId: `${documentType}-${path.basename(file.originalname, path.extname(file.originalname))}-${Date.now()}`,
            title: file.originalname || metadata.pdfMetadata?.title || 'Uploaded Document',
            source: source || 'User Upload',
            documentType: (documentType as DocumentMetadata['documentType']) || 'other',
            version: version || process.env.KNOWLEDGE_BASE_VERSION || 'v1.0.0',
            publishDate: metadata.pdfMetadata?.creationDate ? new Date(metadata.pdfMetadata.creationDate) : new Date(),
            language: metadata.pdfMetadata?.language || 'en',
          };

          // Validate metadata
          const metadataValidation = this.ingestionService.validateMetadata(documentMetadata);
          if (!metadataValidation.valid) {
            uploadMiddleware.cleanupFile(file.path);
            results.push({
              file: file.originalname,
              success: false,
              error: `Invalid metadata: ${metadataValidation.errors.join(', ')}`,
            });
            continue;
          }

          // Ingest document
          const result = await this.ingestionService.ingestDocument(text, documentMetadata, {
            chunkSize: 1000,
            chunkOverlap: 200,
            skipExisting: false,
          });

          // Cleanup uploaded file
          uploadMiddleware.cleanupFile(file.path);

          results.push({
            file: file.originalname,
            success: true,
            documentId: result.documentId,
            chunksCreated: result.chunksCreated,
            vectorsStored: result.vectorsStored,
          });
        } catch (error) {
          // Cleanup file on error
          uploadMiddleware.cleanupFile(file.path);
          results.push({
            file: file.originalname,
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process file',
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      res.status(200).json({
        success: true,
        message: `Bulk upload completed: ${successCount} successful, ${failCount} failed`,
        data: {
          total: files.length,
          successful: successCount,
          failed: failCount,
          results,
        },
      });
    } catch (error) {
      // Cleanup all files on error
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach((file) => uploadMiddleware.cleanupFile(file.path));
      }

      console.error('Bulk upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process bulk upload',
      });
    }
  }

  /**
   * Handle URL upload (ingest from URL)
   */
  async uploadURL(req: Request, res: Response): Promise<void> {
    try {
      const { url, documentType = 'other', title, section, source, version } = req.body;

      if (!url) {
        res.status(400).json({
          success: false,
          error: 'URL is required',
        });
        return;
      }

      // Validate URL
      const validation = this.urlParser.validateURL(url);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.error || 'URL validation failed',
        });
        return;
      }

      console.log(`📤 Uploading from URL: ${url}`);

      // Parse URL
      const urlResult = await this.urlParser.parseURL(url, {
        extractMetadata: true,
        removeScripts: true,
        removeStyles: true,
      });

      if (!urlResult.text || urlResult.text.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'URL content is empty or contains no extractable text',
        });
        return;
      }

      // Prepare document metadata
      const documentMetadata: DocumentMetadata = {
        documentId: `${documentType}-url-${Date.now()}`,
        title: title || urlResult.metadata?.title || this.extractTitleFromURL(url),
        source: source || 'User URL Upload',
        url: url,
        section: section || undefined,
        documentType: (documentType as DocumentMetadata['documentType']) || 'other',
        version: version || process.env.KNOWLEDGE_BASE_VERSION || 'v1.0.0',
        publishDate: urlResult.metadata?.publishedDate ? new Date(urlResult.metadata.publishedDate) : new Date(),
        language: urlResult.metadata?.language || 'en',
      };

      // Validate metadata
      const metadataValidation = this.ingestionService.validateMetadata(documentMetadata);
      if (!metadataValidation.valid) {
        res.status(400).json({
          success: false,
          error: `Invalid metadata: ${metadataValidation.errors.join(', ')}`,
        });
        return;
      }

      // Ingest document
      const startTime = Date.now();
      const result = await this.ingestionService.ingestDocument(urlResult.text, documentMetadata, {
        chunkSize: parseInt(req.body.chunkSize || '1000', 10),
        chunkOverlap: parseInt(req.body.chunkOverlap || '200', 10),
        skipExisting: req.body.skipExisting === 'true',
      });

      const processingTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        message: 'URL content ingested successfully',
        data: {
          documentId: result.documentId,
          chunksCreated: result.chunksCreated,
          vectorsStored: result.vectorsStored,
          processingTimeMs: processingTime,
          metadata: documentMetadata,
          urlType: urlResult.type,
          numPages: urlResult.numPages,
        },
      });
    } catch (error) {
      console.error('URL upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ingest content from URL',
      });
    }
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
        return lastPart.replace(/\.(html?|pdf|xml|txt)$/i, '').replace(/[-_]/g, ' ');
      }
      return urlObj.hostname;
    } catch {
      return url;
    }
  }
}

export const uploadController = new UploadController();
