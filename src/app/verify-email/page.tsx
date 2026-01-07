'use client';

import { useEffect, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [verifying, setVerifying] = useState(true);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [email] = useState('');

    useEffect(() => {
        const verifyEmail = async () => {
            if (!token) {
                setError('Invalid or missing verification token');
                setVerifying(false);
                return;
            }

            try {
                const response = await api.post('/api/auth/verify-email', { token });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    setError(data.error || 'Email verification failed');
                    setVerifying(false);
                    return;
                }

                // Success
                setSuccess(true);
                setVerifying(false);
            } catch {
                setError('An error occurred during verification');
                setVerifying(false);
            }
        };

        verifyEmail();
    }, [token]);

    if (verifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Verifying your email...</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <div className="max-w-md w-full space-y-8">
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                            Email Verified!
                        </h2>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            Your email has been successfully verified. You can now log in to your account.
                        </p>
                        <div className="mt-6">
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Go to login
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
                        <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                        Verification Failed
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {error || 'This verification link is invalid or has expired.'}
                    </p>
                    <div className="mt-6 space-y-3">
                        <Link
                            href="/resend-verification"
                            className="block w-full text-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            Resend verification email
                        </Link>
                        <Link
                            href="/login"
                            className="block text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            ← Back to login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
