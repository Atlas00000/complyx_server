/**
 * Integration test for logging system
 * Tests both client and server logging together
 * Run with: tsx src/scripts/testLoggingIntegration.ts
 */

import { logger } from '../utils/logger';
import express, { Express, Request, Response } from 'express';
import { requestLogger } from '../middleware/requestLogger';

console.log('🧪 Testing Logging Integration\n');

const app: Express = express();
app.use(express.json());
app.use(requestLogger);

// Simulate API endpoint
app.get('/api/test', (req: Request, res: Response) => {
  logger.info('Processing test request', { requestId: req.requestId });
  res.json({ message: 'Success', requestId: req.requestId });
});

app.post('/api/test', (req: Request, res: Response) => {
  logger.info('Processing POST test request', { 
    requestId: req.requestId,
    body: req.body 
  });
  res.status(201).json({ message: 'Created', requestId: req.requestId });
});

const PORT = 3003;
const server = app.listen(PORT, async () => {
  console.log(`✅ Integration test server started on port ${PORT}\n`);

  const baseUrl = `http://localhost:${PORT}`;

  try {
    // Test 1: Basic request/response logging
    console.log('1. Testing basic request/response logging:');
    const response1 = await fetch(`${baseUrl}/api/test`);
    const data1 = await response1.json();
    console.log(`   Response: ${JSON.stringify(data1)}\n`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Test 2: POST request with body
    console.log('2. Testing POST request with body:');
    const response2 = await fetch(`${baseUrl}/api/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data', userId: 'user-123' }),
    });
    const data2 = await response2.json();
    console.log(`   Response: ${JSON.stringify(data2)}\n`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Test 3: Error scenario
    console.log('3. Testing error logging:');
    try {
      await fetch(`${baseUrl}/api/error`);
    } catch (error) {
      logger.error('Request failed', error instanceof Error ? error : new Error(String(error)), {
        endpoint: '/api/error',
      });
    }

    console.log('\n✅ Integration tests completed!');
    console.log('Check the console output above to verify:');
    console.log('  - Request logging with unique IDs');
    console.log('  - Response logging with status codes and timing');
    console.log('  - Error logging with context');
    console.log('  - All logs should have proper formatting and context\n');

  } catch (error) {
    console.error('Integration test error:', error);
  } finally {
    server.close(() => {
      console.log('Integration test server closed.');
      process.exit(0);
    });
  }
});
