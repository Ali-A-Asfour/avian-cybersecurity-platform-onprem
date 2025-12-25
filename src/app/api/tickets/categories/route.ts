import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/services/ticket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse } from '@/types';

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

    // Get allowed categories for the user's role
    const allowedCategories = TicketService.getAllowedCategories(authResult.user!.role);

    const response: ApiResponse = {
      success: true,
      data: {
        role: authResult.user!.role,
        allowed_categories: allowedCategories,
        category_descriptions: {
          // Security categories
          security_incident: 'Security incidents requiring immediate attention',
          vulnerability: 'Security vulnerabilities in systems or applications',
          malware_detection: 'Malware or suspicious software detected',
          phishing_attempt: 'Phishing emails or social engineering attempts',
          data_breach: 'Potential or confirmed data breaches',
          policy_violation: 'Security policy violations',
          compliance: 'Compliance-related security issues',
          
          // IT Support categories
          it_support: 'General IT support requests',
          hardware_issue: 'Hardware problems or failures',
          software_issue: 'Software bugs or installation issues',
          network_issue: 'Network connectivity or performance problems',
          access_request: 'Requests for system or application access',
          account_setup: 'New user account setup or modifications',
          
          // General categories
          general_request: 'General requests not fitting other categories',
          other: 'Other miscellaneous issues',
        },
      },
    };

    return NextResponse.json(response);
  } catch {
    console.error('Error fetching ticket categories:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch ticket categories',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}