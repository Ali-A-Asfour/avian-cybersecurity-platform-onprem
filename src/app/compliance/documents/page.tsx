'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DocumentUpload } from '@/components/compliance/DocumentUpload';
import { PendingReviews } from '@/components/compliance/PendingReviews';
import { DocumentAnalysisViewer } from '@/components/compliance/DocumentAnalysisViewer';

type ViewMode = 'upload' | 'pending' | 'analysis';

export default function DocumentsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

  const handleAnalysisComplete = (analysisId: string) => {
    setCurrentAnalysisId(analysisId);
    setViewMode('analysis');
  };

  const handleBackToUpload = () => {
    setCurrentAnalysisId(null);
    setViewMode('upload');
  };

  const renderContent = () => {
    switch (viewMode) {
      case 'upload':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Document Upload & Analysis
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Upload compliance documents for AI-powered analysis and automatic compliance mapping.
              </p>
            </div>
            
            <DocumentUpload
              onUploadComplete={(documentId) => console.log('Document uploaded:', documentId)}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </div>
        );

      case 'pending':
        return <PendingReviews />;

      case 'analysis':
        return currentAnalysisId ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Analysis Results
              </h2>
              <Button variant="outline" onClick={handleBackToUpload}>
                Back to Upload
              </Button>
            </div>
            <DocumentAnalysisViewer
              analysisId={currentAnalysisId}
              onReviewSubmitted={handleBackToUpload}
            />
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setViewMode('upload')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'upload'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Upload Documents
            </button>
            <button
              onClick={() => setViewMode('pending')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'pending'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Pending Reviews
            </button>
          </nav>
        </div>

        {/* Content */}
        {renderContent()}

        {/* Help Section */}
        {viewMode === 'upload' && (
          <Card className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  AI-Powered Document Analysis
                </h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  <p className="mb-2">
                    Our AI system can automatically analyze your compliance documents to:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Extract key compliance findings and requirements</li>
                    <li>Map document content to specific compliance controls</li>
                    <li>Identify gaps and provide recommendations</li>
                    <li>Generate confidence scores for human review</li>
                    <li>Process both text-based and scanned documents using OCR</li>
                  </ul>
                  <p className="mt-2">
                    Supported formats: PDF, Word documents, images (JPEG, PNG, TIFF), and plain text files.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}