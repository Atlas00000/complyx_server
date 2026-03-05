import { prisma } from '../utils/db';
import { logger } from '../utils/logger';

const DEFAULT_AUDIT_DAYS = 18 * 30;
const DEFAULT_CHAT_DAYS = 12 * 30;
const DEFAULT_ASSESSMENT_DAYS = 24 * 30;
const DEFAULT_CLIENT_ERROR_DAYS = 30;
const DEFAULT_CLIENT_LOG_DAYS = 30;

export interface RetentionConfig {
  auditLogDays: number;
  chatDays: number;
  assessmentDays: number;
  clientErrorDays: number;
  clientLogDays: number;
}

export function getRetentionConfig(): RetentionConfig {
  return {
    auditLogDays: Math.max(1, parseInt(process.env.RETENTION_AUDIT_LOG_DAYS ?? String(DEFAULT_AUDIT_DAYS), 10) || DEFAULT_AUDIT_DAYS),
    chatDays: Math.max(1, parseInt(process.env.RETENTION_CHAT_DAYS ?? String(DEFAULT_CHAT_DAYS), 10) || DEFAULT_CHAT_DAYS),
    assessmentDays: Math.max(1, parseInt(process.env.RETENTION_ASSESSMENT_DAYS ?? String(DEFAULT_ASSESSMENT_DAYS), 10) || DEFAULT_ASSESSMENT_DAYS),
    clientErrorDays: Math.max(1, parseInt(process.env.RETENTION_CLIENT_ERROR_DAYS ?? String(DEFAULT_CLIENT_ERROR_DAYS), 10) || DEFAULT_CLIENT_ERROR_DAYS),
    clientLogDays: Math.max(1, parseInt(process.env.RETENTION_CLIENT_LOG_DAYS ?? String(DEFAULT_CLIENT_LOG_DAYS), 10) || DEFAULT_CLIENT_LOG_DAYS),
  };
}

export function isRetentionCleanupEnabled(): boolean {
  const v = process.env.RETENTION_CLEANUP_ENABLED;
  if (v === 'false' || v === '0') return false;
  return true;
}

export async function runRetentionCleanup(): Promise<void> {
  if (!isRetentionCleanupEnabled()) {
    logger.info('Retention cleanup skipped (RETENTION_CLEANUP_ENABLED is false)');
    return;
  }
  const config = getRetentionConfig();
  const now = new Date();

  const cutoffAudit = new Date(now);
  cutoffAudit.setDate(cutoffAudit.getDate() - config.auditLogDays);

  const cutoffChat = new Date(now);
  cutoffChat.setDate(cutoffChat.getDate() - config.chatDays);

  const cutoffAssessment = new Date(now);
  cutoffAssessment.setDate(cutoffAssessment.getDate() - config.assessmentDays);

  const cutoffClientError = new Date(now);
  cutoffClientError.setDate(cutoffClientError.getDate() - config.clientErrorDays);

  const cutoffClientLog = new Date(now);
  cutoffClientLog.setDate(cutoffClientLog.getDate() - config.clientLogDays);

  let auditDeleted = 0;
  let chatSessionsDeleted = 0;
  let assessmentsDeleted = 0;
  let clientErrorsDeleted = 0;
  let clientLogsDeleted = 0;

  try {
    const auditResult = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoffAudit } },
    });
    auditDeleted = auditResult.count;
    logger.info('Retention cleanup: audit logs', { deleted: auditDeleted, cutoff: cutoffAudit.toISOString() });
  } catch (err) {
    logger.error('Retention cleanup: audit logs failed', err as Error, { cutoff: cutoffAudit.toISOString() });
    throw err;
  }

  try {
    const chatResult = await prisma.chatSession.deleteMany({
      where: {
        OR: [
          { lastMessageAt: { lt: cutoffChat } },
          { lastMessageAt: null, createdAt: { lt: cutoffChat } },
        ],
      },
    });
    chatSessionsDeleted = chatResult.count;
    if (chatSessionsDeleted > 0) {
      logger.info('Retention cleanup: chat sessions', { deleted: chatSessionsDeleted, cutoff: cutoffChat.toISOString() });
    }
  } catch (err) {
    logger.error('Retention cleanup: chat sessions failed', err as Error, { cutoff: cutoffChat.toISOString() });
    throw err;
  }

  try {
    const assessmentResult = await prisma.assessment.deleteMany({
      where: {
        OR: [
          { completedAt: { lt: cutoffAssessment } },
          { completedAt: null, createdAt: { lt: cutoffAssessment } },
        ],
      },
    });
    assessmentsDeleted = assessmentResult.count;
    if (assessmentsDeleted > 0) {
      logger.info('Retention cleanup: assessments', { deleted: assessmentsDeleted, cutoff: cutoffAssessment.toISOString() });
    }
  } catch (err) {
    logger.error('Retention cleanup: assessments failed', err as Error, { cutoff: cutoffAssessment.toISOString() });
    throw err;
  }

  try {
    const clientErrorResult = await prisma.clientError.deleteMany({
      where: { createdAt: { lt: cutoffClientError } },
    });
    clientErrorsDeleted = clientErrorResult.count;
    if (clientErrorsDeleted > 0) {
      logger.info('Retention cleanup: client errors', { deleted: clientErrorsDeleted, cutoff: cutoffClientError.toISOString() });
    }
  } catch (err) {
    logger.error('Retention cleanup: client errors failed', err as Error, { cutoff: cutoffClientError.toISOString() });
    throw err;
  }

  try {
    const clientLogResult = await prisma.clientLog.deleteMany({
      where: { createdAt: { lt: cutoffClientLog } },
    });
    clientLogsDeleted = clientLogResult.count;
    if (clientLogsDeleted > 0) {
      logger.info('Retention cleanup: client logs', { deleted: clientLogsDeleted, cutoff: cutoffClientLog.toISOString() });
    }
  } catch (err) {
    logger.error('Retention cleanup: client logs failed', err as Error, { cutoff: cutoffClientLog.toISOString() });
    throw err;
  }

  logger.info('Retention cleanup completed', {
    auditLogs: auditDeleted,
    chatSessions: chatSessionsDeleted,
    assessments: assessmentsDeleted,
    clientErrors: clientErrorsDeleted,
    clientLogs: clientLogsDeleted,
  });
}
