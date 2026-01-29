import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import { ticketStore } from '@/lib/ticket-store';

/**
 * GET /api/help-desk/queue/closed-tickets
 * Get closed/resolved tickets queue for help desk analysts and users
 * Uses file-based ticket store for consistency
 */
export async function GET(request: NextRequest) {
    try {
        console.log('🎫 Closed tickets queue API called (file-based)');
        
        // Apply authentication middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            console.log('❌ Auth failed:', authResult.error);
            return NextResponse.json({
                success: false,
                error: 'Authentication failed'
            }, { status: 401 });
        }

        const user = authResult.user!;
        console.log('✅ User authenticated:', user.email, user.role);

        // Validate user role - allow users to see their own closed tickets
        const allowedRoles = [UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.USER];
        if (!allowedRoles.includes(user.role)) {
            return NextResponse.json({
                success: false,
                error: 'Access denied'
            }, { status: 403 });
        }

        // Get tenant filter for cross-tenant users
        let tenantFilter: string | undefined;
        if ([UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(user.role)) {
            tenantFilter = request.headers.get('x-selected-tenant-id') || undefined;
            console.log('🏢 Cross-tenant user, tenant filter:', tenantFilter);
        } else if (user.role !== UserRole.SUPER_ADMIN) {
            tenantFilter = user.tenant_id;
            console.log('🏢 Regular user, tenant filter:', tenantFilter);
        }

        console.log('📊 Fetching closed tickets from store...');
        
        let tickets;
        
        if (user.role === UserRole.USER) {
            // Regular users see only their own closed tickets
            tickets = ticketStore.getAllTickets(tenantFilter).filter(ticket => {
                const isUserTicket = ticket.created_by === user.user_id;
                const isClosed = ticket.status === 'resolved' || ticket.status === 'closed';
                return isUserTicket && isClosed;
            });
            console.log(`📋 Found ${tickets.length} closed tickets for user ${user.user_id}`);
        } else {
            // Help desk staff see closed tickets they handled or all closed tickets
            tickets = ticketStore.getAllTickets(tenantFilter).filter(ticket => {
                const isClosed = ticket.status === 'resolved' || ticket.status === 'closed';
                const isAssignedToUser = ticket.assigned_to === user.user_id;
                
                // For help desk staff, show tickets they handled or all if they're admin
                if ([UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(user.role)) {
                    return isClosed; // Admins see all closed tickets
                } else {
                    return isClosed && isAssignedToUser; // Analysts see only tickets they handled
                }
            });
            console.log(`📋 Found ${tickets.length} closed tickets for ${user.role}`);
        }

        // Sort by most recently updated first
        tickets.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

        console.log('✅ Closed tickets retrieved successfully');

        return NextResponse.json({
            success: true,
            data: tickets,
            meta: {
                total: tickets.length,
                userRole: user.role,
                tenantFilter: tenantFilter
            }
        });

    } catch (error) {
        console.error('❌ Error fetching closed tickets:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        return NextResponse.json({
            success: false,
            error: 'Internal server error: ' + error.message
        }, { status: 500 });
    }
}