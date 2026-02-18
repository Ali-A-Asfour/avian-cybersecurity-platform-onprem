/**
 * API Client Utility
 * Handles authenticated API requests with automatic token inclusion
 */

/**
 * Get the auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth-token');
}

/**
 * Get the selected tenant ID from DemoContext (for cross-tenant users)
 */
function getSelectedTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Try multiple sources in order of preference
  // 1. Global variable (set by DemoContext)
  const globalTenant = (window as any).__SELECTED_TENANT_ID__;
  if (globalTenant) {
    console.log('🌐 API Client: Found selected tenant ID from global:', globalTenant);
    return globalTenant;
  }
  
  // 2. Session storage (fallback)
  const sessionTenant = sessionStorage.getItem('selectedTenantId');
  if (sessionTenant) {
    console.log('🌐 API Client: Found selected tenant ID from session:', sessionTenant);
    return sessionTenant;
  }
  
  console.log('🌐 API Client: No selected tenant ID found');
  return null;
}

/**
 * Make an authenticated API request
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();
  const selectedTenantId = getSelectedTenantId();
  
  const headers = new Headers(options.headers);
  
  // Add Authorization header if token exists
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Add selected tenant ID header for cross-tenant users
  if (selectedTenantId) {
    headers.set('x-selected-tenant-id', selectedTenantId);
    console.log('🌐 API Client: Added tenant header:', selectedTenantId);
  }
  
  // Ensure Content-Type is set for JSON requests
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: (url: string, options?: RequestInit) =>
    authenticatedFetch(url, { ...options, method: 'GET' }),
  
  post: (url: string, body?: any, options?: RequestInit) =>
    authenticatedFetch(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  put: (url: string, body?: any, options?: RequestInit) =>
    authenticatedFetch(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  patch: (url: string, body?: any, options?: RequestInit) =>
    authenticatedFetch(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  delete: (url: string, options?: RequestInit) =>
    authenticatedFetch(url, { ...options, method: 'DELETE' }),

  /**
   * Get a blob response (for file downloads)
   */
  getBlob: async (url: string, options?: RequestInit): Promise<Blob> => {
    const response = await authenticatedFetch(url, { ...options, method: 'GET' });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Access restricted. Please contact your administrator for download access.');
      } else if (response.status === 404) {
        throw new Error('File not found. It may have been archived or deleted.');
      } else {
        throw new Error('Download failed. Please try again.');
      }
    }
    
    return response.blob();
  },
};
