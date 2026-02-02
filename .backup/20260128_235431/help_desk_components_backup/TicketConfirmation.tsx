'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckCircle, Clock, Mail, Phone, ArrowLeft, ExternalLink } from 'lucide-react';

interface TicketConfirmationProps {
    ticketNumber: string;
    impactLevel: 'critical' | 'medium' | 'low';
    contactMethod: 'email' | 'phone';
    userEmail?: string;
    phoneNumber?: string;
    onCreateAnother?: () => void;
    onViewTicket?: (ticketId: string) => void;
    onBackToHelpDesk?: () => void;
}

export function TicketConfirmation({
    ticketNumber,
    impactLevel,
    contactMethod,
    userEmail,
    phoneNumber,
    onCreateAnother,
    onViewTicket,
    onBackToHelpDesk
}: TicketConfirmationProps) {

    // Response time mapping
    const responseTimeMap = {
        critical: {
            time: "within 1 hour",
            description: "We'll prioritize this and get back to you very soon"
        },
        medium: {
            time: "within 4 hours",
            description: "We'll work on this today and keep you updated"
        },
        low: {
            time: "within 1 business day",
            description: "We'll address this during normal business hours"
        }
    };

    const responseInfo = responseTimeMap[impactLevel];

    // Contact method display
    const contactDisplay = {
        email: {
            icon: <Mail className="h-5 w-5 text-blue-600" />,
            method: "Email",
            detail: userEmail || "your work email"
        },
        phone: {
            icon: <Phone className="h-5 w-5 text-blue-600" />,
            method: "Phone",
            detail: phoneNumber || "the phone number you provided"
        }
    };

    const contactInfo = contactDisplay[contactMethod];

    return (
        <div className="max-w-2xl mx-auto">
            <Card>
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl text-green-800">
                        Request Submitted Successfully!
                    </CardTitle>
                    <p className="text-gray-600">
                        Your support request has been received and assigned ticket number:
                    </p>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Ticket Number */}
                    <div className="text-center">
                        <div className="inline-flex items-center bg-blue-50 border border-blue-200 rounded-lg px-6 py-3">
                            <span className="text-sm font-medium text-blue-800 mr-2">Ticket #</span>
                            <span className="text-xl font-bold text-blue-900">{ticketNumber}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                            Save this number for your records
                        </p>
                    </div>

                    {/* Response Time */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Clock className="h-6 w-6 text-gray-600 mt-0.5" />
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1">
                                    Expected Response Time
                                </h3>
                                <p className="text-lg font-semibold text-gray-800 mb-1">
                                    We'll respond {responseInfo.time}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {responseInfo.description}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Contact Method */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            {contactInfo.icon}
                            <div>
                                <h3 className="font-medium text-blue-900 mb-1">
                                    How We'll Contact You
                                </h3>
                                <p className="text-blue-800 mb-1">
                                    We'll send updates via {contactInfo.method.toLowerCase()} to {contactInfo.detail}
                                </p>
                                <p className="text-sm text-blue-700">
                                    You'll receive a confirmation email shortly with your ticket details
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* What Happens Next */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="font-medium text-gray-900 mb-3">What happens next?</h3>
                        <div className="space-y-2 text-sm text-gray-800">
                            <div className="flex items-start gap-2">
                                <span className="font-semibold min-w-[20px]">1.</span>
                                <span>A help desk analyst will review your request</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="font-semibold min-w-[20px]">2.</span>
                                <span>They'll contact you using your preferred method</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="font-semibold min-w-[20px]">3.</span>
                                <span>We'll work together to resolve your issue</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="font-semibold min-w-[20px]">4.</span>
                                <span>You'll receive updates throughout the process</span>
                            </div>
                        </div>
                    </div>

                    {/* Important Notes */}
                    <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Important Notes:</h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                            <li>• Keep your ticket number ({ticketNumber}) for reference</li>
                            <li>• Reply to any emails from IT support to add updates to your ticket</li>
                            <li>• If this is urgent and you don't hear back within the expected time, call the IT help desk</li>
                            <li>• You can check your ticket status anytime in the help desk portal</li>
                        </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                        <Button
                            variant="outline"
                            onClick={onBackToHelpDesk}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Dashboard
                        </Button>

                        <div className="flex gap-3 flex-1">
                            {onCreateAnother && (
                                <Button
                                    onClick={onCreateAnother}
                                    className="flex-1"
                                >
                                    Submit Another Request
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="text-center pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                            <strong>Need immediate help?</strong> Call the IT Help Desk at{' '}
                            <a href="tel:+1-555-0123" className="text-blue-600 hover:text-blue-800 font-medium">
                                (555) 012-3456
                            </a>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}