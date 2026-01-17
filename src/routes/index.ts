import { Express } from 'express';
import chatRoutes from './chat';
import questionRoutes from './question';
import assessmentRoutes from './assessment';
import complianceRoutes from './compliance';
import aiFeaturesRoutes from './aiFeatures';
import knowledgeRoutes from './knowledge';

export const setupRoutes = (app: Express): void => {
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
};
