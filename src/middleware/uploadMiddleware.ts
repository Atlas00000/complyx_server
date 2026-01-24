import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface UploadConfig {
  maxFileSize?: number; // Maximum file size in bytes
  allowedMimeTypes?: string[]; // Allowed MIME types
  allowedExtensions?: string[]; // Allowed file extensions
  destination?: string; // Upload destination directory
}

/**
 * File Upload Middleware
 * Handles file upload validation and storage
 */
export class UploadMiddleware {
  private defaultMaxSize: number;
  private allowedMimeTypes: string[];
  private allowedExtensions: string[];
  private uploadDir: string;

  constructor(config: UploadConfig = {}) {
    this.defaultMaxSize = config.maxFileSize || 100 * 1024 * 1024; // 100 MB default
    this.allowedMimeTypes = config.allowedMimeTypes || [
      'text/plain',
      'application/pdf',
      'application/x-pdf',
      'text/html',
      'application/xml',
      'text/xml',
    ];
    this.allowedExtensions = config.allowedExtensions || ['.txt', '.pdf', '.html', '.htm', '.xml'];
    this.uploadDir = config.destination || path.join(os.tmpdir(), 'complyx-uploads');

    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Create multer storage configuration
   */
  private createStorage() {
    return multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (_req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
      },
    });
  }

  /**
   * File filter function
   */
  private fileFilter() {
    return (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      // Check MIME type
      if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error(`File type not allowed: ${file.mimetype}. Allowed types: ${this.allowedMimeTypes.join(', ')}`));
      }

      // Check file extension
      const ext = path.extname(file.originalname).toLowerCase();
      if (this.allowedExtensions.length > 0 && !this.allowedExtensions.includes(ext)) {
        return cb(new Error(`File extension not allowed: ${ext}. Allowed extensions: ${this.allowedExtensions.join(', ')}`));
      }

      cb(null, true);
    };
  }

  /**
   * Get multer upload middleware
   */
  getUploadMiddleware(fieldName: string = 'file', maxFiles: number = 1) {
    return multer({
      storage: this.createStorage(),
      fileFilter: this.fileFilter(),
      limits: {
        fileSize: this.defaultMaxSize,
        files: maxFiles,
      },
    }).single(fieldName);
  }

  /**
   * Get multer upload middleware for multiple files
   */
  getBulkUploadMiddleware(fieldName: string = 'files', maxFiles: number = 10) {
    return multer({
      storage: this.createStorage(),
      fileFilter: this.fileFilter(),
      limits: {
        fileSize: this.defaultMaxSize,
        files: maxFiles,
      },
    }).array(fieldName, maxFiles);
  }

  /**
   * Validate uploaded file
   */
  validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    if (!file) {
      return {
        valid: false,
        error: 'No file uploaded',
      };
    }

    // Check file size
    if (file.size > this.defaultMaxSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size: ${this.formatFileSize(this.defaultMaxSize)}`,
      };
    }

    // Check MIME type
    if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: `File type not allowed: ${file.mimetype}`,
      };
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (this.allowedExtensions.length > 0 && !this.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension not allowed: ${ext}`,
      };
    }

    return {
      valid: true,
    };
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Clean up uploaded file
   */
  cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Failed to cleanup file: ${filePath}`, error);
    }
  }

  /**
   * Clean up multiple files
   */
  cleanupFiles(filePaths: string[]): void {
    filePaths.forEach((filePath) => this.cleanupFile(filePath));
  }
}

export const uploadMiddleware = new UploadMiddleware();
