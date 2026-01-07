'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Ticket } from '@/types';

interface TicketResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: Ticket | null;
    onResolve: (ticketId: string, resolution: string, createKnowledgeArticle: boolean, knowledgeArticleTitle?: string) => Promise<void>;
}

export function TicketResolutionModal({ isOpen, onClose, ticket, onResolve }: TicketResolutionModalProps) {
    const [resolution, setResolution] = useState('');
    const [createKnowledgeArticle, setCreateKnowledgeArticle] = useState(false);
    const [knowledgeArticleTitle, setKnowledgeArticleTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ticket) return;

        // Validate resolution
        if (!resolution.trim()) {
            setError('Resolution description is required');
            return;
        }

        if (resolution.trim().length < 10) {
            setError('Resolution description must be at least 10 characters');
            return;
        }

        if (createKnowledgeArticle && !knowledgeArticleTitle.trim()) {
            setError('Knowledge article title is required when creating an article');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onResolve(
                ticket.id,
                resolution.trim(),
                createKnowledgeArticle,
                createKnowledgeArticle ? knowledgeArticleTitle.trim() : undefined
            );

            // Reset form and close modal
            setResolution('');
            setCreateKnowledgeArticle(false);
            setKnowledgeArticleTitle('');
            onClose();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to resolve ticket');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setResolution('');
            setCreateKnowledgeArticle(false);
            setKnowledgeArticleTitle('');
            setError(null);
            onClose();
        }
    };

    if (!ticket) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`Resolve Ticket #${ticket.id}`}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Ticket Summary */}
                <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-white mb-2">
                        Ticket Summary
                    </h3>
                    <p className="text-sm text-gray-300 font-medium">
                        {ticket.title}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        {ticket.description}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                        <span>Requester: {typeof ticket.requester === 'string' ? ticket.requester : ticket.requester?.email || 'Unknown'}</span>
                        <span>Priority: {ticket.priority}</span>
                        <span>Severity: {ticket.severity}</span>
                    </div>
                </div>

                {/* Resolution Description */}
                <div>
                    <label htmlFor="resolution" className="block text-sm font-medium text-gray-300 mb-2">
                        Resolution Description *
                    </label>
                    <textarea
                        id="resolution"
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="Describe how this issue was resolved, what steps were taken, and any preventive measures implemented..."
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white text-sm"
                        disabled={isSubmitting}
                        required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Minimum 10 characters. Be specific about the solution and any follow-up actions.
                    </p>
                </div>

                {/* Knowledge Base Article Option */}
                <div className="border-t border-gray-600 pt-4">
                    <div className="flex items-start space-x-3">
                        <input
                            type="checkbox"
                            id="createKnowledgeArticle"
                            checked={createKnowledgeArticle}
                            onChange={(e) => setCreateKnowledgeArticle(e.target.checked)}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            disabled={isSubmitting}
                        />
                        <div className="flex-1">
                            <label htmlFor="createKnowledgeArticle" className="text-sm font-medium text-gray-300">
                                Create Knowledge Base Article
                            </label>
                            <p className="text-xs text-gray-400 mt-1">
                                Create a knowledge base article from this resolution to help with similar issues in the future.
                            </p>
                        </div>
                    </div>

                    {createKnowledgeArticle && (
                        <div className="mt-4 ml-7">
                            <label htmlFor="knowledgeArticleTitle" className="block text-sm font-medium text-gray-300 mb-2">
                                Knowledge Article Title *
                            </label>
                            <input
                                type="text"
                                id="knowledgeArticleTitle"
                                value={knowledgeArticleTitle}
                                onChange={(e) => setKnowledgeArticleTitle(e.target.value)}
                                placeholder="e.g., How to resolve email sync issues in Outlook"
                                className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white text-sm"
                                disabled={isSubmitting}
                                required={createKnowledgeArticle}
                            />
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-900/20 border border-red-800 rounded-md p-3">
                        <div className="flex">
                            <div className="text-red-400 text-sm">
                                <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-600">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={isSubmitting || !resolution.trim() || resolution.trim().length < 10}
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Resolving...
                            </>
                        ) : (
                            'Resolve Ticket'
                        )}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}