'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';

export function ReviewWorkflowGuide() {
  const [activeSection, setActiveSection] = useState<'overview' | 'workflow' | 'feedback' | 'ml'>('overview');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Human-in-the-Loop Review System
        </h2>
        <Label variant="secondary">Documentation</Label>
      </div>

      {/* Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📋' },
            { id: 'workflow', label: 'Review Workflow', icon: '🔄' },
            { id: 'feedback', label: 'Feedback System', icon: '💬' },
            { id: 'ml', label: 'ML Improvement', icon: '🤖' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeSection === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              System Overview
            </h3>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The Human-in-the-Loop Compliance Verification system combines AI-powered document analysis
                with human expertise to ensure accurate compliance assessments. This hybrid approach
                leverages machine learning for initial analysis while incorporating human judgment for
                validation and continuous improvement.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">AI Analysis</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Automated document processing</li>
                    <li>• Key finding extraction</li>
                    <li>• Compliance mapping</li>
                    <li>• Confidence scoring</li>
                  </ul>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Human Review</h4>
                  <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                    <li>• Accuracy validation</li>
                    <li>• Correction feedback</li>
                    <li>• Approval/rejection decisions</li>
                    <li>• Quality assurance</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Key Benefits
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white">Improved Accuracy</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Human validation ensures high-quality compliance assessments
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white">Continuous Learning</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  ML models improve through human feedback and corrections
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white">Efficiency</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Automated processing with targeted human intervention
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeSection === 'workflow' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Review Workflow Process
            </h3>

            <div className="space-y-6">
              {[
                {
                  step: 1,
                  title: 'Document Upload & AI Analysis',
                  description: 'Documents are uploaded and processed using AI for initial analysis',
                  details: [
                    'OCR processing for scanned documents',
                    'NLP analysis for key finding extraction',
                    'Compliance framework mapping',
                    'Confidence score calculation',
                  ],
                  status: 'automated',
                },
                {
                  step: 2,
                  title: 'Review Requirement Assessment',
                  description: 'System determines if human review is needed based on confidence thresholds',
                  details: [
                    'Confidence score < 70% triggers review',
                    'Complex compliance mappings require validation',
                    'Critical frameworks get priority review',
                    'Random sampling for quality assurance',
                  ],
                  status: 'automated',
                },
                {
                  step: 3,
                  title: 'Human Review Assignment',
                  description: 'Analyses requiring review are assigned to qualified reviewers',
                  details: [
                    'Priority-based queue management',
                    'Reviewer expertise matching',
                    'Workload balancing',
                    'SLA tracking and notifications',
                  ],
                  status: 'manual',
                },
                {
                  step: 4,
                  title: 'Review Execution',
                  description: 'Reviewers validate findings, mappings, and provide feedback',
                  details: [
                    'Finding accuracy assessment',
                    'Compliance mapping validation',
                    'Correction and improvement suggestions',
                    'Overall approval or rejection decision',
                  ],
                  status: 'manual',
                },
                {
                  step: 5,
                  title: 'Feedback Integration',
                  description: 'Human feedback is processed and used for ML model improvement',
                  details: [
                    'Training data generation',
                    'Model weight adjustments',
                    'Confidence calibration updates',
                    'Performance metrics tracking',
                  ],
                  status: 'automated',
                },
              ].map((step, index) => (
                <div key={step.step} className="flex items-start space-x-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step.status === 'automated'
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
                    }`}>
                    {step.step}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">{step.title}</h4>
                      <Badge variant={step.status === 'automated' ? 'secondary' : 'success'}>
                        {step.status}
                      </Badge>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">{step.description}</p>
                    <ul className="text-sm text-gray-500 dark:text-gray-500 space-y-1">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex}>• {detail}</li>
                      ))}
                    </ul>
                  </div>

                  {index < 4 && (
                    <div className="flex-shrink-0 w-px h-16 bg-gray-200 dark:bg-gray-700 ml-4"></div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeSection === 'feedback' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Feedback Collection System
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Finding Feedback</h4>
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">Relevance Assessment</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Reviewers mark whether each finding is relevant to compliance requirements
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">Accuracy Rating</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      0-100% accuracy score for each finding's correctness
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">Corrections</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Suggested improvements for category, description, or classification
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Mapping Feedback</h4>
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">Correctness Validation</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Verification that compliance mappings are accurate and complete
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">Status Corrections</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Updates to compliance status (satisfied, partial, not satisfied)
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">Evidence Updates</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Improvements to evidence text and supporting documentation
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Audit Trail & Tracking
            </h3>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Complete Review History</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Every review action is logged with timestamp, reviewer ID, and detailed feedback
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Decision Tracking</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Approval/rejection decisions with reasoning and supporting evidence
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Performance Metrics</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Reviewer performance, accuracy trends, and system improvement metrics
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Compliance Reporting</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Exportable audit data for regulatory compliance and quality assurance
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeSection === 'ml' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Machine Learning Improvement
            </h3>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Feedback Integration Process</h4>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">1</span>
                      </div>
                      <h5 className="font-medium text-gray-900 dark:text-white">Data Collection</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Human feedback is converted to training data
                      </p>
                    </div>

                    <div className="text-center">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">2</span>
                      </div>
                      <h5 className="font-medium text-gray-900 dark:text-white">Model Training</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        ML models are retrained with corrected examples
                      </p>
                    </div>

                    <div className="text-center">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <span className="text-green-600 dark:text-green-400 font-semibold">3</span>
                      </div>
                      <h5 className="font-medium text-gray-900 dark:text-white">Deployment</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Improved models are deployed for better accuracy
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Improvement Areas</h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Confidence Calibration</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Finding Classification</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Compliance Mapping</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Document Understanding</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Performance Metrics</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Precision</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">87%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Recall</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">82%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">F1 Score</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">84%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Calibration Error</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">8%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Continuous Improvement Cycle
            </h3>

            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Continuous</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h5 className="font-medium text-blue-900 dark:text-blue-100">Monitor Performance</h5>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Track accuracy, confidence calibration, and user feedback
                    </p>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h5 className="font-medium text-green-900 dark:text-green-100">Collect Feedback</h5>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Gather human corrections and validation data
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <h5 className="font-medium text-purple-900 dark:text-purple-100">Update Models</h5>
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      Retrain with new data and deploy improvements
                    </p>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                    <h5 className="font-medium text-orange-900 dark:text-orange-100">Validate Results</h5>
                    <p className="text-sm text-orange-800 dark:text-orange-200">
                      Test improved models and measure performance gains
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}