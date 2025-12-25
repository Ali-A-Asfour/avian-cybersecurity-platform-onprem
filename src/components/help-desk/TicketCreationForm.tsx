'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ValidationMessage } from '@/components/help-desk/ValidationMessage';
import { Upload, Phone, Mail, HelpCircle, AlertTriangle, Clock, Zap } from 'lucide-react';

interface TicketCreationFormData {
    title: string;
    description: string;
    impactLevel: 'critical' | 'medium' | 'low';
    deviceId?: string;
    contactMethod: 'email' | 'phone';
    phoneNumber?: string;
    attachments?: File[];
}

interface TicketCreationFormProps {
    onSubmit: (data: TicketCreationFormData) => Promise<void>;
    onCancel?: () => void;
    loading?: boolean;
}

export function TicketCreationForm({ onSubmit, onCancel, loading = false }: TicketCreationFormProps) {
    const [formData, setFormData] = useState<TicketCreationFormData>({
        title: '',
        description: '',
        impactLevel: 'medium',
        deviceId: '',
        contactMethod: 'email',
        phoneNumber: '',
        attachments: [],
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [dragActive, setDragActive] = useState(false);

    // Impact level options with user-friendly language
    const impactLevels = [
        {
            value: 'critical' as const,
            label: "I can't work at all",
            description: "This is blocking all my work",
            icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
            selectedBorder: 'border-red-500',
            hoverBg: 'hover:bg-gray-50'
        },
        {
            value: 'medium' as const,
            label: "This is slowing me down",
            description: "I can work but it's difficult",
            icon: <Clock className="h-5 w-5 text-orange-500" />,
            selectedBorder: 'border-orange-500',
            hoverBg: 'hover:bg-gray-50'
        },
        {
            value: 'low' as const,
            label: "It's a minor issue",
            description: "I can work normally but this needs fixing",
            icon: <Zap className="h-5 w-5 text-blue-500" />,
            selectedBorder: 'border-blue-500',
            hoverBg: 'hover:bg-gray-50'
        }
    ];

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Required field validation
        if (!formData.title.trim()) {
            newErrors.title = 'Please provide a short title for your request';
        } else if (formData.title.length > 200) {
            newErrors.title = 'Title must be less than 200 characters';
        }

        if (!formData.description.trim()) {
            newErrors.description = 'Please describe what help you need';
        } else if (formData.description.length > 5000) {
            newErrors.description = 'Description must be less than 5000 characters';
        }

        // Phone number validation (always required)
        if (!formData.phoneNumber?.trim()) {
            newErrors.phoneNumber = 'Phone number is required';
        } else {
            const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
            if (!phoneRegex.test(formData.phoneNumber) || formData.phoneNumber.replace(/\D/g, '').length < 10) {
                newErrors.phoneNumber = 'Please enter a valid phone number';
            }
        }

        // Device ID validation (optional but format check if provided)
        if (formData.deviceId && formData.deviceId.trim()) {
            const deviceIdRegex = /^[A-Z0-9-_]+$/i;
            if (!deviceIdRegex.test(formData.deviceId)) {
                newErrors.deviceId = 'Device ID can only contain letters, numbers, hyphens, and underscores';
            } else if (formData.deviceId.length > 50) {
                newErrors.deviceId = 'Device ID must be less than 50 characters';
            }
        }

        // File validation
        if (formData.attachments && formData.attachments.length > 0) {
            const maxFileSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];

            for (const file of formData.attachments) {
                if (file.size > maxFileSize) {
                    newErrors.attachments = 'Files must be smaller than 10MB';
                    break;
                }
                if (!allowedTypes.includes(file.type)) {
                    newErrors.attachments = 'Only images, PDF, and text files are allowed';
                    break;
                }
            }

            if (formData.attachments.length > 3) {
                newErrors.attachments = 'Maximum 3 files allowed';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            await onSubmit(formData);
        } catch (error) {
            console.error('Error submitting ticket:', error);
        }
    };

    const handleInputChange = (field: keyof TicketCreationFormData, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const handleFileUpload = (files: FileList | null) => {
        if (!files) return;

        const fileArray = Array.from(files);
        const currentFiles = formData.attachments || [];
        const newFiles = [...currentFiles, ...fileArray].slice(0, 3); // Limit to 3 files

        handleInputChange('attachments', newFiles);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files);
        }
    };

    const removeFile = (index: number) => {
        const newFiles = [...(formData.attachments || [])];
        newFiles.splice(index, 1);
        handleInputChange('attachments', newFiles);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HelpCircle className="h-6 w-6 text-blue-600" />
                        Get Help from IT Support
                    </CardTitle>
                    <p className="text-gray-600 text-sm">
                        Tell us what's going wrong and we'll help you fix it. Title, description, and phone number are required.
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                What's the problem? *
                            </label>
                            <Input
                                type="text"
                                value={formData.title}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                                placeholder="e.g., Can't print to the office printer"
                                className={errors.title ? 'border-red-300' : ''}
                                disabled={loading}
                            />
                            <ValidationMessage message={errors.title} />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tell us more about what's happening *
                            </label>
                            <textarea
                                className={`w-full px-3 py-2 border rounded-md resize-vertical min-h-[120px] ${errors.description ? 'border-red-300' : 'border-gray-300'
                                    } ${loading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                                value={formData.description}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                placeholder="Describe what you were trying to do, what went wrong, and any error messages you saw..."
                                disabled={loading}
                            />
                            <ValidationMessage message={errors.description} />
                        </div>

                        {/* Impact Level */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                How is this affecting your work? *
                            </label>
                            <div className="space-y-3">
                                {impactLevels.map((level) => (
                                    <div
                                        key={level.value}
                                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${formData.impactLevel === level.value
                                            ? `${level.selectedBorder} bg-white shadow-sm`
                                            : `border-gray-200 bg-white ${level.hoverBg}`
                                            } ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
                                        onClick={() => !loading && handleInputChange('impactLevel', level.value)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="radio"
                                                name="impactLevel"
                                                value={level.value}
                                                checked={formData.impactLevel === level.value}
                                                onChange={() => handleInputChange('impactLevel', level.value)}
                                                className="mt-1"
                                                disabled={loading}
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {level.icon}
                                                    <span className="font-medium text-gray-900">{level.label}</span>
                                                </div>
                                                <p className="text-sm text-gray-600">{level.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Device ID (Optional) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Computer or device name (if you know it)
                            </label>
                            <Input
                                type="text"
                                value={formData.deviceId}
                                onChange={(e) => handleInputChange('deviceId', e.target.value)}
                                placeholder="e.g., PC-RECEP-01, LAPTOP-JOHN-02"
                                className={errors.deviceId ? 'border-red-300' : ''}
                                disabled={loading}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                This helps us connect to your computer remotely if needed
                            </p>
                            <ValidationMessage message={errors.deviceId} />
                        </div>

                        {/* Contact Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                How should we contact you?
                            </label>
                            <div className="space-y-3">
                                <div
                                    className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${formData.contactMethod === 'email'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                        } ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
                                    onClick={() => !loading && handleInputChange('contactMethod', 'email')}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="contactMethod"
                                            value="email"
                                            checked={formData.contactMethod === 'email'}
                                            onChange={() => handleInputChange('contactMethod', 'email')}
                                            disabled={loading}
                                        />
                                        <Mail className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <span className="font-medium text-gray-900">Email updates</span>
                                            <p className="text-sm text-gray-600">We'll send updates to your work email</p>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${formData.contactMethod === 'phone'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                        } ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
                                    onClick={() => !loading && handleInputChange('contactMethod', 'phone')}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="contactMethod"
                                            value="phone"
                                            checked={formData.contactMethod === 'phone'}
                                            onChange={() => handleInputChange('contactMethod', 'phone')}
                                            disabled={loading}
                                        />
                                        <Phone className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <span className="font-medium text-gray-900">Phone call</span>
                                            <p className="text-sm text-gray-600">We'll call you with updates</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Phone Number Input (always required) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Your phone number *
                            </label>
                            <Input
                                type="tel"
                                value={formData.phoneNumber}
                                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                                placeholder="e.g., +1 (555) 123-4567"
                                className={errors.phoneNumber ? 'border-red-300' : ''}
                                disabled={loading}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Required for urgent issues and verification purposes
                            </p>
                            <ValidationMessage message={errors.phoneNumber} />
                        </div>

                        {/* File Upload (Optional) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Screenshots or files (optional)
                            </label>
                            <div
                                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive
                                    ? 'border-blue-500 bg-blue-50'
                                    : errors.attachments
                                        ? 'border-red-300 bg-red-50'
                                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                                    } ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => !loading && document.getElementById('file-upload')?.click()}
                            >
                                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">
                                    Drop files here or click to browse
                                </p>
                                <p className="text-xs text-gray-500">
                                    Images, PDF, or text files up to 10MB (max 3 files)
                                </p>
                                <input
                                    id="file-upload"
                                    type="file"
                                    multiple
                                    accept="image/*,.pdf,.txt"
                                    onChange={(e) => handleFileUpload(e.target.files)}
                                    className="hidden"
                                    disabled={loading}
                                />
                            </div>
                            <ValidationMessage message={errors.attachments} />

                            {/* File List */}
                            {formData.attachments && formData.attachments.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {formData.attachments.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between bg-gray-100 rounded p-2">
                                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(index)}
                                                className="text-red-500 hover:text-red-700 ml-2"
                                                disabled={loading}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Form Actions */}
                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                            {onCancel && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onCancel}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={loading}
                                className="min-w-[120px]"
                            >
                                {loading ? 'Submitting...' : 'Submit Request'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}