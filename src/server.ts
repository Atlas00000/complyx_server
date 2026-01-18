import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupRoutes } from './routes';
import {
  securityHeaders,
  apiLimiter,
  authLimiter,
  adminLimiter,
  chatLimiter,
  sanitizeInput,
  xssProtection,
  securityLogger,
  securityErrorHandler,
  corsConfig,
} from './middleware/security';

// Load .env file - dotenv will look for .env in current working directory and parent directories
dotenv.config();

// Verify GEMINI_API_KEY is loaded (for debugging)
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  WARNING: GEMINI_API_KEY is not set in environment variables');
} else {
  console.log(`✅ GEMINI_API_KEY loaded (length: ${process.env.GEMINI_API_KEY.length})`);
}

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Security middleware (apply early)
app.use(securityHeaders);
app.use(securityLogger);
app.use(sanitizeInput);
app.use(xssProtection);

// CORS configuration
app.use(cors(corsConfig));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - apply general limiter to all routes
app.use('/api', apiLimiter);

// Specific rate limiters for sensitive endpoints
app.use('/api/auth', authLimiter);
app.use('/api/admin', adminLimiter);
app.use('/api/chat', chatLimiter);

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Complyx API Server is running' });
});

// API routes
app.get('/api', (_req: Request, res: Response) => {
  res.json({ message: 'Complyx API' });
});

// Setup application routes
setupRoutes(app);

// Initialize default roles and permissions on startup
(async () => {
  try {
    const { rbacService } = await import('./services/auth/rbacService');
    await rbacService.initializeDefaultRolesAndPermissions();
    console.log('✅ Default roles and permissions initialized');
  } catch (error) {
    console.error('⚠️  Failed to initialize roles and permissions:', error);
  }
})();

// Error handling middleware (must be last)
app.use(securityErrorHandler);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔒 Security middleware enabled`);
});
