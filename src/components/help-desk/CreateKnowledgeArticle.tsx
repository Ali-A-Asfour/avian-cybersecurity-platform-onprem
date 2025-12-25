'use client';

import React, { useState } from 'react';
import { BookOpen, Save, X } from 'lucide-react';

interface CreateKnowledgeArticleProps {
    onArticleCreated?: (article: any) => void;
    onCancel?: () => void;
    initialData?: {
        title?: string;
        problemDescription?: string;
        resolution?: string;
        sourceTicketId?: string;
    };
    className?: string;
}

export function CreateKnowledgeArticle({
    onArticleCreated,
    onCancel,
    initialData,
    className = ''
}: CreateKnowledgeArticleProps) {
    const [formData, setFormData] = useState({
        title: initialData?.title || '',
        problemDescription: initialData?.problemDescription || '',
        resolution: initialData?.resolution || '',
        sourceTicketId: initialData?.sourceTicketId || '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/help-desk/knowledge-base', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create article');
            }

            const article = await response.json();
            onArticleCreated?.(article);

            // Reset form if no callback provided (standalone usage)
            if (!onArticleCreated) {
                setFormData({
                    title: '',
                    problemDescription: '',
                    resolution: '',
                    sourceTicketId: '',
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create article');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (error) setError(null); // Clear error when user starts typing
    };

    return (
        <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
            <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-6 w-6 text-blue-600" />
                        <h2 className="text-xl font-semibold text-gray-900">Create Knowledge Article</h2>
                    </div>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {/* Title */}
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                        Article Title *
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder="Enter a clear, descriptive title for this solution"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        maxLength={500}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        {formData.title.length}/500 characters
                    </p>
                </div>

                {/* Problem Description */}
                <div>
                    <label htmlFor="problemDescription" className="block text-sm font-medium text-gray-700 mb-2">
                        Problem Description *
                    </label>
                    <textarea
                        id="problemDescription"
                        value={formData.problemDescription}
                        onChange={(e) => handleInputChange('problemDescription', e.target.value)}
                        placeholder="Describe the problem or issue that this article addresses..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                        required
                    />
                </div>

                {/* Resolution */}
                <div>
                    <label htmlFor="resolution" className="block text-sm font-medium text-gray-700 mb-2">
                        Resolution Steps *
                    </label>
                    <textarea
                        id="resolution"
                        value={formData.resolution}
                        onChange={(e) => handleInputChange('resolution', e.target.value)}
                        placeholder="Provide step-by-step instructions to resolve the problem..."
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                        required
                    />
                </div>

                {/* Source Ticket ID (if provided) */}
                {initialData?.sourceTicketId && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Source Ticket
                        </label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                            This article is being created from Ticket #{initialData.sourceTicketId.slice(-8)}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting || !formData.title.trim() || !formData.problemDescription.trim() || !formData.resolution.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Creating...' : 'Create Article'}
                    </button>
                </div>
            </form>
        </div>
    );
}