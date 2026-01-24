/**
 * Server-side structured logging utility
 * Provides consistent logging with levels, context, and optional file/remote logging
 */

import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  requestId?: string;
  userId?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;
  private logLevel: LogLevel;
  private enableFileLogging: boolean;
  private logDir: string;
  private enableRemoteLogging: boolean;
  private remoteLogEndpoint?: string;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.enableRemoteLogging = process.env.ENABLE_REMOTE_LOGGING === 'true';
    this.remoteLogEndpoint = process.env.LOG_ENDPOINT;

    // Create log directory if file logging is enabled
    if (this.enableFileLogging) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Get log file path for a date
   */
  private getLogFilePath(date: Date): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `app-${dateStr}.log`);
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Format log entry
   */
  private formatLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
  }

  /**
   * Format console message with emoji and color
   */
  private formatConsoleMessage(entry: LogEntry): string {
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    }[entry.level];

    const prefix = `${emoji} [${entry.level.toUpperCase()}]`;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const errorStr = entry.error ? `\n  Error: ${entry.error.name}: ${entry.error.message}` : '';
    const requestInfo = entry.requestId ? ` [Request: ${entry.requestId}]` : '';
    const durationStr = entry.duration ? ` (${entry.duration}ms)` : '';

    return `${prefix} [${timestamp}]${requestInfo}${durationStr} ${entry.message}${contextStr}${errorStr}`;
  }

  /**
   * Write log to file
   */
  private writeToFile(entry: LogEntry): void {
    if (!this.enableFileLogging) {
      return;
    }

    try {
      const logFilePath = this.getLogFilePath(new Date(entry.timestamp));
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(logFilePath, logLine, 'utf8');
    } catch (error) {
      // Silently fail file logging to avoid breaking the app
      console.error('Failed to write log to file:', error);
    }
  }

  /**
   * Send log to remote endpoint (if enabled)
   */
  private async sendRemoteLog(entry: LogEntry): Promise<void> {
    if (!this.enableRemoteLogging || !this.remoteLogEndpoint) {
      return;
    }

    try {
      const response = await fetch(this.remoteLogEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        console.warn(`Remote logging failed: ${response.statusText}`);
      }
    } catch (error) {
      // Silently fail remote logging to avoid breaking the app
      console.warn('Failed to send remote log:', error);
    }
  }

  /**
   * Core log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.formatLogEntry(level, message, context, error);

    // Console logging
    if (this.isDevelopment) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](this.formatConsoleMessage(entry));
      
      // In development, also log full entry for debugging
      if (level === 'error' || level === 'debug') {
        console[consoleMethod]('Full log entry:', entry);
      }
    } else if (this.isProduction && (level === 'error' || level === 'warn')) {
      // In production, only log errors and warnings to console
      const consoleMethod = level === 'error' ? 'error' : 'warn';
      console[consoleMethod](this.formatConsoleMessage(entry));
    }

    // File logging (synchronous, but non-blocking in practice)
    if (this.enableFileLogging) {
      this.writeToFile(entry);
    }

    // Remote logging (async, non-blocking)
    if (this.enableRemoteLogging) {
      this.sendRemoteLog(entry).catch(() => {
        // Silently fail
      });
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error);
  }

  /**
   * Log HTTP request
   */
  request(
    method: string,
    url: string,
    requestId: string,
    ip?: string,
    userId?: string,
    context?: LogContext
  ): void {
    this.debug(`Request: ${method} ${url}`, {
      ...context,
      requestId,
      method,
      url,
      ip,
      userId,
    });
  }

  /**
   * Log HTTP response
   */
  response(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    requestId: string,
    context?: LogContext
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const entry = this.formatLogEntry(level, `Response: ${method} ${url} - ${statusCode}`, {
      ...context,
      method,
      url,
      statusCode,
      duration,
      requestId,
    });

    // Add to entry for file/remote logging
    entry.statusCode = statusCode;
    entry.duration = duration;
    entry.requestId = requestId;

    this.log(level, entry.message, entry.context);
  }

  /**
   * Log database query
   */
  dbQuery(operation: string, table: string, duration?: number, context?: LogContext): void {
    this.debug(`DB Query: ${operation} on ${table}`, {
      ...context,
      operation,
      table,
      duration,
    });
  }

  /**
   * Log database error
   */
  dbError(operation: string, table: string, error: Error, context?: LogContext): void {
    this.error(`DB Error: ${operation} on ${table}`, error, {
      ...context,
      operation,
      table,
    });
  }

  /**
   * Log API call (external)
   */
  apiCall(provider: string, endpoint: string, duration?: number, context?: LogContext): void {
    this.debug(`API Call: ${provider} - ${endpoint}`, {
      ...context,
      provider,
      endpoint,
      duration,
    });
  }

  /**
   * Log API error (external)
   */
  apiError(provider: string, endpoint: string, error: Error, context?: LogContext): void {
    this.error(`API Error: ${provider} - ${endpoint}`, error, {
      ...context,
      provider,
      endpoint,
    });
  }

  /**
   * Log performance metric
   */
  performance(metric: string, duration: number, context?: LogContext): void {
    this.debug(`Performance: ${metric}`, {
      ...context,
      metric,
      duration,
      unit: 'ms',
    });
  }

  /**
   * Log security event
   */
  security(event: string, context?: LogContext): void {
    this.warn(`Security: ${event}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;
