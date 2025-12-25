import { 
  SecurityPlaybook, 
  PlaybookExecution, 
  PlaybookRecommendation, 
  Alert, 
  ThreatType, 
  PlaybookSeverity, 
  StepActionType, 
  ExecutionStatus,
  AlertCategory,
  AlertSeverity,
  PlaybookStep,
  PlaybookTrigger,
  CompletedStep
} from '@/types';

// Mock database - in production this would use actual database
const mockPlaybooks: SecurityPlaybook[] = [
  {
    id: 'pb-malware-001',
    tenant_id: 'tenant-1',
    name: 'Malware Incident Response',
    description: 'Standard response procedure for malware detection and containment',
    threat_type: ThreatType.MALWARE,
    severity_level: PlaybookSeverity.HIGH,
    steps: [
      {
        id: 'step-1',
        step_number: 1,
        title: 'Initial Assessment',
        description: 'Assess the scope and impact of the malware incident',
        action_type: StepActionType.INVESTIGATION,
        required: true,
        estimated_time: 15,
        dependencies: [],
        verification_criteria: 'Document affected systems and potential data exposure',
        instructions: 'Review alert details, identify affected systems, and assess potential impact. Document findings in incident notes.'
      },
      {
        id: 'step-2',
        step_number: 2,
        title: 'Isolate Affected Systems',
        description: 'Immediately isolate infected systems to prevent spread',
        action_type: StepActionType.CONTAINMENT,
        required: true,
        estimated_time: 10,
        dependencies: ['step-1'],
        verification_criteria: 'Confirm systems are isolated from network',
        instructions: 'Disconnect affected systems from network. Coordinate with IT team for network isolation if needed.'
      },
      {
        id: 'step-3',
        step_number: 3,
        title: 'Collect Evidence',
        description: 'Preserve forensic evidence before remediation',
        action_type: StepActionType.INVESTIGATION,
        required: true,
        estimated_time: 30,
        dependencies: ['step-2'],
        verification_criteria: 'Evidence collected and stored securely',
        instructions: 'Create disk images, collect memory dumps, and preserve log files. Store evidence in secure location.'
      },
      {
        id: 'step-4',
        step_number: 4,
        title: 'Malware Analysis',
        description: 'Analyze malware samples to understand behavior',
        action_type: StepActionType.INVESTIGATION,
        required: false,
        estimated_time: 60,
        dependencies: ['step-3'],
        verification_criteria: 'Malware analysis report completed',
        instructions: 'Submit samples to security team for analysis. Document malware behavior and indicators of compromise.'
      },
      {
        id: 'step-5',
        step_number: 5,
        title: 'Remove Malware',
        description: 'Clean infected systems and remove malware',
        action_type: StepActionType.ERADICATION,
        required: true,
        estimated_time: 45,
        dependencies: ['step-3'],
        verification_criteria: 'Systems cleaned and verified malware-free',
        instructions: 'Use approved anti-malware tools to clean systems. Verify complete removal with multiple scans.'
      },
      {
        id: 'step-6',
        step_number: 6,
        title: 'System Recovery',
        description: 'Restore systems to normal operation',
        action_type: StepActionType.RECOVERY,
        required: true,
        estimated_time: 30,
        dependencies: ['step-5'],
        verification_criteria: 'Systems restored and functioning normally',
        instructions: 'Restore systems from clean backups if needed. Update security patches and reconnect to network.'
      },
      {
        id: 'step-7',
        step_number: 7,
        title: 'Notify Stakeholders',
        description: 'Communicate incident status to relevant parties',
        action_type: StepActionType.COMMUNICATION,
        required: true,
        estimated_time: 15,
        dependencies: ['step-1'],
        verification_criteria: 'Stakeholders notified according to policy',
        instructions: 'Notify management, legal team, and affected users according to incident communication policy.'
      },
      {
        id: 'step-8',
        step_number: 8,
        title: 'Document Incident',
        description: 'Complete incident documentation and lessons learned',
        action_type: StepActionType.DOCUMENTATION,
        required: true,
        estimated_time: 20,
        dependencies: ['step-6'],
        verification_criteria: 'Incident report completed and filed',
        instructions: 'Complete incident report with timeline, actions taken, and lessons learned. File in incident database.'
      }
    ],
    triggers: [
      {
        id: 'trigger-1',
        alert_category: AlertCategory.MALWARE,
        keywords: ['virus', 'trojan', 'malware', 'infected'],
        conditions: {}
      }
    ],
    estimated_duration: 225,
    created_by: 'system',
    last_updated: new Date(),
    usage_count: 0,
    effectiveness_rating: 4.5,
    is_active: true,
    is_template: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'pb-phishing-001',
    tenant_id: 'tenant-1',
    name: 'Phishing Attack Response',
    description: 'Response procedure for phishing attacks and email security incidents',
    threat_type: ThreatType.PHISHING,
    severity_level: PlaybookSeverity.MEDIUM,
    steps: [
      {
        id: 'step-1',
        step_number: 1,
        title: 'Verify Phishing Report',
        description: 'Confirm the reported email is indeed a phishing attempt',
        action_type: StepActionType.INVESTIGATION,
        required: true,
        estimated_time: 10,
        dependencies: [],
        verification_criteria: 'Phishing attempt confirmed and documented',
        instructions: 'Analyze reported email headers, links, and attachments. Verify against known phishing indicators.'
      },
      {
        id: 'step-2',
        step_number: 2,
        title: 'Block Malicious Content',
        description: 'Block malicious URLs and email addresses',
        action_type: StepActionType.CONTAINMENT,
        required: true,
        estimated_time: 15,
        dependencies: ['step-1'],
        verification_criteria: 'Malicious content blocked in security systems',
        instructions: 'Add malicious URLs to web filter blocklist. Block sender email addresses in email security gateway.'
      },
      {
        id: 'step-3',
        step_number: 3,
        title: 'Search for Similar Emails',
        description: 'Find other instances of the phishing email in the organization',
        action_type: StepActionType.INVESTIGATION,
        required: true,
        estimated_time: 20,
        dependencies: ['step-1'],
        verification_criteria: 'Email search completed and results documented',
        instructions: 'Search email logs for similar sender addresses, subjects, or content. Document all instances found.'
      },
      {
        id: 'step-4',
        step_number: 4,
        title: 'Remove Phishing Emails',
        description: 'Remove phishing emails from all user mailboxes',
        action_type: StepActionType.ERADICATION,
        required: true,
        estimated_time: 25,
        dependencies: ['step-3'],
        verification_criteria: 'All phishing emails removed from mailboxes',
        instructions: 'Use email admin tools to remove phishing emails from all affected mailboxes. Confirm removal.'
      },
      {
        id: 'step-5',
        step_number: 5,
        title: 'Notify Affected Users',
        description: 'Inform users about the phishing attempt and security measures',
        action_type: StepActionType.COMMUNICATION,
        required: true,
        estimated_time: 15,
        dependencies: ['step-2'],
        verification_criteria: 'Users notified with security awareness message',
        instructions: 'Send security awareness email to affected users. Include information about identifying phishing attempts.'
      },
      {
        id: 'step-6',
        step_number: 6,
        title: 'Update Security Training',
        description: 'Update security awareness training based on incident',
        action_type: StepActionType.RECOVERY,
        required: false,
        estimated_time: 30,
        dependencies: ['step-5'],
        verification_criteria: 'Training materials updated with new examples',
        instructions: 'Update phishing awareness training with examples from this incident. Schedule additional training if needed.'
      }
    ],
    triggers: [
      {
        id: 'trigger-1',
        alert_category: AlertCategory.PHISHING,
        keywords: ['phishing', 'suspicious email', 'malicious link'],
        conditions: {}
      }
    ],
    estimated_duration: 115,
    created_by: 'system',
    last_updated: new Date(),
    usage_count: 0,
    effectiveness_rating: 4.2,
    is_active: true,
    is_template: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'pb-breach-001',
    tenant_id: 'tenant-1',
    name: 'Data Breach Response',
    description: 'Comprehensive response procedure for data breach incidents',
    threat_type: ThreatType.DATA_BREACH,
    severity_level: PlaybookSeverity.CRITICAL,
    steps: [
      {
        id: 'step-1',
        step_number: 1,
        title: 'Immediate Assessment',
        description: 'Rapidly assess the scope and severity of the data breach',
        action_type: StepActionType.INVESTIGATION,
        required: true,
        estimated_time: 30,
        dependencies: [],
        verification_criteria: 'Breach scope and impact documented',
        instructions: 'Determine what data was accessed, how many records affected, and potential business impact.'
      },
      {
        id: 'step-2',
        step_number: 2,
        title: 'Contain the Breach',
        description: 'Stop ongoing data exfiltration and secure systems',
        action_type: StepActionType.CONTAINMENT,
        required: true,
        estimated_time: 45,
        dependencies: ['step-1'],
        verification_criteria: 'Data exfiltration stopped and systems secured',
        instructions: 'Block unauthorized access, change compromised credentials, and isolate affected systems.'
      },
      {
        id: 'step-3',
        step_number: 3,
        title: 'Legal Notification',
        description: 'Notify legal team and assess regulatory requirements',
        action_type: StepActionType.COMMUNICATION,
        required: true,
        estimated_time: 20,
        dependencies: ['step-1'],
        verification_criteria: 'Legal team notified and guidance received',
        instructions: 'Contact legal counsel immediately. Assess notification requirements under applicable regulations.'
      },
      {
        id: 'step-4',
        step_number: 4,
        title: 'Preserve Evidence',
        description: 'Collect and preserve forensic evidence',
        action_type: StepActionType.INVESTIGATION,
        required: true,
        estimated_time: 60,
        dependencies: ['step-2'],
        verification_criteria: 'Forensic evidence collected and secured',
        instructions: 'Create forensic images, collect logs, and preserve evidence chain of custody.'
      },
      {
        id: 'step-5',
        step_number: 5,
        title: 'Regulatory Notification',
        description: 'Notify regulatory authorities as required',
        action_type: StepActionType.COMMUNICATION,
        required: true,
        estimated_time: 30,
        dependencies: ['step-3'],
        verification_criteria: 'Regulatory notifications completed',
        instructions: 'Submit required breach notifications to regulatory authorities within legal timeframes.'
      },
      {
        id: 'step-6',
        step_number: 6,
        title: 'Customer Notification',
        description: 'Notify affected customers and stakeholders',
        action_type: StepActionType.COMMUNICATION,
        required: true,
        estimated_time: 45,
        dependencies: ['step-3'],
        verification_criteria: 'Affected parties notified appropriately',
        instructions: 'Prepare and send breach notification letters to affected individuals and business partners.'
      }
    ],
    triggers: [
      {
        id: 'trigger-1',
        alert_category: AlertCategory.DATA_BREACH,
        keywords: ['data breach', 'unauthorized access', 'data exfiltration'],
        conditions: {}
      }
    ],
    estimated_duration: 230,
    created_by: 'system',
    last_updated: new Date(),
    usage_count: 0,
    effectiveness_rating: 4.8,
    is_active: true,
    is_template: true,
    created_at: new Date(),
    updated_at: new Date()
  }
];

const mockExecutions: PlaybookExecution[] = [];

export class PlaybookService {
  // Get all playbooks for a tenant
  static async getPlaybooks(_tenantId: string): Promise<SecurityPlaybook[]> {
    return mockPlaybooks.filter(pb => pb.tenant_id === tenantId || pb.is_template);
  }

  // Get a specific playbook by ID
  static async getPlaybook(id: string, tenantId: string): Promise<SecurityPlaybook | null> {
    const playbook = mockPlaybooks.find(pb => pb.id === id && (pb.tenant_id === tenantId || pb.is_template));
    return playbook || null;
  }

  // Create a new custom playbook
  static async createPlaybook(playbookData: Omit<SecurityPlaybook, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'effectiveness_rating'>): Promise<SecurityPlaybook> {
    const newPlaybook: SecurityPlaybook = {
      ...playbookData,
      id: `pb-custom-${Date.now()}`,
      usage_count: 0,
      effectiveness_rating: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    mockPlaybooks.push(newPlaybook);
    return newPlaybook;
  }

  // Update an existing playbook
  static async updatePlaybook(id: string, tenantId: string, updates: Partial<SecurityPlaybook>): Promise<SecurityPlaybook | null> {
    const _index = mockPlaybooks.findIndex(pb => pb.id === id && pb.tenant_id === tenantId);
    if (index === -1) return null;

    mockPlaybooks[index] = {
      ...mockPlaybooks[index],
      ...updates,
      updated_at: new Date()
    };

    return mockPlaybooks[index];
  }

  // Delete a playbook (only custom playbooks can be deleted)
  static async deletePlaybook(id: string, tenantId: string): Promise<boolean> {
    const _index = mockPlaybooks.findIndex(pb => pb.id === id && pb.tenant_id === tenantId && !pb.is_template);
    if (index === -1) return false;

    mockPlaybooks.splice(index, 1);
    return true;
  }

  // Get playbook recommendations based on alert characteristics
  static async getRecommendations(alert: Alert): Promise<PlaybookRecommendation[]> {
    const recommendations: PlaybookRecommendation[] = [];
    
    for (const playbook of mockPlaybooks) {
      if (!playbook.is_active) continue;

      let confidenceScore = 0;
      const matchingCriteria: string[] = [];

      // Check triggers
      for (const trigger of playbook.triggers) {
        // Match alert category
        if (trigger.alert_category === alert.category) {
          confidenceScore += 40;
          matchingCriteria.push(`Alert category: ${alert.category}`);
        }

        // Match alert severity with playbook severity
        if (this.severityMatches(alert.severity, playbook.severity_level)) {
          confidenceScore += 20;
          matchingCriteria.push(`Severity level: ${alert.severity}`);
        }

        // Match keywords in alert title or description
        const alertText = `${alert.title} ${alert.description}`.toLowerCase();
        const matchedKeywords = trigger.keywords.filter(keyword => 
          alertText.includes(keyword.toLowerCase())
        );
        
        if (matchedKeywords.length > 0) {
          confidenceScore += matchedKeywords.length * 10;
          matchingCriteria.push(`Keywords: ${matchedKeywords.join(', ')}`);
        }
      }

      // Add recommendation if confidence score is above threshold
      if (confidenceScore >= 30) {
        recommendations.push({
          playbook,
          confidence_score: Math.min(confidenceScore, 100),
          matching_criteria: matchingCriteria,
          reason: this.generateRecommendationReason(playbook, matchingCriteria)
        });
      }
    }

    // Sort by confidence score (highest first)
    return recommendations.sort((a, b) => b.confidence_score - a.confidence_score);
  }

  // Start playbook execution
  static async startExecution(playbookId: string, tenantId: string, executedBy: string, alertId?: string, incidentId?: string): Promise<PlaybookExecution> {
    const playbook = await this.getPlaybook(playbookId, tenantId);
    if (!playbook) {
      throw new Error('Playbook not found');
    }

    const execution: PlaybookExecution = {
      id: `exec-${Date.now()}`,
      playbook_id: playbookId,
      incident_id: incidentId,
      alert_id: alertId,
      executed_by: executedBy,
      started_at: new Date(),
      status: ExecutionStatus.IN_PROGRESS,
      completed_steps: [],
      notes: '',
      current_step: 1
    };

    mockExecutions.push(execution);

    // Update playbook usage count
    const playbookIndex = mockPlaybooks.findIndex(pb => pb.id === playbookId);
    if (playbookIndex !== -1) {
      mockPlaybooks[playbookIndex].usage_count++;
    }

    return execution;
  }

  // Complete a step in playbook execution
  static async completeStep(executionId: string, stepId: string, completedBy: string, notes?: string, verificationStatus: 'verified' | 'skipped' | 'failed' = 'verified'): Promise<PlaybookExecution | null> {
    const execution = mockExecutions.find(exec => exec.id === executionId);
    if (!execution) return null;

    const completedStep: CompletedStep = {
      step_id: stepId,
      completed_at: new Date(),
      completed_by: completedBy,
      notes,
      verification_status: verificationStatus
    };

    execution.completed_steps.push(completedStep);

    // Update current step
    const playbook = await this.getPlaybook(execution.playbook_id, ''); // Get playbook regardless of tenant for execution
    if (playbook) {
      const currentStepNumber = playbook.steps.find(step => step.id === stepId)?.step_number || 0;
      const nextStep = playbook.steps.find(step => step.step_number === currentStepNumber + 1);
      
      if (nextStep) {
        execution.current_step = nextStep.step_number;
      } else {
        // All steps completed
        execution.status = ExecutionStatus.COMPLETED;
        execution.completed_at = new Date();
      }
    }

    return execution;
  }

  // Get playbook executions
  static async getExecutions(tenantId: string, playbookId?: string): Promise<PlaybookExecution[]> {
    let executions = mockExecutions;
    
    if (playbookId) {
      executions = executions.filter(exec => exec.playbook_id === playbookId);
    }

    // Filter by tenant through playbook association
    const tenantExecutions = [];
    for (const execution of executions) {
      const playbook = await this.getPlaybook(execution.playbook_id, tenantId);
      if (playbook) {
        tenantExecutions.push(execution);
      }
    }

    return tenantExecutions;
  }

  // Get a specific execution
  static async getExecution(executionId: string): Promise<PlaybookExecution | null> {
    return mockExecutions.find(exec => exec.id === executionId) || null;
  }

  // Update execution notes
  static async updateExecutionNotes(executionId: string, notes: string): Promise<PlaybookExecution | null> {
    const execution = mockExecutions.find(exec => exec.id === executionId);
    if (!execution) return null;

    execution.notes = notes;
    return execution;
  }

  // Pause/resume execution
  static async updateExecutionStatus(executionId: string, status: ExecutionStatus): Promise<PlaybookExecution | null> {
    const execution = mockExecutions.find(exec => exec.id === executionId);
    if (!execution) return null;

    execution.status = status;
    if (status === ExecutionStatus.COMPLETED && !execution.completed_at) {
      execution.completed_at = new Date();
    }

    return execution;
  }

  // Helper methods
  private static severityMatches(alertSeverity: AlertSeverity, playbookSeverity: PlaybookSeverity): boolean {
    const severityMap = {
      [AlertSeverity.INFO]: 1,
      [AlertSeverity.LOW]: 2,
      [AlertSeverity.MEDIUM]: 3,
      [AlertSeverity.HIGH]: 4,
      [AlertSeverity.CRITICAL]: 5
    };

    const playbookSeverityMap = {
      [PlaybookSeverity.LOW]: 2,
      [PlaybookSeverity.MEDIUM]: 3,
      [PlaybookSeverity.HIGH]: 4,
      [PlaybookSeverity.CRITICAL]: 5
    };

    const alertLevel = severityMap[alertSeverity] || 1;
    const playbookLevel = playbookSeverityMap[playbookSeverity] || 1;

    // Match if alert severity is equal or higher than playbook severity
    return alertLevel >= playbookLevel;
  }

  private static generateRecommendationReason(playbook: SecurityPlaybook, criteria: string[]): string {
    const reasons = [
      `This playbook is designed for ${playbook.threat_type} incidents`,
      `Estimated completion time: ${playbook.estimated_duration} minutes`,
      `${playbook.steps.length} structured response steps`
    ];

    if (criteria.length > 0) {
      reasons.unshift(`Matches: ${criteria.join(', ')}`);
    }

    return reasons.join('. ');
  }
}