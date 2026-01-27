import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import { ticketStore } from '@/lib/ticket-store';

/**
 * GET /api/help-desk/queue/unassigned
 * Get unassigned tickets queue for help desk analysts
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

        // Validate user role - only analysts and admins can access unassigned queue
        const allowedRoles = [UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.SUPER_ADMIN];
        if (!allowedRoles.includes(user.role)) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Access denied - insufficient permissions',
                    requiredRole: 'IT_HELPDESK_ANALYST or SECURITY_ANALYST'
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
            console.log('Unassigned queue - Cross-tenant user, selected tenant:', selectedTenantId);
        } else {
            // Regular users: use their own tenant
            tenantFilter = user.tenant_id;
            console.log('Unassigned queue - Regular user, using own tenant:', user.tenant_id);
        }
        
        console.log('Unassigned queue - User role:', user.role);
        console.log('Unassigned queue - Final tenant filter:', tenantFilter);
        console.log('Unassigned queue - Total tickets in store:', ticketStore.getCount());
        
        const tickets = ticketStore.getUnassignedTickets(tenantFilter);
        console.log('Unassigned queue - Found tickets:', tickets.length);

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
        console.error('Error fetching unassigned queue:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch unassigned queue',
            },
        }, { status: 500 });
    }
}