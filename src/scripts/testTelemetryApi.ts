/**
 * Test script for telemetry API (client errors & logs).
 * Run with: pnpm test:telemetry-api (or tsx src/scripts/testTelemetryApi.ts)
 * Requires: DB and env (e.g. DATABASE_URL). Does not require server to be running.
 */

import { reportError, ingestLog, getErrors } from '../controllers/telemetryController';
import type { Request, Response } from 'express';

function mockRes(): Response & { statusCode: number; body: unknown } {
  const out = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      out.statusCode = code;
      return out as unknown as Response;
    },
    json(data: unknown) {
      out.body = data;
      return out as unknown as Response;
    },
    send() {
      return out as unknown as Response;
    },
    setHeader: () => out as unknown as Response,
    getHeader: () => undefined,
    sendStatus: () => out as unknown as Response,
  };
  return out as unknown as Response & { statusCode: number; body: unknown };
}

function mockReq(options: { body?: unknown; query?: Record<string, string>; user?: { userId: string } }): Request {
  return {
    body: options.body ?? {},
    query: options.query ?? {},
    user: options.user,
  } as unknown as Request;
}

async function run() {
  console.log('Telemetry API tests');
  console.log('='.repeat(50));

  let passed = 0;
  let failed = 0;

  // 1. reportError – missing message -> 400
  const res1 = mockRes();
  await reportError(mockReq({ body: {} }), res1 as Response);
  if (res1.statusCode === 400 && (res1.body as { error?: string })?.error?.includes('message')) {
    console.log('  OK  reportError: missing message returns 400');
    passed++;
  } else {
    console.log('  FAIL reportError: expected 400, got', res1.statusCode, res1.body);
    failed++;
  }

  // 2. reportError – valid body -> 204
  const res2 = mockRes();
  await reportError(
    mockReq({
      body: {
        message: 'Test error from testTelemetryApi',
        code: 'TEST',
        url: 'http://localhost:3000/test',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        level: 'error',
      },
    }),
    res2 as Response
  );
  if (res2.statusCode === 204) {
    console.log('  OK  reportError: valid body returns 204');
    passed++;
  } else {
    console.log('  FAIL reportError: expected 204, got', res2.statusCode, res2.body);
    failed++;
  }

  // 3. ingestLog – empty entries -> 204
  const res3 = mockRes();
  await ingestLog(mockReq({ body: { entries: [] } }), res3 as Response);
  if (res3.statusCode === 204) {
    console.log('  OK  ingestLog: empty entries returns 204');
    passed++;
  } else {
    console.log('  FAIL ingestLog: expected 204, got', res3.statusCode, res3.body);
    failed++;
  }

  // 4. ingestLog – valid entries -> 204
  const res4 = mockRes();
  await ingestLog(
    mockReq({
      body: {
        entries: [
          { level: 'info', message: 'Test log entry', timestamp: new Date().toISOString(), context: { isMobile: true } },
        ],
      },
    }),
    res4 as Response
  );
  if (res4.statusCode === 204) {
    console.log('  OK  ingestLog: valid entries returns 204');
    passed++;
  } else {
    console.log('  FAIL ingestLog: expected 204, got', res4.statusCode, res4.body);
    failed++;
  }

  // 5. getErrors – no query -> 200 and errors array
  const res5 = mockRes();
  await getErrors(mockReq({ query: {} }), res5 as Response);
  const data5 = res5.body as { errors?: unknown[] };
  if (res5.statusCode === 200 && Array.isArray(data5?.errors)) {
    console.log('  OK  getErrors: returns 200 with errors array (length ' + data5.errors.length + ')');
    passed++;
  } else {
    console.log('  FAIL getErrors: expected 200 and { errors }, got', res5.statusCode, res5.body);
    failed++;
  }

  // 6. getErrors – with level and mobile
  const res6 = mockRes();
  await getErrors(
    mockReq({ query: { level: 'error', mobile: 'true', limit: '5' } }),
    res6 as Response
  );
  if (res6.statusCode === 200 && Array.isArray((res6.body as { errors?: unknown[] })?.errors)) {
    console.log('  OK  getErrors: with level & mobile returns 200');
    passed++;
  } else {
    console.log('  FAIL getErrors: with filters got', res6.statusCode, res6.body);
    failed++;
  }

  console.log('='.repeat(50));
  console.log(`Result: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
