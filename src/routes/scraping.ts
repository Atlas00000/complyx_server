import express, { Router } from 'express';
import { scrapingController } from '../controllers/scrapingController';

const router = Router();

/**
 * POST /api/scraping/feeds
 * Register a new RSS feed for scheduled scraping
 */
router.post('/feeds', express.json(), async (req, res) => {
  await scrapingController.registerFeed(req, res);
});

/**
 * GET /api/scraping/feeds
 * Get all registered feeds
 */
router.get('/feeds', async (req, res) => {
  await scrapingController.getFeeds(req, res);
});

/**
 * GET /api/scraping/feeds/:feedId
 * Get a specific feed
 */
router.get('/feeds/:feedId', async (req, res) => {
  await scrapingController.getFeed(req, res);
});

/**
 * DELETE /api/scraping/feeds/:feedId
 * Unregister a feed
 */
router.delete('/feeds/:feedId', async (req, res) => {
  await scrapingController.unregisterFeed(req, res);
});

/**
 * PATCH /api/scraping/feeds/:feedId/enable
 * Enable/disable a feed
 */
router.patch('/feeds/:feedId/enable', express.json(), async (req, res) => {
  await scrapingController.setFeedEnabled(req, res);
});

/**
 * POST /api/scraping/feeds/:feedId/process
 * Manually trigger feed processing
 */
router.post('/feeds/:feedId/process', async (req, res) => {
  await scrapingController.processFeed(req, res);
});

/**
 * POST /api/scraping/process-all
 * Manually trigger processing of all enabled feeds
 */
router.post('/process-all', async (req, res) => {
  await scrapingController.processAllFeeds(req, res);
});

/**
 * GET /api/scraping/statistics
 * Get scraping statistics
 */
router.get('/statistics', async (req, res) => {
  await scrapingController.getStatistics(req, res);
});

export default router;
