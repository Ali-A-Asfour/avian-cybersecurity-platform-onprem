/**
 * Monitoring Middleware
 * 
 * Automatically tracks HTTP requests, errors, and performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitoring } from '@/lib/monitoring';

/**
 * Wrap an API route handler with monitoring
 */
export function withMonitoring(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const start = Date.now();
    const method = request.method;
    const path = new URL(request.url).pathname;

    try {
      // Execute handler
      const response = await handler(request);
      const duration = Date.now() - start;

      // Record metrics
      monitoring.recordHttpRequest(
        method,
        path,
        response.status,
        duration
      );

      return response;
    } catch (error) {
      const duration = Date.now() - start;

      // Record error metrics
      monitoring.recordHttpRequest(method, path, 500, duration);

      // Track error
      await monitoring.trackError({
        error: error as Error,
        context: {
          method,
          path,
          duration,
        },
      });

      // Re-throw error
      throw error;
    }
  };
}

/**
 * Create a monitored API route handler
 */
export function monitoredRoute(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return withMonitoring(handler);
}
