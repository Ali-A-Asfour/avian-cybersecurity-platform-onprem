'use client';

import { useEffect, useState } from 'react';

export default function ResetDemoPage() {
    const [resetComplete, setResetComplete] = useState(false);

    const resetDemo = async () => {
        try {
            // Clear session storage
            sessionStorage.removeItem('demoUserId');
            
            // Reset server state
            const response = await fetch('/api/alerts-incidents/demo/debug?action=reset');
            const result = await response.json();
            
            console.log('Demo reset result:', result);
            setResetComplete(true);
            
            // Redirect to alerts page after 2 seconds
            setTimeout(() => {
                window.location.href = '/alerts-incidents';
            }, 2000);
            
        } catch (error) {
            console.error('Failed to reset demo:', error);
        }
    };

    useEffect(() => {
        resetDemo();
    }, []);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md text-center">
                <h1 className="text-2xl font-bold mb-4">Resetting Demo State</h1>
                {resetComplete ? (
                    <div>
                        <p className="text-green-600 mb-4">✅ Demo state reset successfully!</p>
                        <p className="text-gray-600">Redirecting to alerts page...</p>
                    </div>
                ) : (
                    <div>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Resetting demo state...</p>
                    </div>
                )}
            </div>
        </div>
    );
}