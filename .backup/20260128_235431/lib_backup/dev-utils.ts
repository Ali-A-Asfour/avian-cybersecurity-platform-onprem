/**
 * Development utilities for faster development experience
 */

export const isDevelopment = process.env.NODE_ENV === 'development';
export const isFastDevMode = process.env.FAST_DEV_MODE === 'true';
export const shouldSkipApiCalls = process.env.SKIP_API_CALLS === 'true';
export const shouldBypassAuth = process.env.BYPASS_AUTH === 'true';

/**
 * Mock data generator for development
 */
export function generateMockData<T>(type: string, count: number = 10): T[] {
  const mockData: Record<string, any> = {
    tickets: Array.from({ length: count }, (_, i) => ({
      id: `ticket-${i + 1}`,
      title: `Sample Ticket ${i + 1}`,
      status: ['open', 'in_progress', 'resolved', 'closed'][i % 4],
      priority: ['low', 'medium', 'high', 'critical'][i % 4],
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      updated_at: new Date(Date.now() - i * 3600000).toISOString(),
    })),
    alerts: Array.from({ length: count }, (_, i) => ({
      id: `alert-${i + 1}`,
      title: `Security Alert ${i + 1}`,
      severity: ['low', 'medium', 'high', 'critical'][i % 4],
      status: ['active', 'investigating', 'resolved'][i % 3],
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
    })),
    agents: Array.from({ length: count }, (_, i) => ({
      id: `agent-${i + 1}`,
      name: `Agent ${i + 1}`,
      status: i % 10 === 0 ? 'offline' : 'online',
      last_seen: new Date(Date.now() - i * 60000).toISOString(),
      version: '1.0.0',
    })),
    assets: Array.from({ length: count }, (_, i) => ({
      id: `asset-${i + 1}`,
      name: `Asset ${i + 1}`,
      type: ['server', 'workstation', 'network_device', 'mobile'][i % 4],
      status: ['active', 'inactive', 'maintenance'][i % 3],
      last_scan: new Date(Date.now() - i * 86400000).toISOString(),
    })),
  };

  return mockData[type] || [];
}

/**
 * Fast API response for development
 */
export function createMockApiResponse<T>(data: T, delay: number = 0): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
}

/**
 * Development performance logger
 */
export function logPerformance(label: string, startTime: number) {
  if (isDevelopment) {
    const duration = Date.now() - startTime;
    console.log(`🚀 [${label}] ${duration}ms`);
  }
}

/**
 * Skip API call in development mode
 */
export function skipApiCall<T>(mockData: T): Promise<{ success: boolean; data: T }> {
  if (shouldSkipApiCalls && isDevelopment) {
    return createMockApiResponse({ success: true, data: mockData }, 50);
  }
  throw new Error('Not in skip mode');
}

/**
 * Development mode wrapper for API calls
 */
export async function devApiCall<T>(
  apiCall: () => Promise<T>,
  mockData: T,
  label?: string
): Promise<T> {
  const startTime = Date.now();
  
  try {
    if (shouldSkipApiCalls && isDevelopment) {
      const _result = await createMockApiResponse(mockData, 50);
      if (label) logPerformance(`${label} (mock)`, startTime);
      return result;
    }
    
    const _result = await apiCall();
    if (label) logPerformance(label, startTime);
    return result;
  } catch (error) {
    if (isDevelopment) {
      console.warn(`API call failed, using mock data for ${label}:`, error);
      return await createMockApiResponse(mockData, 50);
    }
    throw error;
  }
}