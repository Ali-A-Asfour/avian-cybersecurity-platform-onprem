'use client';

import { useRef, useState } from 'react';
import { ComplianceEvidence } from '../../types';
import { DocumentUpload } from './DocumentUpload';
import { DocumentAnalysisViewer } from './DocumentAnalysisViewer';
import { Button } from '@/components/ui/Button';

interface EvidenceUploadProps {
  controlId: string;
  frameworkId?: string;
  onEvidenceUploaded: (evidence: ComplianceEvidence) => void;
}

export function EvidenceUpload({ controlId, frameworkId, onEvidenceUploaded }: EvidenceUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [description, setDescription] = useState('');
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (_e: unknown) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (_e: unknown) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (_e: unknown) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Allowed types: PDF, JPEG, PNG, DOC, DOCX, TXT');
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);

      const response = await fetch(`/api/compliance/controls/${controlId}/evidence`, {
        method: 'POST',
        body: formData,
      });

      const _result = await response.json();

      if (result.success) {
        onEvidenceUploaded(result.data);
        setDescription('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        alert(result.error?.message || 'Failed to upload evidence');
      }
    } catch {
      console.error('Error uploading evidence:', error);
      alert('Failed to upload evidence');
    } finally {
      setUploading(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleDocumentUploadComplete = (documentId: string) => {
    console.log('Document uploaded:', documentId);
    // Convert to ComplianceEvidence format for compatibility
    const mockEvidence: ComplianceEvidence = {
      id: `evidence-${Date.now()}`,
      control_id: controlId,
      filename: `document-${documentId}`,
      original_filename: 'Uploaded Document',
      file_size: 0,
      mime_type: 'application/pdf',
      file_path: `/documents/${documentId}`,
      description: 'AI-analyzed document',
      uploaded_by: 'current-user',
      created_at: new Date(),
    };
    onEvidenceUploaded(mockEvidence);
  };

  const handleAnalysisComplete = (analysisId: string) => {
    console.log('Analysis completed:', analysisId);
    setCurrentAnalysisId(analysisId);
  };

  if (currentAnalysisId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Document Analysis Results
          </h3>
          <Button
            variant="outline"
            onClick={() => setCurrentAnalysisId(null)}
            size="sm"
          >
            Back to Upload
          </Button>
        </div>
        <DocumentAnalysisViewer
          analysisId={currentAnalysisId}
          onReviewSubmitted={() => {
            setCurrentAnalysisId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Method Selection */}
      <div className="flex space-x-4 mb-4">
        <Button
          variant={!showDocumentUpload ? 'default' : 'outline'}
          onClick={() => setShowDocumentUpload(false)}
          size="sm"
        >
          Simple Upload
        </Button>
        <Button
          variant={showDocumentUpload ? 'default' : 'outline'}
          onClick={() => setShowDocumentUpload(true)}
          size="sm"
        >
          AI-Powered Analysis
        </Button>
      </div>

      {showDocumentUpload ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Upload documents with AI-powered analysis for automatic compliance mapping and key findings extraction.
          </div>
          <DocumentUpload
            controlId={controlId}
            frameworkId={frameworkId}
            onUploadComplete={handleDocumentUploadComplete}
            onAnalysisComplete={handleAnalysisComplete}
          />
        </div>
      ) : (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Description (Optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this evidence..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white text-sm"
          rows={2}
        />
      </div>

      {/* File Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
          onChange={handleFileInput}
          disabled={uploading}
        />

        {uploading ? (
          <div className="space-y-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <svg
              className="w-8 h-8 text-gray-400 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div>
              <button
                type="button"
                onClick={openFileDialog}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              >
                Click to upload
              </button>
              <span className="text-gray-500 dark:text-gray-400"> or drag and drop</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PDF, JPEG, PNG, DOC, DOCX, TXT up to 10MB
            </p>
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
}