'use client';

import { useState } from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { TicketList } from '@/components/tickets/TicketList';
import { TicketForm } from '@/components/tickets/TicketForm';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { Ticket, TicketCategory, UserRole } from '@/types';
import { useDemoContext } from '@/contexts/DemoContext';

export const dynamic = 'force-dynamic';

export default function SecurityTicketsPage() {
    const { currentUser } = useDemoContext();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [ticketFieldPermissions, setTicketFieldPermissions] = useState<Record<string, { canEdit: boolean; reason?: string }> | null>(null);

    // Only super admin can edit tickets
    const canEditTickets = currentUser.role === UserRole.SUPER_ADMIN;

    // Security-related ticket categories for filtering
    const securityCategories = [
        TicketCategory.SECURITY_INCIDENT,
        TicketCategory.VULNERABILITY,
        TicketCategory.MALWARE_DETECTION,
        TicketCategory.PHISHING_ATTEMPT,
        TicketCategory.DATA_BREACH,
        TicketCategory.POLICY_VIOLATION,
        TicketCategory.COMPLIANCE,
    ];

    const handleCreateTicket = () => {
        setSelectedTicket(null);
        setShowCreateForm(true);
    };

    const handleEditTicket = (ticket: Ticket) => {
        if (!canEditTickets) {
            console.warn('Only Super Admin can edit tickets');
            return;
        }
        setSelectedTicket(ticket);
        setShowEditForm(true);
    };

    const handleViewTicket = async (ticket: Ticket) => {
        try {
            // Use mock data for development
            const { delay } = await import('@/lib/mock-data');
            await delay(300); // Simulate API call

            // Use basic ticket data for demo
            setSelectedTicket(ticket);
            setTicketFieldPermissions(null);
            setShowDetailModal(true);
        } catch (error) {
            console.error('Error fetching ticket details:', error);
            // Fallback to basic ticket data
            setSelectedTicket(ticket);
            setTicketFieldPermissions(null);
            setShowDetailModal(true);
        }
    };

    const handleSubmitTicket = async (ticketData: Partial<Ticket>) => {
        try {
            // Use mock data for development
            const { delay } = await import('@/lib/mock-data');
            await delay(500); // Simulate API call

            // Simulate successful save
            console.log('Mock security ticket save:', ticketData);

            // Close modals and refresh
            handleCloseModals();
            // In a real app, we'd refresh the ticket list here
        } catch (error) {
            throw error;
        }
    };

    const handleCloseModals = () => {
        setShowCreateForm(false);
        setShowEditForm(false);
        setShowDetailModal(false);
        setSelectedTicket(null);
        setTicketFieldPermissions(null);
    };

    const handleEditFromDetail = () => {
        if (!canEditTickets) {
            console.warn('Only Super Admin can edit tickets');
            return;
        }
        setShowDetailModal(false);
        setShowEditForm(true);
    };

    return (
        <ClientLayout>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                            Security Tickets
                        </h1>
                        <p className="text-neutral-600 dark:text-neutral-400">
                            Manage security incidents, vulnerabilities, and compliance issues
                        </p>
                    </div>
                </div>

                {/* Security Tickets List */}
                <TicketList
                    onCreateTicket={handleCreateTicket}
                    onEditTicket={canEditTickets ? handleEditTicket : undefined}
                    onViewTicket={handleViewTicket}
                    categoryFilter={securityCategories}
                    pageTitle="Security Tickets"
                />
            </div>

            <TicketForm
                isOpen={showCreateForm}
                onClose={handleCloseModals}
                onSubmit={handleSubmitTicket}
                mode="create"
                defaultCategory={TicketCategory.SECURITY_INCIDENT}
                allowedCategories={securityCategories}
            />

            <TicketForm
                isOpen={showEditForm}
                onClose={handleCloseModals}
                onSubmit={handleSubmitTicket}
                ticket={selectedTicket}
                mode="edit"
                fieldPermissions={ticketFieldPermissions || undefined}
                allowedCategories={securityCategories}
            />

            <TicketDetail
                isOpen={showDetailModal}
                onClose={handleCloseModals}
                onEdit={canEditTickets ? handleEditFromDetail : undefined}
                ticket={selectedTicket}
                fieldPermissions={ticketFieldPermissions || undefined}
            />
        </ClientLayout>
    );
}