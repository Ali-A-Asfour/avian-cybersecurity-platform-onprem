import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse } from '@/types';
import { ticketStore } from '@/lib/ticket-store';

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

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: { 
          code: "FORBIDDEN", 
          message: tenantResult.error?.message || "Access denied" 
        } 
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    // Get tickets from the ticket store
    console.log('🎫 Tickets API: Fetching tickets for tenant:', tenantResult.tenant!.id);
    const allTickets = ticketStore.getAllTickets(tenantResult.tenant!.id);
    console.log('🎫 Tickets API: Found', allTickets.length, 'tickets for tenant', tenantResult.tenant!.id);
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTickets = allTickets.slice(startIndex, endIndex);

    // Return tickets with pagination info
    const response: ApiResponse = {
      success: true,
      data: paginatedTickets,
      meta: {
        total: allTickets.length,
        page: page,
        limit: limit,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Tickets API error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        path: '/api/tickets'
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: { 
          code: "FORBIDDEN", 
          message: tenantResult.error?.message || "Access denied" 
        } 
      }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    
    // Basic validation
    if (!body.title || !body.description) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title and description are required'
        }
      }, { status: 400 });
    }

    // Create a ticket using the ticket store
    const ticket = ticketStore.createTicket({
      id: `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: body.title,
      description: body.description,
      severity: body.impactLevel || 'medium',
      phoneNumber: body.phoneNumber,
      contactMethod: body.contactMethod || 'email',
      status: 'new',
      priority: body.impactLevel === 'critical' ? 'urgent' : body.impactLevel || 'medium',
      created_at: new Date().toISOString(),
      created_by: authResult.user!.user_id,
      tenant_id: tenantResult.tenant!.id,
      category: 'it_support',
      requester_email: (authResult.user as any).email || undefined,
      tags: [],
      device_name: body.deviceId || undefined
    });

    console.log('Created ticket:', ticket);

    // Return success response
    const response: ApiResponse = {
      success: true,
      data: ticket
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Ticket creation error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create ticket',
        timestamp: new Date().toISOString(),
        request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        path: '/api/tickets'
      }
    }, { status: 500 });
  }
}
