import {
  Agent,
  AgentConfiguration,
  AgentDeployment,
  AgentInstallationScript,
  AgentRegistration,
  AgentStatus,
  DeploymentConfig,
  HeartbeatData,
  InstalledTool,
  ToolInstallationConfig,
  ToolStatus,
  OSInfo,
  HardwareInfo,
  AgentHealthMetrics,
  SecurityEvent,
  DataSourceType,
  AlertSeverity,
  Asset,
  AssetType,
  ComplianceStatus
} from '@/types';
// import { db } from '@/lib/database';
// import { logger } from '@/lib/logger';
import { assetService } from './asset.service';
import { AlertService } from './alert.service';

const alertService = new AlertService();
import crypto from 'crypto';

export class AgentService {
  /**
   * Create a new agent deployment configuration
   */
  async createDeployment(
    tenantId: string,
    deploymentName: string,
    config: DeploymentConfig,
    createdBy: string
  ): Promise<AgentDeployment> {
    try {
      const deployment: AgentDeployment = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        deployment_name: deploymentName,
        target_count: 0,
        deployed_count: 0,
        failed_count: 0,
        status: 'pending',
        deployment_config: config,
        created_by: createdBy,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // In a real implementation, this would be stored in the database
      logger.info('Agent deployment created', {
        deploymentId: deployment.id,
        tenantId,
        deploymentName
      });

      return deployment;
    } catch {
      logger.error('Failed to create agent deployment', { error, tenantId, deploymentName });
      throw new Error('Failed to create agent deployment');
    }
  }

  /**
   * Generate installation script for specific OS
   */
  async generateInstallationScript(
    tenantId: string,
    osType: 'windows' | 'linux' | 'macos',
    deploymentId?: string
  ): Promise<AgentInstallationScript> {
    try {
      const deploymentKey = this.generateDeploymentKey(tenantId);
      const scriptContent = this.generateScriptContent(osType, deploymentKey, tenantId);
      const scriptHash = crypto.createHash('sha256').update(scriptContent).digest('hex');

      const script: AgentInstallationScript = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        os_type: osType,
        script_content: scriptContent,
        script_hash: scriptHash,
        deployment_key: deploymentKey,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        download_count: 0,
        created_at: new Date(),
      };

      logger.info('Installation script generated', {
        scriptId: script.id,
        tenantId,
        osType
      });

      return script;
    } catch {
      logger.error('Failed to generate installation script', { error, tenantId, osType });
      throw new Error('Failed to generate installation script');
    }
  }

  /**
   * Register a new agent
   */
  async registerAgent(registrationData: Omit<AgentRegistration, 'registration_status' | 'registered_at'>): Promise<AgentRegistration> {
    try {
      const registration: AgentRegistration = {
        ...registrationData,
        registration_status: 'pending',
        registered_at: new Date(),
      };

      // Validate registration token
      if (!this.validateRegistrationToken(registration.registration_token, registration.tenant_id)) {
        throw new Error('Invalid registration token');
      }

      // Auto-approve registration for valid tokens
      registration.registration_status = 'approved';
      registration.approved_at = new Date();

      // Create the agent record
      const agent = await this.createAgentFromRegistration(registration);

      logger.info('Agent registered successfully', {
        agentId: agent.id,
        tenantId: registration.tenant_id,
        hostname: registration.hostname
      });

      return registration;
    } catch {
      logger.error('Failed to register agent', { error, registrationData });
      throw new Error('Failed to register agent');
    }
  }

  /**
   * Create agent record from registration
   */
  private async createAgentFromRegistration(registration: AgentRegistration): Promise<Agent> {
    const agent: Agent = {
      id: registration.agent_id,
      tenant_id: registration.tenant_id,
      client_id: `client-${Date.now()}`,
      hostname: registration.hostname,
      ip_address: registration.ip_address,
      os_type: registration.os_info.name,
      os_version: registration.os_info.version,
      agent_version: registration.agent_version,
      status: AgentStatus.ACTIVE,
      last_heartbeat: new Date(),
      installed_tools: [],
      configuration: await this.createDefaultConfiguration(registration.agent_id),
      deployment_key: this.generateDeploymentKey(registration.tenant_id),
      health_metrics: {
        cpu_usage: 0,
        memory_usage: 0,
        disk_usage: 0,
        network_latency: 0,
        uptime_seconds: 0,
        events_processed_24h: 0,
        last_updated: new Date(),
      },
      created_at: new Date(),
      updated_at: new Date(),
    };

    return agent;
  }

  /**
   * Create default agent configuration
   */
  private async createDefaultConfiguration(_agentId: string): Promise<AgentConfiguration> {
    return {
      id: crypto.randomUUID(),
      agent_id: agentId,
      heartbeat_interval: 300, // 5 minutes
      data_collection_enabled: true,
      log_level: 'info',
      auto_update_enabled: true,
      tools_to_install: [
        {
          tool_name: 'Avast Business Antivirus',
          vendor: 'Avast',
          installation_params: {
            silent_install: true,
            auto_configure: true,
          },
          auto_configure: true,
          priority: 1,
        },
      ],
      monitoring_settings: {
        collect_system_metrics: true,
        collect_security_events: true,
        collect_network_traffic: false,
        collect_file_changes: true,
        metrics_interval: 60,
        retention_days: 30,
      },
      security_settings: {
        encryption_enabled: true,
        certificate_validation: true,
        allowed_commands: ['status', 'update', 'scan', 'configure'],
        restricted_paths: ['/etc', '/sys', '/proc'],
        communication_protocol: 'https',
        api_key_rotation_days: 90,
      },
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * Process agent heartbeat
   */
  async processHeartbeat(heartbeatData: HeartbeatData): Promise<void> {
    try {
      // Update agent status and health metrics
      await this.updateAgentHealth(heartbeatData.agent_id, heartbeatData);

      // Process any security events
      if (heartbeatData.security_events && heartbeatData.security_events.length > 0) {
        await this.processSecurityEvents(heartbeatData.agent_id, heartbeatData.security_events);
      }

      logger.debug('Heartbeat processed', {
        agentId: heartbeatData.agent_id,
        timestamp: heartbeatData.timestamp,
        eventsCount: heartbeatData.security_events?.length || 0
      });
    } catch {
      logger.error('Failed to process heartbeat', { error, agentId: heartbeatData.agent_id });
      throw new Error('Failed to process heartbeat');
    }
  }

  /**
   * Update agent health metrics
   */
  private async updateAgentHealth(agentId: string, heartbeatData: HeartbeatData): Promise<void> {
    // In a real implementation, this would update the database
    logger.debug('Agent health updated', {
      agentId,
      status: heartbeatData.status,
      cpuUsage: heartbeatData.health_metrics.cpu_usage,
      memoryUsage: heartbeatData.health_metrics.memory_usage
    });
  }

  /**
   * Process security events from agent
   */
  private async processSecurityEvents(agentId: string, events: any[]): Promise<void> {
    try {
      for (const event of events) {
        // Normalize the event data
        const normalizedEvent = await this.normalizeSecurityEvent(agentId, event);

        // Store the event for correlation and analysis
        await this.storeSecurityEvent(normalizedEvent);

        // Check if event should trigger an alert
        await this.evaluateEventForAlerting(normalizedEvent);

        // Update asset information if relevant
        await this.updateAssetFromEvent(agentId, event);
      }

      logger.info('Security events processed', {
        agentId,
        eventCount: events.length
      });
    } catch {
      logger.error('Failed to process security events', { error, agentId, eventCount: events.length });
      throw error;
    }
  }

  /**
   * Normalize security event from agent data
   */
  private async normalizeSecurityEvent(agentId: string, rawEvent: any): Promise<SecurityEvent> {
    const agent = await this.getAgentById(agentId);

    return {
      id: crypto.randomUUID(),
      source_type: DataSourceType.AVIAN_AGENT,
      source_id: agentId,
      tenant_id: agent?.tenant_id || 'unknown',
      asset_id: await this.getAssetIdByAgentId(agentId),
      agent_id: agentId,
      event_type: rawEvent.event_type || 'unknown',
      severity: this.mapEventSeverity(rawEvent.severity),
      timestamp: new Date(rawEvent.timestamp || Date.now()),
      raw_data: rawEvent,
      normalized_data: {
        title: rawEvent.title || rawEvent.event_type || 'Security Event',
        description: rawEvent.description || 'Security event detected by AVIAN agent',
        source_ip: rawEvent.source_ip,
        destination_ip: rawEvent.destination_ip,
        process_name: rawEvent.process_name,
        file_path: rawEvent.file_path,
        user_account: rawEvent.user_account,
        command_line: rawEvent.command_line,
        network_protocol: rawEvent.network_protocol,
        port: rawEvent.port,
        hash_md5: rawEvent.hash_md5,
        hash_sha256: rawEvent.hash_sha256,
      },
      tags: this.generateEventTags(rawEvent),
      processed_at: new Date(),
      correlation_id: null,
      threat_indicators: this.extractThreatIndicators(rawEvent),
      confidence_score: this.calculateConfidenceScore(rawEvent),
    };
  }

  /**
   * Store security event for analysis and correlation
   */
  private async storeSecurityEvent(event: SecurityEvent): Promise<void> {
    // In a real implementation, this would store in a time-series database or threat lake
    logger.debug('Security event stored', {
      eventId: event.id,
      eventType: event.event_type,
      severity: event.severity,
      agentId: event.agent_id
    });
  }

  /**
   * Evaluate if event should trigger an alert
   */
  private async evaluateEventForAlerting(event: SecurityEvent): Promise<void> {
    try {
      // Define alerting rules
      const shouldAlert = this.shouldCreateAlert(event);

      if (shouldAlert) {
        await alertService.createAlertFromSecurityEvent(event);
        logger.info('Alert created from agent event', {
          eventId: event.id,
          eventType: event.event_type,
          severity: event.severity
        });
      }
    } catch {
      logger.error('Failed to evaluate event for alerting', { error, eventId: event.id });
    }
  }

  /**
   * Update asset information based on agent event
   */
  private async updateAssetFromEvent(agentId: string, event: any): Promise<void> {
    try {
      const assetId = await this.getAssetIdByAgentId(agentId);
      if (!assetId) return;

      // Update software inventory if event contains software information
      if (event.software_changes) {
        await assetService.updateSoftwareInventory(assetId, event.software_changes);
      }

      // Update security tools if event contains security tool information
      if (event.security_tool_status) {
        await assetService.updateSecurityTools(assetId, event.security_tool_status);
      }

      // Update vulnerabilities if event contains vulnerability information
      if (event.vulnerabilities) {
        await assetService.updateVulnerabilities(assetId, event.vulnerabilities, event.tenant_id);
      }
    } catch {
      logger.error('Failed to update asset from event', { error, agentId, event });
    }
  }

  /**
   * Ingest telemetry data from agent
   */
  async ingestTelemetryData(agentId: string, telemetryData: any): Promise<void> {
    try {
      // Process system metrics
      if (telemetryData.system_metrics) {
        await this.processSystemMetrics(agentId, telemetryData.system_metrics);
      }

      // Process network traffic data
      if (telemetryData.network_traffic) {
        await this.processNetworkTraffic(agentId, telemetryData.network_traffic);
      }

      // Process file system changes
      if (telemetryData.file_changes) {
        await this.processFileChanges(agentId, telemetryData.file_changes);
      }

      // Process process monitoring data
      if (telemetryData.process_data) {
        await this.processProcessData(agentId, telemetryData.process_data);
      }

      // Update asset information
      await this.updateAssetFromTelemetry(agentId, telemetryData);

      logger.debug('Telemetry data ingested', {
        agentId,
        dataTypes: Object.keys(telemetryData)
      });
    } catch {
      logger.error('Failed to ingest telemetry data', { error, agentId });
      throw error;
    }
  }

  /**
   * Process system metrics from agent
   */
  private async processSystemMetrics(agentId: string, metrics: any): Promise<void> {
    // Store metrics for monitoring and alerting
    const normalizedMetrics = {
      agent_id: agentId,
      timestamp: new Date(metrics.timestamp || Date.now()),
      cpu_usage: metrics.cpu_usage,
      memory_usage: metrics.memory_usage,
      disk_usage: metrics.disk_usage,
      network_io: metrics.network_io,
      disk_io: metrics.disk_io,
      process_count: metrics.process_count,
      uptime: metrics.uptime,
    };

    // Check for anomalies and create alerts if necessary
    await this.checkMetricAnomalies(agentId, normalizedMetrics);
  }

  /**
   * Process network traffic data from agent
   */
  private async processNetworkTraffic(agentId: string, networkData: any): Promise<void> {
    // Analyze network connections for suspicious activity
    for (const connection of networkData.connections || []) {
      const suspiciousActivity = await this.analyzeNetworkConnection(connection);

      if (suspiciousActivity) {
        await this.createNetworkSecurityEvent(agentId, connection, suspiciousActivity);
      }
    }
  }

  /**
   * Process file system changes from agent
   */
  private async processFileChanges(agentId: string, fileChanges: any): Promise<void> {
    // Monitor for suspicious file activities
    for (const change of fileChanges.changes || []) {
      const suspiciousChange = await this.analyzeFileChange(change);

      if (suspiciousChange) {
        await this.createFileSecurityEvent(agentId, change, suspiciousChange);
      }
    }
  }

  /**
   * Process process monitoring data from agent
   */
  private async processProcessData(agentId: string, processData: any): Promise<void> {
    // Monitor for suspicious processes
    for (const process of processData.processes || []) {
      const suspiciousProcess = await this.analyzeProcess(process);

      if (suspiciousProcess) {
        await this.createProcessSecurityEvent(agentId, process, suspiciousProcess);
      }
    }
  }

  /**
   * Update asset information from telemetry data
   */
  private async updateAssetFromTelemetry(agentId: string, telemetryData: any): Promise<void> {
    try {
      const assetId = await this.getAssetIdByAgentId(agentId);
      if (!assetId) return;

      // Update hardware information if available
      if (telemetryData.hardware_info) {
        // In a real implementation, this would update the asset's hardware info
      }

      // Update software inventory if available
      if (telemetryData.installed_software) {
        await assetService.updateSoftwareInventory(assetId, telemetryData.installed_software);
      }

      // Update security tools status if available
      if (telemetryData.security_tools) {
        await assetService.updateSecurityTools(assetId, telemetryData.security_tools);
      }
    } catch {
      logger.error('Failed to update asset from telemetry', { error, agentId });
    }
  }

  /**
   * Correlate agent data with SIEM and threat intelligence
   */
  async correlateAgentData(agentId: string, eventData: any): Promise<any> {
    try {
      const correlationResults = {
        threat_matches: [],
        siem_correlations: [],
        risk_score: 0,
        recommendations: [],
      };

      // Correlate with threat intelligence feeds
      const threatMatches = await this.correlateThreatIntelligence(eventData);
      correlationResults.threat_matches = threatMatches;

      // Correlate with SIEM data
      const siemCorrelations = await this.correlateSIEMData(eventData);
      correlationResults.siem_correlations = siemCorrelations;

      // Calculate risk score based on correlations
      correlationResults.risk_score = this.calculateCorrelationRiskScore(
        threatMatches,
        siemCorrelations
      );

      // Generate recommendations
      correlationResults.recommendations = this.generateCorrelationRecommendations(
        correlationResults
      );

      logger.info('Agent data correlated', {
        agentId,
        threatMatches: threatMatches.length,
        siemCorrelations: siemCorrelations.length,
        riskScore: correlationResults.risk_score
      });

      return correlationResults;
    } catch {
      logger.error('Failed to correlate agent data', { error, agentId });
      throw error;
    }
  }

  /**
   * Generate anomaly detection alerts from agent data
   */
  async generateAnomalyAlerts(agentId: string, telemetryData: any): Promise<void> {
    try {
      // Detect system performance anomalies
      const performanceAnomalies = await this.detectPerformanceAnomalies(agentId, telemetryData);

      // Detect security behavior anomalies
      const securityAnomalies = await this.detectSecurityAnomalies(agentId, telemetryData);

      // Create alerts for detected anomalies
      for (const anomaly of [...performanceAnomalies, ...securityAnomalies]) {
        await alertService.createAnomalyAlert(agentId, anomaly);
      }

      logger.info('Anomaly detection completed', {
        agentId,
        performanceAnomalies: performanceAnomalies.length,
        securityAnomalies: securityAnomalies.length
      });
    } catch {
      logger.error('Failed to generate anomaly alerts', { error, agentId });
    }
  }

  // Helper methods for data processing and analysis

  private async getAgentById(_agentId: string): Promise<Agent | null> {
    // In a real implementation, this would query the database
    return null;
  }

  private async getAssetIdByAgentId(_agentId: string): Promise<string | null> {
    // In a real implementation, this would query the database to find the asset associated with the agent
    return null;
  }

  private mapEventSeverity(severity: string): AlertSeverity {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return AlertSeverity.CRITICAL;
      case 'high':
        return AlertSeverity.HIGH;
      case 'medium':
        return AlertSeverity.MEDIUM;
      case 'low':
        return AlertSeverity.LOW;
      default:
        return AlertSeverity.MEDIUM;
    }
  }

  private generateEventTags(rawEvent: any): string[] {
    const tags = ['agent-generated'];

    if (rawEvent.event_type) {
      tags.push(`type:${rawEvent.event_type}`);
    }

    if (rawEvent.process_name) {
      tags.push(`process:${rawEvent.process_name}`);
    }

    if (rawEvent.user_account) {
      tags.push(`user:${rawEvent.user_account}`);
    }

    return tags;
  }

  private extractThreatIndicators(rawEvent: any): any[] {
    const indicators = [];

    if (rawEvent.hash_md5) {
      indicators.push({
        type: 'file_hash',
        value: rawEvent.hash_md5,
        hash_type: 'md5',
      });
    }

    if (rawEvent.hash_sha256) {
      indicators.push({
        type: 'file_hash',
        value: rawEvent.hash_sha256,
        hash_type: 'sha256',
      });
    }

    if (rawEvent.source_ip) {
      indicators.push({
        type: 'ip_address',
        value: rawEvent.source_ip,
      });
    }

    return indicators;
  }

  private calculateConfidenceScore(rawEvent: any): number {
    let score = 50; // Base confidence

    // Increase confidence based on available data
    if (rawEvent.hash_sha256) score += 20;
    if (rawEvent.process_name) score += 10;
    if (rawEvent.command_line) score += 10;
    if (rawEvent.user_account) score += 10;

    return Math.min(score, 100);
  }

  private shouldCreateAlert(event: SecurityEvent): boolean {
    // Define rules for when to create alerts
    if (event.severity === AlertSeverity.CRITICAL) return true;
    if (event.severity === AlertSeverity.HIGH && event.confidence_score > 70) return true;
    if (event.threat_indicators.length > 2) return true;

    return false;
  }

  private async checkMetricAnomalies(agentId: string, metrics: any): Promise<void> {
    // Check for performance anomalies
    if (metrics.cpu_usage > 90) {
      await this.createPerformanceAlert(agentId, 'high_cpu_usage', metrics);
    }

    if (metrics.memory_usage > 95) {
      await this.createPerformanceAlert(agentId, 'high_memory_usage', metrics);
    }

    if (metrics.disk_usage > 90) {
      await this.createPerformanceAlert(agentId, 'high_disk_usage', metrics);
    }
  }

  private async analyzeNetworkConnection(connection: any): Promise<any> {
    // Analyze network connection for suspicious activity
    const suspiciousIndicators = [];

    // Check for connections to known malicious IPs
    if (await this.isKnownMaliciousIP(connection.remote_ip)) {
      suspiciousIndicators.push('malicious_ip');
    }

    // Check for unusual ports
    if (this.isUnusualPort(connection.remote_port)) {
      suspiciousIndicators.push('unusual_port');
    }

    return suspiciousIndicators.length > 0 ? { indicators: suspiciousIndicators } : null;
  }

  private async analyzeFileChange(change: any): Promise<any> {
    // Analyze file change for suspicious activity
    const suspiciousIndicators = [];

    // Check for changes to system files
    if (this.isSystemFile(change.file_path)) {
      suspiciousIndicators.push('system_file_modification');
    }

    // Check for executable files in unusual locations
    if (this.isExecutableInUnusualLocation(change.file_path)) {
      suspiciousIndicators.push('unusual_executable_location');
    }

    return suspiciousIndicators.length > 0 ? { indicators: suspiciousIndicators } : null;
  }

  private async analyzeProcess(process: any): Promise<any> {
    // Analyze process for suspicious activity
    const suspiciousIndicators = [];

    // Check for processes with suspicious names
    if (this.isSuspiciousProcessName(process.name)) {
      suspiciousIndicators.push('suspicious_process_name');
    }

    // Check for processes running from unusual locations
    if (this.isUnusualProcessLocation(process.path)) {
      suspiciousIndicators.push('unusual_process_location');
    }

    return suspiciousIndicators.length > 0 ? { indicators: suspiciousIndicators } : null;
  }

  private async createNetworkSecurityEvent(agentId: string, connection: any, suspiciousActivity: any): Promise<void> {
    // Create security event for suspicious network activity
    logger.warn('Suspicious network activity detected', { agentId, connection, suspiciousActivity });
  }

  private async createFileSecurityEvent(agentId: string, change: any, suspiciousChange: any): Promise<void> {
    // Create security event for suspicious file activity
    logger.warn('Suspicious file activity detected', { agentId, change, suspiciousChange });
  }

  private async createProcessSecurityEvent(agentId: string, process: any, suspiciousProcess: any): Promise<void> {
    // Create security event for suspicious process activity
    logger.warn('Suspicious process activity detected', { agentId, process, suspiciousProcess });
  }

  private async createPerformanceAlert(agentId: string, alertType: string, metrics: any): Promise<void> {
    // Create performance alert
    logger.warn('Performance alert triggered', { agentId, alertType, metrics });
  }

  private async correlateThreatIntelligence(eventData: any): Promise<any[]> {
    // Correlate with threat intelligence feeds
    // In a real implementation, this would query threat intelligence databases
    return [];
  }

  private async correlateSIEMData(eventData: any): Promise<any[]> {
    // Correlate with SIEM data
    // In a real implementation, this would query SIEM systems
    return [];
  }

  private calculateCorrelationRiskScore(threatMatches: any[], siemCorrelations: any[]): number {
    let score = 0;
    score += threatMatches.length * 20;
    score += siemCorrelations.length * 10;
    return Math.min(score, 100);
  }

  private generateCorrelationRecommendations(correlationResults: any): string[] {
    const recommendations = [];

    if (correlationResults.threat_matches.length > 0) {
      recommendations.push('Investigate threat intelligence matches');
    }

    if (correlationResults.risk_score > 70) {
      recommendations.push('Implement additional security controls');
    }

    return recommendations;
  }

  private async detectPerformanceAnomalies(agentId: string, telemetryData: any): Promise<any[]> {
    // Detect performance anomalies using statistical analysis
    return [];
  }

  private async detectSecurityAnomalies(agentId: string, telemetryData: any): Promise<any[]> {
    // Detect security behavior anomalies using machine learning
    return [];
  }

  private async isKnownMaliciousIP(_ip: string): Promise<boolean> {
    // Check against threat intelligence feeds
    return false;
  }

  private isUnusualPort(port: number): boolean {
    // Check if port is commonly used
    const commonPorts = [80, 443, 22, 21, 25, 53, 110, 143, 993, 995];
    return !commonPorts.includes(port) && port > 1024;
  }

  private isSystemFile(filePath: string): boolean {
    // Check if file is a system file
    const systemPaths = ['/etc/', '/sys/', '/proc/', 'C:\\Windows\\System32\\'];
    return systemPaths.some(path => filePath.startsWith(path));
  }

  private isExecutableInUnusualLocation(filePath: string): boolean {
    // Check if executable is in an unusual location
    const executableExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com'];
    const unusualPaths = ['\\Temp\\', '\\AppData\\', '/tmp/', '/var/tmp/'];

    return executableExtensions.some(ext => filePath.endsWith(ext)) &&
      unusualPaths.some(path => filePath.includes(path));
  }

  private isSuspiciousProcessName(name: string): boolean {
    // Check for suspicious process names
    const suspiciousNames = ['cmd.exe', 'powershell.exe', 'wscript.exe', 'cscript.exe'];
    return suspiciousNames.includes(name.toLowerCase());
  }

  private isUnusualProcessLocation(path: string): boolean {
    // Check if process is running from an unusual location
    const unusualPaths = ['\\Temp\\', '\\AppData\\', '/tmp/', '/var/tmp/'];
    return unusualPaths.some(unusualPath => path.includes(unusualPath));
  }

  /**
   * Install tool on agent
   */
  async installTool(agentId: string, toolConfig: ToolInstallationConfig): Promise<InstalledTool> {
    try {
      const installedTool: InstalledTool = {
        id: crypto.randomUUID(),
        name: toolConfig.tool_name,
        version: toolConfig.version || 'latest',
        vendor: toolConfig.vendor,
        tool_type: this.determineToolType(toolConfig.tool_name),
        status: ToolStatus.INSTALLING,
        config_status: 'pending',
        installed_at: new Date(),
        updated_at: new Date(),
      };

      // Send installation command to agent
      await this.sendInstallationCommand(agentId, toolConfig);

      logger.info('Tool installation initiated', {
        agentId,
        toolName: toolConfig.tool_name,
        toolId: installedTool.id
      });

      return installedTool;
    } catch {
      logger.error('Failed to install tool', { error, agentId, toolConfig });
      throw new Error('Failed to install tool');
    }
  }

  /**
   * Get agent status and health
   */
  async getAgentStatus(_agentId: string): Promise<Agent | null> {
    try {
      // In a real implementation, this would query the database
      // For now, return mock data
      return null;
    } catch {
      logger.error('Failed to get agent status', { error, agentId });
      throw new Error('Failed to get agent status');
    }
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfiguration(agentId: string, config: Partial<AgentConfiguration>): Promise<AgentConfiguration> {
    try {
      // In a real implementation, this would update the database and notify the agent
      const updatedConfig = {
        ...config,
        agent_id: agentId,
        updated_at: new Date(),
      } as AgentConfiguration;

      // Send configuration update to agent
      await this.sendConfigurationUpdate(agentId, updatedConfig);

      logger.info('Agent configuration updated', { agentId, config });

      return updatedConfig;
    } catch {
      logger.error('Failed to update agent configuration', { error, agentId, config });
      throw new Error('Failed to update agent configuration');
    }
  }

  /**
   * Get agents for tenant
   */
  async getAgentsByTenant(_tenantId: string): Promise<Agent[]> {
    try {
      // In a real implementation, this would query the database
      return [];
    } catch {
      logger.error('Failed to get agents for tenant', { error, tenantId });
      throw new Error('Failed to get agents for tenant');
    }
  }

  // Private helper methods

  private generateDeploymentKey(_tenantId: string): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    return crypto.createHash('sha256')
      .update(`${tenantId}-${timestamp}-${random}`)
      .digest('hex')
      .substring(0, 32);
  }

  private generateScriptContent(osType: string, deploymentKey: string, tenantId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.avian.security';

    switch (osType) {
      case 'windows':
        return this.generateWindowsScript(baseUrl, deploymentKey, tenantId);
      case 'linux':
        return this.generateLinuxScript(baseUrl, deploymentKey, tenantId);
      case 'macos':
        return this.generateMacOSScript(baseUrl, deploymentKey, tenantId);
      default:
        throw new Error(`Unsupported OS type: ${osType}`);
    }
  }

  private generateWindowsScript(baseUrl: string, deploymentKey: string, tenantId: string): string {
    return `@echo off
REM AVIAN Agent Installation Script for Windows
REM Generated: ${new Date().toISOString()}
REM Tenant: ${tenantId}

echo Installing AVIAN Agent...

REM Create installation directory
mkdir "C:\\Program Files\\AVIAN Agent" 2>nul

REM Download agent installer
powershell -Command "Invoke-WebRequest -Uri '${baseUrl}/agents/download/windows' -OutFile 'C:\\temp\\avian-agent-installer.msi' -Headers @{'X-Deployment-Key'='${deploymentKey}'; 'X-Tenant-ID'='${tenantId}'}"

REM Install agent silently
msiexec /i "C:\\temp\\avian-agent-installer.msi" /quiet /norestart DEPLOYMENT_KEY="${deploymentKey}" TENANT_ID="${tenantId}" API_URL="${baseUrl}"

REM Start agent service
sc start "AVIAN Agent Service"

REM Cleanup
del "C:\\temp\\avian-agent-installer.msi"

echo AVIAN Agent installation completed.
echo The agent will automatically register with the platform.
pause`;
  }

  private generateLinuxScript(baseUrl: string, deploymentKey: string, tenantId: string): string {
    return `#!/bin/bash
# AVIAN Agent Installation Script for Linux
# Generated: ${new Date().toISOString()}
# Tenant: ${tenantId}

set -e

echo "Installing AVIAN Agent..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Create installation directory
mkdir -p /opt/avian-agent

# Download agent installer
curl -H "X-Deployment-Key: ${deploymentKey}" \\
     -H "X-Tenant-ID: ${tenantId}" \\
     -o /tmp/avian-agent-installer.tar.gz \\
     "${baseUrl}/agents/download/linux"

# Extract and install
cd /tmp
tar -xzf avian-agent-installer.tar.gz
cd avian-agent-installer

# Run installer
./install.sh --deployment-key="${deploymentKey}" --tenant-id="${tenantId}" --api-url="${baseUrl}"

# Enable and start service
systemctl enable avian-agent
systemctl start avian-agent

# Cleanup
rm -rf /tmp/avian-agent-installer*

echo "AVIAN Agent installation completed."
echo "The agent will automatically register with the platform."`;
  }

  private generateMacOSScript(baseUrl: string, deploymentKey: string, tenantId: string): string {
    return `#!/bin/bash
# AVIAN Agent Installation Script for macOS
# Generated: ${new Date().toISOString()}
# Tenant: ${tenantId}

set -e

echo "Installing AVIAN Agent..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Create installation directory
mkdir -p /Applications/AVIAN\\ Agent

# Download agent installer
curl -H "X-Deployment-Key: ${deploymentKey}" \\
     -H "X-Tenant-ID: ${tenantId}" \\
     -o /tmp/avian-agent-installer.pkg \\
     "${baseUrl}/agents/download/macos"

# Install package
installer -pkg /tmp/avian-agent-installer.pkg -target /

# Configure agent
/Applications/AVIAN\\ Agent/configure.sh --deployment-key="${deploymentKey}" --tenant-id="${tenantId}" --api-url="${baseUrl}"

# Load launch daemon
launchctl load /Library/LaunchDaemons/com.avian.agent.plist

# Cleanup
rm /tmp/avian-agent-installer.pkg

echo "AVIAN Agent installation completed."
echo "The agent will automatically register with the platform."`;
  }

  private validateRegistrationToken(token: string, tenantId: string): boolean {
    // In a real implementation, this would validate the token against the database
    // For now, accept any non-empty token
    return token && token.length > 0;
  }

  private determineToolType(toolName: string): 'edr' | 'antivirus' | 'monitoring' | 'backup' | 'patch_management' {
    const lowerName = toolName.toLowerCase();

    if (lowerName.includes('edr') || lowerName.includes('endpoint detection')) {
      return 'edr';
    } else if (lowerName.includes('antivirus') || lowerName.includes('anti-virus')) {
      return 'antivirus';
    } else if (lowerName.includes('monitor') || lowerName.includes('observability')) {
      return 'monitoring';
    } else if (lowerName.includes('backup') || lowerName.includes('recovery')) {
      return 'backup';
    } else if (lowerName.includes('patch') || lowerName.includes('update')) {
      return 'patch_management';
    }

    return 'monitoring'; // default
  }

  private async sendInstallationCommand(agentId: string, toolConfig: ToolInstallationConfig): Promise<void> {
    // In a real implementation, this would send a command to the agent
    logger.info('Installation command sent to agent', { agentId, toolConfig });
  }

  private async sendConfigurationUpdate(agentId: string, config: AgentConfiguration): Promise<void> {
    // In a real implementation, this would send configuration to the agent
    logger.info('Configuration update sent to agent', { agentId, config });
  }
}

export const agentService = new AgentService();