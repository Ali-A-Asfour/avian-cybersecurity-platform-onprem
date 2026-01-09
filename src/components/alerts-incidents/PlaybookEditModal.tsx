'use client';

import { useState, useEffect } from 'react';
import { InvestigationPlaybook, PlaybookStatus } from '@/types/alerts-incidents';

interface PlaybookWithClassifications {
    playbook: InvestigationPlaybook;
    classifications: {
        classification: string;
        isPrimary: boolean;
    }[];
}

interface PlaybookEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (playbookId: string, playbook: Partial<InvestigationPlaybook>, classifications: string[]) => Promise<void>;
    playbook: PlaybookWithClassifications | null;
    availableClassifications: string[];
}

export function PlaybookEditModal({ 
    isOpen, 
    onClose, 
    onSave, 
    playbook,
    availableClassifications 
}: PlaybookEditModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        version: '1.0',
        status: 'draft' as PlaybookStatus,
        purpose: '',
        quickResponseGuide: ['', '', ''],
        initialValidationSteps: [''],
        sourceInvestigationSteps: [''],
        containmentChecks: [''],
        decisionGuidance: {
            escalateToIncident: '',
            resolveBenign: '',
            resolveFalsePositive: ''
        }
    });
    
    const [selectedClassifications, setSelectedClassifications] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    // Initialize form data when playbook changes
    useEffect(() => {
        if (playbook) {
            setFormData({
                name: playbook.playbook.name,
                version: playbook.playbook.version,
                status: playbook.playbook.status,
                purpose: playbook.playbook.purpose,
                quickResponseGuide: playbook.playbook.quickResponseGuide?.length ? playbook.playbook.quickResponseGuide : ['', '', ''],
                initialValidationSteps: playbook.playbook.initialValidationSteps?.length ? playbook.playbook.initialValidationSteps : [''],
                sourceInvestigationSteps: playbook.playbook.sourceInvestigationSteps?.length ? playbook.playbook.sourceInvestigationSteps : [''],
                containmentChecks: playbook.playbook.containmentChecks?.length ? playbook.playbook.containmentChecks : [''],
                decisionGuidance: playbook.playbook.decisionGuidance
            });
            
            setSelectedClassifications(playbook.classifications.map(c => c.classification));
        }
    }, [playbook]);

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleArrayChange = (field: string, index: number, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field as keyof typeof prev].map((item: string, i: number) => 
                i === index ? value : item
            )
        }));
    };

    const addArrayItem = (field: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: [...prev[field as keyof typeof prev], '']
        }));
    };

    const removeArrayItem = (field: string, index: number) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field as keyof typeof prev].filter((_: any, i: number) => i !== index)
        }));
    };

    const handleDecisionGuidanceChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            decisionGuidance: {
                ...prev.decisionGuidance,
                [field]: value
            }
        }));
    };

    const handleClassificationToggle = (classification: string) => {
        setSelectedClassifications(prev => 
            prev.includes(classification)
                ? prev.filter(c => c !== classification)
                : [...prev, classification]
        );
    };

    const handleSave = async () => {
        if (!playbook) return;
        
        try {
            setSaving(true);
            
            // Validate required fields
            if (!formData.name.trim() || !formData.purpose.trim()) {
                alert('Name and purpose are required');
                return;
            }

            // Filter out empty strings from arrays
            const cleanedData = {
                ...formData,
                quickResponseGuide: formData.quickResponseGuide.filter(step => step.trim()),
                initialValidationSteps: formData.initialValidationSteps.filter(step => step.trim()),
                sourceInvestigationSteps: formData.sourceInvestigationSteps.filter(step => step.trim()),
                containmentChecks: formData.containmentChecks.filter(step => step.trim())
            };

            await onSave(playbook.playbook.id, cleanedData, selectedClassifications);
            onClose();
        } catch (error) {
            console.error('Error saving playbook:', error);
            alert('Failed to save playbook');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !playbook) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Edit Playbook: {playbook.playbook.name}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="px-6 py-4 space-y-6">
                    {/* Basic Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Version
                            </label>
                            <input
                                type="text"
                                value={formData.version}
                                onChange={(e) => handleInputChange('version', e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Status
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => handleInputChange('status', e.target.value as PlaybookStatus)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="deprecated">Deprecated</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Purpose *
                        </label>
                        <textarea
                            value={formData.purpose}
                            onChange={(e) => handleInputChange('purpose', e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>

                    {/* Alert Classifications */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Link to Alert Classifications
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {availableClassifications.map(classification => (
                                <label key={classification} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedClassifications.includes(classification)}
                                        onChange={() => handleClassificationToggle(classification)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                                        {classification.replace('_', ' ')}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Quick Response Guide */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Quick Response Guide (3 Steps)
                        </label>
                        <div className="space-y-2">
                            {formData.quickResponseGuide.map((step, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-500 w-8">
                                        {index + 1}.
                                    </span>
                                    <input
                                        type="text"
                                        value={step}
                                        onChange={(e) => handleArrayChange('quickResponseGuide', index, e.target.value)}
                                        className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                        placeholder={`Step ${index + 1}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dynamic Arrays for Steps */}
                    {[
                        { field: 'initialValidationSteps', label: 'Initial Validation Steps' },
                        { field: 'sourceInvestigationSteps', label: 'Source Investigation Steps' },
                        { field: 'containmentChecks', label: 'Containment Checks' }
                    ].map(({ field, label }) => (
                        <div key={field}>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {label}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => addArrayItem(field)}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                    + Add Step
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formData[field as keyof typeof formData].map((step: string, index: number) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={step}
                                            onChange={(e) => handleArrayChange(field, index, e.target.value)}
                                            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            placeholder={`${label} ${index + 1}`}
                                        />
                                        {formData[field as keyof typeof formData].length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeArrayItem(field, index)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Decision Guidance */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Decision Guidance
                        </label>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Escalate to Incident
                                </label>
                                <textarea
                                    value={formData.decisionGuidance.escalateToIncident}
                                    onChange={(e) => handleDecisionGuidanceChange('escalateToIncident', e.target.value)}
                                    rows={2}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Resolve as Benign
                                </label>
                                <textarea
                                    value={formData.decisionGuidance.resolveBenign}
                                    onChange={(e) => handleDecisionGuidanceChange('resolveBenign', e.target.value)}
                                    rows={2}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Resolve as False Positive
                                </label>
                                <textarea
                                    value={formData.decisionGuidance.resolveFalsePositive}
                                    onChange={(e) => handleDecisionGuidanceChange('resolveFalsePositive', e.target.value)}
                                    rows={2}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}