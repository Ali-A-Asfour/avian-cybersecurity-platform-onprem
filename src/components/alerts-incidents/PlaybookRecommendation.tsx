'use client';

import { useState, useEffect } from 'react';
import { InvestigationPlaybook } from '@/types/alerts-incidents';
import { api } from '@/lib/api-client';

interface PlaybookRecommendationProps {
    classification: string;
    demoMode?: boolean;
    className?: string;
}

interface PlaybookWithClassifications {
    playbook: InvestigationPlaybook;
    classifications: {
        classification: string;
        isPrimary: boolean;
    }[];
}

/**
 * Playbook Recommendation Component
 * 
 * Shows relevant playbooks for an alert classification with:
 * - Quick Response Guide (3-step process)
 * - Expandable detailed procedures
 * - Primary vs secondary playbook indicators
 */
export function PlaybookRecommendation({ 
    classification, 
    demoMode = false, 
    className = '' 
}: PlaybookRecommendationProps) {
    const [playbooks, setPlaybooks] = useState<InvestigationPlaybook[]>([]);
    const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookWithClassifications | null>(null);
    const [expandedPlaybook, setExpandedPlaybook] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPlaybooks();
    }, [classification, demoMode]);

    const fetchPlaybooks = async () => {
        try {
            setLoading(true);
            setError(null);

            const endpoint = demoMode
                ? `/api/alerts-incidents/demo/playbooks?classification=${classification}`
                : `/api/alerts-incidents/playbooks?classification=${classification}`;

            const response = await api.get(endpoint);

            if (!response.ok) {
                throw new Error('Failed to fetch playbooks');
            }

            const data = await response.json();
            setPlaybooks(data.data?.playbooks || []);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load playbooks');
        } finally {
            setLoading(false);
        }
    };

    const handleViewPlaybook = async (playbookId: string) => {
        try {
            const endpoint = demoMode
                ? `/api/alerts-incidents/demo/playbooks/${playbookId}`
                : `/api/alerts-incidents/playbooks/${playbookId}`;
            
            const response = await api.get(endpoint);

            if (!response.ok) {
                throw new Error('Failed to load playbook details');
            }

            const data = await response.json();
            setSelectedPlaybook({
                playbook: data.data.playbook,
                classifications: data.data.classifications.map((c: any) => ({
                    classification: c.classification,
                    isPrimary: c.isPrimary,
                })),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load playbook details');
        }
    };

    const toggleExpanded = (playbookId: string) => {
        if (expandedPlaybook === playbookId) {
            setExpandedPlaybook(null);
        } else {
            setExpandedPlaybook(playbookId);
            if (!selectedPlaybook || selectedPlaybook.playbook.id !== playbookId) {
                handleViewPlaybook(playbookId);
            }
        }
    };

    const formatClassification = (classification: string): string => {
        return classification
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    if (loading) {
        return (
            <div className={`border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 ${className}`}>
                <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-blue-900 dark:text-blue-100 font-medium">Loading investigation playbooks...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20 ${className}`}>
                <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-900 dark:text-red-100 font-medium">Failed to load playbooks</span>
                </div>
            </div>
        );
    }

    if (playbooks.length === 0) {
        return (
            <div className={`border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20 ${className}`}>
                <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-yellow-900 dark:text-yellow-100 font-medium">
                        No playbooks found for {formatClassification(classification)} alerts
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={`border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20 ${className}`}>
            <div className="p-4">
                <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">
                        Investigation Playbooks for {formatClassification(classification)}
                    </h4>
                </div>

                <div className="space-y-3">
                    {playbooks.map((playbook) => (
                        <div key={playbook.id} className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                            <div className="p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <h5 className="font-medium text-gray-900 dark:text-white">
                                                {playbook.name}
                                            </h5>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                v{playbook.version}
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                {playbook.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {playbook.purpose}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => toggleExpanded(playbook.id)}
                                        className="ml-3 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
                                    >
                                        {expandedPlaybook === playbook.id ? 'Hide Details' : 'View Details'}
                                    </button>
                                </div>

                                {/* Quick Response Guide - Always Visible */}
                                {playbook.quickResponseGuide && playbook.quickResponseGuide.length > 0 && (
                                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                                        <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2 text-sm">
                                            🚀 Quick Response Guide
                                        </h6>
                                        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                                            {playbook.quickResponseGuide.map((step, index) => (
                                                <li key={index} className="leading-relaxed">{step}</li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Expanded Details */}
                                {expandedPlaybook === playbook.id && selectedPlaybook && selectedPlaybook.playbook.id === playbook.id && (
                                    <div className="mt-4 space-y-4 border-t border-blue-200 dark:border-blue-700 pt-4">
                                        {/* Initial Validation Steps */}
                                        {selectedPlaybook.playbook.initialValidationSteps.length > 0 && (
                                            <div>
                                                <h6 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                                                    Initial Validation Steps
                                                </h6>
                                                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                                    {selectedPlaybook.playbook.initialValidationSteps.map((step, index) => (
                                                        <li key={index} className="leading-relaxed">{step}</li>
                                                    ))}
                                                </ol>
                                            </div>
                                        )}

                                        {/* Source Investigation Steps */}
                                        {selectedPlaybook.playbook.sourceInvestigationSteps.length > 0 && (
                                            <div>
                                                <h6 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                                                    Source Investigation Steps
                                                </h6>
                                                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                                    {selectedPlaybook.playbook.sourceInvestigationSteps.map((step, index) => (
                                                        <li key={index} className="leading-relaxed">{step}</li>
                                                    ))}
                                                </ol>
                                            </div>
                                        )}

                                        {/* Containment Checks */}
                                        {selectedPlaybook.playbook.containmentChecks.length > 0 && (
                                            <div>
                                                <h6 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                                                    Containment Checks
                                                </h6>
                                                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                                    {selectedPlaybook.playbook.containmentChecks.map((step, index) => (
                                                        <li key={index} className="leading-relaxed">{step}</li>
                                                    ))}
                                                </ol>
                                            </div>
                                        )}

                                        {/* Decision Guidance */}
                                        <div>
                                            <h6 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                                                Decision Guidance
                                            </h6>
                                            <div className="space-y-2 text-sm">
                                                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                                                    <span className="font-medium text-red-800 dark:text-red-200">Escalate to Incident:</span>
                                                    <p className="text-red-700 dark:text-red-300 mt-1">{selectedPlaybook.playbook.decisionGuidance.escalateToIncident}</p>
                                                </div>
                                                <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                                                    <span className="font-medium text-green-800 dark:text-green-200">Resolve as Benign:</span>
                                                    <p className="text-green-700 dark:text-green-300 mt-1">{selectedPlaybook.playbook.decisionGuidance.resolveBenign}</p>
                                                </div>
                                                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                                                    <span className="font-medium text-yellow-800 dark:text-yellow-200">Resolve as False Positive:</span>
                                                    <p className="text-yellow-700 dark:text-yellow-300 mt-1">{selectedPlaybook.playbook.decisionGuidance.resolveFalsePositive}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}