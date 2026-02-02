import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { ticketStore } from '@/lib/ticket-store';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: ticketId } = await params;

  try {
    console.log('📎 Get ticket attachments API called (file-based)');
    console.log('🔍 Ticket ID:', ticketId);
    
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
    const ticket = ticketStore.getTicket(ticketId);
    if (!ticket) {
      console.log('❌ Ticket not found:', ticketId);
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        },
      }, { status: 404 });
    }

    console.log('✅ Ticket found:', ticket.title);

    // For now, return empty attachments array since we don't have attachment storage implemented
    // This prevents the UI from crashing while we implement proper attachment functionality
    const mockAttachments = [];

    console.log(`📋 Returning ${mockAttachments.length} attachments for ticket ${ticketId}`);

    return NextResponse.json({
      success: true,
      data: mockAttachments,
    });
  } catch (error) {
    console.error('❌ Error fetching ticket attachments:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch ticket attachments: ' + error.message,
      },
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file provided',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'File size exceeds 10MB limit',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate file type (basic validation)
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'File type not allowed',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || '';
    const filename = `${timestamp}_${randomString}.${fileExtension}`;

    // In a real implementation, you would save the file to storage (S3, local filesystem, etc.)
    // For now, we'll simulate the file path
    const filePath = `/uploads/tickets/${id}/${filename}`;

    // Create attachment record
    const attachment = await TicketService.addAttachment(
      tenantResult.tenant!.id,
      id,
      authResult.user!.user_id,
      {
        filename,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        file_path: filePath,
      }
    );

    const response: ApiResponse = {
      success: true,
      data: attachment,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to upload attachment',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}