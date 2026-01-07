'use client';

import { useEffect, useState } from 'react';
import { ComplianceFramework } from '../../types';
import { AddFrameworkModal } from './AddFrameworkModal';
import { api } from '@/lib/api-client';

interface ComplianceFrameworkListProps {
  frameworks: ComplianceFramework[];
  onFrameworkSelect: (framework: ComplianceFramework) => void;
  onFrameworksChange?: () => void;
}

interface FrameworkScore {
  framework_id: string;
  score: number;
  total_controls: number;
  completed_controls: number;
}

export function ComplianceFrameworkList({ frameworks, onFrameworkSelect, onFrameworksChange }: ComplianceFrameworkListProps) {
  const [frameworkScores, setFrameworkScores] = useState<Record<string, FrameworkScore>>({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchFrameworkScores();
  }, [frameworks]);

  const fetchFrameworkScores = async () => {
    try {
      const scores: Record<string, FrameworkScore> = {};

      for (const framework of frameworks) {
        const response = await api.get(`/api/compliance/score?framework_id=${framework.id}`);
        const result = await response.json();

        if (result.success) {
          scores[framework.id] = {
            framework_id: framework.id,
            score: result.data.framework_scores[framework.id] || 0,
            total_controls: result.data.total_controls,
            completed_controls: result.data.completed_controls,
          };
        }
      }

      setFrameworkScores(scores);
    } catch (error) {
      console.error('Error fetching framework scores:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
    if (score >= 50) return 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300';
    return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) {
      return (
        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    if (score >= 70) {
      return (
        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Compliance Frameworks
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {frameworks.length} active framework{frameworks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Framework
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {frameworks.map((framework) => {
          const score = frameworkScores[framework.id];

          return (
            <div
              key={framework.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
              onClick={() => onFrameworkSelect(framework)}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {framework.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Version {framework.version}
                      </p>
                    </div>
                  </div>

                  {score && (
                    <div className="flex items-center space-x-2">
                      {getScoreIcon(score.score)}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(score.score)}`}>
                        {score.score}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {framework.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {framework.description}
                  </p>
                )}

                {/* Progress Bar */}
                {score && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{score.completed_controls} of {score.total_controls} controls</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${score.score}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Updated {new Date(framework.updated_at).toLocaleDateString()}
                  </span>
                  <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
                    View Controls →
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {frameworks.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Compliance Frameworks
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Get started by adding your first compliance framework like HIPAA or PHIPA.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Framework
          </button>
        </div>
      )}

      {/* Add Framework Modal */}
      <AddFrameworkModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onFrameworkAdded={() => {
          setShowAddModal(false);
          onFrameworksChange?.();
        }}
      />
    </div>
  );
}