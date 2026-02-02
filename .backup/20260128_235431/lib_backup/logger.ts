export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  maxLogHistory: number;
}

class Logger {
  private config: LoggerConfig;
  private logHistory: LogEntry[] = [];
  private context: Record<string, any> = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableRemote: false,
      maxLogHistory: 1000,
      ...config,
    };
  }

  /**
   * Set global context that will be included in all log entries
   */
  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear global context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    const errorContext = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    } : context;

    this.log(LogLevel.ERROR, message, errorContext);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (level < this.config.level) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
    };

    // Add to history
    this.logHistory.push(logEntry);
    if (this.logHistory.length > this.config.maxLogHistory) {
      this.logHistory.shift();
    }

    // Output to console
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    // Output to file (in production, this would write to actual files)
    if (this.config.enableFile) {
      this.outputToFile(logEntry);
    }

    // Send to remote logging service
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.outputToRemote(logEntry);
    }
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const contextStr = entry.context && Object.keys(entry.context).length > 0 
      ? ` ${JSON.stringify(entry.context)}` 
      : '';

    const logMessage = `[${entry.timestamp}] ${levelName}: ${entry.message}${contextStr}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
        console.error(logMessage);
        if (entry.context?.error?.stack) {
          console.error(entry.context.error.stack);
        }
        break;
    }
  }

  /**
   * Output log entry to file (mock implementation)
   */
  private outputToFile(entry: LogEntry): void {
    // In a real implementation, this would write to log files
    // For now, we'll just store in memory
    if (typeof window === 'undefined') {
      // Server-side: could write to actual files
      // fs.appendFileSync(`logs/${LogLevel[entry.level].toLowerCase()}.log`, JSON.stringify(entry) + '\n');
    }
  }

  /**
   * Send log entry to remote logging service
   */
  private async outputToRemote(entry: LogEntry): Promise<void> {
    try {
      if (this.config.remoteEndpoint) {
        await fetch(this.config.remoteEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry),
        });
      }
    } catch (error) {
      // Fallback to console if remote logging fails
      console.error('Failed to send log to remote endpoint:', error);
    }
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(limit?: number, level?: LogLevel): LogEntry[] {
    let logs = this.logHistory;

    if (level !== undefined) {
      logs = logs.filter(entry => entry.level >= level);
    }

    return limit ? logs.slice(-limit) : logs;
  }

  /**
   * Search logs by message or context
   */
  searchLogs(query: string, limit?: number): LogEntry[] {
    const results = this.logHistory.filter(entry => {
      const messageMatch = entry.message.toLowerCase().includes(query.toLowerCase());
      const contextMatch = entry.context && 
        JSON.stringify(entry.context).toLowerCase().includes(query.toLowerCase());
      return messageMatch || contextMatch;
    });

    return limit ? results.slice(-limit) : results;
  }

  /**
   * Get logs by tenant ID
   */
  getLogsByTenant(tenantId: string, limit?: number): LogEntry[] {
    const logs = this.logHistory.filter(entry => entry.tenantId === tenantId);
    return limit ? logs.slice(-limit) : logs;
  }

  /**
   * Get logs by user ID
   */
  getLogsByUser(userId: string, limit?: number): LogEntry[] {
    const logs = this.logHistory.filter(entry => entry.userId === userId);
    return limit ? logs.slice(-limit) : logs;
  }

  /**
   * Get logs by trace ID
   */
  getLogsByTrace(traceId: string): LogEntry[] {
    return this.logHistory.filter(entry => entry.traceId === traceId);
  }

  /**
   * Clear log history
   */
  clearLogs(): void {
    this.logHistory = [];
  }

  /**
   * Get log statistics
   */
  getLogStats(): {
    total: number;
    byLevel: Record<string, number>;
    recentErrors: LogEntry[];
    topErrors: Array<{ message: string; count: number }>;
  } {
    const byLevel: Record<string, number> = {};
    const errorMessages: Record<string, number> = {};
    const recentErrors: LogEntry[] = [];

    for (const entry of this.logHistory) {
      const levelName = LogLevel[entry.level];
      byLevel[levelName] = (byLevel[levelName] || 0) + 1;

      if (entry.level === LogLevel.ERROR) {
        recentErrors.push(entry);
        errorMessages[entry.message] = (errorMessages[entry.message] || 0) + 1;
      }
    }

    const topErrors = Object.entries(errorMessages)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: this.logHistory.length,
      byLevel,
      recentErrors: recentErrors.slice(-20),
      topErrors,
    };
  }
}

// Create default logger instance
export const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableFile: process.env.NODE_ENV === 'production',
  enableRemote: false, // Enable when remote logging endpoint is configured
});

// Utility functions for common logging patterns
export const auditLogger = logger.child({ category: 'audit' });
export const securityLogger = logger.child({ category: 'security' });
export const performanceLogger = logger.child({ category: 'performance' });

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(2, 15);
    
    // Add request ID to request object
    req.requestId = requestId;

    // Create request logger with context
    req.logger = logger.child({
      requestId,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    req.logger.info('Request started');

    // Override res.end to log completion
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const duration = Date.now() - startTime;
      
      req.logger.info('Request completed', {
        statusCode: res.statusCode,
        duration,
      });

      originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Error logging middleware
 */
export function errorLoggingMiddleware() {
  return (error: Error, req: any, res: any, next: any) => {
    const errorLogger = req.logger || logger;
    
    errorLogger.error('Request error', error, {
      statusCode: res.statusCode,
      method: req.method,
      path: req.path,
    });

    next(error);
  };
}