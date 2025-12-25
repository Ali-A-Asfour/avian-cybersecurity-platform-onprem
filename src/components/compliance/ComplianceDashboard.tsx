'use client';

import { useEffect, useState } from 'react';
import { ComplianceFramework, ComplianceControl, ComplianceStatus } from '../../types';
import { ComplianceGauge } from '../dashboard/ComplianceGauge';
import { HybridComplianceScoring } from './HybridComplianceScoring';

interface ComplianceDashboardData {
  frameworks: ComplianceFramework[];
  recent_controls: ComplianceControl[];
  compliance_score: number;
  controls_by_status: Record<ComplianceStatus, number>;
  upcoming_reviews: ComplianceControl[];
}

export function ComplianceDashboard() {
  const [data, setData] = useState<ComplianceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'hybrid-scoring'>('overview');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/compliance/dashboard');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } else if (response.status === 401) {
        // Mock data for development/demo mode
        setData({
          overallScore: 85,
          frameworks: [
            { name: 'SOC 2', score: 90 },
            { name: 'ISO 27001', score: 80 },
            { name: 'GDPR', score: 85 }
          ]
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback to mock data
      setData({
        overallScore: 85,
        frameworks: [
          { name: 'SOC 2', score: 90 },
          { name: 'ISO 27001', score: 80 },
          { name: 'GDPR', score: 85 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Failed to load compliance data</p>
      </div>
    );
  }

  const getStatusColor = (status: ComplianceStatus) => {
    switch (status) {
      case ComplianceStatus.COMPLETED:
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case ComplianceStatus.IN_PROGRESS:
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
      case ComplianceStatus.NON_COMPLIANT:
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('hybrid-scoring')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'hybrid-scoring'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
          >
            Hybrid Scoring & Analytics
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'hybrid-scoring' ? (
        <HybridComplianceScoring tenantId="dev-tenant-123" />
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Score</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{data.compliance_score}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{data.controls_by_status[ComplianceStatus.COMPLETED]}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{data.controls_by_status[ComplianceStatus.IN_PROGRESS]}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Non-Compliant</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{data.controls_by_status[ComplianceStatus.NON_COMPLIANT]}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Compliance Score Gauge */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Compliance Score
              </h3>
              <div className="flex justify-center">
                <ComplianceGauge data={{
                  overall_score: data.compliance_score,
                  frameworks_count: data.frameworks.length,
                  controls_completed: data.controls_by_status.completed || 0,
                  controls_total: Object.values(data.controls_by_status).reduce((a, b) => a + b, 0),
                  controls_in_progress: data.controls_by_status.in_progress || 0,
                  controls_not_started: data.controls_by_status.not_started || 0,
                  frameworks: data.frameworks.map(f => ({
                    id: f.id,
                    name: f.name,
                    score: 85, // Mock score
                    controls_completed: 10, // Mock data
                    controls_total: 15 // Mock data
                  }))
                }} />
              </div>
            </div>

            {/* Framework Overview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Active Frameworks
              </h3>
              <div className="space-y-4">
                {data.frameworks.map((framework) => (
                  <div key={framework.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{framework.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Version {framework.version}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Recent Control Updates
              </h3>
              <div className="space-y-4">
                {data.recent_controls.length > 0 ? (
                  data.recent_controls.map((control) => (
                    <div key={control.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full mt-2 ${getStatusColor(control.status).split(' ')[0].replace('text-', 'bg-')}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {control.title}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {control.control_id} • Updated {formatDate(control.updated_at)}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(control.status)}`}>
                          {control.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No recent updates</p>
                )}
              </div>
            </div>

            {/* Upcoming Reviews */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Upcoming Reviews
              </h3>
              <div className="space-y-4">
                {data.upcoming_reviews.length > 0 ? (
                  data.upcoming_reviews.map((control) => (
                    <div key={control.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {control.title}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {control.control_id} • Due {formatDate(control.next_review_date!)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No upcoming reviews</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}