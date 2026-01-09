import { Alert, AlertSeverity, AlertCategory, AlertStatus, Ticket, TicketSeverity, TicketCategory, TicketPriority, TicketStatus, ComplianceFramework, ComplianceControl, ComplianceEvidence, ComplianceStatus } from '@/types';

// In-memory mock database for development
class MockDatabase {
  private alerts: Alert[] = [];
  private tickets: Ticket[] = [];
  private ticketComments: any[] = []; // Store ticket comments
  private complianceFrameworks: ComplianceFramework[] = [];
  private complianceControls: ComplianceControl[] = [];
  private complianceEvidence: ComplianceEvidence[] = [];
  private nextAlertId = 1;
  private nextTicketId = 1;
  private nextCommentId = 1;

  // Generate some initial mock data
  constructor() {
    console.log('MockDatabase constructor called - initializing mock data');
    this.seedAlertData();
    this.seedTicketData();
    this.seedComplianceData();
    console.log('MockDatabase initialized with:', {
      alerts: this.alerts.length,
      tickets: this.tickets.length,
      ticketIds: this.tickets.map(t => `${t.id} (${t.tenant_id})`)
    });
  }

  // Clear all tickets method
  clearAllTickets() {
    console.log('Clearing all tickets from mock database');
    this.tickets = [];
    this.nextTicketId = 1;
    console.log('All tickets cleared');
  }

  private seedAlertData() {
    const mockSources = ['Splunk', 'QRadar', 'Sentinel', 'CrowdStrike', 'SentinelOne'];
    const mockTitles = [
      'Suspicious login attempt detected',
      'Malware signature detected',
      'Unusual network traffic pattern',
      'Failed authentication attempts',
      'Privilege escalation detected',
    ];

    for (let i = 0; i < 10; i++) {
      const severity = [AlertSeverity.INFO, AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL][Math.floor(Math.random() * 5)];
      const category = [AlertCategory.MALWARE, AlertCategory.PHISHING, AlertCategory.INTRUSION, AlertCategory.DATA_BREACH, AlertCategory.POLICY_VIOLATION, AlertCategory.ANOMALY][Math.floor(Math.random() * 6)];
      const source = mockSources[Math.floor(Math.random() * mockSources.length)];
      const title = mockTitles[Math.floor(Math.random() * mockTitles.length)];

      // Create alerts with timestamps spread over the last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const hoursAgo = Math.floor(Math.random() * 24);
      const minutesAgo = Math.floor(Math.random() * 60);

      this.alerts.push({
        id: `alert-${this.nextAlertId++}`,
        tenant_id: 'acme-corp', // Use consistent tenant ID
        source,
        title,
        description: `${title} from ${source}. This is a mock alert generated for demonstration purposes.`,
        severity,
        category,
        status: Math.random() > 0.7 ? AlertStatus.RESOLVED : AlertStatus.OPEN,
        metadata: {
          source_ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          event_id: `EVT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          confidence: Math.floor(Math.random() * 100),
        },
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
        updated_at: new Date(),
      });
    }
  }

  private seedTicketData() {
    // Create a test ticket from acme-corp tenant
    const acmeTestTicket = {
      id: `TKT-001`,
      tenant_id: 'acme-corp',
      requester: 'user@demo.com',
      assignee: null, // Unassigned
      title: 'Test ticket from ACME Corporation',
      description: 'This is a sample IT support ticket for demonstration purposes',
      category: 'it_support',
      severity: 'high',
      priority: 'high',
      status: 'new',
      tags: ['test', 'acme-corp'],
      created_by: '5', // user@demo.com user ID
      sla_deadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      queue_position_updated_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.tickets.push(acmeTestTicket as any);
    this.nextTicketId = 2; // Start from 2 for new tickets

    console.log('MockDatabase: Added test ticket for ACME Corporation');
    console.log('  - TKT-001: acme-corp tenant');
  }

  // Alert operations
  async createAlert(tenantId: string, alertData: Omit<Alert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<Alert> {
    const alert: Alert = {
      id: `alert-${this.nextAlertId++}`,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date(),
      ...alertData,
    };

    this.alerts.push(alert);
    return alert;
  }

  async getAlerts(tenantId: string, filters: any = {}): Promise<{ alerts: Alert[]; total: number }> {
    let filteredAlerts = this.alerts.filter(alert => alert.tenant_id === tenantId);

    // Apply filters
    if (filters.severity?.length) {
      filteredAlerts = filteredAlerts.filter(alert => filters.severity.includes(alert.severity));
    }
    if (filters.category?.length) {
      filteredAlerts = filteredAlerts.filter(alert => filters.category.includes(alert.category));
    }
    if (filters.status?.length) {
      filteredAlerts = filteredAlerts.filter(alert => filters.status.includes(alert.status));
    }
    if (filters.source?.length) {
      filteredAlerts = filteredAlerts.filter(alert => filters.source.includes(alert.source));
    }

    // Sort
    const sortBy = filters.sort_by || 'created_at';
    const sortOrder = filters.sort_order || 'desc';
    filteredAlerts.sort((a, b) => {
      const aValue = a[sortBy as keyof Alert];
      const bValue = b[sortBy as keyof Alert];

      if (aValue === bValue) return 0;
      const comparison = aValue < bValue ? -1 : 1;
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;
    const paginatedAlerts = filteredAlerts.slice(offset, offset + limit);

    return {
      alerts: paginatedAlerts,
      total: filteredAlerts.length,
    };
  }

  async getAlertById(tenantId: string, alertId: string): Promise<Alert | null> {
    return this.alerts.find(alert => alert.id === alertId && alert.tenant_id === tenantId) || null;
  }

  async updateAlertStatus(tenantId: string, alertId: string, status: AlertStatus, metadata?: Record<string, any>): Promise<Alert | null> {
    const alertIndex = this.alerts.findIndex(alert => alert.id === alertId && alert.tenant_id === tenantId);
    if (alertIndex === -1) return null;

    this.alerts[alertIndex] = {
      ...this.alerts[alertIndex],
      status,
      metadata: metadata ? { ...this.alerts[alertIndex].metadata, ...metadata } : this.alerts[alertIndex].metadata,
      updated_at: new Date(),
    };

    return this.alerts[alertIndex];
  }

  async bulkCreateAlerts(tenantId: string, alertsData: Omit<Alert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>[]): Promise<Alert[]> {
    const newAlerts: Alert[] = [];

    for (const alertData of alertsData) {
      const alert = await this.createAlert(tenantId, alertData);
      newAlerts.push(alert);
    }

    return newAlerts;
  }

  async getAlertStats(tenantId: string): Promise<any> {
    const tenantAlerts = this.alerts.filter(alert => alert.tenant_id === tenantId);

    const total = tenantAlerts.length;
    const critical = tenantAlerts.filter(alert => alert.severity === AlertSeverity.CRITICAL).length;
    const high = tenantAlerts.filter(alert => alert.severity === AlertSeverity.HIGH).length;
    const unresolved = tenantAlerts.filter(alert => [AlertStatus.OPEN, AlertStatus.INVESTIGATING].includes(alert.status)).length;

    // Severity distribution
    const by_severity = {
      [AlertSeverity.CRITICAL]: tenantAlerts.filter(alert => alert.severity === AlertSeverity.CRITICAL).length,
      [AlertSeverity.HIGH]: tenantAlerts.filter(alert => alert.severity === AlertSeverity.HIGH).length,
      [AlertSeverity.MEDIUM]: tenantAlerts.filter(alert => alert.severity === AlertSeverity.MEDIUM).length,
      [AlertSeverity.LOW]: tenantAlerts.filter(alert => alert.severity === AlertSeverity.LOW).length,
      [AlertSeverity.INFO]: tenantAlerts.filter(alert => alert.severity === AlertSeverity.INFO).length,
    };

    // Category distribution
    const by_category = {
      [AlertCategory.MALWARE]: tenantAlerts.filter(alert => alert.category === AlertCategory.MALWARE).length,
      [AlertCategory.PHISHING]: tenantAlerts.filter(alert => alert.category === AlertCategory.PHISHING).length,
      [AlertCategory.INTRUSION]: tenantAlerts.filter(alert => alert.category === AlertCategory.INTRUSION).length,
      [AlertCategory.DATA_BREACH]: tenantAlerts.filter(alert => alert.category === AlertCategory.DATA_BREACH).length,
      [AlertCategory.POLICY_VIOLATION]: tenantAlerts.filter(alert => alert.category === AlertCategory.POLICY_VIOLATION).length,
      [AlertCategory.ANOMALY]: tenantAlerts.filter(alert => alert.category === AlertCategory.ANOMALY).length,
      [AlertCategory.OTHER]: tenantAlerts.filter(alert => alert.category === AlertCategory.OTHER).length,
    };

    // Recent alerts
    const recent_alerts = tenantAlerts
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    return {
      total,
      critical,
      high,
      unresolved,
      by_severity,
      by_category,
      recent_alerts,
    };
  }

  // Ticket operations
  async createTicket(tenantId: string, ticketData: Omit<Ticket, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<Ticket> {
    const now = new Date();
    const ticket: Ticket = {
      id: `TKT-${String(this.nextTicketId++).padStart(3, '0')}`,
      tenant_id: tenantId,
      created_at: now,
      updated_at: now,
      ...ticketData,
    };

    this.tickets.push(ticket);
    return ticket;
  }

  async getTickets(tenantId: string | null, filters: any = {}): Promise<{ tickets: Ticket[]; total: number }> {
    console.log('=== MOCK DB GET TICKETS ===');
    console.log('Requested tenant ID:', tenantId);
    console.log('Available tickets:', this.tickets.map(t => `${t.id} (${t.tenant_id})`));
    
    let filteredTickets = tenantId ? 
      this.tickets.filter(ticket => ticket.tenant_id === tenantId) :
      this.tickets; // Super admins see all tickets across all tenants

    console.log('After tenant filtering:', filteredTickets.map(t => `${t.id} (${t.tenant_id})`));

    // Apply filters
    if (filters.status?.length) {
      filteredTickets = filteredTickets.filter(ticket => filters.status.includes(ticket.status));
    }
    if (filters.severity?.length) {
      filteredTickets = filteredTickets.filter(ticket => filters.severity.includes(ticket.severity));
    }
    if (filters.priority?.length) {
      filteredTickets = filteredTickets.filter(ticket => filters.priority.includes(ticket.priority));
    }
    if (filters.category?.length) {
      filteredTickets = filteredTickets.filter(ticket => filters.category.includes(ticket.category));
    }
    if (filters.hasOwnProperty('assignee')) {
      if (filters.assignee === undefined || filters.assignee === null) {
        // Filter for unassigned tickets only
        filteredTickets = filteredTickets.filter(ticket => !ticket.assignee);
      } else {
        // Filter for tickets assigned to specific user
        filteredTickets = filteredTickets.filter(ticket => ticket.assignee === filters.assignee);
      }
    }
    if (filters.requester) {
      filteredTickets = filteredTickets.filter(ticket => ticket.requester === filters.requester);
    }

    // Sort using queue sorting logic: assignment status ASC (unassigned first), severity DESC, queue_position_updated_at ASC, id ASC
    filteredTickets.sort((a, b) => {
      // First sort by assignment status (unassigned tickets at top)
      const aAssigned = !!a.assignee;
      const bAssigned = !!b.assignee;
      if (aAssigned !== bAssigned) {
        return aAssigned ? 1 : -1; // Unassigned (false) comes first
      }

      // Then sort by severity (impact level) - critical > high > medium > low
      const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const aSeverityValue = severityOrder[a.severity as keyof typeof severityOrder] || 0;
      const bSeverityValue = severityOrder[b.severity as keyof typeof severityOrder] || 0;

      if (aSeverityValue !== bSeverityValue) {
        return bSeverityValue - aSeverityValue; // DESC order for severity
      }

      // Then sort by queue_position_updated_at (oldest first)
      const aQueueTime = new Date(a.queue_position_updated_at).getTime();
      const bQueueTime = new Date(b.queue_position_updated_at).getTime();

      if (aQueueTime !== bQueueTime) {
        return aQueueTime - bQueueTime; // ASC order for queue position
      }

      // Finally sort by ID as tie-breaker
      return a.id.localeCompare(b.id); // ASC order for ID
    });

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const paginatedTickets = filteredTickets.slice(offset, offset + limit);

    return {
      tickets: paginatedTickets,
      total: filteredTickets.length,
    };
  }

  async getTicketById(tenantId: string, ticketId: string): Promise<Ticket | null> {
    return this.tickets.find(ticket => ticket.id === ticketId && ticket.tenant_id === tenantId) || null;
  }

  async updateTicket(tenantId: string, ticketId: string, updates: Partial<Ticket>): Promise<Ticket | null> {
    console.log('Mock updateTicket called:', { tenantId, ticketId, updates });

    const ticketIndex = this.tickets.findIndex(ticket => ticket.id === ticketId && ticket.tenant_id === tenantId);
    if (ticketIndex === -1) {
      console.log('Ticket not found for update:', { ticketId, tenantId });
      return null;
    }

    console.log('Before update:', {
      id: this.tickets[ticketIndex].id,
      assignee: this.tickets[ticketIndex].assignee,
      status: this.tickets[ticketIndex].status
    });

    this.tickets[ticketIndex] = {
      ...this.tickets[ticketIndex],
      ...updates,
      updated_at: new Date(),
    };

    console.log('After update:', {
      id: this.tickets[ticketIndex].id,
      assignee: this.tickets[ticketIndex].assignee,
      status: this.tickets[ticketIndex].status
    });

    return this.tickets[ticketIndex];
  }

  async deleteTicket(tenantId: string, ticketId: string): Promise<boolean> {
    const ticketIndex = this.tickets.findIndex(ticket => ticket.id === ticketId && ticket.tenant_id === tenantId);
    if (ticketIndex === -1) return false;

    this.tickets.splice(ticketIndex, 1);
    return true;
  }

  async getTicketStats(_tenantId: string): Promise<any> {
    const tenantTickets = this.tickets.filter(ticket => ticket.tenant_id === _tenantId);

    const total = tenantTickets.length;
    const open = tenantTickets.filter(ticket => [TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_RESPONSE].includes(ticket.status)).length;
    const overdue = tenantTickets.filter(ticket => ticket.sla_deadline && new Date() > ticket.sla_deadline && ![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status)).length;
    const resolvedToday = tenantTickets.filter(ticket => {
      const today = new Date();
      const ticketDate = new Date(ticket.updated_at);
      return ticket.status === TicketStatus.RESOLVED &&
        ticketDate.toDateString() === today.toDateString();
    }).length;

    // Calculate severity breakdown
    const by_severity = {
      [TicketSeverity.LOW]: tenantTickets.filter(t => t.severity === TicketSeverity.LOW).length,
      [TicketSeverity.MEDIUM]: tenantTickets.filter(t => t.severity === TicketSeverity.MEDIUM).length,
      [TicketSeverity.HIGH]: tenantTickets.filter(t => t.severity === TicketSeverity.HIGH).length,
      [TicketSeverity.CRITICAL]: tenantTickets.filter(t => t.severity === TicketSeverity.CRITICAL).length,
    };

    // Calculate status breakdown
    const by_status = {
      [TicketStatus.NEW]: tenantTickets.filter(t => t.status === TicketStatus.NEW).length,
      [TicketStatus.IN_PROGRESS]: tenantTickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length,
      [TicketStatus.AWAITING_RESPONSE]: tenantTickets.filter(t => t.status === TicketStatus.AWAITING_RESPONSE).length,
      [TicketStatus.RESOLVED]: tenantTickets.filter(t => t.status === TicketStatus.RESOLVED).length,
      [TicketStatus.CLOSED]: tenantTickets.filter(t => t.status === TicketStatus.CLOSED).length,
    };

    return {
      total,
      open,
      overdue,
      resolved_today: resolvedToday,
      by_severity,
      by_status,
    };
  }

  private seedComplianceData() {
    // Seed frameworks
    this.complianceFrameworks = [
      {
        id: 'framework-hipaa',
        tenant_id: 'acme-corp', // Use consistent tenant ID
        name: 'HIPAA',
        version: '2013',
        description: 'Health Insurance Portability and Accountability Act compliance framework',
        is_active: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      },
      {
        id: 'framework-iso27001',
        tenant_id: 'acme-corp', // Use consistent tenant ID
        name: 'ISO 27001',
        version: '2022',
        description: 'Information Security Management System standard',
        is_active: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      },
      {
        id: 'framework-pci',
        tenant_id: 'acme-corp', // Use consistent tenant ID
        name: 'PCI DSS',
        version: '4.0',
        description: 'Payment Card Industry Data Security Standard',
        is_active: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      },
    ];

    // Seed controls
    this.complianceControls = [
      // HIPAA Controls
      {
        id: 'control-hipaa-1',
        framework_id: 'framework-hipaa',
        control_id: 'HIPAA-164.308(a)(1)',
        title: 'Security Officer',
        description: 'Assign security responsibilities to an individual',
        status: ComplianceStatus.COMPLETED,
        last_reviewed: new Date('2024-10-01'),
        next_review_date: new Date('2025-01-01'),
        assigned_to: 'user-security-officer',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-10-01'),
      },
      {
        id: 'control-hipaa-2',
        framework_id: 'framework-hipaa',
        control_id: 'HIPAA-164.308(a)(3)',
        title: 'Workforce Training',
        description: 'Implement procedures for workforce training and access management',
        status: ComplianceStatus.IN_PROGRESS,
        last_reviewed: new Date('2024-09-15'),
        next_review_date: new Date('2024-12-15'),
        assigned_to: 'user-hr-manager',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-09-15'),
      },
      {
        id: 'control-hipaa-3',
        framework_id: 'framework-hipaa',
        control_id: 'HIPAA-164.312(a)(1)',
        title: 'Access Control',
        description: 'Implement technical safeguards to control access to PHI',
        status: ComplianceStatus.NOT_STARTED,
        next_review_date: new Date('2024-11-30'),
        assigned_to: 'user-it-admin',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      },
      // ISO 27001 Controls
      {
        id: 'control-iso-1',
        framework_id: 'framework-iso27001',
        control_id: 'ISO-A.5.1.1',
        title: 'Information Security Policy',
        description: 'Establish and maintain information security policy',
        status: ComplianceStatus.COMPLETED,
        last_reviewed: new Date('2024-09-01'),
        next_review_date: new Date('2024-12-01'),
        assigned_to: 'user-security-officer',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-09-01'),
      },
      {
        id: 'control-iso-2',
        framework_id: 'framework-iso27001',
        control_id: 'ISO-A.8.1.1',
        title: 'Asset Inventory',
        description: 'Maintain an inventory of information assets',
        status: ComplianceStatus.IN_PROGRESS,
        last_reviewed: new Date('2024-10-15'),
        next_review_date: new Date('2025-01-15'),
        assigned_to: 'user-it-admin',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-10-15'),
      },
      // PCI DSS Controls
      {
        id: 'control-pci-1',
        framework_id: 'framework-pci',
        control_id: 'PCI-1.1.1',
        title: 'Firewall Configuration',
        description: 'Establish firewall and router configuration standards',
        status: ComplianceStatus.COMPLETED,
        last_reviewed: new Date('2024-10-20'),
        next_review_date: new Date('2025-01-20'),
        assigned_to: 'user-network-admin',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-10-20'),
      },
      {
        id: 'control-pci-2',
        framework_id: 'framework-pci',
        control_id: 'PCI-2.1',
        title: 'Default Passwords',
        description: 'Change vendor-supplied defaults for system passwords',
        status: ComplianceStatus.NON_COMPLIANT,
        last_reviewed: new Date('2024-10-10'),
        next_review_date: new Date('2024-11-10'),
        assigned_to: 'user-system-admin',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-10-10'),
      },
    ];

    // Seed evidence
    this.complianceEvidence = [
      {
        id: 'evidence-1',
        control_id: 'control-hipaa-1',
        filename: 'security-officer-appointment.pdf',
        original_filename: 'Security Officer Appointment Letter.pdf',
        file_size: 245760,
        mime_type: 'application/pdf',
        file_path: '/uploads/evidence/security-officer-appointment.pdf',
        description: 'Official appointment letter for security officer role',
        uploaded_by: 'user-security-officer',
        created_at: new Date('2024-10-01'),
      },
      {
        id: 'evidence-2',
        control_id: 'control-iso-1',
        filename: 'information-security-policy-v2.pdf',
        original_filename: 'Information Security Policy v2.0.pdf',
        file_size: 512000,
        mime_type: 'application/pdf',
        file_path: '/uploads/evidence/information-security-policy-v2.pdf',
        description: 'Updated information security policy document',
        uploaded_by: 'user-security-officer',
        created_at: new Date('2024-09-01'),
      },
    ];
  }

  // Compliance operations
  async getComplianceFrameworks(tenantId: string): Promise<{ frameworks: ComplianceFramework[]; total: number }> {
    const frameworks = this.complianceFrameworks.filter(f => f.tenant_id === tenantId && f.is_active);
    return {
      frameworks,
      total: frameworks.length,
    };
  }

  async getComplianceFrameworkById(tenantId: string, frameworkId: string): Promise<ComplianceFramework | null> {
    return this.complianceFrameworks.find(f => f.id === frameworkId && f.tenant_id === tenantId) || null;
  }

  async getComplianceControlsByFramework(tenantId: string, frameworkId: string): Promise<{ controls: ComplianceControl[]; total: number }> {
    const controls = this.complianceControls.filter(c => c.framework_id === frameworkId);
    return {
      controls,
      total: controls.length,
    };
  }

  async updateComplianceControlStatus(
    tenantId: string,
    controlId: string,
    status: ComplianceStatus,
    assignedTo?: string
  ): Promise<ComplianceControl | null> {
    const controlIndex = this.complianceControls.findIndex(c => c.id === controlId);
    if (controlIndex === -1) return null;

    this.complianceControls[controlIndex] = {
      ...this.complianceControls[controlIndex],
      status,
      assigned_to: assignedTo || this.complianceControls[controlIndex].assigned_to,
      last_reviewed: new Date(),
      updated_at: new Date(),
    };

    return this.complianceControls[controlIndex];
  }

  async getComplianceEvidenceByControl(tenantId: string, controlId: string): Promise<{ evidence: ComplianceEvidence[]; total: number }> {
    const evidence = this.complianceEvidence.filter(e => e.control_id === controlId);
    return {
      evidence,
      total: evidence.length,
    };
  }

  async uploadComplianceEvidence(
    tenantId: string,
    controlId: string,
    file: {
      filename: string;
      originalFilename: string;
      fileSize: number;
      mimeType: string;
      filePath: string;
    },
    description: string,
    uploadedBy: string
  ): Promise<ComplianceEvidence> {
    const evidence: ComplianceEvidence = {
      id: `evidence-${Date.now()}`,
      control_id: controlId,
      filename: file.filename,
      original_filename: file.originalFilename,
      file_size: file.fileSize,
      mime_type: file.mimeType,
      file_path: file.filePath,
      description,
      uploaded_by: uploadedBy,
      created_at: new Date(),
    };

    this.complianceEvidence.push(evidence);
    return evidence;
  }

  async calculateComplianceScore(tenantId: string, frameworkId?: string): Promise<{
    overall_score: number;
    framework_scores: Record<string, number>;
    total_controls: number;
    completed_controls: number;
    in_progress_controls: number;
    not_started_controls: number;
    non_compliant_controls: number;
  }> {
    let controls = this.complianceControls;

    if (frameworkId) {
      controls = controls.filter(c => c.framework_id === frameworkId);
    }

    const totalControls = controls.length;
    const completedControls = controls.filter(c => c.status === ComplianceStatus.COMPLETED).length;
    const inProgressControls = controls.filter(c => c.status === ComplianceStatus.IN_PROGRESS).length;
    const notStartedControls = controls.filter(c => c.status === ComplianceStatus.NOT_STARTED).length;
    const nonCompliantControls = controls.filter(c => c.status === ComplianceStatus.NON_COMPLIANT).length;

    // Calculate overall score (completed controls / total controls * 100)
    const overallScore = totalControls > 0 ? Math.round((completedControls / totalControls) * 100) : 0;

    // Calculate framework-specific scores
    const frameworkScores: Record<string, number> = {};
    for (const framework of this.complianceFrameworks) {
      const frameworkControls = controls.filter(c => c.framework_id === framework.id);
      const frameworkCompleted = frameworkControls.filter(c => c.status === ComplianceStatus.COMPLETED).length;
      frameworkScores[framework.id] = frameworkControls.length > 0
        ? Math.round((frameworkCompleted / frameworkControls.length) * 100)
        : 0;
    }

    return {
      overall_score: overallScore,
      framework_scores: frameworkScores,
      total_controls: totalControls,
      completed_controls: completedControls,
      in_progress_controls: inProgressControls,
      not_started_controls: notStartedControls,
      non_compliant_controls: nonCompliantControls,
    };
  }

  async getComplianceDashboardData(tenantId: string): Promise<{
    frameworks: ComplianceFramework[];
    recent_controls: ComplianceControl[];
    compliance_score: number;
    controls_by_status: Record<ComplianceStatus, number>;
    upcoming_reviews: ComplianceControl[];
  }> {
    const frameworks = this.complianceFrameworks.filter(f => f.tenant_id === tenantId && f.is_active);
    const recentControls = this.complianceControls
      .filter(c => c.last_reviewed)
      .sort((a, b) => new Date(b.last_reviewed!).getTime() - new Date(a.last_reviewed!).getTime())
      .slice(0, 5);

    const scoreResult = await this.calculateComplianceScore(tenantId);
    const complianceScore = scoreResult.overall_score;

    const controlsByStatus = {
      [ComplianceStatus.COMPLETED]: this.complianceControls.filter(c => c.status === ComplianceStatus.COMPLETED).length,
      [ComplianceStatus.IN_PROGRESS]: this.complianceControls.filter(c => c.status === ComplianceStatus.IN_PROGRESS).length,
      [ComplianceStatus.NOT_STARTED]: this.complianceControls.filter(c => c.status === ComplianceStatus.NOT_STARTED).length,
      [ComplianceStatus.NON_COMPLIANT]: this.complianceControls.filter(c => c.status === ComplianceStatus.NON_COMPLIANT).length,
    };

    const upcomingReviews = this.complianceControls
      .filter(c => c.next_review_date && new Date(c.next_review_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      .sort((a, b) => new Date(a.next_review_date!).getTime() - new Date(b.next_review_date!).getTime())
      .slice(0, 10);

    return {
      frameworks,
      recent_controls: recentControls,
      compliance_score: complianceScore,
      controls_by_status: controlsByStatus,
      upcoming_reviews: upcomingReviews,
    };
  }

  // Add comment to a ticket (mock implementation)
  async addComment(
    tenantId: string,
    ticketId: string,
    userId: string,
    data: { content: string; is_internal?: boolean }
  ): Promise<any> {
    console.log('MockDatabase.addComment called:', { tenantId, ticketId, userId, data });
    
    // Get user information based on userId
    let userName = 'Unknown User';
    let userEmail = 'unknown@demo.com';
    
    // Map common user IDs to names and emails
    switch (userId) {
      case 'dev-user-def':
      case '1':
        userName = 'Abdullah Asfour';
        userEmail = 'abdullah.asfour@acmecorp.com';
        break;
      case '2':
        userName = 'Anita V';
        userEmail = 'anita.v@acmecorp.com';
        break;
      case '3':
        userName = 'Ali Asfour';
        userEmail = 'ali.asfour@acmecorp.com';
        break;
      case '4':
        userName = 'Sarah Mitchell';
        userEmail = 'sarah.mitchell@acmecorp.com';
        break;
      case '5':
        userName = 'Mr Linux';
        userEmail = 'mr.linux@acmecorp.com';
        break;
      case 'analyst-1':
        userName = 'Security Analyst';
        userEmail = 'analyst@demo.com';
        break;
      case 'helpdesk-1':
        userName = 'IT Helpdesk';
        userEmail = 'helpdesk@demo.com';
        break;
      case 'system':
        userName = 'System';
        userEmail = 'system@demo.com';
        break;
      default:
        userName = `User ${userId}`;
        userEmail = `${userId}@demo.com`;
    }

    console.log('Mapped user info:', { userId, userName, userEmail });

    const comment = {
      id: `comment-${this.nextCommentId++}`,
      ticket_id: ticketId,
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      content: data.content,
      is_internal: data.is_internal || false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Store the comment
    this.ticketComments.push(comment);
    console.log('Comment stored:', comment);
    console.log('Total comments in database:', this.ticketComments.length);
    
    return comment;
  }

  // Get comments for a ticket (mock implementation)
  async getTicketComments(tenantId: string, ticketId: string): Promise<any[]> {
    console.log('MockDatabase.getTicketComments called:', { tenantId, ticketId });
    
    // Get stored comments for this ticket
    const storedComments = this.ticketComments.filter(comment => comment.ticket_id === ticketId);
    console.log('Stored comments found:', storedComments.length, storedComments);
    
    // If no stored comments, return some initial mock comments
    if (storedComments.length === 0) {
      const initialComments = [
        {
          id: `comment-initial-1`,
          ticket_id: ticketId,
          user_id: 'user-1',
          user_name: 'John Doe',
          user_email: 'john.doe@demo.com',
          content: 'Initial ticket submission. Please investigate this issue.',
          is_internal: false,
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ];
      console.log('Returning initial comments:', initialComments);
      return initialComments;
    }
    
    // Return stored comments sorted by creation date
    const sortedComments = storedComments.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    console.log('Returning sorted stored comments:', sortedComments);
    return sortedComments;
  }
}

// Export singleton instance with global persistence for development
// This ensures the mock database persists across hot reloads in Next.js
declare global {
  var __mockDb: MockDatabase | undefined;
}

if (!global.__mockDb) {
  global.__mockDb = new MockDatabase();
}

export const mockDb = global.__mockDb;