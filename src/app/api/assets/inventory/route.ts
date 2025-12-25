import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse, UserRole } from '@/types';

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

    // Verify user has appropriate role for asset access
    const userRole = authResult.user!.role;
    if (userRole !== UserRole.IT_HELPDESK_ANALYST &&
      userRole !== UserRole.SECURITY_ANALYST &&
      userRole !== UserRole.TENANT_ADMIN &&
      userRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to access asset inventory',
        },
      }, { status: 403 });
    }

    // Generate mock asset data for development
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      const mockAssets = [
        {
          id: 'asset-001',
          name: 'Web Server - Production',
          type: 'server',
          ip_address: '192.168.1.10',
          os: 'Ubuntu 22.04 LTS',
          risk_score: 85,
          compliance_status: 'compliant',
          vulnerabilities: ['CVE-2023-1234'],
          last_scan_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        },
        {
          id: 'asset-002',
          name: 'Database Server - Primary',
          type: 'database',
          ip_address: '192.168.1.20',
          os: 'Windows Server 2022',
          risk_score: 45,
          compliance_status: 'compliant',
          vulnerabilities: [],
          last_scan_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        },
        {
          id: 'asset-003',
          name: 'Workstation - Marketing',
          type: 'workstation',
          ip_address: '192.168.1.100',
          os: 'Windows 11 Pro',
          risk_score: 25,
          compliance_status: 'compliant',
          vulnerabilities: [],
          last_scan_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        },
        {
          id: 'asset-004',
          name: 'Legacy System - Finance',
          type: 'server',
          ip_address: '192.168.1.50',
          os: 'Windows Server 2016',
          risk_score: 95,
          compliance_status: 'non_compliant',
          vulnerabilities: ['CVE-2023-5678', 'CVE-2023-9012'],
          last_scan_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'needs_attention'
        },
        {
          id: 'asset-005',
          name: 'Network Firewall',
          type: 'network_device',
          ip_address: '192.168.1.1',
          os: 'SonicOS 7.0',
          risk_score: 30,
          compliance_status: 'compliant',
          vulnerabilities: [],
          last_scan_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        }
      ];

      const response: ApiResponse = {
        success: true,
        data: mockAssets,
      };

      return NextResponse.json(response);
    }

    // For production, you would implement actual database queries here
    // For now, return empty data to prevent errors
    const response: ApiResponse = {
      success: true,
      data: [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching asset inventory:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch asset inventory',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}