'use client';

import { useState, useEffect } from 'react';
import { UserRole } from '@/types';
import { api } from '@/lib/api-client';

interface TicketCounts {
    helpDesk: number;
    alerts: number;
    tickets: number;
}

export function useTicketCounts(userRole: UserRole) {
    const [counts, setCounts] = useState<TicketCounts>({
        helpDesk: 0,
        alerts: 0,
        tickets: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                setLoading(true);

                // Fetch help desk ticket counts based on user role
                if (userRole === UserRole.USER) {
                    // For regular users, get their created tickets
                    const response = await api.get('/api/tickets/user?limit=1');
                    if (response.ok) {
                        const data = await response.json();
                        setCounts(prev => ({ ...prev, helpDesk: data.total || 0 }));
                    }
                } else if (userRole === UserRole.IT_HELPDESK_ANALYST) {
                    // For helpdesk analysts, get unassigned tickets
                    const response = await api.get('/api/help-desk/queue/unassigned?limit=1');
                    if (response.ok) {
                        const data = await response.json();
                        setCounts(prev => ({ ...prev, helpDesk: data.data?.pagination?.total || 0 }));
                    }
                }

                // Fetch alerts count for security analysts and super admins
                if (userRole === UserRole.SECURITY_ANALYST || userRole === UserRole.SUPER_ADMIN) {
                    try {
                        const response = await api.get('/api/alerts-incidents/alerts?limit=1');
                        if (response.ok) {
                            const data = await response.json();
                            setCounts(prev => ({ ...prev, alerts: data.pagination?.total || 0 }));
                        } else if (response.status === 401) {
                            // Mock data for development/demo mode
                            setCounts(prev => ({ ...prev, alerts: 42 }));
                        }
                    } catch (error) {
                        // Fallback to mock data on error
                        setCounts(prev => ({ ...prev, alerts: 42 }));
                    }
                }

                // Fetch general tickets count for super admins
                if (userRole === UserRole.SUPER_ADMIN) {
                    const response = await api.get('/api/tickets?limit=1');
                    if (response.ok) {
                        const data = await response.json();
                        setCounts(prev => ({ ...prev, tickets: data.total || 0 }));
                    }
                }
            } catch (error) {
                console.error('Error fetching ticket counts:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCounts();
    }, [userRole]);

    return { counts, loading };
}