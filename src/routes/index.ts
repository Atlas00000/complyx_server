import { Express } from 'express';
import chatRoutes from './chat';
import questionRoutes from './question';
import assessmentRoutes from './assessment';
import complianceRoutes from './compliance';
import aiFeaturesRoutes from './aiFeatures';
import knowledgeRoutes from './knowledge';
import uploadRoutes from './upload';
import scrapingRoutes from './scraping';
import authRoutes from './auth';
import adminRoutes from './admin';
import dashboardRoutes from './dashboard';

export const setupRoutes = (app: Express): void => {
  // Authentication API routes
  app.use('/api/auth', authRoutes);
  
  // Admin API routes
  app.use('/api/admin', adminRoutes);
  
  // Chat API routes
  app.use('/api/chat', chatRoutes);
  
  // Question API routes
  app.use('/api/questions', questionRoutes);
  
  // Assessment API routes
  app.use('/api/assessment', assessmentRoutes);
  
  // Compliance API routes
  app.use('/api/compliance', complianceRoutes);
  
  // AI Features API routes
  app.use('/api/ai', aiFeaturesRoutes);
  
  // Knowledge Base API routes
  app.use('/api/knowledge', knowledgeRoutes);
  
  // Upload API routes
  app.use('/api/upload', uploadRoutes);
  
  // Scraping API routes
  app.use('/api/scraping', scrapingRoutes);
  
  // Dashboard API routes
  app.use('/api/dashboard', dashboardRoutes);
};
