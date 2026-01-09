'use client';

import { useState } from 'react';

export default function DebugLoginPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    setLoading(true);
    setResult(null);

    try {
      console.log('Testing login API...');
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test2@demo.com',
          password: 'twst123',
          rememberMe: false,
        }),
      });

      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });

      const data = await response.json();
      console.log('Response data:', data);

      setResult({
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
        data: data
      });

    } catch (error) {
      console.error('Error:', error);
      setResult({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Debug Login API</h2>
          <p className="mt-2 text-sm text-gray-600">
            Test the login API directly
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={testLogin}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Login API'}
          </button>

          {result && (
            <div className="mt-4 p-4 bg-gray-100 rounded-md">
              <h3 className="font-bold mb-2">Result:</h3>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}