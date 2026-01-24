/**
 * Test script for request logging middleware
 * This script simulates HTTP requests to test the request logger
 * Run with: tsx src/scripts/testRequestLogging.ts
 */

import express, { Express, Request, Response } from 'express';
import { requestLogger } from '../middleware/requestLogger';
import { logger as _logger } from '../utils/logger';

console.log('🧪 Testing Request Logging Middleware\n');

const app: Express = express();

// Apply request logger middleware
app.use(requestLogger);

// Test routes
app.get('/test/success', (req: Request, res: Response) => {
  res.json({ message: 'Success', requestId: req.requestId });
});

app.get('/test/error', (req: Request, res: Response) => {
  res.status(500).json({ error: 'Internal server error', requestId: req.requestId });
});

app.post('/test/post', (req: Request, res: Response) => {
  res.status(201).json({ message: 'Created', requestId: req.requestId, body: req.body });
});

app.get('/test/slow', async (req: Request, res: Response) => {
  // Simulate slow request
  await new Promise((resolve) => setTimeout(resolve, 1000));
  res.json({ message: 'Slow response', requestId: req.requestId, duration: 1000 });
});

app.get('/test/not-found', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', requestId: req.requestId });
});

// Start test server
const PORT = 3002;
const server = app.listen(PORT, async () => {
  console.log(`✅ Test server started on port ${PORT}\n`);

  const baseUrl = `http://localhost:${PORT}`;

  // Test 1: Successful GET request
  console.log('1. Testing successful GET request:');
  try {
    const response = await fetch(`${baseUrl}/test/success`);
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data)}\n`);
  } catch (error) {
    console.error('   Error:', error);
  }

  // Wait a bit between requests
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Test 2: Error response
  console.log('2. Testing error response (500):');
  try {
    const response = await fetch(`${baseUrl}/test/error`);
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data)}\n`);
  } catch (error) {
    console.error('   Error:', error);
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Test 3: POST request
  console.log('3. Testing POST request:');
  try {
    const response = await fetch(`${baseUrl}/test/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data', userId: 'user-123' }),
    });
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data)}\n`);
  } catch (error) {
    console.error('   Error:', error);
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Test 4: Slow request
  console.log('4. Testing slow request (>1s):');
  try {
    const startTime = Date.now();
    const response = await fetch(`${baseUrl}/test/slow`);
    const duration = Date.now() - startTime;
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data)}`);
    console.log(`   Actual duration: ${duration}ms\n`);
  } catch (error) {
    console.error('   Error:', error);
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Test 5: Not found
  console.log('5. Testing 404 response:');
  try {
    const response = await fetch(`${baseUrl}/test/not-found`);
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data)}\n`);
  } catch (error) {
    console.error('   Error:', error);
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Test 6: Multiple concurrent requests
  console.log('6. Testing concurrent requests:');
  try {
    const promises = Array.from({ length: 5 }, (_, i) =>
      fetch(`${baseUrl}/test/success?index=${i}`)
    );
    const responses = await Promise.all(promises);
    console.log(`   Completed ${responses.length} concurrent requests\n`);
  } catch (error) {
    console.error('   Error:', error);
  }

  console.log('✅ Request logging tests completed!');
  console.log('Check the console output above to verify request/response logging.');
  console.log('Each request should have a unique requestId and timing information.\n');

  // Close server
  server.close(() => {
    console.log('Test server closed.');
    process.exit(0);
  });
});
