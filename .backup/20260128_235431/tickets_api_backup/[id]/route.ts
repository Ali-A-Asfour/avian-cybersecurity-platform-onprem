import { NextRequest, NextResponse } from 'next/server';
import { TicketService, UpdateTicketRequest } from '@/services/ticket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    // Apply middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: authResult.error || "Authentication failed"
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

    // Get ticket
    const ticket = await TicketService.getTicketById(tenantResult.tenant!.id, id);
    if (!ticket) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse = {
      success: true,
      data: ticket,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch ticket',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    // Apply middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: authResult.error || "Authentication failed"
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

    // Verify ticket exists
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      BYPASS_AUTH: process.env.BYPASS_AUTH,
      shouldUseMock: process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true'
    });

    const existingTicket = await TicketService.getTicketById(tenantResult.tenant!.id, id);
    if (!existingTicket) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const body: UpdateTicketRequest = await request.json();

    // Update ticket with field-level access control
    const updatedTicket = await TicketService.updateTicket(
      tenantResult.tenant!.id,
      id,
      body,
      authResult.user!.user_id,
      authResult.user!.role
    );

    if (!updatedTicket) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse = {
      success: true,
      data: updatedTicket,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating ticket:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update ticket',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}