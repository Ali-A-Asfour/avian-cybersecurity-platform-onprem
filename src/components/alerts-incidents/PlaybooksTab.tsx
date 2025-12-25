'use client';

import { useState, useEffect } from 'react';
import { InvestigationPlaybook, PlaybookStatus } from '@/types/alerts-incidents';
import { PlaybookClassificationLinkInput } from '@/services/alerts-incidents/PlaybookManager';
import { useAuth } from '@/hooks/useAuth';

interface PlaybookWithClassifications {
    playbook: InvestigationPlaybook;
    classifications: {
        classification: string;
        isPrimary: boolean;
    }[];
}

interface ClassificationSummary {
    classification: string;
    primaryPlaybook: InvestigationPlaybook | null;
    secondaryCount: number;
}

interface PlaybooksTabProps {
    demoMode?: boolean;
}

/**
 * Playbooks Management Tab Component
 * 
 * Provides CRUD interface for investigation playbooks with role-based access control:
 * - Super Admin: Full CRUD access
 * - Security Analyst: Read-only access
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
export function PlaybooksTab({ demoMode = false }: PlaybooksTabProps = {}) {
    const { user } = useAuth();
    const [playbooks, setPlaybooks] = useState<InvestigationPlaybook[]>([]);
    const [classifications, setClassifications] = useState<ClassificationSummary[]>([]);
    const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookWithClassifications | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<PlaybookStatus | 'all'>('all');

    const isSuperAdmin = user?.role === 'super_admin';

    // Load playbooks and classifications
    useEffect(() => {
        loadData();
    }, [statusFilter]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load playbooks with filtering
            const playbooksParams = new URLSearchParams();
            if (statusFilter !== 'all') {
                playbooksParams.set('status', statusFilter);
            }

            const playbooksEndpoint = demoMode
                ? '/api/alerts-incidents/demo/playbooks'
                : '/api/alerts-incidents/playbooks';

            const classificationsEndpoint = demoMode
                ? '/api/alerts-incidents/demo/playbooks/classifications'
                : '/api/alerts-incidents/playbooks/classifications';

            const [playbooksResponse, classificationsResponse] = await Promise.all([
                fetch(`${playbooksEndpoint}?${playbooksParams}`, {
                    headers: {
                        'x-user': JSON.stringify(user),
                    },
                }),
                fetch(classificationsEndpoint, {
                    headers: {
                        'x-user': JSON.stringify(user),
                    },
                }),
            ]);

            if (!playbooksResponse.ok || !classificationsResponse.ok) {
                throw new Error('Failed to load data');
            }

            const playbooksData = await playbooksResponse.json();
            const classificationsData = await classificationsResponse.json();

            setPlaybooks(playbooksData.data.playbooks || []);
            setClassifications(Array.isArray(classificationsData.data) ? classificationsData.data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleViewPlaybook = async (playbookId: string) => {
        try {
            const response = await fetch(`/api/alerts-incidents/playbooks/${playbookId}`, {
                headers: {
                    'x-user': JSON.stringify(user),
                },
            });

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

    const handleActivatePlaybook = async (playbookId: string) => {
        if (!isSuperAdmin) return;

        try {
            const response = await fetch(`/api/alerts-incidents/playbooks/${playbookId}/activate`, {
                method: 'POST',
                headers: {
                    'x-user': JSON.stringify(user),
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to activate playbook');
            }

            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to activate playbook');
        }
    };

    const handleDeprecatePlaybook = async (playbookId: string) => {
        if (!isSuperAdmin) return;

        try {
            const response = await fetch(`/api/alerts-incidents/playbooks/${playbookId}/deprecate`, {
                method: 'POST',
                headers: {
                    'x-user': JSON.stringify(user),
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to deprecate playbook');
            }

            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to deprecate playbook');
        }
    };

    const handleDeletePlaybook = async (playbookId: string) => {
        if (!isSuperAdmin) return;

        if (!confirm('Are you sure you want to delete this playbook? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/alerts-incidents/playbooks/${playbookId}`, {
                method: 'DELETE',
                headers: {
                    'x-user': JSON.stringify(user),
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete playbook');
            }

            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete playbook');
        }
    };

    const getStatusBadgeColor = (status: PlaybookStatus) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'draft':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'deprecated':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading playbooks...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Investigation Playbooks
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        {isSuperAdmin
                            ? 'Manage investigation playbooks and classification links'
                            : 'View investigation playbooks (read-only access)'
                        }
                    </p>
                </div>
                {isSuperAdmin && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        Create Playbook
                    </button>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex">
                        <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex space-x-4">
                <div>
                    <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status
                    </label>
                    <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as PlaybookStatus | 'all')}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="deprecated">Deprecated</option>
                    </select>
                </div>
            </div>

            {/* Playbooks List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Playbooks ({playbooks.length})
                    </h3>
                </div>

                {playbooks.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No playbooks found</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {isSuperAdmin
                                ? 'Create your first playbook to get started.'
                                : 'No playbooks are available yet.'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {playbooks.map((playbook) => (
                            <div key={playbook.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                                                {playbook.name}
                                            </h4>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                v{playbook.version}
                                            </span>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(playbook.status)}`}>
                                                {playbook.status}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                                            {playbook.purpose}
                                        </p>
                                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                            <span>Created {new Date(playbook.createdAt).toLocaleDateString()}</span>
                                            <span>Updated {new Date(playbook.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleViewPlaybook(playbook.id)}
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                                        >
                                            View
                                        </button>
                                        {isSuperAdmin && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setSelectedPlaybook({
                                                            playbook,
                                                            classifications: [], // Will be loaded when editing
                                                        });
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                                                >
                                                    Edit
                                                </button>
                                                {playbook.status === 'draft' && (
                                                    <button
                                                        onClick={() => handleActivatePlaybook(playbook.id)}
                                                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium"
                                                    >
                                                        Activate
                                                    </button>
                                                )}
                                                {playbook.status === 'active' && (
                                                    <button
                                                        onClick={() => handleDeprecatePlaybook(playbook.id)}
                                                        className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300 font-medium"
                                                    >
                                                        Deprecate
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeletePlaybook(playbook.id)}
                                                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Classifications Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Classification Coverage
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Overview of playbook coverage by alert classification
                    </p>
                </div>

                {classifications.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                        <p className="text-gray-600 dark:text-gray-400">No classifications found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {classifications.map((classification) => (
                            <div key={classification.classification} className="px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium text-gray-900 dark:text-white">
                                            {classification.classification}
                                        </h4>
                                        {classification.primaryPlaybook ? (
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Primary: {classification.primaryPlaybook.name} v{classification.primaryPlaybook.version}
                                                {classification.secondaryCount > 0 && (
                                                    <span className="ml-2">
                                                        + {classification.secondaryCount} secondary
                                                    </span>
                                                )}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-red-600 dark:text-red-400">
                                                No primary playbook assigned
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center">
                                        {classification.primaryPlaybook ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                Covered
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                Missing
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Playbook Detail Modal */}
            {selectedPlaybook && (
                <PlaybookDetailModal
                    playbook={selectedPlaybook}
                    onClose={() => setSelectedPlaybook(null)}
                />
            )}

            {/* Create/Edit Modals would go here */}
            {/* These would be separate components for creating and editing playbooks */}
        </div>
    );
}

/**
 * Playbook Detail Modal Component
 */
interface PlaybookDetailModalProps {
    playbook: PlaybookWithClassifications;
    onClose: () => void;
}

function PlaybookDetailModal({ playbook, onClose }: PlaybookDetailModalProps) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {playbook.playbook.name} v{playbook.playbook.version}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="px-6 py-4 space-y-6">
                    {/* Purpose */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Purpose</h3>
                        <p className="text-gray-700 dark:text-gray-300">{playbook.playbook.purpose}</p>
                    </div>

                    {/* Classifications */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Classifications</h3>
                        <div className="flex flex-wrap gap-2">
                            {playbook.classifications.map((classification) => (
                                <span
                                    key={classification.classification}
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${classification.isPrimary
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                        }`}
                                >
                                    {classification.classification}
                                    {classification.isPrimary && ' (Primary)'}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Steps */}
                    {playbook.playbook.initialValidationSteps.length > 0 && (
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Initial Validation Steps</h3>
                            <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300">
                                {playbook.playbook.initialValidationSteps.map((step, index) => (
                                    <li key={index}>{step}</li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {playbook.playbook.sourceInvestigationSteps.length > 0 && (
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Source Investigation Steps</h3>
                            <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300">
                                {playbook.playbook.sourceInvestigationSteps.map((step, index) => (
                                    <li key={index}>{step}</li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {playbook.playbook.containmentChecks.length > 0 && (
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Containment Checks</h3>
                            <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300">
                                {playbook.playbook.containmentChecks.map((step, index) => (
                                    <li key={index}>{step}</li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {/* Decision Guidance */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Decision Guidance</h3>
                        <div className="space-y-3">
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">Escalate to Incident:</h4>
                                <p className="text-gray-700 dark:text-gray-300">{playbook.playbook.decisionGuidance.escalateToIncident}</p>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">Resolve as Benign:</h4>
                                <p className="text-gray-700 dark:text-gray-300">{playbook.playbook.decisionGuidance.resolveBenign}</p>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">Resolve as False Positive:</h4>
                                <p className="text-gray-700 dark:text-gray-300">{playbook.playbook.decisionGuidance.resolveFalsePositive}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}