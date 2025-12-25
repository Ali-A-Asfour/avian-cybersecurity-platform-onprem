'use client';

import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AnalysisType } from '@/types';

interface DocumentUploadProps {
  controlId?: string;
  frameworkId?: string;
  onUploadComplete?: (documentId: string) => void;
  onAnalysisComplete?: (analysisId: string) => void;
}

export function DocumentUpload({
  controlId,
  frameworkId,
  onUploadComplete,
  onAnalysisComplete,
}: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [analysisType, setAnalysisType] = useState<AnalysisType>(AnalysisType.POLICY_DOCUMENT);
  const [enableAnalysis, setEnableAnalysis] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((_e: unknown) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((_e: unknown) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((_e: unknown) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFile(droppedFiles[0]);
    }
  }, []);

  const handleFileSelect = (_e: unknown) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);
      formData.append('analysisRequested', enableAnalysis.toString());
      
      if (controlId) formData.append('controlId', controlId);
      if (frameworkId) formData.append('frameworkId', frameworkId);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const _result = await response.json();

      if (result.success) {
        const documentId = result.data.id;
        onUploadComplete?.(documentId);

        if (enableAnalysis) {
          await handleAnalysis(documentId);
        }

        // Reset form
        setFile(null);
        setDescription('');
        setEnableAnalysis(true);
      } else {
        console.error('Upload failed:', result.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalysis = async (documentId: string) => {
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis_type: analysisType,
          framework_id: frameworkId,
          control_id: controlId,
          processing_options: {
            enable_ocr: true,
            enable_nlp: true,
            confidence_threshold: 70,
            extract_tables: true,
            extract_images: false,
          },
        }),
      });

      const _result = await response.json();

      if (result.success) {
        onAnalysisComplete?.(result.data.id);
      } else {
        console.error('Analysis failed:', result.error);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isValidFileType = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ];
    return allowedTypes.includes(file.type);
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Upload Compliance Document
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload documents for AI-powered analysis and compliance mapping
          </p>
        </div>

        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatFileSize(file.size)}
                </p>
                {!isValidFileType(file) && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    Unsupported file type. Please upload PDF, Word, or image files.
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFile(null)}
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  Drop your document here
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  or click to browse files
                </p>
              </div>
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.tiff"
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" className="cursor-pointer">
                  Browse Files
                </Button>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Supported: PDF, Word, Text, Images (max 50MB)
              </p>
            </div>
          )}
        </div>

        {/* Document Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description (Optional)
          </label>
          <Input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the document..."
            className="w-full"
          />
        </div>

        {/* Analysis Options */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enable-analysis"
              checked={enableAnalysis}
              onChange={(e) => setEnableAnalysis(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="enable-analysis" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable AI Analysis
            </label>
          </div>

          {enableAnalysis && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Analysis Type
              </label>
              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value={AnalysisType.POLICY_DOCUMENT}>Policy Document</option>
                <option value={AnalysisType.PROCEDURE_MANUAL}>Procedure Manual</option>
                <option value={AnalysisType.TRAINING_MATERIAL}>Training Material</option>
                <option value={AnalysisType.AUDIT_REPORT}>Audit Report</option>
                <option value={AnalysisType.RISK_ASSESSMENT}>Risk Assessment</option>
                <option value={AnalysisType.SECURITY_POLICY}>Security Policy</option>
                <option value={AnalysisType.INCIDENT_RESPONSE_PLAN}>Incident Response Plan</option>
              </select>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={!file || !isValidFileType(file) || uploading || analyzing}
            className="min-w-[120px]"
          >
            {uploading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Uploading...</span>
              </div>
            ) : analyzing ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing...</span>
              </div>
            ) : (
              'Upload & Analyze'
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}