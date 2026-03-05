import { prisma } from '../utils/db';
import { logger } from '../utils/logger';

const WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_THRESHOLD = 10;

function getThreshold(): number {
  const v = process.env.TELEMETRY_ALERT_THRESHOLD;
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_THRESHOLD;
}

function getWebhookUrl(): string | null {
  const u = process.env.TELEMETRY_ALERT_WEBHOOK_URL;
  return u && typeof u === 'string' && u.startsWith('http') ? u : null;
}

/**
 * Check client error count in the last 15 minutes; log and optionally notify if over threshold.
 */
export async function runTelemetryAlert(): Promise<void> {
  const cutoff = new Date(Date.now() - WINDOW_MS);
  const threshold = getThreshold();
  const webhookUrl = getWebhookUrl();

  try {
    const count = await prisma.clientError.count({
      where: { createdAt: { gte: cutoff } },
    });

    if (count > threshold) {
      logger.warn('Telemetry alert: client errors in last 15 min exceed threshold', {
        count,
        threshold,
        windowMinutes: 15,
      });

      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `[Telemetry] Client errors in last 15 min: ${count} (threshold: ${threshold})`,
            }),
          });
        } catch (err) {
          logger.error('Telemetry alert webhook failed', err as Error, { webhookUrl: webhookUrl.slice(0, 50) });
        }
      }
    }
  } catch (err) {
    logger.error('Telemetry alert job failed', err as Error);
  }
}
