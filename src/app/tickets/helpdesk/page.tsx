'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { TicketList } from '@/components/tickets/TicketList';
import { TicketForm } from '@/components/tickets/TicketForm';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { Ticket, TicketCategory, UserRole } from '@/types';
import { useDemoContext } from '@/contexts/DemoContext';

export const dynamic = 'force-dynamic';

export default function HelpdeskTicketsPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const { currentUser } = useDemoContext();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [ticketFieldPermissions, setTicketFieldPermissions] = useState<Record<string, { canEdit: boolean; reason?: string }> | null>(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading || !isAuthenticated) {
        return null;
    }

    // Only super admin can edit tickets
    const canEditTickets = currentUser.role === UserRole.SUPER_ADMIN;

    // IT Support/Helpdesk-related ticket categories for filtering
    const helpdeskCategories = [
        TicketCategory.IT_SUPPORT,
        TicketCategory.HARDWARE_ISSUE,
        TicketCategory.SOFTWARE_ISSUE,
        TicketCategory.NETWORK_ISSUE,
        TicketCategory.ACCESS_REQUEST,
        TicketCategory.ACCOUNT_SETUP,
        TicketCategory.GENERAL_REQUEST,
        TicketCategory.OTHER,
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
            console.log('Mock helpdesk ticket save:', ticketData);

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
                            Helpdesk Tickets
                        </h1>
                        <p className="text-neutral-600 dark:text-neutral-400">
                            Manage IT support requests, hardware issues, and general assistance
                        </p>
                    </div>
                </div>

                {/* Helpdesk Tickets List */}
                <TicketList
                    onCreateTicket={handleCreateTicket}
                    onEditTicket={canEditTickets ? handleEditTicket : undefined}
                    onViewTicket={handleViewTicket}
                    categoryFilter={helpdeskCategories}
                    pageTitle="Helpdesk Tickets"
                />
            </div>

            <TicketForm
                isOpen={showCreateForm}
                onClose={handleCloseModals}
                onSubmit={handleSubmitTicket}
                mode="create"
                defaultCategory={TicketCategory.IT_SUPPORT}
                allowedCategories={helpdeskCategories}
            />

            <TicketForm
                isOpen={showEditForm}
                onClose={handleCloseModals}
                onSubmit={handleSubmitTicket}
                ticket={selectedTicket}
                mode="edit"
                fieldPermissions={ticketFieldPermissions || undefined}
                allowedCategories={helpdeskCategories}
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