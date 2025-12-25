'use client';

import React, { useState } from 'react';
import { BookOpen, Clock, User, CheckCircle, XCircle, ExternalLink, Trash2 } from 'lucide-react';
import { KnowledgeArticle } from '../../services/help-desk/KnowledgeBaseService';

interface KnowledgeArticleDisplayProps {
    article: KnowledgeArticle;
    onApprovalChange?: (articleId: string, isApproved: boolean) => void;
    onDelete?: (articleId: string) => void;
    showActions?: boolean;
    className?: string;
}

export function KnowledgeArticleDisplay({
    article,
    onApprovalChange,
    onDelete,
    showActions = false,
    className = ''
}: KnowledgeArticleDisplayProps) {
    const [isUpdating, setIsUpdating] = useState(false);

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleApprovalToggle = async () => {
        if (!onApprovalChange) return;

        setIsUpdating(true);
        try {
            await onApprovalChange(article.id, !article.is_approved);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!onDelete) return;

        if (window.confirm('Are you sure you want to delete this knowledge article? This action cannot be undone.')) {
            await onDelete(article.id);
        }
    };

    return (
        <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
            {/* Header */}
            <div className="p-6 border-b">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <BookOpen className="h-5 w-5 text-blue-600" />
                            <h1 className="text-xl font-semibold text-gray-900">{article.title}</h1>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>Created {formatDate(article.created_at)}</span>
                            </div>

                            <div className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                <span>By {article.created_by}</span>
                            </div>

                            <div className="flex items-center gap-1">
                                {article.is_approved ? (
                                    <>
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        <span className="text-green-700">Approved</span>
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="h-4 w-4 text-yellow-500" />
                                        <span className="text-yellow-700">Pending Approval</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {article.source_ticket_id && (
                            <div className="mt-2">
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                                    <ExternalLink className="h-3 w-3" />
                                    Created from Ticket #{article.source_ticket_id.slice(-8)}
                                </span>
                            </div>
                        )}
                    </div>

                    {showActions && (
                        <div className="flex items-center gap-2 ml-4">
                            {onApprovalChange && (
                                <button
                                    onClick={handleApprovalToggle}
                                    disabled={isUpdating}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${article.is_approved
                                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                                        } disabled:opacity-50`}
                                >
                                    {isUpdating ? 'Updating...' : article.is_approved ? 'Unapprove' : 'Approve'}
                                </button>
                            )}

                            {onDelete && (
                                <button
                                    onClick={handleDelete}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete Article"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
                {/* Problem Description */}
                <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-3">Problem Description</h2>
                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 whitespace-pre-wrap">{article.problem_description}</p>
                    </div>
                </div>

                {/* Resolution Steps */}
                <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-3">Resolution Steps</h2>
                    <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-gray-700 whitespace-pre-wrap">{article.resolution}</div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t rounded-b-lg">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Article ID: {article.id}</span>
                    {article.updated_at && article.updated_at !== article.created_at && (
                        <span>Last updated: {formatDate(article.updated_at)}</span>
                    )}
                </div>
            </div>
        </div>
    );
}