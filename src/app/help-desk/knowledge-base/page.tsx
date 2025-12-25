'use client';

import React, { useState, useEffect } from 'react';
import { Plus, BarChart3 } from 'lucide-react';
import { KnowledgeBaseSearch } from '../../../components/help-desk/KnowledgeBaseSearch';
import { KnowledgeArticleDisplay } from '../../../components/help-desk/KnowledgeArticleDisplay';
import { CreateKnowledgeArticle } from '../../../components/help-desk/CreateKnowledgeArticle';
import { KnowledgeArticle } from '../../../services/help-desk/KnowledgeBaseService';

interface KnowledgeBaseStats {
    total: number;
    approved: number;
    pending_approval: number;
    created_this_month: number;
}

export default function KnowledgeBasePage() {
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Load knowledge base statistics
    useEffect(() => {
        const loadStats = async () => {
            try {
                const response = await fetch('/api/help-desk/knowledge-base/stats');
                if (response.ok) {
                    const statsData = await response.json();
                    setStats(statsData);
                }
            } catch (error) {
                console.error('Failed to load knowledge base stats:', error);
            }
        };

        loadStats();
    }, [refreshKey]);

    const handleArticleSelect = (article: KnowledgeArticle) => {
        setSelectedArticle(article);
        setShowCreateForm(false);
    };

    const handleCreateNew = () => {
        setShowCreateForm(true);
        setSelectedArticle(null);
    };

    const handleArticleCreated = (article: KnowledgeArticle) => {
        setShowCreateForm(false);
        setSelectedArticle(article);
        setRefreshKey(prev => prev + 1); // Refresh stats and search results
    };

    const handleApprovalChange = async (articleId: string, isApproved: boolean) => {
        try {
            const response = await fetch(`/api/help-desk/knowledge-base/${articleId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_approved: isApproved }),
            });

            if (response.ok) {
                const updatedArticle = await response.json();
                setSelectedArticle(updatedArticle);
                setRefreshKey(prev => prev + 1); // Refresh stats and search results
            } else {
                throw new Error('Failed to update approval status');
            }
        } catch (error) {
            console.error('Error updating approval status:', error);
            alert('Failed to update approval status. Please try again.');
        }
    };

    const handleDelete = async (articleId: string) => {
        try {
            const response = await fetch(`/api/help-desk/knowledge-base/${articleId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setSelectedArticle(null);
                setRefreshKey(prev => prev + 1); // Refresh stats and search results
            } else {
                throw new Error('Failed to delete article');
            }
        } catch (error) {
            console.error('Error deleting article:', error);
            alert('Failed to delete article. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
                            <p className="mt-2 text-gray-600">
                                Search and manage knowledge articles for faster issue resolution
                            </p>
                        </div>
                        <button
                            onClick={handleCreateNew}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            New Article
                        </button>
                    </div>

                    {/* Stats */}
                    {stats && (
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-blue-600" />
                                    <span className="text-sm font-medium text-gray-600">Total Articles</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-green-600" />
                                    <span className="text-sm font-medium text-gray-600">Approved</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.approved}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-yellow-600" />
                                    <span className="text-sm font-medium text-gray-600">Pending</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pending_approval}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-purple-600" />
                                    <span className="text-sm font-medium text-gray-600">This Month</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.created_this_month}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Search */}
                    <div>
                        <KnowledgeBaseSearch
                            key={refreshKey} // Force refresh when articles change
                            onArticleSelect={handleArticleSelect}
                            showApprovedOnly={false}
                        />
                    </div>

                    {/* Right Column - Article Display or Create Form */}
                    <div>
                        {showCreateForm ? (
                            <CreateKnowledgeArticle
                                onArticleCreated={handleArticleCreated}
                                onCancel={() => setShowCreateForm(false)}
                            />
                        ) : selectedArticle ? (
                            <KnowledgeArticleDisplay
                                article={selectedArticle}
                                onApprovalChange={handleApprovalChange}
                                onDelete={handleDelete}
                                showActions={true}
                            />
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                                <div className="text-gray-400 mb-4">
                                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Article Selected</h3>
                                <p className="text-gray-600 mb-4">
                                    Search for an article on the left or create a new one to get started.
                                </p>
                                <button
                                    onClick={handleCreateNew}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    Create New Article
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}