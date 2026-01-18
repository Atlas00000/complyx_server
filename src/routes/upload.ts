import express, { Router } from 'express';
import { uploadController } from '../controllers/uploadController';
import { uploadMiddleware } from '../middleware/uploadMiddleware';

const router = Router();

/**
 * POST /api/upload
 * Upload a single file for ingestion
 */
router.post(
  '/',
  uploadMiddleware.getUploadMiddleware('file', 1),
  async (req, res) => {
    await uploadController.uploadFile(req as any, res);
  }
);

/**
 * POST /api/upload/bulk
 * Upload multiple files for bulk ingestion
 */
router.post(
  '/bulk',
  uploadMiddleware.getBulkUploadMiddleware('files', 10),
  async (req, res) => {
    await uploadController.uploadBulk(req as any, res);
  }
);

/**
 * POST /api/upload/url
 * Ingest content from a URL
 */
router.post(
  '/url',
  express.json(),
  async (req, res) => {
    await uploadController.uploadURL(req, res);
  }
);

export default router;
