'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth as useAuthContext } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { UnassignedTicketQueue } from '@/components/help-desk/UnassignedTicketQueue';
import { MyTicketsQueue } from '@/components/help-desk/MyTicketsQueue';
import { TenantAdminQueue } from '@/components/help-desk/TenantAdminQueue';
import { GeneralTicketQueue } from '@/components/help-desk/GeneralTicketQueue';
import { KnowledgeBaseSearch } from '@/components/help-desk/KnowledgeBaseSearch';
import { useAuth } from '@/hooks/useAuth';
import { initializeDemoUser } from '@/lib/demo-auth';
import { api } from '@/lib/api-client';
import {
    Users,
    User,
    Settings,
    BarChart3,
    Clock,
    AlertTriangle,
    Loader2,
    BookOpen,
    List
} from 'lucide-react';

interface QueueMetrics {
    total_tickets: number;
    unassigned_tickets: number;
    assigned_tickets: number;
    overdue_tickets: number;
    by_severity: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
    by_status: {
        new: number;
        in_progress: number;
        awaiting_response: number;
        resolved: number;
        closed: number;
    };
    average_queue_time: number;
}

export default function TicketsPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authContextLoading } = useAuthContext();
    const { user: authUser, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
    const [metricsLoading, setMetricsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('unassigned');

    useEffect(() => {
        if (!authContextLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authContextLoading, isAuthenticated, router]);

    // Initialize demo user if no user is authenticated
    useEffect(() => {
        if (!authLoading && !authUser) {
            console.log('No authenticated user found, initializing demo user...');
            initializeDemoUser(UserRole.SECURITY_ANALYST);
            // Reload the page to pick up the new user
            window.location.reload();
        }
    }, [authUser, authLoading]);

    // Convert auth user to expected format - memoized to prevent infinite loops
    const user = useMemo(() => {
        if (!authUser) return null;

        return {
            id: authUser.id,
            role: authUser.role as UserRole,
            email: authUser.email,
            first_name: authUser.name.split(' ')[0] || 'User',
            last_name: authUser.name.split(' ').slice(1).join(' ') || '',
        };
    }, [authUser]);

    // Memoize tenant object to prevent infinite loops
    const tenant = useMemo(() => {
        if (!authUser) return null;

        return {
            id: authUser.tenantId || 'tenant-123',
            name: 'Demo Tenant',
            domain: 'demo.example.com',
        };
    }, [authUser?.tenantId]);

    // Fetch tenant context and set default tab
    useEffect(() => {
        const initializePage = async () => {
            if (!authUser || authLoading) return;

            try {
                // Set default tab based on user role
                if (authUser.role === UserRole.TENANT_ADMIN) {
                    setActiveTab('tenant-admin');
                } else {
                    setActiveTab('unassigned');
                }
            } catch (error) {
                console.error('Error initializing page:', error);
            } finally {
                setLoading(false);
            }
        };

        initializePage();
    }, [authUser?.role, authLoading]);

    // Fetch queue metrics
    useEffect(() => {
        const fetchMetrics = async () => {
            if (!user || !tenant) return;

            try {
                setMetricsLoading(true);
                console.log('Fetching metrics from /api/help-desk/queue/metrics');

                const response = await api.get('/api/help-desk/queue/metrics');

                console.log('Metrics response status:', response.status);

                if (response.ok) {
                    const data = await response.json();
                    console.log('Metrics data received:', data);
                    setMetrics(data.data);
                } else {
                    console.error('Metrics fetch failed with status:', response.status);
                    const errorText = await response.text();
                    console.error('Error response:', errorText);
                }
            } catch (error) {
                console.error('Error fetching queue metrics:', error);
                // Don't show error to user, just log it and continue with empty metrics
            } finally {
                setMetricsLoading(false);
            }
        };

        fetchMetrics();
    }, [user?.id, tenant?.id]); // Use stable IDs instead of full objects

    // Handle ticket assignment (refresh metrics)
    const handleTicketAssigned = useMemo(() => {
        return () => {
            // Refresh metrics when a ticket is assigned
            if (user && tenant) {
                const fetchMetrics = async () => {
                    try {
                        const response = await api.get('/api/help-desk/queue/metrics');
                        if (response.ok) {
                            const data = await response.json();
                            setMetrics(data.data);
                        }
                    } catch (error) {
                        console.error('Error refreshing metrics:', error);
                    }
                };
                fetchMetrics();
            }
        };
    }, [user?.id, tenant?.id]);

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading helpdesk tickets...</span>
            </div>
        );
    }

    if (!user || !tenant) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
                    <p className="text-gray-600">You don't have permission to access helpdesk tickets.</p>
                </div>
            </div>
        );
    }

    // Check if user has ticket access - excludes regular users who should only create tickets
    const hasTicketAccess = [
        UserRole.IT_HELPDESK_ANALYST,
        UserRole.SECURITY_ANALYST,
        UserRole.TENANT_ADMIN,
        UserRole.SUPER_ADMIN
    ].includes(user.role);

    if (!hasTicketAccess) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
                    <p className="text-gray-600">
                        You don't have permission to access helpdesk tickets.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ClientLayout>
            <div className="container mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Helpdesk Tickets</h1>
                        <p className="text-gray-600 mt-1">
                            Manage support tickets and track issue resolution
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href="/help-desk/tickets/new"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Ticket
                        </a>
                        <Badge variant="outline" className="text-sm">
                            {user.role.replace('_', ' ').toUpperCase()}
                        </Badge>
                    </div>
                </div>

                {/* Metrics Cards */}
                {metrics && !metricsLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Total Tickets</p>
                                        <p className="text-2xl font-bold">{metrics.total_tickets}</p>
                                    </div>
                                    <BarChart3 className="h-8 w-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Unassigned</p>
                                        <p className="text-2xl font-bold text-orange-600">{metrics.unassigned_tickets}</p>
                                    </div>
                                    <Users className="h-8 w-8 text-orange-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Overdue</p>
                                        <p className="text-2xl font-bold text-red-600">{metrics.overdue_tickets}</p>
                                    </div>
                                    <AlertTriangle className="h-8 w-8 text-red-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Avg Queue Time</p>
                                        <p className="text-2xl font-bold">
                                            {Math.round(metrics.average_queue_time)}h
                                        </p>
                                    </div>
                                    <Clock className="h-8 w-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Queue Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="grid w-full grid-cols-5">
                        {/* Unassigned Queue - only for help desk staff and super admin */}
                        {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.SUPER_ADMIN].includes(user.role) && (
                            <TabsTrigger value="unassigned" className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Unassigned Queue
                                {metrics && (
                                    <Badge variant="secondary" className="ml-1">
                                        {metrics.unassigned_tickets}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        )}

                        {/* My Tickets - for help desk staff and super admin */}
                        {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.SUPER_ADMIN].includes(user.role) && (
                            <TabsTrigger value="my-tickets" className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                My Assigned Tickets
                                {metrics && (
                                    <Badge variant="secondary" className="ml-1">
                                        {metrics.assigned_tickets}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        )}

                        {/* General Queue - for help desk staff, super admin, and tenant admins */}
                        {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN].includes(user.role) && (
                            <TabsTrigger value="general-queue" className="flex items-center gap-2">
                                <List className="h-4 w-4" />
                                General Queue
                                {metrics && (
                                    <Badge variant="secondary" className="ml-1">
                                        {metrics.total_tickets}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        )}

                        {/* All Tickets - only for tenant admins and super admin */}
                        {[UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN].includes(user.role) && (
                            <TabsTrigger value="tenant-admin" className="flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                All Tickets
                                {metrics && (
                                    <Badge variant="secondary" className="ml-1">
                                        {metrics.total_tickets}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        )}

                        {/* Knowledge Base - for everyone */}
                        <TabsTrigger value="knowledge-base" className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            Knowledge Base
                        </TabsTrigger>
                    </TabsList>

                    {/* Unassigned Queue Tab Content */}
                    {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.SUPER_ADMIN].includes(user.role) && (
                        <TabsContent value="unassigned">
                            <UnassignedTicketQueue
                                userRole={user.role}
                                userId={user.id}
                                tenantId={tenant.id}
                                onTicketAssigned={handleTicketAssigned}
                            />
                        </TabsContent>
                    )}

                    {/* My Tickets Tab Content */}
                    {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.SUPER_ADMIN].includes(user.role) && (
                        <TabsContent value="my-tickets">
                            <MyTicketsQueue
                                userRole={user.role}
                                userId={user.id}
                                tenantId={tenant.id}
                            />
                        </TabsContent>
                    )}

                    {/* General Queue Tab Content */}
                    {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN].includes(user.role) && (
                        <TabsContent value="general-queue">
                            <GeneralTicketQueue
                                userRole={user.role}
                                userId={user.id}
                                tenantId={tenant.id}
                            />
                        </TabsContent>
                    )}

                    {/* All Tickets Tab Content */}
                    {[UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN].includes(user.role) && (
                        <TabsContent value="tenant-admin">
                            <TenantAdminQueue
                                userRole={user.role}
                                userId={user.id}
                                tenantId={tenant.id}
                            />
                        </TabsContent>
                    )}

                    {/* Knowledge Base Tab Content */}
                    <TabsContent value="knowledge-base">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold">Knowledge Base</h2>
                                    <p className="text-gray-600 text-sm mt-1">
                                        Search for solutions and create reusable knowledge articles
                                    </p>
                                </div>
                                {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN].includes(user.role) && (
                                    <a
                                        href="/help-desk/knowledge-base"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <BookOpen className="h-4 w-4" />
                                        Manage Knowledge Base
                                    </a>
                                )}
                            </div>
                            <KnowledgeBaseSearch showApprovedOnly={false} />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </ClientLayout>
    );
}