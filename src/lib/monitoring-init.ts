import { performanceMonitor } from './performance-monitor';
// import { logger } from './logger';

/**
 * Initialize monitoring services
 */
export function initializeMonitoring(): void {
  try {
    // Start performance monitoring
    performanceMonitor.start(30); // 30 second intervals

    logger.info('Monitoring services initialized', {
      performanceMonitoring: true,
      logLevel: process.env.NODE_ENV === 'development' ? 'DEBUG' : 'INFO',
    });
  } catch {
    logger.error('Failed to initialize monitoring services', error instanceof Error ? error : undefined);
  }
}

/**
 * Shutdown monitoring services gracefully
 */
export function shutdownMonitoring(): void {
  try {
    performanceMonitor.stop();
    logger.info('Monitoring services shut down');
  } catch {
    logger.error('Error during monitoring shutdown', error instanceof Error ? error : undefined);
  }
}

// Auto-initialize in server environments
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  initializeMonitoring();

  // Graceful shutdown
  process.on('SIGTERM', shutdownMonitoring);
  process.on('SIGINT', shutdownMonitoring);
}