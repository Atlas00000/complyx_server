import { registerJob } from './scheduler';
import { runRetentionCleanup } from './retentionCleanupJob';
import { runTelemetryAlert } from './telemetryAlertJob';

const RETENTION_JOB_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TELEMETRY_ALERT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

registerJob({
  name: 'retention-cleanup',
  intervalMs: RETENTION_JOB_INTERVAL_MS,
  run: runRetentionCleanup,
});

registerJob({
  name: 'telemetry-alert',
  intervalMs: TELEMETRY_ALERT_INTERVAL_MS,
  run: runTelemetryAlert,
});
