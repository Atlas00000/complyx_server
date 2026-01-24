/**
 * Test script for server-side logging
 * Run with: tsx src/scripts/testLogging.ts
 * 
 * Set environment variables for testing:
 * - NODE_ENV=development (to see all logs)
 * - LOG_LEVEL=debug (to see debug logs)
 * - ENABLE_FILE_LOGGING=true (to test file logging)
 */

// Ensure NODE_ENV is set for development logging
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

import { logger } from '../utils/logger';

console.log('🧪 Testing Server-Side Logging\n');
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Log Level: ${process.env.LOG_LEVEL || 'info'}\n`);

// Test basic logging levels
console.log('1. Testing Basic Log Levels:');
logger.debug('Debug message', { test: 'debug', value: 123 });
logger.info('Info message', { test: 'info', value: 456 });
logger.warn('Warning message', { test: 'warn', value: 789 });
logger.error('Error message', new Error('Test error'), { test: 'error', value: 999 });

console.log('\n2. Testing HTTP Request/Response Logging:');
const requestId = 'req-' + Date.now();
logger.request('GET', '/api/dashboard/score', requestId, '192.168.1.1', 'user-123', {
  query: { assessmentId: 'assess-456' },
});
logger.response('GET', '/api/dashboard/score', 200, 150, requestId, {
  userId: 'user-123',
  dataSize: 1024,
});

logger.request('POST', '/api/auth/login', 'req-' + (Date.now() + 1), '192.168.1.2', undefined, {
  body: { email: 'test@example.com' },
});
logger.response('POST', '/api/auth/login', 401, 50, 'req-' + (Date.now() + 1), {
  reason: 'Invalid credentials',
});

console.log('\n3. Testing Database Logging:');
logger.dbQuery('SELECT', 'users', 45, { where: { id: 'user-123' } });
logger.dbQuery('INSERT', 'assessments', 120, { data: { userId: 'user-123' } });
logger.dbQuery('UPDATE', 'answers', 78, { where: { id: 'answer-456' } });
logger.dbError('SELECT', 'users', new Error('Connection timeout'), {
  query: 'SELECT * FROM users',
  retries: 3,
});

console.log('\n4. Testing External API Logging:');
logger.apiCall('gemini', '/v1/models', 234, { model: 'gemini-pro' });
logger.apiCall('openai', '/v1/chat/completions', 567, { model: 'gpt-4' });
logger.apiError('gemini', '/v1/generate', new Error('API rate limit exceeded'), {
  retries: 3,
  waitTime: 60000,
});

console.log('\n5. Testing Performance Logging:');
logger.performance('query_execution', 45, { table: 'users', operation: 'SELECT' });
logger.performance('api_call', 234, { provider: 'gemini', endpoint: '/v1/models' });
logger.performance('data_processing', 1234, { records: 1000, operation: 'transform' });

console.log('\n6. Testing Security Logging:');
logger.security('Failed login attempt', {
  ip: '192.168.1.100',
  email: 'test@example.com',
  reason: 'Invalid password',
});
logger.security('Rate limit exceeded', {
  ip: '192.168.1.101',
  endpoint: '/api/chat',
  limit: 20,
  current: 25,
});
logger.security('Suspicious activity detected', {
  userId: 'user-123',
  action: 'bulk_delete',
  count: 1000,
});

console.log('\n7. Testing Error Scenarios:');
try {
  throw new Error('Simulated database error');
} catch (error) {
  logger.error('Caught error in test', error instanceof Error ? error : new Error(String(error)), {
    test: 'error-handling',
    context: 'test-script',
  });
}

console.log('\n8. Testing Complex Context Logging:');
logger.info('Complex context logging', {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin',
  },
  request: {
    method: 'POST',
    endpoint: '/api/assessment',
    timestamp: new Date().toISOString(),
  },
  database: {
    query: 'SELECT * FROM assessments',
    duration: 45,
    rows: 10,
  },
  metadata: {
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
});

console.log('\n9. Testing File Logging (if enabled):');
if (process.env.ENABLE_FILE_LOGGING === 'true') {
  logger.info('This log should be written to file', {
    test: 'file-logging',
    timestamp: new Date().toISOString(),
  });
  console.log('✅ Check the logs directory for file output');
} else {
  console.log('ℹ️  File logging is disabled. Set ENABLE_FILE_LOGGING=true to test');
}

console.log('\n✅ Server-side logging tests completed!');
console.log('Check the console output above to verify all log levels and formats.');
if (process.env.ENABLE_FILE_LOGGING === 'true') {
  console.log('Also check the logs directory for file output.');
}
