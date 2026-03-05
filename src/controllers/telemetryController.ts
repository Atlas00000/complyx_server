import { Request, Response } from 'express';
import { prisma } from '../utils/db';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_STACK_LENGTH = 5000;
const MAX_LOG_MESSAGE_LENGTH = 2000;
const MAX_LOG_LEVEL_LENGTH = 50;
const MAX_LOG_ENTRIES = 50;

export interface ReportErrorBody {
  message: string;
  stack?: string;
  code?: string;
  url?: string;
  userAgent?: string;
  userId?: string;
  level?: string;
}

/**
 * POST /api/telemetry/error
 * Accepts client-side error reports and stores them for visibility (e.g. from mobile).
 * Auth optional; userId can come from body or req.user if authenticated.
 * Returns 204 on success.
 */
export async function reportError(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as ReportErrorBody;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const userId = (req as Request & { user?: { userId: string } }).user?.userId ?? body.userId ?? null;
    const stack = typeof body.stack === 'string' ? body.stack.slice(0, MAX_STACK_LENGTH) : null;
    const code = typeof body.code === 'string' ? body.code.slice(0, 200) : null;
    const url = typeof body.url === 'string' ? body.url.slice(0, 2000) : null;
    const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : null;
    const level = typeof body.level === 'string' ? body.level.slice(0, 50) : null;

    await prisma.clientError.create({
      data: {
        message: message.slice(0, MAX_MESSAGE_LENGTH),
        stack,
        code,
        url,
        userAgent,
        userId,
        level,
      },
    });

    res.status(204).send();
  } catch (err) {
    console.error('Telemetry reportError:', err);
    res.status(500).json({ error: 'Failed to store error report' });
  }
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp?: string;
  context?: unknown;
}

export interface IngestLogBody {
  entries?: LogEntry[];
}

/**
 * POST /api/telemetry/log
 * Accepts batches of client log entries. Rate limit should be applied at route level.
 * Returns 204 on success.
 */
export async function ingestLog(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as IngestLogBody;
    const raw = Array.isArray(body?.entries) ? body.entries : [];

    if (raw.length === 0) {
      res.status(204).send();
      return;
    }

    const entries = raw.slice(0, MAX_LOG_ENTRIES).map((e) => ({
      level: typeof e.level === 'string' ? e.level.slice(0, MAX_LOG_LEVEL_LENGTH) : 'info',
      message: typeof e.message === 'string' ? e.message.slice(0, MAX_LOG_MESSAGE_LENGTH) : String(e.message ?? '').slice(0, MAX_LOG_MESSAGE_LENGTH),
      context: e.context !== undefined && e.context !== null ? e.context : undefined,
    }));

    await prisma.clientLog.createMany({
      data: entries.map((e) => ({
        level: e.level,
        message: e.message,
        context: e.context ?? undefined,
      })),
    });

    res.status(204).send();
  } catch (err) {
    console.error('Telemetry ingestLog:', err);
    res.status(500).json({ error: 'Failed to store log entries' });
  }
}

const DEFAULT_ERRORS_LIMIT = 100;
const MAX_ERRORS_LIMIT = 500;

const MOBILE_USER_AGENT_PATTERNS = ['Mobile', 'Android', 'iPhone', 'iPad', 'webOS'];

/**
 * GET /api/telemetry/errors
 * Returns recent client errors for viewing (e.g. admin). Optional query: limit, level, from, to, mobile.
 */
export async function getErrors(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(
      Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_ERRORS_LIMIT),
      MAX_ERRORS_LIMIT
    );
    const level = typeof req.query.level === 'string' ? req.query.level : undefined;
    const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
    const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
    const mobileOnly = req.query.mobile === 'true' || req.query.mobile === '1';

    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if (fromRaw && isNaN(from!.getTime())) {
      res.status(400).json({ error: 'Invalid from date' });
      return;
    }
    if (toRaw && isNaN(to!.getTime())) {
      res.status(400).json({ error: 'Invalid to date' });
      return;
    }

    const where: Record<string, unknown> = {};
    if (level) where.level = level;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, Date>).gte = from;
      if (to) (where.createdAt as Record<string, Date>).lte = to;
    }
    if (mobileOnly) {
      where.OR = MOBILE_USER_AGENT_PATTERNS.map((pattern) => ({
        userAgent: { contains: pattern, mode: 'insensitive' as const },
      }));
    }

    const errors = await prisma.clientError.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({ errors });
  } catch (err) {
    console.error('Telemetry getErrors:', err);
    res.status(500).json({ error: 'Failed to list errors' });
  }
}
