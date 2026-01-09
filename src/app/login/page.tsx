'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Force a unique timestamp to prevent caching
    const timestamp = Date.now();
    console.log(`[Login-${timestamp}] Starting login attempt for:`, email);

    try {
      console.log(`[Login-${timestamp}] Attempting login for:`, email);
      
      // Try regular login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          email,
          password,
          rememberMe,
        }),
      });

      console.log(`[Login-${timestamp}] Raw response:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });

      let data;
      try {
        data = await response.json();
        console.log(`[Login-${timestamp}] JSON parsed successfully:`, data);
      } catch (jsonError) {
        console.error(`[Login-${timestamp}] Failed to parse JSON response:`, jsonError);
        const textResponse = await response.text();
        console.error(`[Login-${timestamp}] Raw response text:`, textResponse);
        setError('Invalid response from server');
        setLoading(false);
        return;
      }

      console.log(`[Login-${timestamp}] API response:`, { 
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok,
        success: data.success, 
        user: data.user,
        error: data.error,
        fullResponse: data
      });

      if (!response.ok) {
        console.error(`[Login-${timestamp}] Login failed - response not ok:`, data);
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Check if the API returned success
      if (!data.success) {
        console.error(`[Login-${timestamp}] API returned success=false:`, data);
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Success - store user info and redirect based on role
      if (data.user) {
        console.log(`[Login-${timestamp}] Storing user data:`, data.user);
        
        // Store user data
        localStorage.setItem('auth-user', JSON.stringify(data.user));
        
        // Store the JWT token for API requests
        if (data.token) {
          localStorage.setItem('auth-token', data.token);
          console.log(`[Login-${timestamp}] Stored auth token`);
        }
        
        // Store session indicator (the actual session is in httpOnly cookie)
        localStorage.setItem('session-id', 'active');
        
        console.log(`[Login-${timestamp}] All auth data stored, redirecting...`);

        // Small delay to ensure localStorage is written
        await new Promise(resolve => setTimeout(resolve, 100));

        // Redirect based on user role
        if (data.user.role === 'super_admin') {
          // Clear any previously selected tenant
          localStorage.removeItem('selected-tenant');
          sessionStorage.removeItem('selectedTenant');
          console.log(`[Login-${timestamp}] Redirecting to super-admin dashboard`);
          window.location.href = '/super-admin';
        } else {
          console.log(`[Login-${timestamp}] Redirecting to dashboard`);
          window.location.href = '/dashboard';
        }
      } else {
        console.log(`[Login-${timestamp}] No user data in response, redirecting to dashboard`);
        // Fallback to dashboard
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error(`[Login-${timestamp}] Login error:`, error);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            AVIAN Platform
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to your account
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800"
                placeholder="Email address"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800"
                placeholder="Password"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}