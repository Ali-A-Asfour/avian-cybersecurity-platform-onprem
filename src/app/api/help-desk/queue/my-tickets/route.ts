import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import { ticketStore } from '@/lib/ticket-store';

/**
 * GET /api/help-desk/queue/my-tickets
 * Get personal "My Tickets" queue for help desk analysts
 * Returns empty results since mock tickets have been removed
 */
export async function GET(request: NextRequest) {
    try {
        // Apply middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: authResult.error || 'Authentication failed'
                }
            }, { status: 401 });
        }

        const user = authResult.user!;

        // Validate user role - only analysts and users can access personal queue
        const allowedRoles = [UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.USER, UserRole.SUPER_ADMIN];
        if (!allowedRoles.includes(user.role)) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Access denied - insufficient permissions',
                    requiredRole: 'IT_HELPDESK_ANALYST, SECURITY_ANALYST, or USER'
                }
            }, { status: 403 });
        }

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        // Get tenant filter - for cross-tenant users, use selected tenant from header
        let tenantFilter: string | undefined;
        
        if ([UserRole.SECURITY_ANALYST, UserRole.IT_HELPDESK_ANALYST].includes(user.role)) {
            // Cross-tenant users: use selected tenant from header
            const selectedTenantId = request.headers.get('x-selected-tenant-id');
            tenantFilter = selectedTenantId || undefined;
            console.log('My tickets - Cross-tenant user, selected tenant:', selectedTenantId);
        } else {
            // Regular users: use their own tenant
            tenantFilter = user.tenant_id;
            console.log('My tickets - Regular user, using own tenant:', user.tenant_id);
        }

        // Get tickets for this user
        let tickets = [];
        
        console.log('My tickets - User ID:', user.user_id);
        console.log('My tickets - User role:', user.role);
        console.log('My tickets - Final tenant filter:', tenantFilter);
        console.log('My tickets - Total tickets in store:', ticketStore.getCount());
        
        if (user.role === UserRole.USER || user.role === UserRole.SUPER_ADMIN) {
            // Regular users and super admins see tickets they created
            tickets = ticketStore.getTicketsByUser(user.user_id, tenantFilter);
            console.log('My tickets - Found tickets by user:', tickets.length);
        } else {
            // Analysts see tickets assigned to them
            tickets = ticketStore.getAssignedTickets(user.user_id, tenantFilter);
            console.log('My tickets - Found assigned tickets:', tickets.length);
        }

        // Apply pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedTickets = tickets.slice(startIndex, endIndex);

        return NextResponse.json({
            success: true,
            data: {
                tickets: paginatedTickets,
                pagination: {
                    page,
                    limit,
                    total: tickets.length,
                    pages: Math.ceil(tickets.length / limit),
                },
            },
        });
    } catch (error) {
        console.error('Error fetching my tickets queue:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch my tickets queue',
            },
        }, { status: 500 });
    }
}