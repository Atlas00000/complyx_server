import { logger } from '../utils/logger';

export type JobFn = () => Promise<void> | void;

export interface ScheduledJob {
  name: string;
  intervalMs: number;
  run: JobFn;
}

const jobs: ScheduledJob[] = [];
let started = false;

/**
 * Register a periodic job. Jobs will only start running when startJobs() is called.
 */
export function registerJob(job: ScheduledJob): void {
  jobs.push(job);
}

/**
 * Start all registered jobs using setInterval. Intended to be called once from server bootstrap.
 */
export function startJobs(): void {
  if (started) {
    return;
  }
  started = true;

  for (const job of jobs) {
    logger.info('Starting scheduled job', { job: job.name, intervalMs: job.intervalMs });

    // Run once on startup
    void executeJob(job);

    // Run on interval
    setInterval(() => {
      void executeJob(job);
    }, job.intervalMs);
  }
}

async function executeJob(job: ScheduledJob): Promise<void> {
  const start = Date.now();
  try {
    await job.run();
    const duration = Date.now() - start;
    logger.info('Scheduled job completed', { job: job.name, durationMs: duration });
  } catch (err) {
    const duration = Date.now() - start;
    logger.error('Scheduled job failed', err as Error, {
      job: job.name,
      durationMs: duration,
    });
  }
}

