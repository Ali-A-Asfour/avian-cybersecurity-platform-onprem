import { NextRequest, NextResponse } from 'next/server';
import { assetService } from '@/services/asset.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { ApiResponse, ComplianceStatus } from '@/types';

export async function GET(request: NextRequest) {
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

    // Get assets for the tenant
    const assets = await assetService.getAssetsByTenant(tenant.id);

    // Generate compliance report
    const report = {
      summary: {
        total_assets: assets.length,
        compliant_assets: assets.filter(a => a.compliance_status === ComplianceStatus.COMPLETED).length,
        non_compliant_assets: assets.filter(a => a.compliance_status === ComplianceStatus.NON_COMPLIANT).length,
        in_progress_assets: assets.filter(a => a.compliance_status === ComplianceStatus.IN_PROGRESS).length,
        not_started_assets: assets.filter(a => a.compliance_status === ComplianceStatus.NOT_STARTED).length,
        compliance_percentage: Math.round(
          (assets.filter(a => a.compliance_status === ComplianceStatus.COMPLETED).length / assets.length) * 100
        ),
      },
      by_asset_type: generateAssetTypeBreakdown(assets),
      security_controls: generateSecurityControlsCoverage(assets),
      vulnerability_summary: generateVulnerabilitySummary(assets),
      recommendations: generateRecommendations(assets),
      assets: assets,
    };

    const response: ApiResponse = {
      success: true,
      data: report,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to generate compliance report', { error });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'COMPLIANCE_REPORT_ERROR',
        message: 'Failed to generate compliance report',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

function generateAssetTypeBreakdown(assets: any[]) {
  const breakdown: Record<string, any> = {};
  
  assets.forEach(asset => {
    if (!breakdown[asset.asset_type]) {
      breakdown[asset.asset_type] = {
        total: 0,
        compliant: 0,
        compliance_percentage: 0,
      };
    }
    
    breakdown[asset.asset_type].total++;
    if (asset.compliance_status === ComplianceStatus.COMPLETED) {
      breakdown[asset.asset_type].compliant++;
    }
  });

  // Calculate percentages
  Object.keys(breakdown).forEach(assetType => {
    const data = breakdown[assetType];
    data.compliance_percentage = Math.round((data.compliant / data.total) * 100);
  });

  return breakdown;
}

function generateSecurityControlsCoverage(assets: any[]) {
  const totalAssets = assets.length;
  
  const antivirusCount = assets.filter(asset => 
    asset.security_tools.some((tool: any) => tool.type === 'antivirus' || tool.type === 'edr')
  ).length;
  
  const firewallCount = assets.filter(asset => 
    asset.security_tools.some((tool: any) => tool.type === 'firewall')
  ).length;
  
  const edrCount = assets.filter(asset => 
    asset.security_tools.some((tool: any) => tool.type === 'edr')
  ).length;
  
  const backupCount = assets.filter(asset => 
    asset.security_tools.some((tool: any) => tool.type === 'backup')
  ).length;

  return {
    antivirus_coverage: Math.round((antivirusCount / totalAssets) * 100),
    firewall_coverage: Math.round((firewallCount / totalAssets) * 100),
    edr_coverage: Math.round((edrCount / totalAssets) * 100),
    backup_coverage: Math.round((backupCount / totalAssets) * 100),
  };
}

function generateVulnerabilitySummary(assets: any[]) {
  return {
    assets_with_critical: assets.filter(asset => 
      asset.vulnerabilities.some((vuln: any) => vuln.severity === 'critical')
    ).length,
    assets_with_high: assets.filter(asset => 
      asset.vulnerabilities.some((vuln: any) => vuln.severity === 'high')
    ).length,
    assets_with_medium: assets.filter(asset => 
      asset.vulnerabilities.some((vuln: any) => vuln.severity === 'medium')
    ).length,
    assets_with_low: assets.filter(asset => 
      asset.vulnerabilities.some((vuln: any) => vuln.severity === 'low')
    ).length,
    assets_clean: assets.filter(asset => asset.vulnerabilities.length === 0).length,
  };
}

function generateRecommendations(assets: any[]) {
  const recommendations = [];

  // Check for assets without antivirus/EDR
  const assetsWithoutAntivirus = assets.filter(asset => 
    !asset.security_tools.some((tool: any) => tool.type === 'antivirus' || tool.type === 'edr')
  );
  
  if (assetsWithoutAntivirus.length > 0) {
    recommendations.push({
      priority: 'high' as const,
      title: 'Install Antivirus/EDR Protection',
      description: 'Several assets are missing antivirus or EDR protection, leaving them vulnerable to malware attacks.',
      affected_assets: assetsWithoutAntivirus.length,
    });
  }

  // Check for assets with critical vulnerabilities
  const assetsWithCriticalVulns = assets.filter(asset => 
    asset.vulnerabilities.some((vuln: any) => vuln.severity === 'critical')
  );
  
  if (assetsWithCriticalVulns.length > 0) {
    recommendations.push({
      priority: 'high' as const,
      title: 'Patch Critical Vulnerabilities',
      description: 'Critical vulnerabilities have been identified that require immediate attention and patching.',
      affected_assets: assetsWithCriticalVulns.length,
    });
  }

  // Check for assets without firewall
  const assetsWithoutFirewall = assets.filter(asset => 
    !asset.security_tools.some((tool: any) => tool.type === 'firewall')
  );
  
  if (assetsWithoutFirewall.length > 0) {
    recommendations.push({
      priority: 'medium' as const,
      title: 'Enable Firewall Protection',
      description: 'Some assets do not have firewall protection enabled, which could allow unauthorized network access.',
      affected_assets: assetsWithoutFirewall.length,
    });
  }

  // Check for assets without backup
  const assetsWithoutBackup = assets.filter(asset => 
    !asset.security_tools.some((tool: any) => tool.type === 'backup')
  );
  
  if (assetsWithoutBackup.length > 0) {
    recommendations.push({
      priority: 'medium' as const,
      title: 'Implement Backup Solutions',
      description: 'Assets without backup solutions are at risk of data loss in case of system failure or ransomware attacks.',
      affected_assets: assetsWithoutBackup.length,
    });
  }

  // Check for high-risk assets
  const highRiskAssets = assets.filter(asset => asset.risk_score >= 75);
  
  if (highRiskAssets.length > 0) {
    recommendations.push({
      priority: 'high' as const,
      title: 'Address High-Risk Assets',
      description: 'Several assets have high risk scores and require immediate security attention.',
      affected_assets: highRiskAssets.length,
    });
  }

  return recommendations;
}