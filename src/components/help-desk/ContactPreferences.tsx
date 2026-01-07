'use client';

import React from 'react';
import { Ticket } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Mail, Phone, User, MessageCircle } from 'lucide-react';

interface ContactPreferencesProps {
    ticket: Ticket;
}

export function ContactPreferences({ ticket }: ContactPreferencesProps) {
    // Determine contact method from ticket data
    // In a real implementation, this would come from user preferences or ticket creation data
    const getContactMethod = () => {
        // For now, we'll infer from available data or default to email
        // In the future, this should be stored in the ticket or user profile
        return 'email'; // Default to email
    };

    const contactMethod = getContactMethod();
    const hasPhoneNumber = ticket.phoneNumber ? true : false; // Check if phone number exists in ticket data

    return (
        <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-gray-900">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                    Contact Preferences
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Primary Contact Information */}
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <User className="h-5 w-5 text-gray-700" />
                            <div>
                                <div className="font-semibold text-gray-900">
                                    {typeof ticket.requester === 'string' ? ticket.requester : ticket.requester?.email || 'Unknown'}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Primary Contact
                                </div>
                            </div>
                        </div>

                        {/* Preferred Contact Method */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-900">
                                    Email (Primary)
                                </span>
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                    Preferred
                                </Badge>
                            </div>

                            <div className="text-sm text-gray-700 ml-6 font-mono bg-white px-2 py-1 rounded border">
                                {typeof ticket.requester === 'string' ? ticket.requester : ticket.requester?.email || 'Unknown'}
                            </div>

                            {hasPhoneNumber && (
                                <>
                                    <div className="flex items-center gap-2 mt-3">
                                        <Phone className="h-4 w-4 text-gray-600" />
                                        <span className="text-sm font-medium text-gray-900">
                                            Phone (Secondary)
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-700 ml-6 font-mono bg-white px-2 py-1 rounded border">
                                        {ticket.phoneNumber || 'No phone number provided'}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Contact Guidelines */}
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-900 mb-2">Communication Guidelines</div>
                        <div className="text-sm text-gray-700 space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                <span>All updates will be sent via email</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                <span>User will receive notifications for status changes</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
                                <span>Response expected within 24 hours</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}