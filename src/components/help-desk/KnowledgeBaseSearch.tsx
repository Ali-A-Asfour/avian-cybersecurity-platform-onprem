'use client';

import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { KnowledgeArticle as BaseKnowledgeArticle } from '../../services/help-desk/KnowledgeBaseService';
import { api } from '@/lib/api-client';

// Extended interface to support both field names for compatibility
interface KnowledgeArticle extends BaseKnowledgeArticle {
    ticket_id?: string; // For compatibility with knowledge base store
}

interface KnowledgeBaseSearchProps {
    onArticleSelect?: (article: KnowledgeArticle) => void;
    showApprovedOnly?: boolean;
    className?: string;
}

interface SearchResult {
    articles: KnowledgeArticle[];
    total: number;
}

export function KnowledgeBaseSearch({
    onArticleSelect,
    showApprovedOnly = false,
    className = ''
}: KnowledgeBaseSearchProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult>({ articles: [], total: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const searchArticles = async (query: string, page: number = 1) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
            });

            if (query.trim()) {
                params.append('query', query.trim());
            }

            if (showApprovedOnly) {
                params.append('approved_only', 'true');
            }

            const response = await api.get(`/api/help-desk/knowledge-base?${params}`);

            if (!response.ok) {
                throw new Error('Failed to search knowledge base');
            }

            const apiResult = await response.json();
            
            // Handle API response structure
            if (apiResult.success && apiResult.data) {
                setSearchResults({
                    articles: apiResult.data.articles || [],
                    total: apiResult.data.total || 0
                });
            } else {
                throw new Error(apiResult.error || 'Failed to search knowledge base');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
            setSearchResults({ articles: [], total: 0 });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchArticles(searchQuery, 1);
            setCurrentPage(1);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, showApprovedOnly]);

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        searchArticles(searchQuery, newPage);
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const handleViewTicket = (ticketId: string, event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent article selection
        window.location.href = `/help-desk/tickets/${ticketId}`;
    };

    const totalPages = Math.ceil(searchResults.total / 10);

    return (
        <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
            <div className="p-6 border-b">
                <div className="flex items-center gap-3 mb-4">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Knowledge Base</h2>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search articles by title, problem, or solution..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div className="p-6">
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Searching...</span>
                    </div>
                ) : searchResults.articles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        {searchQuery.trim() ? 'No articles found matching your search.' : 'No articles available.'}
                    </div>
                ) : (
                    <>
                        <div className="mb-4 text-sm text-gray-600">
                            Found {searchResults.total} article{searchResults.total !== 1 ? 's' : ''}
                        </div>

                        <div className="space-y-4">
                            {searchResults.articles.map((article) => (
                                <div
                                    key={article.id}
                                    className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${onArticleSelect ? 'cursor-pointer hover:border-blue-300' : ''
                                        }`}
                                    onClick={() => onArticleSelect?.(article)}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-medium text-gray-900 flex-1 pr-4">
                                            {article.title}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {article.is_approved ? (
                                                <CheckCircle className="h-4 w-4 text-green-500" title="Approved" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-yellow-500" title="Pending Approval" />
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                        {article.problem_description}
                                    </p>

                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            <span>Created {formatDate(article.created_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {(article.source_ticket_id || article.ticket_id) && (
                                                <button
                                                    onClick={(e) => handleViewTicket((article.source_ticket_id || article.ticket_id)!, e)}
                                                    className="flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded text-xs transition-colors"
                                                    title="View original ticket"
                                                >
                                                    <Eye className="h-3 w-3" />
                                                    View Ticket
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-6">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                    Previous
                                </button>

                                <span className="text-sm text-gray-600">
                                    Page {currentPage} of {totalPages}
                                </span>

                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}