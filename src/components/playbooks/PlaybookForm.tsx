'use client';

import React, { useState } from 'react';
import { SecurityPlaybook, ThreatType, PlaybookSeverity, StepActionType, PlaybookStep, PlaybookTrigger, AlertCategory, AlertSeverity } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface PlaybookFormProps {
  playbook?: SecurityPlaybook;
  onSubmit: (playbookData: Partial<SecurityPlaybook>) => void;
  onCancel: () => void;
}

export function PlaybookForm({ playbook, onSubmit, onCancel }: PlaybookFormProps) {
  const [formData, setFormData] = useState({
    name: playbook?.name || '',
    description: playbook?.description || '',
    threat_type: playbook?.threat_type || ThreatType.MALWARE,
    severity_level: playbook?.severity_level || PlaybookSeverity.MEDIUM,
    estimated_duration: playbook?.estimated_duration || 60,
    steps: playbook?.steps || [],
    triggers: playbook?.triggers || []
  });

  const [currentStep, setCurrentStep] = useState<Partial<PlaybookStep>>({
    step_number: (formData.steps.length || 0) + 1,
    title: '',
    description: '',
    action_type: StepActionType.INVESTIGATION,
    required: true,
    estimated_time: 15,
    dependencies: [],
    verification_criteria: '',
    instructions: ''
  });

  const [currentTrigger, setCurrentTrigger] = useState<Partial<PlaybookTrigger>>({
    alert_category: undefined,
    alert_severity: undefined,
    keywords: [],
    conditions: {}
  });

  const [keywordInput, setKeywordInput] = useState('');

  const handleSubmit = (_e: unknown) => {
    e.preventDefault();
    
    // Calculate total estimated duration from steps
    const totalDuration = formData.steps.reduce((sum, step) => sum + step.estimated_time, 0);
    
    onSubmit({
      ...formData,
      estimated_duration: totalDuration
    });
  };

  const addStep = () => {
    if (!currentStep.title || !currentStep.description) return;

    const newStep: PlaybookStep = {
      id: `step-${Date.now()}`,
      step_number: currentStep.step_number || 1,
      title: currentStep.title,
      description: currentStep.description,
      action_type: currentStep.action_type || StepActionType.INVESTIGATION,
      required: currentStep.required || true,
      estimated_time: currentStep.estimated_time || 15,
      dependencies: currentStep.dependencies || [],
      verification_criteria: currentStep.verification_criteria || '',
      instructions: currentStep.instructions || ''
    };

    setFormData({
      ...formData,
      steps: [...formData.steps, newStep]
    });

    setCurrentStep({
      step_number: (formData.steps.length || 0) + 2,
      title: '',
      description: '',
      action_type: StepActionType.INVESTIGATION,
      required: true,
      estimated_time: 15,
      dependencies: [],
      verification_criteria: '',
      instructions: ''
    });
  };

  const removeStep = (stepId: string) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter(step => step.id !== stepId)
    });
  };

  const addTrigger = () => {
    if (!currentTrigger.keywords?.length) return;

    const newTrigger: PlaybookTrigger = {
      id: `trigger-${Date.now()}`,
      alert_category: currentTrigger.alert_category,
      alert_severity: currentTrigger.alert_severity,
      keywords: currentTrigger.keywords || [],
      conditions: currentTrigger.conditions || {}
    };

    setFormData({
      ...formData,
      triggers: [...formData.triggers, newTrigger]
    });

    setCurrentTrigger({
      alert_category: undefined,
      alert_severity: undefined,
      keywords: [],
      conditions: {}
    });
  };

  const removeTrigger = (triggerId: string) => {
    setFormData({
      ...formData,
      triggers: formData.triggers.filter(trigger => trigger.id !== triggerId)
    });
  };

  const addKeyword = () => {
    if (!keywordInput.trim()) return;
    
    setCurrentTrigger({
      ...currentTrigger,
      keywords: [...(currentTrigger.keywords || []), keywordInput.trim()]
    });
    setKeywordInput('');
  };

  const removeKeyword = (keyword: string) => {
    setCurrentTrigger({
      ...currentTrigger,
      keywords: (currentTrigger.keywords || []).filter(k => k !== keyword)
    });
  };

  const getActionTypeColor = (actionType: StepActionType) => {
    switch (actionType) {
      case StepActionType.INVESTIGATION:
        return 'bg-blue-100 text-blue-800';
      case StepActionType.CONTAINMENT:
        return 'bg-orange-100 text-orange-800';
      case StepActionType.ERADICATION:
        return 'bg-red-100 text-red-800';
      case StepActionType.RECOVERY:
        return 'bg-green-100 text-green-800';
      case StepActionType.COMMUNICATION:
        return 'bg-purple-100 text-purple-800';
      case StepActionType.DOCUMENTATION:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {playbook ? 'Edit Playbook' : 'Create New Playbook'}
          </h2>
          <p className="text-gray-600">Define a standardized response procedure for security incidents</p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Playbook Name *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Malware Incident Response"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Threat Type *
              </label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.threat_type}
                onChange={(e) => setFormData({ ...formData, threat_type: e.target.value as ThreatType })}
              >
                {Object.values(ThreatType).map(type => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the purpose and scope of this playbook..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity Level *
              </label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.severity_level}
                onChange={(e) => setFormData({ ...formData, severity_level: e.target.value as PlaybookSeverity })}
              >
                {Object.values(PlaybookSeverity).map(severity => (
                  <option key={severity} value={severity}>
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Steps */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Response Steps</h3>
          
          {/* Existing Steps */}
          {formData.steps.length > 0 && (
            <div className="space-y-3 mb-6">
              {formData.steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                    {step.step_number}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{step.title}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${getActionTypeColor(step.action_type)}`}>
                        {step.action_type}
                      </span>
                      {step.required && (
                        <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{step.description}</p>
                    <p className="text-xs text-gray-500 mt-1">~{step.estimated_time} minutes</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeStep(step.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Step */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Add New Step</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Step Title
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentStep.title}
                  onChange={(e) => setCurrentStep({ ...currentStep, title: e.target.value })}
                  placeholder="e.g., Isolate Affected Systems"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action Type
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentStep.action_type}
                  onChange={(e) => setCurrentStep({ ...currentStep, action_type: e.target.value as StepActionType })}
                >
                  {Object.values(StepActionType).map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentStep.description}
                  onChange={(e) => setCurrentStep({ ...currentStep, description: e.target.value })}
                  placeholder="Describe what needs to be done in this step..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Detailed Instructions
                </label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentStep.instructions}
                  onChange={(e) => setCurrentStep({ ...currentStep, instructions: e.target.value })}
                  placeholder="Provide detailed step-by-step instructions..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Time (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentStep.estimated_time}
                  onChange={(e) => setCurrentStep({ ...currentStep, estimated_time: parseInt(e.target.value) || 15 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Criteria
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentStep.verification_criteria}
                  onChange={(e) => setCurrentStep({ ...currentStep, verification_criteria: e.target.value })}
                  placeholder="How to verify this step is complete"
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={currentStep.required}
                    onChange={(e) => setCurrentStep({ ...currentStep, required: e.target.checked })}
                    className="mr-2"
                  />
                  Required Step
                </label>
                <Button
                  type="button"
                  onClick={addStep}
                  disabled={!currentStep.title || !currentStep.description}
                >
                  Add Step
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Triggers */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Automation Triggers</h3>
          <p className="text-sm text-gray-600 mb-4">
            Define conditions that will automatically recommend this playbook for alerts
          </p>

          {/* Existing Triggers */}
          {formData.triggers.length > 0 && (
            <div className="space-y-3 mb-6">
              {formData.triggers.map((trigger) => (
                <div key={trigger.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {trigger.alert_category && (
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          {trigger.alert_category}
                        </span>
                      )}
                      {trigger.alert_severity && (
                        <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                          {trigger.alert_severity}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {trigger.keywords.map((keyword, index) => (
                        <span key={index} className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeTrigger(trigger.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Trigger */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Add New Trigger</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alert Category (Optional)
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentTrigger.alert_category || ''}
                  onChange={(e) => setCurrentTrigger({ ...currentTrigger, alert_category: e.target.value as AlertCategory || undefined })}
                >
                  <option value="">Any Category</option>
                  {Object.values(AlertCategory).map(category => (
                    <option key={category} value={category}>
                      {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alert Severity (Optional)
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentTrigger.alert_severity || ''}
                  onChange={(e) => setCurrentTrigger({ ...currentTrigger, alert_severity: e.target.value as AlertSeverity || undefined })}
                >
                  <option value="">Any Severity</option>
                  {Object.values(AlertSeverity).map(severity => (
                    <option key={severity} value={severity}>
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="Enter keyword..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  />
                  <Button type="button" onClick={addKeyword} disabled={!keywordInput.trim()}>
                    Add
                  </Button>
                </div>
                {currentTrigger.keywords && currentTrigger.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {currentTrigger.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 cursor-pointer"
                        onClick={() => removeKeyword(keyword)}
                      >
                        {keyword} ×
                      </span>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  onClick={addTrigger}
                  disabled={!currentTrigger.keywords?.length}
                >
                  Add Trigger
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!formData.name || !formData.description || formData.steps.length === 0}>
            {playbook ? 'Update Playbook' : 'Create Playbook'}
          </Button>
        </div>
      </form>
    </div>
  );
}