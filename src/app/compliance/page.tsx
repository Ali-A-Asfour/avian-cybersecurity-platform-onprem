'use client';

import { useEffect, useState } from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { ComplianceFramework } from '@/types';
import { ComplianceDashboard } from '@/components/compliance/ComplianceDashboard';
import { ComplianceFrameworkList } from '@/components/compliance/ComplianceFrameworkList';
import { ComplianceControlList } from '@/components/compliance/ComplianceControlList';
import { ComplianceReports } from '@/components/compliance/ComplianceReports';
import { PendingReviews } from '@/components/compliance/PendingReviews';
import { DocumentAnalysisViewer } from '@/components/compliance/DocumentAnalysisViewer';
import { ReviewWorkflowGuide } from '@/components/compliance/ReviewWorkflowGuide';

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'frameworks' | 'reports' | 'reviews' | 'analysis' | 'guide'>('dashboard');
  const [selectedFramework, setSelectedFramework] = useState<ComplianceFramework | null>(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFrameworks();
  }, []);

  const fetchFrameworks = async () => {
    try {
      const response = await fetch('/api/compliance/frameworks');
      const result = await response.json();

      if (result.success) {
        setFrameworks(result.data);
      }
    } catch (error) {
      console.error('Error fetching frameworks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFrameworkSelect = (framework: ComplianceFramework) => {
    setSelectedFramework(framework);
    setActiveTab('frameworks');
  };

  const handleBackToFrameworks = () => {
    setSelectedFramework(null);
  };

  const handleReviewComplete = (analysisId: string) => {
    // Refresh the dashboard or show success message
    console.log('Review completed for analysis:', analysisId);
  };

  const handleReviewRequest = (analysisId: string) => {
    setSelectedAnalysisId(analysisId);
    setActiveTab('reviews');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Compliance Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track compliance across multiple frameworks and manage evidence
          </p>
        </div>

        {/* Navigation Tabs */}
        {!selectedFramework && (
          <div className="mb-8">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('frameworks')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'frameworks'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Frameworks
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'reviews'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Document Reviews
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'analysis'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Analysis Viewer
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'guide'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Review Guide
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Reports
              </button>
            </nav>
          </div>
        )}

        {/* Content */}
        {selectedFramework ? (
          <ComplianceControlList
            framework={selectedFramework}
            onBack={handleBackToFrameworks}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && <ComplianceDashboard />}
            {activeTab === 'frameworks' && (
              <ComplianceFrameworkList
                frameworks={frameworks}
                onFrameworkSelect={handleFrameworkSelect}
                onFrameworksChange={fetchFrameworks}
              />
            )}
            {activeTab === 'reviews' && (
              <PendingReviews
                tenantId="dev-tenant-123" // This would come from auth context
                onReviewComplete={handleReviewComplete}
              />
            )}
            {activeTab === 'analysis' && (
              <div className="space-y-6">
                {selectedAnalysisId ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Analysis Details
                      </h2>
                      <button
                        onClick={() => setSelectedAnalysisId(null)}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        ← Back to Analysis List
                      </button>
                    </div>
                    <DocumentAnalysisViewer
                      analysisId={selectedAnalysisId}
                      tenantId="dev-tenant-123" // This would come from auth context
                      onReviewRequest={handleReviewRequest}
                    />
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Select an Analysis</h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          Choose an analysis from the Document Reviews tab to view detailed results.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('reviews')}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        View Pending Reviews
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'guide' && <ReviewWorkflowGuide />}
            {activeTab === 'reports' && <ComplianceReports frameworks={frameworks} />}
          </>
        )}
      </div>
    </ClientLayout>
  );
}