'use client';

import { useState, useEffect } from 'react';
import { ComplianceFrameworkDefinition } from '@/lib/compliance-frameworks';

interface AddFrameworkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFrameworkAdded: () => void;
}

export function AddFrameworkModal({ isOpen, onClose, onFrameworkAdded }: AddFrameworkModalProps) {
    const [availableFrameworks, setAvailableFrameworks] = useState<Record<string, ComplianceFrameworkDefinition>>({});
    const [selectedFramework, setSelectedFramework] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchAvailableFrameworks();
        }
    }, [isOpen]);

    const fetchAvailableFrameworks = async () => {
        try {
            const response = await fetch('/api/compliance/available-frameworks');
            const result = await response.json();

            if (result.success) {
                setAvailableFrameworks(result.data);
            }
        } catch (err) {
            console.error('Error fetching available frameworks:', err);
            setError('Failed to load available frameworks');
        }
    };

    const handleAddFramework = async () => {
        if (!selectedFramework) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/compliance/frameworks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    frameworkKey: selectedFramework,
                }),
            });

            const result = await response.json();

            if (result.success) {
                onFrameworkAdded();
                onClose();
                setSelectedFramework('');
            } else {
                setError(result.error?.message || 'Failed to add framework');
            }
        } catch (err) {
            console.error('Error adding framework:', err);
            setError('Failed to add framework');
        } finally {
            setLoading(false);
        }
    };

    const getFrameworkIcon = (frameworkKey: string) => {
        switch (frameworkKey) {
            case 'hipaa':
                return (
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.586-4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-5.586l-2-2H4z" />
                        </svg>
                    </div>
                );
            case 'phipa':
                return (
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                );
            default:
                return (
                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                );
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800">
                <div className="mt-3">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            Add Compliance Framework
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Framework Selection */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Select a compliance framework to add:
                            </label>
                            <div className="space-y-3">
                                {Object.entries(availableFrameworks).map(([key, framework]) => (
                                    <div
                                        key={key}
                                        className={`relative rounded-lg border p-4 cursor-pointer transition-colors ${selectedFramework === key
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                        onClick={() => setSelectedFramework(key)}
                                    >
                                        <div className="flex items-start space-x-3">
                                            <input
                                                type="radio"
                                                name="framework"
                                                value={key}
                                                checked={selectedFramework === key}
                                                onChange={() => setSelectedFramework(key)}
                                                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                            />
                                            {getFrameworkIcon(key)}
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {framework.framework.name}
                                                    </h4>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        v{framework.framework.version}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                    {framework.description}
                                                </p>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                        {framework.controls.length} controls
                                                    </span>
                                                    {framework.applicableRegions.map((region) => (
                                                        <span
                                                            key={region}
                                                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                                                        >
                                                            {region}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="mt-2">
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        <strong>Industries:</strong> {framework.industryFocus.join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddFramework}
                            disabled={!selectedFramework || loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="flex items-center space-x-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Adding...</span>
                                </div>
                            ) : (
                                'Add Framework'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}