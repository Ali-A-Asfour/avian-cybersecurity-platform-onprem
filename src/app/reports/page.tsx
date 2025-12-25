'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { ReportsNavigation } from '@/components/reports/ReportsNavigation';
import { ReportPreview } from '@/components/reports/ReportPreview';
import { PDFExportInterface } from '@/components/reports/PDFExportInterface';

type ReportType = 'weekly' | 'monthly' | 'quarterly';

/**
 * Executive Security Reports Page
 * 
 * Provides access to Weekly, Monthly, and Quarterly executive security reports.
 * Role-based access control: Super Admin and Security Analyst only.
 * Tenant admins and other roles are redirected to dashboard.
 * 
 * Requirements: Task 8.1 - Executive Reports Module
 */
export default function ReportsPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated } = useAuth();
  const [currentReportType, setCurrentReportType] = useState<ReportType>('weekly');
  const [reportData, setReportData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Role-based access control
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      // Only super_admin and security_analyst have access to reports
      if (!['super_admin', 'security_analyst'].includes(user.role)) {
        router.push('/dashboard');
        return;
      }
    }
  }, [user, loading, isAuthenticated, router]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </ClientLayout>
    );
  }

  // Show access denied for unauthenticated users
  if (!isAuthenticated || !user) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-md">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Access Restricted
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Executive Security Reports are available to authorized personnel only.
              Please contact your administrator for access.
            </p>
          </div>
        </div>
      </ClientLayout>
    );
  }

  // Show loading while redirecting unauthorized users
  if (!['super_admin', 'security_analyst'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-neutral-400">Redirecting to Dashboard...</p>
        </div>
      </div>
    );
  }

  const handleReportTypeChange = (reportType: ReportType) => {
    setCurrentReportType(reportType);
    setReportData(null); // Clear previous report data
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      // This would call the actual report generation API
      // For now, we'll simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock report data - in real implementation, this would come from the API
      setReportData({
        type: currentReportType,
        generatedAt: new Date().toISOString(),
        summary: `${currentReportType.charAt(0).toUpperCase() + currentReportType.slice(1)} security report generated successfully.`
      });
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ClientLayout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Executive Security Reports
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Board-ready security performance reports showcasing business value and risk reduction
          </p>
        </div>

        {/* Reports Navigation */}
        <ReportsNavigation
          currentReportType={currentReportType}
          onReportTypeChange={handleReportTypeChange}
        />

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Generation and Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              {reportData ? (
                <ReportPreview
                  reportData={reportData}
                  reportType={currentReportType}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Ready to Create Executive Report
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Generate a comprehensive {currentReportType} security report for executive review.
                  </p>
                  <button
                    onClick={handleGenerateReport}
                    disabled={isGenerating}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Generate {currentReportType.charAt(0).toUpperCase() + currentReportType.slice(1)} Report
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Export and Actions */}
          <div className="lg:col-span-1">
            <PDFExportInterface
              reportId={reportData?.id}
              reportType={currentReportType}
              disabled={!reportData || isGenerating}
            />
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}