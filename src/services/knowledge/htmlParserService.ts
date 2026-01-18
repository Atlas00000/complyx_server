import * as cheerio from 'cheerio';

export interface HTMLParseResult {
  text: string;
  title?: string;
  description?: string;
  author?: string;
  keywords?: string[];
  url?: string;
  metadata?: {
    language?: string;
    publishedDate?: string;
    modifiedDate?: string;
  };
}

export interface HTMLParseOptions {
  removeScripts?: boolean; // Remove <script> tags
  removeStyles?: boolean; // Remove <style> tags
  preserveLinks?: boolean; // Preserve link text with URLs
  extractMetadata?: boolean; // Extract metadata from <meta> tags
  cleanWhitespace?: boolean; // Clean excessive whitespace
}

/**
 * HTML Parser Service
 * Handles HTML parsing and text extraction from web pages
 */
export class HTMLParserService {
  /**
   * Parse HTML and extract text content
   */
  parseHTML(html: string, options: HTMLParseOptions = {}): HTMLParseResult {
    const {
      removeScripts = true,
      removeStyles = true,
      preserveLinks = true,
      extractMetadata = true,
      cleanWhitespace = true,
    } = options;

    // Load HTML into cheerio
    const $ = cheerio.load(html);

    // Remove scripts if requested
    if (removeScripts) {
      $('script, noscript').remove();
    }

    // Remove styles if requested
    if (removeStyles) {
      $('style').remove();
    }

    // Remove comments
    $('*').each(function () {
      $(this)
        .contents()
        .filter(function () {
          return this.nodeType === 8; // Comment node
        })
        .remove();
    });

    // Handle links
    if (preserveLinks) {
      $('a').each(function () {
        const $link = $(this);
        const text = $link.text().trim();
        const href = $link.attr('href');
        if (text && href) {
          $link.replaceWith(`${text} (${href})`);
        }
      });
    } else {
      $('a').each(function () {
        const text = $(this).text();
        $(this).replaceWith(text);
      });
    }

    // Extract text from main content areas (prefer semantic HTML)
    const selectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '#main',
      'body',
    ];

    let text = '';
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0 && element.text().trim().length > 100) {
        text = element.text();
        break;
      }
    }

    // Fallback to body if no main content found
    if (!text || text.trim().length < 100) {
      text = $('body').text();
    }

    // Clean up text
    if (cleanWhitespace) {
      text = this.cleanText(text);
    }

    // Extract metadata if requested
    let metadata: HTMLParseResult['metadata'] | undefined;
    let title: string | undefined;
    let description: string | undefined;
    let author: string | undefined;
    let keywords: string[] | undefined;

    if (extractMetadata) {
      // Extract title
      title = $('title').text().trim() || undefined;
      if (!title) {
        const ogTitle = $('meta[property="og:title"]').attr('content');
        if (ogTitle) title = ogTitle.trim();
      }

      // Extract description
      description = $('meta[name="description"]').attr('content')?.trim();
      if (!description) {
        const ogDesc = $('meta[property="og:description"]').attr('content');
        if (ogDesc) description = ogDesc.trim();
      }

      // Extract author
      author = $('meta[name="author"]').attr('content')?.trim();
      if (!author) {
        const articleAuthor = $('meta[property="article:author"]').attr('content');
        if (articleAuthor) author = articleAuthor.trim();
      }

      // Extract keywords
      const keywordsStr = $('meta[name="keywords"]').attr('content')?.trim();
      if (keywordsStr) {
        keywords = keywordsStr.split(',').map((k) => k.trim()).filter(Boolean);
      }

      // Extract language
      const language = $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content');

      // Extract dates
      const publishedDate = $('meta[property="article:published_time"]').attr('content');
      const modifiedDate = $('meta[property="article:modified_time"]').attr('content');

      if (language || publishedDate || modifiedDate) {
        metadata = {
          language: language || undefined,
          publishedDate: publishedDate || undefined,
          modifiedDate: modifiedDate || undefined,
        };
      }
    }

    return {
      text: text.trim(),
      title,
      description,
      author,
      keywords,
      metadata,
    };
  }

  /**
   * Clean text by removing excessive whitespace
   */
  private cleanText(text: string): string {
    // Remove null bytes
    text = text.replace(/\0/g, '');

    // Normalize whitespace
    text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
    text = text.replace(/\n{3,}/g, '\n\n'); // Multiple newlines to double newline
    text = text.replace(/[ \t]+\n/g, '\n'); // Spaces before newlines
    text = text.replace(/\n[ \t]+/g, '\n'); // Spaces after newlines

    return text.trim();
  }

  /**
   * Extract text from HTML string (simple extraction)
   */
  extractText(html: string, options: HTMLParseOptions = {}): string {
    const result = this.parseHTML(html, options);
    return result.text;
  }

  /**
   * Check if HTML contains meaningful content
   */
  hasContent(html: string): boolean {
    const result = this.parseHTML(html, { extractMetadata: false });
    return result.text.trim().length > 100; // At least 100 characters
  }
}

export const htmlParserService = new HTMLParserService();
