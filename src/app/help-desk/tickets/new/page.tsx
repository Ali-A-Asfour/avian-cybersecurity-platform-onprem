'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TicketCreationForm } from '@/components/help-desk/TicketCreationForm';
import { TicketConfirmation } from '@/components/help-desk/TicketConfirmation';
import { HelpDeskErrorBoundaryComponent as ErrorBoundary } from '@/components/help-desk/ErrorBoundary';
import { ArrowLeft } from 'lucide-react';
import { api, authenticatedFetch } from '@/lib/api-client';

interface TicketCreationFormData {
    title: string;
    description: string;
    impactLevel: 'critical' | 'medium' | 'low';
    deviceId?: string;
    contactMethod: 'email' | 'phone';
    phoneNumber?: string;
    attachments?: File[];
}

interface CreatedTicket {
    id: string;
    ticketNumber: string;
    impactLevel: 'critical' | 'medium' | 'low';
    contactMethod: 'email' | 'phone';
    userEmail?: string;
    phoneNumber?: string;
}

export default function NewHelpDeskTicketPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading || !isAuthenticated) {
        return null;
    }

    const handleSubmit = async (formData: TicketCreationFormData) => {
        setLoading(true);
        setError(null);

        try {
            // Prepare form data for API
            const ticketData = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                impactLevel: formData.impactLevel,
                deviceId: formData.deviceId?.trim() || undefined,
                contactMethod: formData.contactMethod,
                phoneNumber: formData.contactMethod === 'phone' ? formData.phoneNumber?.trim() : undefined,
            };

            console.log('Submitting ticket data:', ticketData);

            // Submit ticket to API
            const response = await api.post('/api/tickets', ticketData);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Ticket creation failed:', errorData);
                throw new Error(errorData.error?.message || 'Failed to create ticket');
            }

            const result = await response.json();
            const ticket = result.data;

            // Handle file uploads if any
            if (formData.attachments && formData.attachments.length > 0) {
                try {
                    const uploadFormData = new FormData();
                    formData.attachments.forEach((file, index) => {
                        uploadFormData.append(`file${index}`, file);
                    });

                    const uploadResponse = await authenticatedFetch(`/api/tickets/${ticket.id}/attachments`, {
                        method: 'POST',
                        body: uploadFormData,
                    });

                    if (!uploadResponse.ok) {
                        console.warn('Failed to upload attachments, but ticket was created successfully');
                    }
                } catch (uploadError) {
                    console.warn('Error uploading attachments:', uploadError);
                    // Don't fail the entire process for attachment upload errors
                }
            }

            // Set created ticket for confirmation screen
            setCreatedTicket({
                id: ticket.id,
                ticketNumber: ticket.id.slice(0, 8).toUpperCase(), // Use first 8 chars as ticket number
                impactLevel: formData.impactLevel,
                contactMethod: formData.contactMethod,
                userEmail: 'user@example.com', // This would come from auth context in real app
                phoneNumber: formData.phoneNumber,
            });

        } catch (err) {
            console.error('Error creating ticket:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAnother = () => {
        setCreatedTicket(null);
        setError(null);
    };

    const handleViewTicket = (ticketId: string) => {
        router.push(`/help-desk/tickets/${ticketId}`);
    };

    const handleBackToHelpDesk = () => {
        router.push('/dashboard');
    };

    const handleCancel = () => {
        router.push('/dashboard');
    };

    // Show confirmation screen after successful submission
    if (createdTicket) {
        return (
            <div className="container mx-auto p-6">
                <TicketConfirmation
                    ticketNumber={createdTicket.ticketNumber}
                    impactLevel={createdTicket.impactLevel}
                    contactMethod={createdTicket.contactMethod}
                    userEmail={createdTicket.userEmail}
                    phoneNumber={createdTicket.phoneNumber}
                    onCreateAnother={handleCreateAnother}
                    onViewTicket={handleViewTicket}
                    onBackToHelpDesk={handleBackToHelpDesk}
                />
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="container mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={handleCancel}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Help Desk
                    </button>

                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Submit a Help Request
                        </h1>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Having trouble with your computer, software, or need IT support?
                            Fill out this form and our help desk team will assist you.
                        </p>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="max-w-2xl mx-auto mb-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className="text-red-600">
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-red-800 mb-1">
                                        Unable to Submit Request
                                    </h3>
                                    <p className="text-sm text-red-700">
                                        {error}
                                    </p>
                                    <button
                                        onClick={() => setError(null)}
                                        className="text-sm text-red-600 hover:text-red-800 underline mt-2"
                                    >
                                        Try again
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Ticket Creation Form */}
                <TicketCreationForm
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                    loading={loading}
                />

                {/* Help Text */}
                <div className="max-w-2xl mx-auto mt-8 text-center">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-medium text-blue-900 mb-2">
                            Need immediate assistance?
                        </h3>
                        <p className="text-sm text-blue-800 mb-3">
                            For urgent issues that prevent you from working, you can also:
                        </p>
                        <div className="space-y-2 text-sm text-blue-700">
                            <div>📞 Call the IT Help Desk: <strong>(555) 012-3456</strong></div>
                            <div>💬 Use the chat support in the bottom right corner</div>
                            <div>🚶 Visit the IT office in person (Building A, Room 101)</div>
                        </div>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}