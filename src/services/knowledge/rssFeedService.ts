import Parser from 'rss-parser';
import { URLParserService } from './urlParserService';
import { KnowledgeIngestionService, DocumentMetadata } from './knowledgeIngestionService';

export interface RSSFeedItem {
  title: string;
  link: string;
  pubDate?: Date;
  description?: string;
  content?: string;
  guid?: string;
  author?: string;
  categories?: string[];
}

export interface RSSFeed {
  title: string;
  description?: string;
  link: string;
  items: RSSFeedItem[];
  lastBuildDate?: Date;
  pubDate?: Date;
}

export interface RSSFeedConfig {
  url: string;
  name: string;
  enabled?: boolean;
  updateInterval?: number; // Minutes between checks
  documentType?: DocumentMetadata['documentType'];
  source?: string;
  priority?: 'high' | 'medium' | 'low';
  scope?: 's1' | 's2' | 'general' | 'accounting';
}

export interface RSSParseResult {
  feed: RSSFeed;
  newItems: RSSFeedItem[]; // Items not yet processed
  totalItems: number;
}

/**
 * RSS Feed Service
 * Handles RSS feed parsing and content extraction
 */
export class RSSFeedService {
  private parser: Parser;
  private urlParser: URLParserService;
  private ingestionService: KnowledgeIngestionService;

  constructor() {
    this.parser = new Parser({
      timeout: 30000, // 30 seconds timeout
      maxRedirects: 5,
      customFields: {
        item: [
          ['content:encoded', 'content'],
          ['description', 'description'],
        ],
      },
    });
    this.urlParser = new URLParserService();
    this.ingestionService = new KnowledgeIngestionService();
  }

  /**
   * Validate RSS feed URL
   */
  validateFeedURL(url: string): { valid: boolean; error?: string } {
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return {
          valid: false,
          error: `Unsupported protocol: ${urlObj.protocol}. Only HTTP and HTTPS are allowed.`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid RSS feed URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse RSS feed from URL
   */
  async parseFeed(feedURL: string): Promise<RSSFeed> {
    // Validate URL
    const validation = this.validateFeedURL(feedURL);
    if (!validation.valid) {
      throw new Error(validation.error || 'RSS feed URL validation failed');
    }

    try {
      // Parse RSS feed
      const feed = await this.parser.parseURL(feedURL);

      // Transform to our format
      const rssFeed: RSSFeed = {
        title: feed.title || 'Untitled Feed',
        description: feed.description,
        link: feed.link || feedURL,
        items: (feed.items || []).map((item) => ({
          title: item.title || 'Untitled',
          link: item.link || item.guid || '',
          pubDate: item.pubDate ? new Date(item.pubDate) : undefined,
          description: item.contentSnippet || item.description || item.content,
          content: item.content || item.contentSnippet || item.description,
          guid: item.guid || item.link || item.id,
          author: item.creator || item.author,
          categories: item.categories || [],
        })),
        lastBuildDate: feed.lastBuildDate ? new Date(feed.lastBuildDate) : undefined,
        pubDate: feed.pubDate ? new Date(feed.pubDate) : undefined,
      };

      return rssFeed;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error(`RSS feed parsing timeout: ${feedURL}`);
      }
      throw new Error(
        `Failed to parse RSS feed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get new items from RSS feed (items not yet processed)
   */
  async getNewItems(
    feedURL: string,
    lastProcessedDate?: Date
  ): Promise<{ feed: RSSFeed; newItems: RSSFeedItem[] }> {
    const feed = await this.parseFeed(feedURL);

    // Filter items newer than last processed date
    let newItems: RSSFeedItem[] = feed.items;

    if (lastProcessedDate) {
      newItems = feed.items.filter((item) => {
        if (!item.pubDate) {
          return true; // Include items without dates (safer to process than skip)
        }
        return item.pubDate > lastProcessedDate;
      });
    }

    // Sort by date (newest first)
    newItems.sort((a, b) => {
      const dateA = a.pubDate?.getTime() || 0;
      const dateB = b.pubDate?.getTime() || 0;
      return dateB - dateA;
    });

    return { feed, newItems };
  }

  /**
   * Ingest content from RSS feed item
   */
  async ingestFeedItem(
    item: RSSFeedItem,
    config: RSSFeedConfig
  ): Promise<{ success: boolean; documentId?: string; error?: string }> {
    try {
      if (!item.link) {
        return {
          success: false,
          error: 'RSS feed item has no link',
        };
      }

      console.log(`   Processing RSS item: ${item.title}`);
      console.log(`   URL: ${item.link}`);

      // Parse URL content
      const urlResult = await this.urlParser.parseURL(item.link, {
        extractMetadata: true,
        removeScripts: true,
        removeStyles: true,
      });

      if (!urlResult.text || urlResult.text.trim().length === 0) {
        return {
          success: false,
          error: 'RSS feed item content is empty or contains no extractable text',
        };
      }

      // Prepare document metadata
      const documentMetadata: DocumentMetadata = {
        documentId: `${config.documentType || 'other'}-rss-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        title: item.title || urlResult.metadata?.title || 'RSS Feed Item',
        source: config.source || config.name || 'RSS Feed',
        url: item.link,
        documentType: config.documentType || 'other',
        version: process.env.KNOWLEDGE_BASE_VERSION || 'v1.0.0',
        publishDate: item.pubDate || new Date(),
        language: urlResult.metadata?.language || 'en',
        tags: item.categories || [],
        priority: config.priority,
        scope: config.scope,
      };

      // Validate metadata
      const validation = this.ingestionService.validateMetadata(documentMetadata);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid metadata: ${validation.errors.join(', ')}`,
        };
      }

      // Ingest document
      const result = await this.ingestionService.ingestDocument(urlResult.text, documentMetadata, {
        chunkSize: 1000,
        chunkOverlap: 200,
        skipExisting: false, // Process all RSS items
      });

      return {
        success: true,
        documentId: result.documentId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ingest RSS feed item',
      };
    }
  }

  /**
   * Process RSS feed and ingest new items
   */
  async processFeed(
    config: RSSFeedConfig,
    lastProcessedDate?: Date
  ): Promise<{
    success: boolean;
    feed?: RSSFeed;
    itemsProcessed: number;
    itemsFailed: number;
    results: Array<{ item: string; success: boolean; error?: string }>;
  }> {
    console.log(`\n📡 Processing RSS feed: ${config.name}`);
    console.log(`   URL: ${config.url}`);

    try {
      // Get new items from feed
      const { feed, newItems } = await this.getNewItems(config.url, lastProcessedDate);

      console.log(`   Total items in feed: ${feed.items.length}`);
      console.log(`   New items to process: ${newItems.length}`);

      if (newItems.length === 0) {
        return {
          success: true,
          feed,
          itemsProcessed: 0,
          itemsFailed: 0,
          results: [],
        };
      }

      // Process each new item
      const results: Array<{ item: string; success: boolean; error?: string }> = [];
      let itemsProcessed = 0;
      let itemsFailed = 0;

      for (const item of newItems) {
        const result = await this.ingestFeedItem(item, config);
        
        results.push({
          item: item.title || item.link,
          success: result.success,
          error: result.error,
        });

        if (result.success) {
          itemsProcessed++;
        } else {
          itemsFailed++;
          console.log(`   ❌ Failed to process: ${item.title} - ${result.error}`);
        }

        // Add small delay between items to avoid rate limiting (only if processing multiple items)
        if (newItems.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return {
        success: true,
        feed,
        itemsProcessed,
        itemsFailed,
        results,
      };
    } catch (error) {
      console.error(`   ❌ Error processing RSS feed: ${error}`);
      return {
        success: false,
        itemsProcessed: 0,
        itemsFailed: 0,
        results: [{ item: config.url, success: false, error: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }
}

export const rssFeedService = new RSSFeedService();
