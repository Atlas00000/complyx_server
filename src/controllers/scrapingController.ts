import { Request, Response } from 'express';
import { scrapingSchedulerService } from '../services/knowledge/scrapingSchedulerService';
import { rssFeedService, RSSFeedConfig } from '../services/knowledge/rssFeedService';

/**
 * Scraping Controller
 * Handles RSS feed scraping and scheduled content updates
 */
export class ScrapingController {
  /**
   * POST /api/scraping/feeds
   * Register a new RSS feed for scheduled scraping
   */
  async registerFeed(req: Request, res: Response): Promise<void> {
    try {
      const {
        url,
        name,
        enabled = true,
        updateInterval, // Minutes between checks
        documentType = 'other',
        source,
        priority,
        scope,
        cronExpression,
      } = req.body;

      if (!url || !name) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: url and name',
        });
        return;
      }

      // Validate feed URL
      const validation = rssFeedService.validateFeedURL(url);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.error || 'Invalid RSS feed URL',
        });
        return;
      }

      // Convert update interval to cron expression if provided
      let cronExpr = cronExpression;
      if (!cronExpr && updateInterval) {
        // Convert minutes to cron expression (every N minutes: */N * * * *)
        cronExpr = `*/${updateInterval} * * * *`;
      }

      // Register feed
      const config: RSSFeedConfig = {
        url,
        name,
        enabled,
        updateInterval,
        documentType,
        source,
        priority,
        scope,
      };

      const feedId = scrapingSchedulerService.registerFeed(config, cronExpr);

      res.status(201).json({
        success: true,
        message: 'RSS feed registered successfully',
        data: {
          feedId,
          config,
          cronExpression: cronExpr || scrapingSchedulerService.getFeed(feedId)?.cronExpression,
        },
      });
    } catch (error) {
      console.error('Error registering RSS feed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to register RSS feed',
      });
    }
  }

  /**
   * GET /api/scraping/feeds
   * Get all registered feeds
   */
  async getFeeds(req: Request, res: Response): Promise<void> {
    try {
      const feeds = scrapingSchedulerService.getFeeds();
      const stats = scrapingSchedulerService.getStatistics();

      res.json({
        success: true,
        data: {
          feeds,
          statistics: stats,
        },
      });
    } catch (error) {
      console.error('Error getting feeds:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get feeds',
      });
    }
  }

  /**
   * GET /api/scraping/feeds/:feedId
   * Get a specific feed
   */
  async getFeed(req: Request, res: Response): Promise<void> {
    try {
      const { feedId } = req.params;
      const feed = scrapingSchedulerService.getFeed(feedId);

      if (!feed) {
        res.status(404).json({
          success: false,
          error: 'Feed not found',
        });
        return;
      }

      res.json({
        success: true,
        data: feed,
      });
    } catch (error) {
      console.error('Error getting feed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get feed',
      });
    }
  }

  /**
   * DELETE /api/scraping/feeds/:feedId
   * Unregister a feed
   */
  async unregisterFeed(req: Request, res: Response): Promise<void> {
    try {
      const { feedId } = req.params;
      const removed = scrapingSchedulerService.unregisterFeed(feedId);

      if (!removed) {
        res.status(404).json({
          success: false,
          error: 'Feed not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Feed unregistered successfully',
      });
    } catch (error) {
      console.error('Error unregistering feed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unregister feed',
      });
    }
  }

  /**
   * PATCH /api/scraping/feeds/:feedId/enable
   * Enable/disable a feed
   */
  async setFeedEnabled(req: Request, res: Response): Promise<void> {
    try {
      const { feedId } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'Missing or invalid field: enabled (must be boolean)',
        });
        return;
      }

      const updated = scrapingSchedulerService.setFeedEnabled(feedId, enabled);

      if (!updated) {
        res.status(404).json({
          success: false,
          error: 'Feed not found',
        });
        return;
      }

      res.json({
        success: true,
        message: `Feed ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      console.error('Error setting feed enabled:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update feed',
      });
    }
  }

  /**
   * POST /api/scraping/feeds/:feedId/process
   * Manually trigger feed processing
   */
  async processFeed(req: Request, res: Response): Promise<void> {
    try {
      const { feedId } = req.params;
      const result = await scrapingSchedulerService.processFeed(feedId);

      res.json({
        success: result.success,
        message: result.success
          ? `Feed processed: ${result.itemsProcessed} items processed, ${result.itemsFailed} failed`
          : `Feed processing failed: ${result.error}`,
        data: result,
      });
    } catch (error) {
      console.error('Error processing feed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process feed',
      });
    }
  }

  /**
   * POST /api/scraping/process-all
   * Manually trigger processing of all enabled feeds
   */
  async processAllFeeds(req: Request, res: Response): Promise<void> {
    try {
      console.log('📡 Manual trigger: Processing all enabled feeds');
      const results = await scrapingSchedulerService.processAllFeeds();

      const totalProcessed = results.reduce((sum, r) => sum + r.itemsProcessed, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.itemsFailed, 0);
      const successful = results.filter((r) => r.success).length;

      res.json({
        success: true,
        message: `Processed ${successful}/${results.length} feeds: ${totalProcessed} items processed, ${totalFailed} failed`,
        data: {
          results,
          summary: {
            totalFeeds: results.length,
            successful,
            failed: results.length - successful,
            totalItemsProcessed: totalProcessed,
            totalItemsFailed: totalFailed,
          },
        },
      });
    } catch (error) {
      console.error('Error processing all feeds:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process all feeds',
      });
    }
  }

  /**
   * GET /api/scraping/statistics
   * Get scraping statistics
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = scrapingSchedulerService.getStatistics();
      const feeds = scrapingSchedulerService.getFeeds();

      res.json({
        success: true,
        data: {
          statistics: stats,
          feeds: feeds.map((feed) => ({
            id: feed.id,
            name: feed.config.name,
            enabled: feed.enabled,
            lastProcessedDate: feed.lastProcessedDate,
            lastCheckDate: feed.lastCheckDate,
            cronExpression: feed.cronExpression,
          })),
        },
      });
    } catch (error) {
      console.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get statistics',
      });
    }
  }
}

export const scrapingController = new ScrapingController();
