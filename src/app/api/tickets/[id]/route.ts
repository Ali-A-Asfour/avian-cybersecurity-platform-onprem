import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import { ticketStore } from '@/lib/ticket-store';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    console.log('🎫 Ticket detail API called (file-based)');
    console.log('🔍 Fetching ticket ID:', id);
    
    // Apply authentication middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      console.log('❌ Auth failed:', authResult.error);
      return NextResponse.json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: authResult.error || "Authentication failed"
        }
      }, { status: 401 });
    }

    const user = authResult.user!;
    console.log('✅ User authenticated:', user.email, user.role);

    // Get ticket from file-based store
    console.log('📊 Looking up ticket in store...');
    const ticket = ticketStore.getTicket(id);
    
    if (!ticket) {
      console.log('❌ Ticket not found:', id);
      console.log('📊 Available ticket IDs:', ticketStore.getAllTickets().map(t => t.id));
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        },
      }, { status: 404 });
    }

    console.log('✅ Ticket found:', ticket.title);

    // Check tenant access for cross-tenant users
    if ([UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(user.role)) {
      const selectedTenantId = request.headers.get('x-selected-tenant-id');
      if (selectedTenantId && ticket.tenant_id !== selectedTenantId) {
        console.log('❌ Tenant access denied:', { ticketTenant: ticket.tenant_id, selectedTenant: selectedTenantId });
        return NextResponse.json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot access ticket from different tenant'
          }
        }, { status: 403 });
      }
    } else if (user.role !== UserRole.SUPER_ADMIN && ticket.tenant_id !== user.tenant_id) {
      // Regular users can only access tickets from their own tenant
      console.log('❌ User tenant access denied:', { ticketTenant: ticket.tenant_id, userTenant: user.tenant_id });
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot access ticket from different tenant'
        }
      }, { status: 403 });
    }

    console.log('✅ Ticket access granted');

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error('❌ Error fetching ticket:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch ticket: ' + error.message,
      },
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    console.log('🎫 Ticket update API called (file-based)');
    console.log('🔍 Updating ticket ID:', id);
    
    // Apply authentication middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      console.log('❌ Auth failed:', authResult.error);
      return NextResponse.json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: authResult.error || "Authentication failed"
        }
      }, { status: 401 });
    }

    const user = authResult.user!;
    console.log('✅ User authenticated:', user.email, user.role);

    // Verify ticket exists in file-based store
    const existingTicket = ticketStore.getTicket(id);
    if (!existingTicket) {
      console.log('❌ Ticket not found:', id);
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        },
      }, { status: 404 });
    }

    console.log('✅ Ticket found:', existingTicket.title);

    // Check tenant access
    if ([UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(user.role)) {
      const selectedTenantId = request.headers.get('x-selected-tenant-id');
      if (selectedTenantId && existingTicket.tenant_id !== selectedTenantId) {
        console.log('❌ Tenant access denied for update');
        return NextResponse.json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot update ticket from different tenant'
          }
        }, { status: 403 });
      }
    } else if (user.role !== UserRole.SUPER_ADMIN && existingTicket.tenant_id !== user.tenant_id) {
      console.log('❌ User tenant access denied for update');
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot update ticket from different tenant'
        }
      }, { status: 403 });
    }

    const body = await request.json();
    console.log('📝 Update data:', body);

    // Update ticket using file-based store
    const updatedTicket = ticketStore.updateTicket(id, body);

    if (!updatedTicket) {
      console.log('❌ Failed to update ticket');
      return NextResponse.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update ticket',
        },
      }, { status: 500 });
    }

    console.log('✅ Ticket updated successfully');

    return NextResponse.json({
      success: true,
      data: updatedTicket,
    });
  } catch (error) {
    console.error('❌ Error updating ticket:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update ticket',
      },
    }, { status: 500 });
  }
}