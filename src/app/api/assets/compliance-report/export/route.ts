import { NextRequest, NextResponse } from 'next/server';
import { assetService } from '@/services/asset.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { ApiResponse, ComplianceStatus } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { user, tenant } = tenantResult;

    // Get format from query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    // Get assets for the tenant
    const assets = await assetService.getAssetsByTenant(tenant.id);

    if (format === 'csv') {
      const csvContent = generateCSVReport(assets, tenant);
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="asset-compliance-report-${tenant.name}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (format === 'pdf') {
      // For PDF generation, you would typically use a library like puppeteer or jsPDF
      // For now, we'll return a simple text-based report
      const pdfContent = generateTextReport(assets, tenant);
      
      return new NextResponse(pdfContent, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="asset-compliance-report-${tenant.name}-${new Date().toISOString().split('T')[0]}.txt"`,
        },
      });
    }

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INVALID_FORMAT',
        message: 'Invalid export format. Supported formats: csv, pdf',
      },
    };

    return NextResponse.json(response, { status: 400 });
  } catch {
    logger.error('Failed to export compliance report', { error });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export compliance report',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

function generateCSVReport(assets: any[], tenant: any): string {
  const headers = [
    'Asset Name',
    'Asset Type',
    'IP Address',
    'Operating System',
    'Compliance Status',
    'Risk Score',
    'Security Tools Count',
    'Active Security Tools',
    'Total Vulnerabilities',
    'Critical Vulnerabilities',
    'High Vulnerabilities',
    'Last Scan Date',
    'Created Date'
  ];

  const rows = assets.map(asset => [
    asset.name,
    asset.asset_type,
    asset.ip_address,
    `${asset.os_info.name} ${asset.os_info.version}`,
    asset.compliance_status,
    asset.risk_score,
    asset.security_tools.length,
    asset.security_tools.filter((tool: any) => tool.status === 'active').length,
    asset.vulnerabilities.length,
    asset.vulnerabilities.filter((vuln: any) => vuln.severity === 'critical').length,
    asset.vulnerabilities.filter((vuln: any) => vuln.severity === 'high').length,
    new Date(asset.last_scan).toISOString().split('T')[0],
    new Date(asset.created_at).toISOString().split('T')[0]
  ]);

  const csvContent = [
    `# Asset Compliance Report - ${tenant.name}`,
    `# Generated on: ${new Date().toISOString()}`,
    `# Total Assets: ${assets.length}`,
    `# Compliant Assets: ${assets.filter(a => a.compliance_status === ComplianceStatus.COMPLETED).length}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

function generateTextReport(assets: any[], tenant: any): string {
  const compliantAssets = assets.filter(a => a.compliance_status === ComplianceStatus.COMPLETED).length;
  const nonCompliantAssets = assets.filter(a => a.compliance_status === ComplianceStatus.NON_COMPLIANT).length;
  const inProgressAssets = assets.filter(a => a.compliance_status === ComplianceStatus.IN_PROGRESS).length;
  
  const totalVulnerabilities = assets.reduce((sum, asset) => sum + asset.vulnerabilities.length, 0);
  const criticalVulnerabilities = assets.reduce((sum, asset) => 
    sum + asset.vulnerabilities.filter((vuln: any) => vuln.severity === 'critical').length, 0
  );
  
  const assetsWithAntivirus = assets.filter(asset => 
    asset.security_tools.some((tool: any) => tool.type === 'antivirus' || tool.type === 'edr')
  ).length;
  
  const assetsWithFirewall = assets.filter(asset => 
    asset.security_tools.some((tool: any) => tool.type === 'firewall')
  ).length;

  const report = `
ASSET COMPLIANCE REPORT
=======================

Organization: ${tenant.name}
Generated: ${new Date().toISOString()}

EXECUTIVE SUMMARY
-----------------
Total Assets: ${assets.length}
Compliant Assets: ${compliantAssets} (${Math.round((compliantAssets / assets.length) * 100)}%)
Non-Compliant Assets: ${nonCompliantAssets} (${Math.round((nonCompliantAssets / assets.length) * 100)}%)
In Progress: ${inProgressAssets} (${Math.round((inProgressAssets / assets.length) * 100)}%)

SECURITY CONTROLS COVERAGE
---------------------------
Antivirus/EDR Coverage: ${assetsWithAntivirus}/${assets.length} (${Math.round((assetsWithAntivirus / assets.length) * 100)}%)
Firewall Coverage: ${assetsWithFirewall}/${assets.length} (${Math.round((assetsWithFirewall / assets.length) * 100)}%)

VULNERABILITY SUMMARY
---------------------
Total Vulnerabilities: ${totalVulnerabilities}
Critical Vulnerabilities: ${criticalVulnerabilities}
Assets with Critical Vulnerabilities: ${assets.filter(asset => 
  asset.vulnerabilities.some((vuln: any) => vuln.severity === 'critical')
).length}

ASSET DETAILS
-------------
${assets.map(asset => `
Asset: ${asset.name}
Type: ${asset.asset_type}
IP: ${asset.ip_address}
OS: ${asset.os_info.name} ${asset.os_info.version}
Compliance: ${asset.compliance_status}
Risk Score: ${asset.risk_score}
Security Tools: ${asset.security_tools.length} (${asset.security_tools.filter((tool: any) => tool.status === 'active').length} active)
Vulnerabilities: ${asset.vulnerabilities.length} (${asset.vulnerabilities.filter((vuln: any) => vuln.severity === 'critical').length} critical)
Last Scan: ${new Date(asset.last_scan).toLocaleDateString()}
`).join('\n')}

END OF REPORT
`;

  return report;
}