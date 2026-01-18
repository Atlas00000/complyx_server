import * as cron from 'node-cron';
import { RSSFeedService, RSSFeedConfig } from './rssFeedService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ScheduledFeed {
  id: string;
  config: RSSFeedConfig;
  cronExpression: string;
  lastProcessedDate?: Date;
  lastCheckDate?: Date;
  enabled: boolean;
  nextRunDate?: Date;
}

export interface ScrapingResult {
  feedId: string;
  feedName: string;
  success: boolean;
  itemsProcessed: number;
  itemsFailed: number;
  processingTimeMs: number;
  error?: string;
}

/**
 * Scraping Scheduler Service
 * Manages scheduled RSS feed scraping and content updates
 */
export class ScrapingSchedulerService {
  private rssFeedService: RSSFeedService;
  private scheduledFeeds: Map<string, ScheduledFeed>;
  private cronJobs: Map<string, cron.ScheduledTask>;
  private stateFile: string;
  private defaultCronExpression: string = '0 */6 * * *'; // Every 6 hours

  constructor() {
    this.rssFeedService = new RSSFeedService();
    this.scheduledFeeds = new Map();
    this.cronJobs = new Map();
    
    // State file for persistence
    const stateDir = path.join(os.tmpdir(), 'complyx-scraping');
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    this.stateFile = path.join(stateDir, 'feed-state.json');
    
    // Load persisted state
    this.loadState();
  }

  /**
   * Load scheduler state from file
   */
  private loadState(): void {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, 'utf-8');
        const state = JSON.parse(data);
        
        // Restore scheduled feeds (without cron jobs)
        if (state.feeds && Array.isArray(state.feeds)) {
          for (const feed of state.feeds) {
            if (feed.lastProcessedDate) {
              feed.lastProcessedDate = new Date(feed.lastProcessedDate);
            }
            if (feed.lastCheckDate) {
              feed.lastCheckDate = new Date(feed.lastCheckDate);
            }
            this.scheduledFeeds.set(feed.id, feed);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load scraping scheduler state:', error);
    }
  }

  /**
   * Save scheduler state to file
   */
  private saveState(): void {
    try {
      const state = {
        feeds: Array.from(this.scheduledFeeds.values()),
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.warn('Failed to save scraping scheduler state:', error);
    }
  }

  /**
   * Register a feed for scheduled scraping
   */
  registerFeed(config: RSSFeedConfig, cronExpression?: string): string {
    const feedId = `feed-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const scheduledFeed: ScheduledFeed = {
      id: feedId,
      config: {
        ...config,
        enabled: config.enabled !== false,
      },
      cronExpression: cronExpression || this.defaultCronExpression,
      enabled: config.enabled !== false,
    };

    this.scheduledFeeds.set(feedId, scheduledFeed);

    // Schedule cron job if enabled
    if (scheduledFeed.enabled) {
      this.scheduleFeed(feedId);
    }

    this.saveState();
    return feedId;
  }

  /**
   * Schedule a feed's scraping job
   */
  private scheduleFeed(feedId: string): void {
    const feed = this.scheduledFeeds.get(feedId);
    if (!feed) {
      return;
    }

    // Remove existing cron job if any
    const existingJob = this.cronJobs.get(feedId);
    if (existingJob) {
      existingJob.stop();
      this.cronJobs.delete(feedId);
    }

    // Validate cron expression
    if (!cron.validate(feed.cronExpression)) {
      console.error(`Invalid cron expression for feed ${feedId}: ${feed.cronExpression}`);
      return;
    }

    // Create new cron job
    const job = cron.schedule(feed.cronExpression, async () => {
      console.log(`\n⏰ Scheduled scraping triggered for feed: ${feed.config.name}`);
      await this.processFeed(feedId);
    });

    this.cronJobs.set(feedId, job);
    console.log(`✅ Scheduled feed: ${feed.config.name} (${feed.cronExpression})`);
  }

  /**
   * Unregister a feed (stop scraping)
   */
  unregisterFeed(feedId: string): boolean {
    // Stop cron job
    const job = this.cronJobs.get(feedId);
    if (job) {
      job.stop();
      this.cronJobs.delete(feedId);
    }

    // Remove feed
    const removed = this.scheduledFeeds.delete(feedId);
    
    if (removed) {
      this.saveState();
    }

    return removed;
  }

  /**
   * Enable/disable a feed
   */
  setFeedEnabled(feedId: string, enabled: boolean): boolean {
    const feed = this.scheduledFeeds.get(feedId);
    if (!feed) {
      return false;
    }

    feed.enabled = enabled;
    
    if (enabled) {
      this.scheduleFeed(feedId);
    } else {
      const job = this.cronJobs.get(feedId);
      if (job) {
        job.stop();
        this.cronJobs.delete(feedId);
      }
    }

    this.saveState();
    return true;
  }

  /**
   * Process a single feed (manual trigger or scheduled)
   */
  async processFeed(feedId: string): Promise<ScrapingResult> {
    const feed = this.scheduledFeeds.get(feedId);
    if (!feed) {
      return {
        feedId,
        feedName: 'Unknown',
        success: false,
        itemsProcessed: 0,
        itemsFailed: 0,
        processingTimeMs: 0,
        error: 'Feed not found',
      };
    }

    const startTime = Date.now();
    feed.lastCheckDate = new Date();

    try {
      const result = await this.rssFeedService.processFeed(feed.config, feed.lastProcessedDate);

      // Update last processed date to most recent item date
      if (result.feed && result.feed.items.length > 0) {
        const mostRecentItem = result.feed.items[0];
        if (mostRecentItem.pubDate) {
          feed.lastProcessedDate = mostRecentItem.pubDate;
        }
      }

      this.saveState();

      return {
        feedId,
        feedName: feed.config.name,
        success: result.success,
        itemsProcessed: result.itemsProcessed,
        itemsFailed: result.itemsFailed,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        feedId,
        feedName: feed.config.name,
        success: false,
        itemsProcessed: 0,
        itemsFailed: 0,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process all enabled feeds
   */
  async processAllFeeds(): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];

    for (const feedId of this.scheduledFeeds.keys()) {
      const feed = this.scheduledFeeds.get(feedId);
      if (feed && feed.enabled) {
        const result = await this.processFeed(feedId);
        results.push(result);

        // Add delay between feeds
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    return results;
  }

  /**
   * Get all registered feeds
   */
  getFeeds(): ScheduledFeed[] {
    return Array.from(this.scheduledFeeds.values());
  }

  /**
   * Get a specific feed
   */
  getFeed(feedId: string): ScheduledFeed | undefined {
    return this.scheduledFeeds.get(feedId);
  }

  /**
   * Get feed statistics
   */
  getStatistics(): {
    totalFeeds: number;
    enabledFeeds: number;
    disabledFeeds: number;
    activeCronJobs: number;
  } {
    const feeds = Array.from(this.scheduledFeeds.values());
    return {
      totalFeeds: feeds.length,
      enabledFeeds: feeds.filter((f) => f.enabled).length,
      disabledFeeds: feeds.filter((f) => !f.enabled).length,
      activeCronJobs: this.cronJobs.size,
    };
  }
}

export const scrapingSchedulerService = new ScrapingSchedulerService();
