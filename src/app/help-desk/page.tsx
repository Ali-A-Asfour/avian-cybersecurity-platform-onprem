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
    BookOpen
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

export default function HelpDeskPage() {
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
                } else if (authUser.role === UserRole.USER) {
                    setActiveTab('my-tickets');
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
                <span className="ml-2">Loading help desk...</span>
            </div>
        );
    }

    if (!user || !tenant) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
                    <p className="text-gray-600">You don't have permission to access the help desk.</p>
                </div>
            </div>
        );
    }

    // Check if user has help desk access - now includes regular users
    const hasHelpDeskAccess = [
        UserRole.IT_HELPDESK_ANALYST,
        UserRole.SECURITY_ANALYST,
        UserRole.TENANT_ADMIN,
        UserRole.USER
    ].includes(user.role);

    if (!hasHelpDeskAccess) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
                    <p className="text-gray-600">
                        You don't have permission to access the help desk.
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
                        <h1 className="text-3xl font-bold">Help Desk</h1>
                        <p className="text-gray-600 mt-1">
                            Manage support tickets and help end users resolve their issues
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
                    <TabsList className="grid w-full grid-cols-4">
                        {/* Unassigned Queue - only for help desk staff */}
                        {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(user.role) && (
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

                        {/* My Tickets - for help desk staff and regular users */}
                        {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.USER].includes(user.role) && (
                            <TabsTrigger value="my-tickets" className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {user.role === UserRole.USER ? 'My Tickets' : 'My Assigned Tickets'}
                                {metrics && (
                                    <Badge variant="secondary" className="ml-1">
                                        {user.role === UserRole.USER ? metrics.total_tickets : metrics.assigned_tickets}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        )}

                        {/* All Tickets - only for tenant admins */}
                        {user.role === UserRole.TENANT_ADMIN && (
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
                    {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(user.role) && (
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
                    {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.USER].includes(user.role) && (
                        <TabsContent value="my-tickets">
                            <MyTicketsQueue
                                userRole={user.role}
                                userId={user.id}
                                tenantId={tenant.id}
                            />
                        </TabsContent>
                    )}

                    {/* All Tickets Tab Content */}
                    {user.role === UserRole.TENANT_ADMIN && (
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
                                {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.TENANT_ADMIN].includes(user.role) && (
                                    <a
                                        href="/help-desk/knowledge-base"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <BookOpen className="h-4 w-4" />
                                        Manage Knowledge Base
                                    </a>
                                )}
                            </div>
                            <KnowledgeBaseSearch showApprovedOnly={user.role === UserRole.USER} />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </ClientLayout>
    );
}