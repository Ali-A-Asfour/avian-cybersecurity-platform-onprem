import {
  Asset,
  AssetType,
  ComplianceStatus,
  OSInfo,
  HardwareInfo,
  SoftwareItem,
  SecurityTool,
  Vulnerability,
  Agent,
  SecurityEvent,
  DataSourceType,
  AlertSeverity
} from '@/types';
// import { db } from '@/lib/database';
import { logger } from '@/lib/logger';
import { reportCacheService } from './reports/ReportCacheService';
import crypto from 'crypto';

export class AssetService {
  /**
   * Create or update asset from agent data
   */
  async createOrUpdateAsset(agentId: string, assetData: Partial<Asset>): Promise<Asset> {
    try {
      const existingAsset = await this.getAssetByAgentId(agentId);

      if (existingAsset) {
        return await this.updateAsset(existingAsset.id, assetData);
      } else {
        return await this.createAsset(agentId, assetData);
      }
    } catch (error) {
      logger.error('Failed to create or update asset', { error, agentId, assetData });
      throw new Error('Failed to create or update asset');
    }
  }

  /**
   * Create new asset
   */
  private async createAsset(agentId: string, assetData: Partial<Asset>): Promise<Asset> {
    const asset: Asset = {
      id: crypto.randomUUID(),
      agent_id: agentId,
      tenant_id: assetData.tenant_id!,
      asset_type: assetData.asset_type || this.determineAssetType(assetData.os_info),
      name: assetData.name || assetData.os_info?.name || 'Unknown Asset',
      description: assetData.description,
      ip_address: assetData.ip_address!,
      mac_address: assetData.mac_address,
      os_info: assetData.os_info!,
      hardware_info: assetData.hardware_info!,
      software_inventory: assetData.software_inventory || [],
      security_tools: assetData.security_tools || [],
      compliance_status: ComplianceStatus.NOT_STARTED,
      risk_score: this.calculateRiskScore(assetData),
      vulnerabilities: assetData.vulnerabilities || [],
      last_scan: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    logger.info('Asset created', {
      assetId: asset.id,
      agentId,
      tenantId: asset.tenant_id,
      assetType: asset.asset_type
    });

    return asset;
  }

  /**
   * Update existing asset
   */
  private async updateAsset(assetId: string, assetData: Partial<Asset>): Promise<Asset> {
    // In a real implementation, this would update the database
    const updatedAsset = {
      ...assetData,
      id: assetId,
      updated_at: new Date(),
      last_scan: new Date(),
    } as Asset;

    logger.info('Asset updated', {
      assetId,
      tenantId: updatedAsset.tenant_id
    });

    return updatedAsset;
  }

  /**
   * Get asset by agent ID
   */
  async getAssetByAgentId(_agentId: string): Promise<Asset | null> {
    try {
      // In a real implementation, this would query the database
      return null;
    } catch (error) {
      logger.error('Failed to get asset by agent ID', { error, agentId });
      throw new Error('Failed to get asset by agent ID');
    }
  }

  /**
   * Get assets for tenant
   */
  async getAssetsByTenant(tenantId: string): Promise<Asset[]> {
    try {
      // Generate tenant-specific mock data
      const mockAssets: Asset[] = this.generateTenantSpecificAssets(tenantId);

      logger.info('Assets retrieved for tenant', {
        tenantId,
        assetCount: mockAssets.length
      });

      return mockAssets;
    } catch (error) {
      logger.error('Failed to get assets for tenant', { error, tenantId });
      throw new Error('Failed to get assets for tenant');
    }
  }

  /**
   * Generate tenant-specific mock assets
   */
  private generateTenantSpecificAssets(tenantId: string): Asset[] {
    // Return simplified mock assets for each tenant
    const baseAssets = {
      'dev-tenant-123': [
        {
          id: 'asset-demo-1',
          agent_id: 'agent-demo-1',
          tenant_id: tenantId,
          asset_type: AssetType.WORKSTATION,
          name: 'DEV-WORKSTATION-01',
          description: 'Development workstation',
          ip_address: '192.168.1.100',
          mac_address: '00:1B:44:11:3A:B7',
          os_info: {
            name: 'Windows 11 Pro',
            version: '22H2',
            architecture: 'x64' as const,
            build_number: '22621.2428',
            kernel_version: '10.0.22621',
            last_boot_time: new Date(Date.now() - 86400000),
            timezone: 'UTC-5'
          },
          hardware_info: {
            manufacturer: 'Dell',
            model: 'OptiPlex 7090',
            serial_number: 'DL7090-001',
            cpu: {
              model: 'Intel Core i7-11700',
              cores: 8,
              threads: 16,
              frequency_mhz: 2900,
              architecture: 'x64' as const
            },
            memory: {
              total_gb: 32,
              available_gb: 16,
              type: 'DDR4',
              speed_mhz: 3200
            },
            storage: [{
              device: 'C:',
              type: 'nvme' as const,
              size_gb: 512,
              free_gb: 256,
              mount_point: 'C:',
              file_system: 'NTFS'
            }],
            network_interfaces: [{
              name: 'Ethernet',
              type: 'ethernet' as const,
              ip_addresses: ['192.168.1.100'],
              mac_address: '00:1B:44:11:3A:B7',
              status: 'up' as const,
              speed_mbps: 1000
            }]
          },
          software_inventory: [{
            name: 'Microsoft Office 365',
            version: '16.0.16827.20166',
            vendor: 'Microsoft',
            install_date: new Date('2023-01-15'),
            size_mb: 2048,
            license_type: 'Commercial',
            is_security_related: false
          }],
          security_tools: [{
            name: 'Windows Defender',
            vendor: 'Microsoft',
            version: '4.18.23090.2008',
            type: 'edr' as const,
            status: 'active' as const,
            last_update: new Date(Date.now() - 3600000),
            configuration_status: 'optimal' as const,
            license_status: 'valid' as const,
            license_expiry: new Date('2024-12-31')
          }],
          compliance_status: ComplianceStatus.COMPLETED,
          risk_score: 25,
          vulnerabilities: [],
          last_scan: new Date(Date.now() - 86400000),
          created_at: new Date('2023-01-01'),
          updated_at: new Date()
        }
      ],
      'acme-corp-456': [
        {
          id: 'asset-acme-1',
          agent_id: 'agent-acme-1',
          tenant_id: tenantId,
          asset_type: AssetType.SERVER,
          name: 'ACME-WEB-SERVER-01',
          description: 'Production web server',
          ip_address: '10.0.1.50',
          mac_address: '00:50:56:A1:B2:C3',
          os_info: {
            name: 'Ubuntu Server',
            version: '22.04 LTS',
            architecture: 'x64' as const,
            build_number: '22.04.3',
            kernel_version: '5.15.0-88-generic',
            last_boot_time: new Date(Date.now() - 2592000000),
            timezone: 'UTC'
          },
          hardware_info: {
            manufacturer: 'HPE',
            model: 'ProLiant DL380 Gen10',
            serial_number: 'HPE-DL380-001',
            cpu: {
              model: 'Intel Xeon Gold 6248R',
              cores: 24,
              threads: 48,
              frequency_mhz: 3000,
              architecture: 'x64' as const
            },
            memory: {
              total_gb: 128,
              available_gb: 64,
              type: 'DDR4',
              speed_mhz: 2933
            },
            storage: [{
              device: '/dev/sda1',
              type: 'ssd' as const,
              size_gb: 2048,
              free_gb: 1024,
              mount_point: '/',
              file_system: 'ext4'
            }],
            network_interfaces: [{
              name: 'eth0',
              type: 'ethernet' as const,
              ip_addresses: ['10.0.1.50'],
              mac_address: '00:50:56:A1:B2:C3',
              status: 'up' as const,
              speed_mbps: 10000
            }]
          },
          software_inventory: [{
            name: 'Apache HTTP Server',
            version: '2.4.52',
            vendor: 'Apache Software Foundation',
            install_date: new Date('2023-06-01'),
            size_mb: 256,
            license_type: 'Open Source',
            is_security_related: false
          }],
          security_tools: [{
            name: 'CrowdStrike Falcon',
            vendor: 'CrowdStrike',
            version: '7.06.16303.0',
            type: 'edr' as const,
            status: 'active' as const,
            last_update: new Date(Date.now() - 1800000),
            configuration_status: 'optimal' as const,
            license_status: 'valid' as const,
            license_expiry: new Date('2024-12-31')
          }],
          compliance_status: ComplianceStatus.IN_PROGRESS,
          risk_score: 45,
          vulnerabilities: [{
            id: 'CVE-2023-12345',
            title: 'Apache HTTP Server Vulnerability',
            description: 'Potential security vulnerability in Apache HTTP Server',
            severity: 'medium' as const,
            cvss_score: 6.5,
            cve_id: 'CVE-2023-12345',
            affected_software: 'Apache HTTP Server 2.4.52',
            patch_available: true,
            patch_details: 'Update to Apache HTTP Server 2.4.58 or later',
            discovered_date: new Date('2023-12-01'),
            remediation_status: 'open' as const
          }],
          last_scan: new Date(Date.now() - 43200000),
          created_at: new Date('2023-06-01'),
          updated_at: new Date()
        },
        {
          id: 'asset-acme-2',
          agent_id: 'agent-acme-2',
          tenant_id: tenantId,
          asset_type: AssetType.WORKSTATION,
          name: 'ACME-LAPTOP-SARAH',
          description: 'Sarah Connor\'s security workstation',
          ip_address: '10.0.2.25',
          mac_address: 'A4:5E:60:D1:E2:F3',
          os_info: {
            name: 'macOS Sonoma',
            version: '14.1.2',
            architecture: 'arm64' as const,
            build_number: '23B92',
            kernel_version: '23.1.0',
            last_boot_time: new Date(Date.now() - 172800000),
            timezone: 'America/New_York'
          },
          hardware_info: {
            manufacturer: 'Apple',
            model: 'MacBook Pro 16-inch',
            serial_number: 'MBP16-2023-001',
            cpu: {
              model: 'Apple M3 Pro',
              cores: 12,
              threads: 12,
              frequency_mhz: 4050,
              architecture: 'arm64' as const
            },
            memory: {
              total_gb: 32,
              available_gb: 18,
              type: 'LPDDR5',
              speed_mhz: 6400
            },
            storage: [{
              device: 'disk0s1',
              type: 'nvme' as const,
              size_gb: 1024,
              free_gb: 512,
              mount_point: '/',
              file_system: 'APFS'
            }],
            network_interfaces: [{
              name: 'en0',
              type: 'ethernet' as const,
              ip_addresses: ['10.0.2.25'],
              mac_address: 'A4:5E:60:D1:E2:F3',
              status: 'up' as const,
              speed_mbps: 1200
            }]
          },
          software_inventory: [{
            name: 'Wireshark',
            version: '4.2.0',
            vendor: 'Wireshark Foundation',
            install_date: new Date('2023-11-15'),
            size_mb: 512,
            license_type: 'Open Source',
            is_security_related: true
          }],
          security_tools: [{
            name: 'SentinelOne',
            vendor: 'SentinelOne',
            version: '23.4.2.15',
            type: 'edr' as const,
            status: 'active' as const,
            last_update: new Date(Date.now() - 7200000),
            configuration_status: 'optimal' as const,
            license_status: 'valid' as const,
            license_expiry: new Date('2024-12-31')
          }],
          compliance_status: ComplianceStatus.COMPLETED,
          risk_score: 15,
          vulnerabilities: [],
          last_scan: new Date(Date.now() - 21600000),
          created_at: new Date('2023-11-01'),
          updated_at: new Date()
        }
      ],
      'techstart-789': [
        {
          id: 'asset-tech-1',
          agent_id: 'agent-tech-1',
          tenant_id: tenantId,
          asset_type: AssetType.WORKSTATION,
          name: 'TECH-DEV-EMMA',
          description: 'Emma\'s development machine',
          ip_address: '192.168.10.10',
          mac_address: 'B8:27:EB:A1:B2:C3',
          os_info: {
            name: 'Arch Linux',
            version: 'Rolling',
            architecture: 'x64' as const,
            build_number: '2023.12.01',
            kernel_version: '6.6.8-arch1-1',
            last_boot_time: new Date(Date.now() - 604800000),
            timezone: 'America/Los_Angeles'
          },
          hardware_info: {
            manufacturer: 'System76',
            model: 'Oryx Pro',
            serial_number: 'SYS76-ORYX-001',
            cpu: {
              model: 'AMD Ryzen 9 7940HS',
              cores: 8,
              threads: 16,
              frequency_mhz: 4000,
              architecture: 'x64' as const
            },
            memory: {
              total_gb: 64,
              available_gb: 32,
              type: 'DDR5',
              speed_mhz: 5600
            },
            storage: [{
              device: '/dev/nvme0n1p1',
              type: 'nvme' as const,
              size_gb: 2048,
              free_gb: 1536,
              mount_point: '/',
              file_system: 'btrfs'
            }],
            network_interfaces: [{
              name: 'wlan0',
              type: 'ethernet' as const,
              ip_addresses: ['192.168.10.10'],
              mac_address: 'B8:27:EB:A1:B2:C3',
              status: 'up' as const,
              speed_mbps: 866
            }]
          },
          software_inventory: [{
            name: 'Docker',
            version: '24.0.7',
            vendor: 'Docker Inc.',
            install_date: new Date('2024-01-01'),
            size_mb: 1024,
            license_type: 'Open Source',
            is_security_related: false
          }],
          security_tools: [{
            name: 'OSSEC HIDS',
            vendor: 'Trend Micro',
            version: '3.7.0',
            type: 'edr' as const,
            status: 'active' as const,
            last_update: new Date(Date.now() - 86400000),
            configuration_status: 'optimal' as const,
            license_status: 'valid' as const,
            license_expiry: new Date('2024-12-31')
          }],
          compliance_status: ComplianceStatus.COMPLETED,
          risk_score: 10,
          vulnerabilities: [],
          last_scan: new Date(Date.now() - 3600000),
          created_at: new Date('2024-01-01'),
          updated_at: new Date()
        }
      ],
      'global-finance-101': [
        {
          id: 'asset-gf-1',
          agent_id: 'agent-gf-1',
          tenant_id: tenantId,
          asset_type: AssetType.SERVER,
          name: 'GF-TRADING-SERVER-01',
          description: 'High-frequency trading server',
          ip_address: '172.16.1.100',
          mac_address: '00:0C:29:A1:B2:C3',
          os_info: {
            name: 'Red Hat Enterprise Linux',
            version: '9.3',
            architecture: 'x64' as const,
            build_number: '9.3-13',
            kernel_version: '5.14.0-362.8.1.el9_3.x86_64',
            last_boot_time: new Date(Date.now() - 7776000000),
            timezone: 'America/New_York'
          },
          hardware_info: {
            manufacturer: 'IBM',
            model: 'Power System S922',
            serial_number: 'IBM-S922-001',
            cpu: {
              model: 'IBM POWER9',
              cores: 32,
              threads: 128,
              frequency_mhz: 3800,
              architecture: 'x64' as const
            },
            memory: {
              total_gb: 512,
              available_gb: 256,
              type: 'DDR4',
              speed_mhz: 2666
            },
            storage: [{
              device: '/dev/sda1',
              type: 'nvme' as const,
              size_gb: 8192,
              free_gb: 4096,
              mount_point: '/',
              file_system: 'xfs'
            }],
            network_interfaces: [{
              name: 'eth0',
              type: 'ethernet' as const,
              ip_addresses: ['172.16.1.100'],
              mac_address: '00:0C:29:A1:B2:C3',
              status: 'up' as const,
              speed_mbps: 25000
            }]
          },
          software_inventory: [{
            name: 'Oracle Database',
            version: '19.21.0.0.0',
            vendor: 'Oracle Corporation',
            install_date: new Date('2023-01-01'),
            size_mb: 8192,
            license_type: 'Commercial',
            is_security_related: false
          }],
          security_tools: [{
            name: 'IBM Security Guardium',
            vendor: 'IBM',
            version: '11.5.0',
            type: 'edr' as const,
            status: 'active' as const,
            last_update: new Date(Date.now() - 3600000),
            configuration_status: 'optimal' as const,
            license_status: 'valid' as const,
            license_expiry: new Date('2024-12-31')
          }],
          compliance_status: ComplianceStatus.COMPLETED,
          risk_score: 35,
          vulnerabilities: [{
            id: 'CVE-2023-67890',
            title: 'Oracle Database Security Patch',
            description: 'Critical security patch required for Oracle Database',
            severity: 'high' as const,
            cvss_score: 8.2,
            cve_id: 'CVE-2023-67890',
            affected_software: 'Oracle Database 19.21.0.0.0',
            patch_available: true,
            patch_details: 'Apply Oracle Critical Patch Update',
            discovered_date: new Date('2023-10-15'),
            remediation_status: 'open' as const
          }],
          last_scan: new Date(Date.now() - 14400000),
          created_at: new Date('2023-01-01'),
          updated_at: new Date()
        }
      ]
    };

    return baseAssets[tenantId as keyof typeof baseAssets] || baseAssets['dev-tenant-123'];
  }

  /**
   * Get asset by ID
   */
  async getAssetById(assetId: string): Promise<Asset | null> {
    try {
      // In a real implementation, this would query the database
      return null;
    } catch (error) {
      logger.error('Failed to get asset by ID', { error, assetId });
      throw new Error('Failed to get asset by ID');
    }
  }

  /**
   * Update asset software inventory
   */
  async updateSoftwareInventory(assetId: string, software: SoftwareItem[]): Promise<void> {
    try {
      // In a real implementation, this would update the database
      logger.info('Software inventory updated', {
        assetId,
        softwareCount: software.length
      });
    } catch (error) {
      logger.error('Failed to update software inventory', { error, assetId });
      throw new Error('Failed to update software inventory');
    }
  }

  /**
   * Update asset security tools
   */
  async updateSecurityTools(assetId: string, tools: SecurityTool[]): Promise<void> {
    try {
      // In a real implementation, this would update the database
      logger.info('Security tools updated', {
        assetId,
        toolsCount: tools.length
      });
    } catch (error) {
      logger.error('Failed to update security tools', { error, assetId });
      throw new Error('Failed to update security tools');
    }
  }

  /**
   * Update asset vulnerabilities
   */
  async updateVulnerabilities(assetId: string, vulnerabilities: Vulnerability[], tenantId?: string): Promise<void> {
    try {
      // In a real implementation, this would update the database
      const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
      const highCount = vulnerabilities.filter(v => v.severity === 'high').length;

      // Invalidate report cache for vulnerability updates
      if (tenantId) {
        await reportCacheService.invalidateCache({
          tenantId,
          trigger: 'new_vulnerabilities'
        });
      }

      logger.info('Vulnerabilities updated', {
        assetId,
        totalCount: vulnerabilities.length,
        criticalCount,
        highCount
      });
    } catch (error) {
      logger.error('Failed to update vulnerabilities', error instanceof Error ? error : new Error(String(error)), { assetId });
      throw new Error('Failed to update vulnerabilities');
    }
  }

  /**
   * Perform asset compliance assessment
   */
  async performComplianceAssessment(assetId: string): Promise<ComplianceStatus> {
    try {
      const asset = await this.getAssetById(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const complianceScore = this.calculateComplianceScore(asset);
      let status: ComplianceStatus;

      if (complianceScore >= 90) {
        status = ComplianceStatus.COMPLETED;
      } else if (complianceScore >= 70) {
        status = ComplianceStatus.IN_PROGRESS;
      } else {
        status = ComplianceStatus.NON_COMPLIANT;
      }

      logger.info('Compliance assessment completed', {
        assetId,
        complianceScore,
        status
      });

      return status;
    } catch (error) {
      logger.error('Failed to perform compliance assessment', { error, assetId });
      throw new Error('Failed to perform compliance assessment');
    }
  }

  /**
   * Generate asset inventory report
   */
  async generateInventoryReport(tenantId: string): Promise<any> {
    try {
      const assets = await this.getAssetsByTenant(tenantId);

      const report = {
        tenant_id: tenantId,
        generated_at: new Date(),
        total_assets: assets.length,
        asset_types: this.groupAssetsByType(assets),
        operating_systems: this.groupAssetsByOS(assets),
        security_tools: this.aggregateSecurityTools(assets),
        vulnerabilities: this.aggregateVulnerabilities(assets),
        compliance_summary: this.aggregateComplianceStatus(assets),
        risk_distribution: this.aggregateRiskScores(assets),
      };

      logger.info('Asset inventory report generated', {
        tenantId,
        totalAssets: assets.length
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate inventory report', { error, tenantId });
      throw new Error('Failed to generate inventory report');
    }
  }

  /**
   * Scan asset for vulnerabilities
   */
  async scanAssetVulnerabilities(assetId: string): Promise<Vulnerability[]> {
    try {
      const asset = await this.getAssetById(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // In a real implementation, this would integrate with vulnerability scanners
      const vulnerabilities = await this.performVulnerabilityScan(asset);

      await this.updateVulnerabilities(assetId, vulnerabilities);

      logger.info('Vulnerability scan completed', {
        assetId,
        vulnerabilitiesFound: vulnerabilities.length
      });

      return vulnerabilities;
    } catch (error) {
      logger.error('Failed to scan asset vulnerabilities', { error, assetId });
      throw new Error('Failed to scan asset vulnerabilities');
    }
  }

  // Private helper methods

  private determineAssetType(osInfo?: OSInfo): AssetType {
    if (!osInfo) return AssetType.WORKSTATION;

    const osName = osInfo.name.toLowerCase();

    if (osName.includes('server') || osName.includes('windows server')) {
      return AssetType.SERVER;
    } else if (osName.includes('mobile') || osName.includes('android') || osName.includes('ios')) {
      return AssetType.MOBILE_DEVICE;
    } else if (osName.includes('macos') || osName.includes('mac os')) {
      return AssetType.LAPTOP;
    } else if (osName.includes('linux')) {
      return AssetType.WORKSTATION;
    } else if (osName.includes('windows')) {
      return AssetType.WORKSTATION;
    }

    return AssetType.WORKSTATION;
  }

  private calculateRiskScore(assetData: Partial<Asset>): number {
    let riskScore = 0;

    // Base risk based on asset type
    switch (assetData.asset_type) {
      case AssetType.SERVER:
        riskScore += 30;
        break;
      case AssetType.WORKSTATION:
        riskScore += 20;
        break;
      case AssetType.LAPTOP:
        riskScore += 25;
        break;
      case AssetType.MOBILE_DEVICE:
        riskScore += 15;
        break;
      default:
        riskScore += 10;
    }

    // Risk based on security tools
    const securityToolsCount = assetData.security_tools?.length || 0;
    if (securityToolsCount === 0) {
      riskScore += 40;
    } else if (securityToolsCount < 3) {
      riskScore += 20;
    }

    // Risk based on vulnerabilities
    const vulnerabilities = assetData.vulnerabilities || [];
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical').length;
    const highVulns = vulnerabilities.filter(v => v.severity === 'high').length;

    riskScore += criticalVulns * 15;
    riskScore += highVulns * 10;

    // Cap at 100
    return Math.min(riskScore, 100);
  }

  private calculateComplianceScore(asset: Asset): number {
    let score = 100;

    // Deduct points for missing security tools
    const requiredTools = ['edr', 'antivirus', 'firewall'];
    const installedToolTypes = asset.security_tools.map(t => t.type);

    requiredTools.forEach(toolType => {
      if (!installedToolTypes.includes(toolType as any)) {
        score -= 20;
      }
    });

    // Deduct points for vulnerabilities
    const criticalVulns = asset.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highVulns = asset.vulnerabilities.filter(v => v.severity === 'high').length;

    score -= criticalVulns * 15;
    score -= highVulns * 10;

    // Deduct points for outdated tools
    const outdatedTools = asset.security_tools.filter(t => t.status !== 'active').length;
    score -= outdatedTools * 5;

    return Math.max(score, 0);
  }

  private async performVulnerabilityScan(asset: Asset): Promise<Vulnerability[]> {
    // Mock vulnerability scan - in real implementation, this would integrate with scanners
    const mockVulnerabilities: Vulnerability[] = [
      {
        id: crypto.randomUUID(),
        cve_id: 'CVE-2023-1234',
        title: 'Critical Security Vulnerability in System Component',
        description: 'A critical vulnerability that could allow remote code execution',
        severity: 'critical',
        cvss_score: 9.8,
        affected_software: 'System Component v1.0',
        patch_available: true,
        patch_details: 'Update to version 1.1 or later',
        discovered_date: new Date(),
        remediation_status: 'open',
      },
    ];

    return mockVulnerabilities;
  }

  private groupAssetsByType(assets: Asset[]): Record<string, number> {
    return assets.reduce((acc, asset) => {
      acc[asset.asset_type] = (acc[asset.asset_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupAssetsByOS(assets: Asset[]): Record<string, number> {
    return assets.reduce((acc, asset) => {
      const osName = asset.os_info.name;
      acc[osName] = (acc[osName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private aggregateSecurityTools(assets: Asset[]): Record<string, number> {
    const toolCounts: Record<string, number> = {};

    assets.forEach(asset => {
      asset.security_tools.forEach(tool => {
        toolCounts[tool.name] = (toolCounts[tool.name] || 0) + 1;
      });
    });

    return toolCounts;
  }

  private aggregateVulnerabilities(assets: Asset[]): Record<string, number> {
    const vulnCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    assets.forEach(asset => {
      asset.vulnerabilities.forEach(vuln => {
        vulnCounts[vuln.severity]++;
      });
    });

    return vulnCounts;
  }

  private aggregateComplianceStatus(assets: Asset[]): Record<string, number> {
    return assets.reduce((acc, asset) => {
      acc[asset.compliance_status] = (acc[asset.compliance_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private aggregateRiskScores(assets: Asset[]): { low: number; medium: number; high: number; critical: number } {
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };

    assets.forEach(asset => {
      if (asset.risk_score < 25) {
        distribution.low++;
      } else if (asset.risk_score < 50) {
        distribution.medium++;
      } else if (asset.risk_score < 75) {
        distribution.high++;
      } else {
        distribution.critical++;
      }
    });

    return distribution;
  }
}

export const assetService = new AssetService();