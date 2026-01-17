import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupRoutes } from './routes';

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
