'use client';

import { useState } from 'react';
import { ComplianceFramework } from '../../types';

interface ComplianceReportsProps {
  frameworks: ComplianceFramework[];
}

export function ComplianceReports({ frameworks }: ComplianceReportsProps) {
  const [selectedFramework, setSelectedFramework] = useState<string>('');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [generating, setGenerating] = useState(false);

  const generateReport = async () => {
    setGenerating(true);

    try {
      const response = await fetch('/api/compliance/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          framework_id: selectedFramework || undefined,
          format: reportFormat,
        }),
      });

      const _result = await response.json();

      if (result.success) {
        // In a real implementation, this would trigger a download
        alert(`Report generated successfully! Report ID: ${result.data.report_id}`);
      } else {
        alert(result.error?.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Compliance Reports
        </h2>
      </div>

      {/* Report Generation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Generate New Report
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Framework (Optional)
              </label>
              <select
                value={selectedFramework}
                onChange={(e) => setSelectedFramework(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Frameworks</option>
                {frameworks.map((framework) => (
                  <option key={framework.id} value={framework.id}>
                    {framework.name} v{framework.version}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave empty to include all frameworks
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Format
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="pdf"
                    checked={reportFormat === 'pdf'}
                    onChange={(e) => setReportFormat(e.target.value as 'pdf' | 'csv')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    PDF Report (Formatted document with branding)
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="csv"
                    checked={reportFormat === 'csv'}
                    onChange={(e) => setReportFormat(e.target.value as 'pdf' | 'csv')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    CSV Export (Raw data for analysis)
                  </span>
                </label>
              </div>
            </div>

            <button
              onClick={generateReport}
              disabled={generating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center space-x-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Report Contents
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Executive summary with compliance scores</li>
              <li>• Framework-specific control status</li>
              <li>• Evidence documentation links</li>
              <li>• Compliance gaps and recommendations</li>
              <li>• Review dates and assigned personnel</li>
              <li>• Tenant branding and timestamp</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Recent Reports
        </h3>
        
        <div className="space-y-3">
          {/* Mock recent reports */}
          {[
            {
              id: 'report-1',
              name: 'HIPAA Compliance Report',
              format: 'PDF',
              generated_at: new Date('2024-10-20'),
              framework: 'HIPAA',
            },
            {
              id: 'report-2',
              name: 'All Frameworks Export',
              format: 'CSV',
              generated_at: new Date('2024-10-15'),
              framework: 'All',
            },
            {
              id: 'report-3',
              name: 'ISO 27001 Compliance Report',
              format: 'PDF',
              generated_at: new Date('2024-10-10'),
              framework: 'ISO 27001',
            },
          ].map((report) => (
            <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{report.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {report.framework} • {report.format} • {report.generated_at.toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium">
                Download
              </button>
            </div>
          ))}
        </div>

        {/* Empty state would go here if no reports */}
      </div>

      {/* Report Templates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Report Templates
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              name: 'Executive Summary',
              description: 'High-level compliance overview for leadership',
              icon: '📊',
            },
            {
              name: 'Detailed Assessment',
              description: 'Complete control-by-control analysis',
              icon: '📋',
            },
            {
              name: 'Gap Analysis',
              description: 'Focus on non-compliant and missing controls',
              icon: '🔍',
            },
            {
              name: 'Evidence Inventory',
              description: 'List of all uploaded evidence files',
              icon: '📁',
            },
            {
              name: 'Audit Preparation',
              description: 'Formatted for external audit review',
              icon: '✅',
            },
            {
              name: 'Trend Analysis',
              description: 'Compliance progress over time',
              icon: '📈',
            },
          ].map((template) => (
            <div key={template.name} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer">
              <div className="text-2xl mb-2">{template.icon}</div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                {template.name}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {template.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}