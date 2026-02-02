import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';

/**
 * GET /api/tickets/user
 * Get tickets created by the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Apply authentication middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: authResult.error || 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    // For demo mode, return mock tickets for the user
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      // Mock tickets data - in real app this would come from database
      const mockTickets = [
        {
          id: 'TKT-001',
          title: 'Cannot access email on mobile device',
          status: 'in_progress',
          priority: 'medium',
          category: 'incident',
          description: 'My email app stopped working on my iPhone. Getting error message when trying to sync.',
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          requester: user.email || user.user_id,
        },
        {
          id: 'TKT-002',
          title: 'Request for new software installation',
          status: 'awaiting_response',
          priority: 'low',
          category: 'request',
          description: 'Need Adobe Photoshop installed on my workstation for design work.',
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          requester: user.email || user.user_id,
        },
        {
          id: 'TKT-003',
          title: 'Suspicious email received',
          status: 'resolved',
          priority: 'high',
          category: 'security',
          description: 'Received an email that looks like phishing. Forwarding for security team review.',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          updated_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
          requester: user.email || user.user_id,
        },
      ];

      // Filter tickets for current user and apply sorting/limiting
      const userTickets = mockTickets
        .filter(ticket => ticket.requester === (user.email || user.user_id))
        .sort((a, b) => {
          const aValue = sortBy === 'created_at' ? new Date(a.created_at).getTime() : a.title;
          const bValue = sortBy === 'created_at' ? new Date(b.created_at).getTime() : b.title;
          
          if (sortOrder === 'desc') {
            return aValue > bValue ? -1 : 1;
          } else {
            return aValue < bValue ? -1 : 1;
          }
        })
        .slice(0, limit);

      return NextResponse.json({
        success: true,
        data: userTickets,
        meta: {
          total: userTickets.length,
          limit,
          sort_by: sortBy,
          sort_order: sortOrder,
        },
      });
    }

    // Production mode would use the TicketService
    // const { TicketService } = await import('@/services/ticket.service');
    // const tickets = await TicketService.getUserTickets(user.user_id, { limit, sortBy, sortOrder });

    return NextResponse.json({
      success: true,
      data: [],
      meta: {
        total: 0,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
      },
    });

  } catch (error) {
    console.error('Error fetching user tickets:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch tickets',
        },
      },
      { status: 500 }
    );
  }
}