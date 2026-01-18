import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface URLFetchResult {
  url: string;
  content: Buffer;
  contentType: string;
  contentLength: number;
  headers: Record<string, string>;
  statusCode: number;
  finalUrl?: string; // After redirects
}

export interface URLFetchOptions {
  timeout?: number; // Request timeout in milliseconds
  maxSize?: number; // Maximum content size in bytes
  followRedirects?: boolean; // Follow HTTP redirects
  userAgent?: string; // Custom user agent
  headers?: Record<string, string>; // Additional headers
}

/**
 * URL Fetcher Service
 * Handles fetching content from URLs with validation and security checks
 */
export class URLFetcherService {
  private defaultTimeout: number;
  private defaultMaxSize: number;
  private allowedContentTypes: string[];

  constructor() {
    this.defaultTimeout = 30000; // 30 seconds
    this.defaultMaxSize = 50 * 1024 * 1024; // 50 MB
    this.allowedContentTypes = [
      'text/html',
      'text/plain',
      'application/pdf',
      'application/x-pdf',
      'text/xml',
      'application/xml',
    ];
  }

  /**
   * Validate URL format and security
   */
  validateURL(url: string): { valid: boolean; error?: string } {
    try {
      const urlObj = new URL(url);

      // Check protocol (only http and https allowed)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return {
          valid: false,
          error: `Unsupported protocol: ${urlObj.protocol}. Only HTTP and HTTPS are allowed.`,
        };
      }

      // Check for potentially dangerous patterns
      const dangerousPatterns = [
        /localhost/i,
        /127\.0\.0\.1/i,
        /0\.0\.0\.0/i,
        /192\.168\./i,
        /10\./i,
        /172\.(1[6-9]|2[0-9]|3[0-1])\./i, // Private IP ranges
      ];

      // Allow localhost in development but warn
      if (process.env.NODE_ENV === 'production') {
        for (const pattern of dangerousPatterns) {
          if (pattern.test(urlObj.hostname)) {
            return {
              valid: false,
              error: 'Local/internal URLs are not allowed in production',
            };
          }
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Fetch content from URL
   */
  async fetchURL(url: string, options: URLFetchOptions = {}): Promise<URLFetchResult> {
    // Validate URL
    const validation = this.validateURL(url);
    if (!validation.valid) {
      throw new Error(validation.error || 'URL validation failed');
    }

    const timeout = options.timeout || this.defaultTimeout;
    const maxSize = options.maxSize || this.defaultMaxSize;
    const userAgent =
      options.userAgent ||
      'Mozilla/5.0 (compatible; ComplyxBot/1.0; +https://complyx.ai/bot)';

    try {
      // Configure axios request
      const response: AxiosResponse<Buffer> = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout,
        maxContentLength: maxSize,
        maxBodyLength: maxSize,
        validateStatus: (status) => status >= 200 && status < 400, // Accept 2xx and 3xx
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/pdf,application/xhtml+xml,application/xml,*/*',
          ...options.headers,
        },
        maxRedirects: options.followRedirects !== false ? 5 : 0,
      });

      // Get content type from response headers
      const contentType = this.getContentType(response.headers);
      const contentLength = parseInt(response.headers['content-length'] || '0', 10);

      // Validate content type
      if (!this.isAllowedContentType(contentType)) {
        throw new Error(
          `Content type not allowed: ${contentType}. Allowed types: ${this.allowedContentTypes.join(', ')}`
        );
      }

      // Check content size
      if (contentLength > maxSize) {
        throw new Error(`Content size exceeds maximum allowed size: ${maxSize} bytes`);
      }

      const content = Buffer.from(response.data);

      return {
        url,
        content,
        contentType,
        contentLength: content.length || contentLength,
        headers: response.headers as Record<string, string>,
        statusCode: response.status,
        finalUrl: response.request?.res?.responseUrl || url,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new Error(`Unable to connect to URL: ${url}`);
        }
        if (error.response) {
          throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
        }
        throw new Error(`Failed to fetch URL: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get content type from headers
   */
  private getContentType(headers: Record<string, any>): string {
    const contentType = headers['content-type'] || headers['Content-Type'] || '';
    // Extract main content type (e.g., "text/html" from "text/html; charset=utf-8")
    return contentType.split(';')[0].trim().toLowerCase();
  }

  /**
   * Check if content type is allowed
   */
  private isAllowedContentType(contentType: string): boolean {
    if (!contentType) {
      return true; // Allow unknown content types (will be handled by parser)
    }

    // Check exact match or partial match
    for (const allowedType of this.allowedContentTypes) {
      if (contentType.includes(allowedType) || contentType === allowedType) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if URL points to a PDF
   */
  isPDFURL(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      return pathname.endsWith('.pdf') || pathname.includes('.pdf');
    } catch {
      return false;
    }
  }

  /**
   * Check if URL points to an HTML page
   */
  isHTMLURL(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      const htmlExtensions = ['.html', '.htm', '.xhtml'];
      return htmlExtensions.some((ext) => pathname.endsWith(ext));
    } catch {
      return false;
    }
  }

  /**
   * Download content to file (for PDFs or caching)
   */
  async downloadToFile(url: string, filePath: string, options: URLFetchOptions = {}): Promise<string> {
    const result = await this.fetchURL(url, options);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, result.content);

    return filePath;
  }
}

export const urlFetcherService = new URLFetcherService();
