// Core enums and types
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  SECURITY_ANALYST = 'security_analyst',
  IT_HELPDESK_ANALYST = 'it_helpdesk_analyst',
  USER = 'user',
}

export enum TicketStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  AWAITING_RESPONSE = 'awaiting_response',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TicketCategory {
  // Security-related categories (Security Analysts only)
  SECURITY_INCIDENT = 'security_incident',
  VULNERABILITY = 'vulnerability',
  MALWARE_DETECTION = 'malware_detection',
  PHISHING_ATTEMPT = 'phishing_attempt',
  DATA_BREACH = 'data_breach',
  POLICY_VIOLATION = 'policy_violation',
  COMPLIANCE = 'compliance',

  // IT Support categories (IT Helpdesk Analysts only)
  IT_SUPPORT = 'it_support',
  HARDWARE_ISSUE = 'hardware_issue',
  SOFTWARE_ISSUE = 'software_issue',
  NETWORK_ISSUE = 'network_issue',
  ACCESS_REQUEST = 'access_request',
  ACCOUNT_SETUP = 'account_setup',

  // General categories (all roles)
  GENERAL_REQUEST = 'general_request',
  OTHER = 'other',
}

export enum AlertSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertCategory {
  MALWARE = 'malware',
  PHISHING = 'phishing',
  INTRUSION = 'intrusion',
  DATA_BREACH = 'data_breach',
  POLICY_VIOLATION = 'policy_violation',
  ANOMALY = 'anomaly',
  OTHER = 'other',
}

export enum AlertStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
}

export enum ComplianceStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NON_COMPLIANT = 'non_compliant',
}

// Core interfaces
export interface User {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  mfa_enabled: boolean;
  mfa_secret?: string;
  mfa_backup_codes?: string[];
  mfa_setup_completed: boolean;
  account_locked: boolean;
  failed_login_attempts: number;
  last_failed_login?: Date;
  password_hash: string;
  last_login?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  logo_url?: string;
  theme_color?: string;
  settings: TenantSettings;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TenantSettings {
  max_users?: number;
  features_enabled: string[];
  notification_settings: NotificationSettings;
  sla_settings: SLASettings;
  branding: BrandingSettings;
}

export interface NotificationSettings {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  digest_frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

export interface SLASettings {
  response_time_hours: number;
  resolution_time_hours: number;
  escalation_enabled: boolean;
  escalation_time_hours: number;
}

export interface BrandingSettings {
  primary_color: string;
  secondary_color: string;
  logo_url?: string;
  favicon_url?: string;
}

export interface Ticket {
  id: string;
  tenant_id: string;
  requester: string;
  assignee?: string;
  title: string;
  description: string;
  category: TicketCategory;
  severity: TicketSeverity;
  priority: TicketPriority;
  status: TicketStatus;
  tags: string[];
  created_by: string; // User ID of ticket creator for field access control
  device_name?: string;
  phoneNumber?: string; // Phone number for contact purposes
  sla_deadline?: Date;
  source_alert_id?: string; // ID of the alert that was escalated to create this ticket
  queue_position_updated_at: Date; // For deterministic queue ordering
  created_at: Date;
  updated_at: Date;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  content: string;
  is_internal: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  uploaded_by: string;
  created_at: Date;
}

export interface Alert {
  id: string;
  tenant_id: string;
  source: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  category: AlertCategory;
  status: AlertStatus;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ComplianceFramework {
  id: string;
  tenant_id: string;
  name: string;
  version: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ComplianceControl {
  id: string;
  framework_id: string;
  control_id: string;
  title: string;
  description: string;
  status: ComplianceStatus;
  last_reviewed?: Date;
  next_review_date?: Date;
  assigned_to?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ComplianceEvidence {
  id: string;
  control_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  description?: string;
  uploaded_by: string;
  created_at: Date;
}

// Hybrid Compliance Scoring Types
export enum ControlType {
  AUTOMATED = 'automated',     // Fully automated assessment (technical controls)
  AI_ASSISTED = 'ai_assisted', // AI analysis with human validation (document reviews)
  MANUAL = 'manual',          // Requires human verification (physical security)
  HYBRID = 'hybrid'           // Combination of multiple approaches
}

export enum AutomatedComplianceStatus {
  PASS = 'pass',
  FAIL = 'fail',
  WARNING = 'warning',
  NOT_APPLICABLE = 'not_applicable',
  ERROR = 'error'
}

export enum ManualComplianceStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING_REVIEW = 'pending_review',
  NOT_REVIEWED = 'not_reviewed'
}

export interface AutomatedCheck {
  id: string;
  control_id: string;
  check_type: string; // 'agent_policy', 'edr_config', 'asset_inventory', 'security_tool', 'document_analysis'
  data_source: string;
  query: string;
  expected_result: any;
  actual_result: any;
  status: AutomatedComplianceStatus;
  confidence_score?: number; // For AI-based checks (0-100)
  last_checked: Date;
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface _HybridComplianceControl extends ComplianceControl {
  control_type: ControlType;
  weight: number; // For scoring calculations (0-100)
  automated_status: AutomatedComplianceStatus;
  manual_status: ManualComplianceStatus;
  overall_status: ComplianceStatus;
  automated_checks: AutomatedCheck[];
  last_automated_assessment?: Date;
  last_manual_review?: Date;
  reviewer?: string;
  confidence_score?: number; // Overall confidence (0-100)
  ai_analysis_confidence?: number; // AI analysis confidence (0-100)
  human_validation_required: boolean;
}

export interface ComplianceScore {
  framework_id: string;
  tenant_id: string;
  overall_score: number;      // 0-100 percentage
  weighted_score: number;     // Weighted score considering control importance
  automated_score: number;    // Score from automated checks
  ai_assisted_score: number;  // Score from AI-assisted checks
  manual_score: number;       // Score from manual reviews
  confidence_score: number;   // Overall confidence in the score (0-100)
  total_controls: number;
  automated_controls: number;
  ai_assisted_controls: number;
  manual_controls: number;
  hybrid_controls: number;
  passed_controls: number;
  failed_controls: number;
  pending_controls: number;
  total_weight: number;       // Sum of all control weights
  last_calculated: Date;
  calculation_metadata: {
    automated_weight: number;
    ai_assisted_weight: number;
    manual_weight: number;
    confidence_adjustments: Record<string, number>;
  };
}

export interface ComplianceScoreHistory {
  id: string;
  framework_id: string;
  tenant_id: string;
  score_data: ComplianceScore;
  calculated_at: Date;
  triggered_by: 'automated' | 'manual' | 'scheduled';
  changes_from_previous?: {
    score_change: number;
    confidence_change: number;
    controls_changed: string[];
  };
}

export interface ComplianceTrend {
  framework_id: string;
  tenant_id: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  trend_data: {
    date: Date;
    overall_score: number;
    confidence_score: number;
    automated_score: number;
    ai_assisted_score: number;
    manual_score: number;
  }[];
  accuracy_metrics: {
    prediction_accuracy: number; // How accurate were previous predictions
    confidence_reliability: number; // How reliable are confidence scores
    trend_stability: number; // How stable is the trend
  };
}

export interface ComplianceReport {
  id: string;
  tenant_id: string;
  framework_id?: string;
  report_type: 'comprehensive' | 'executive_summary' | 'gap_analysis' | 'trend_analysis';
  format: 'pdf' | 'csv' | 'json';
  generated_by: string;
  generated_at: Date;
  report_data: {
    scores: ComplianceScore[];
    trends: ComplianceTrend[];
    controls_breakdown: {
      automated: _HybridComplianceControl[];
      ai_assisted: _HybridComplianceControl[];
      manual: _HybridComplianceControl[];
      hybrid: _HybridComplianceControl[];
    };
    recommendations: ComplianceRecommendation[];
    accuracy_assessment: {
      overall_confidence: number;
      data_quality_score: number;
      completeness_percentage: number;
    };
  };
  file_path?: string;
  download_url?: string;
  expires_at?: Date;
}

export interface ComplianceRecommendation {
  id: string;
  control_id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendation_type: 'automation_opportunity' | 'manual_review_needed' | 'confidence_improvement' | 'gap_closure';
  title: string;
  description: string;
  estimated_effort: 'low' | 'medium' | 'high';
  potential_impact: number; // Score improvement potential (0-100)
  confidence_in_recommendation: number; // How confident we are in this recommendation (0-100)
  created_at: Date;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  read_at?: Date;
}

export interface AuditLog {
  id: string;
  tenant_id?: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Dashboard types
export interface DashboardMetrics {
  tickets: {
    total: number;
    open: number;
    overdue: number;
    resolved_today: number;
  };
  alerts: {
    total: number;
    critical: number;
    high: number;
    unresolved: number;
  };
  compliance: {
    overall_score: number;
    frameworks_count: number;
    controls_completed: number;
    controls_total: number;
  };
  sla: {
    response_rate: number;
    resolution_rate: number;
    average_response_time: number;
    average_resolution_time: number;
  };
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'list' | 'gauge';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
  is_enabled: boolean;
}

export interface DashboardConfig {
  tenant_id: string;
  user_id?: string;
  widgets: DashboardWidget[];
  layout: 'default' | 'compact' | 'detailed';
  refresh_interval: number;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
  mfa_code?: string;
}

export interface LoginResponse {
  user: Omit<User, 'password_hash' | 'mfa_secret'>;
  tenant: Tenant;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface JWTPayload {
  user_id: string;
  tenant_id: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// Filter and pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface TicketFilters extends PaginationParams {
  status?: TicketStatus[];
  severity?: TicketSeverity[];
  priority?: TicketPriority[];
  category?: TicketCategory[];
  assignee?: string;
  requester?: string;
  tags?: string[];
  created_after?: Date;
  created_before?: Date;
}

export interface AlertFilters extends PaginationParams {
  severity?: AlertSeverity[];
  category?: AlertCategory[];
  status?: AlertStatus[];
  source?: string[];
  created_after?: Date;
  created_before?: Date;
}

// Security Playbook types
export enum ThreatType {
  MALWARE = 'malware',
  PHISHING = 'phishing',
  DATA_BREACH = 'data_breach',
  NETWORK_INTRUSION = 'network_intrusion',
  RANSOMWARE = 'ransomware',
  INSIDER_THREAT = 'insider_threat',
  DDOS_ATTACK = 'ddos_attack',
  VULNERABILITY_EXPLOIT = 'vulnerability_exploit',
  SOCIAL_ENGINEERING = 'social_engineering',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
}

export enum PlaybookSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum StepActionType {
  INVESTIGATION = 'investigation',
  CONTAINMENT = 'containment',
  ERADICATION = 'eradication',
  RECOVERY = 'recovery',
  COMMUNICATION = 'communication',
  DOCUMENTATION = 'documentation',
}

export enum ExecutionStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

export interface SecurityPlaybook {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  threat_type: ThreatType;
  severity_level: PlaybookSeverity;
  steps: PlaybookStep[];
  triggers: PlaybookTrigger[];
  estimated_duration: number; // in minutes
  created_by: string;
  last_updated: Date;
  usage_count: number;
  effectiveness_rating: number;
  is_active: boolean;
  is_template: boolean; // true for predefined templates
  created_at: Date;
  updated_at: Date;
}

export interface PlaybookStep {
  id: string;
  step_number: number;
  title: string;
  description: string;
  action_type: StepActionType;
  required: boolean;
  estimated_time: number; // in minutes
  dependencies: string[]; // step IDs that must be completed first
  verification_criteria: string;
  instructions: string;
}

export interface PlaybookTrigger {
  id: string;
  alert_category?: AlertCategory;
  alert_severity?: AlertSeverity;
  keywords: string[];
  conditions: Record<string, any>;
}

export interface PlaybookExecution {
  id: string;
  playbook_id: string;
  incident_id?: string;
  alert_id?: string;
  executed_by: string;
  started_at: Date;
  completed_at?: Date;
  status: ExecutionStatus;
  completed_steps: CompletedStep[];
  notes: string;
  current_step?: number;
}

export interface CompletedStep {
  step_id: string;
  completed_at: Date;
  completed_by: string;
  notes?: string;
  verification_status: 'verified' | 'skipped' | 'failed';
}

export interface PlaybookRecommendation {
  playbook: SecurityPlaybook;
  confidence_score: number;
  matching_criteria: string[];
  reason: string;
}

// Document Analysis types
export enum AnalysisType {
  POLICY_DOCUMENT = 'policy_document',
  PROCEDURE_MANUAL = 'procedure_manual',
  TRAINING_MATERIAL = 'training_material',
  AUDIT_REPORT = 'audit_report',
  RISK_ASSESSMENT = 'risk_assessment',
  SECURITY_POLICY = 'security_policy',
  INCIDENT_RESPONSE_PLAN = 'incident_response_plan',
}

export enum AnalysisStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  HUMAN_REVIEW_REQUIRED = 'human_review_required',
}

export enum DocumentProcessingMethod {
  TEXT_EXTRACTION = 'text_extraction',
  OCR_PROCESSING = 'ocr_processing',
  NLP_ANALYSIS = 'nlp_analysis',
  HYBRID = 'hybrid',
}

export interface DocumentAnalysis {
  id: string;
  document_id: string;
  tenant_id: string;
  framework_id?: string;
  control_id?: string;
  analysis_type: AnalysisType;
  processing_method: DocumentProcessingMethod;
  content_extracted: string;
  key_findings: KeyFinding[];
  compliance_mappings: ComplianceMapping[];
  confidence_score: number;
  status: AnalysisStatus;
  human_reviewed: boolean;
  reviewer_feedback?: ReviewerFeedback;
  processing_metadata: ProcessingMetadata;
  analyzed_at: Date;
  reviewed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface KeyFinding {
  id: string;
  category: string;
  finding: string;
  confidence: number;
  location: DocumentLocation;
  compliance_relevance: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  keywords: string[];
}

export interface ComplianceMapping {
  id: string;
  control_id: string;
  framework_id: string;
  requirement: string;
  document_section: string;
  compliance_status: 'satisfied' | 'partial' | 'not_satisfied' | 'unclear';
  confidence: number;
  evidence_text: string;
  gap_analysis?: string;
  recommendations?: string[];
}

export interface DocumentLocation {
  page?: number;
  paragraph?: number;
  line_start?: number;
  line_end?: number;
  character_start?: number;
  character_end?: number;
  section?: string;
}

export interface ReviewerFeedback {
  reviewer_id: string;
  review_date: Date;
  overall_accuracy: number; // 0-100
  findings_feedback: FindingFeedback[];
  mappings_feedback: MappingFeedback[];
  general_comments: string;
  approved: boolean;
}

export interface FindingFeedback {
  finding_id: string;
  accuracy_rating: number; // 0-100
  is_relevant: boolean;
  corrected_category?: string;
  corrected_finding?: string;
  comments?: string;
}

export interface MappingFeedback {
  mapping_id: string;
  accuracy_rating: number; // 0-100
  is_correct: boolean;
  corrected_status?: 'satisfied' | 'partial' | 'not_satisfied' | 'unclear';
  corrected_evidence?: string;
  comments?: string;
}

export interface ProcessingMetadata {
  file_size: number;
  page_count?: number;
  word_count?: number;
  processing_time_ms: number;
  ocr_confidence?: number;
  language_detected?: string;
  document_structure: DocumentStructure;
  extraction_method: string;
  ai_model_version?: string;
}

export interface DocumentStructure {
  has_table_of_contents: boolean;
  sections: DocumentSection[];
  tables_count: number;
  images_count: number;
  footnotes_count: number;
}

export interface DocumentSection {
  title: string;
  level: number;
  page_start?: number;
  page_end?: number;
  word_count: number;
}

export interface DocumentUpload {
  id: string;
  tenant_id: string;
  control_id?: string;
  framework_id?: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  description?: string;
  uploaded_by: string;
  analysis_requested: boolean;
  analysis_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AnalysisRequest {
  document_id: string;
  analysis_type: AnalysisType;
  framework_id?: string;
  control_id?: string;
  processing_options: ProcessingOptions;
}

export interface ProcessingOptions {
  enable_ocr: boolean;
  enable_nlp: boolean;
  confidence_threshold: number; // 0-100
  language?: string;
  extract_tables: boolean;
  extract_images: boolean;
  compliance_frameworks?: string[];
}

export interface BatchAnalysisRequest {
  document_ids: string[];
  analysis_type: AnalysisType;
  framework_id?: string;
  processing_options: ProcessingOptions;
}

export interface AnalysisProgress {
  analysis_id: string;
  status: AnalysisStatus;
  progress_percentage: number;
  current_step: string;
  estimated_completion?: Date;
  error_message?: string;
}

export interface DocumentValidationResult {
  document_id: string;
  framework_id: string;
  overall_compliance_score: number;
  validation_results: ValidationResult[];
  gaps_identified: ComplianceGap[];
  recommendations: string[];
  validated_at: Date;
}

export interface ValidationResult {
  control_id: string;
  requirement: string;
  status: 'met' | 'partially_met' | 'not_met' | 'not_applicable';
  confidence: number;
  evidence_found: string[];
  gaps: string[];
}

export interface ComplianceGap {
  control_id: string;
  requirement: string;
  gap_description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  estimated_effort: string;
}

// AVIAN Agent types
export enum AgentStatus {
  PENDING = 'pending',
  INSTALLING = 'installing',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  UPDATING = 'updating',
  OFFLINE = 'offline',
}

export enum ToolStatus {
  NOT_INSTALLED = 'not_installed',
  INSTALLING = 'installing',
  INSTALLED = 'installed',
  FAILED = 'failed',
  UPDATING = 'updating',
  OUTDATED = 'outdated',
}

export enum AssetType {
  WORKSTATION = 'workstation',
  SERVER = 'server',
  LAPTOP = 'laptop',
  MOBILE_DEVICE = 'mobile_device',
  NETWORK_DEVICE = 'network_device',
  IOT_DEVICE = 'iot_device',
  VIRTUAL_MACHINE = 'virtual_machine',
  CONTAINER = 'container',
}

export enum DataSourceType {
  EDR_AVAST = 'edr_avast',
  EDR_CROWDSTRIKE = 'edr_crowdstrike',
  EDR_SENTINELONE = 'edr_sentinelone',
  EDR_DEFENDER = 'edr_defender',
  FIREWALL_PFSENSE = 'firewall_pfsense',
  FIREWALL_FORTINET = 'firewall_fortinet',
  FIREWALL_CISCO = 'firewall_cisco',
  SIEM_SPLUNK = 'siem_splunk',
  SIEM_QRADAR = 'siem_qradar',
  SIEM_SENTINEL = 'siem_sentinel',
  AVIAN_AGENT = 'avian_agent',
}

export enum DataSourceStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  CONFIGURING = 'configuring',
  TESTING = 'testing',
}

export interface Agent {
  id: string;
  tenant_id: string;
  client_id: string;
  hostname: string;
  ip_address: string;
  mac_address?: string;
  os_type: string;
  os_version: string;
  agent_version: string;
  status: AgentStatus;
  last_heartbeat: Date;
  installed_tools: InstalledTool[];
  configuration: AgentConfiguration;
  deployment_key: string;
  registration_token?: string;
  health_metrics: AgentHealthMetrics;
  created_at: Date;
  updated_at: Date;
}

export interface InstalledTool {
  id: string;
  name: string;
  version: string;
  vendor: string;
  tool_type: 'edr' | 'antivirus' | 'monitoring' | 'backup' | 'patch_management';
  status: ToolStatus;
  installation_path?: string;
  config_status: 'configured' | 'pending' | 'error';
  last_update_check?: Date;
  installed_at: Date;
  updated_at: Date;
}

export interface AgentConfiguration {
  id: string;
  agent_id: string;
  heartbeat_interval: number; // seconds
  data_collection_enabled: boolean;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  auto_update_enabled: boolean;
  tools_to_install: ToolInstallationConfig[];
  monitoring_settings: MonitoringSettings;
  security_settings: SecuritySettings;
  created_at: Date;
  updated_at: Date;
}

export interface ToolInstallationConfig {
  tool_name: string;
  vendor: string;
  version?: string; // if not specified, install latest
  installation_params: Record<string, any>;
  auto_configure: boolean;
  priority: number; // installation order
}

export interface MonitoringSettings {
  collect_system_metrics: boolean;
  collect_security_events: boolean;
  collect_network_traffic: boolean;
  collect_file_changes: boolean;
  metrics_interval: number; // seconds
  retention_days: number;
}

export interface SecuritySettings {
  encryption_enabled: boolean;
  certificate_validation: boolean;
  allowed_commands: string[];
  restricted_paths: string[];
  communication_protocol: 'https' | 'wss';
  api_key_rotation_days: number;
}

export interface AgentHealthMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_latency: number;
  last_error?: string;
  uptime_seconds: number;
  events_processed_24h: number;
  last_updated: Date;
}

export interface Asset {
  id: string;
  agent_id: string;
  tenant_id: string;
  asset_type: AssetType;
  name: string;
  description?: string;
  ip_address: string;
  mac_address?: string;
  os_info: OSInfo;
  hardware_info: HardwareInfo;
  software_inventory: SoftwareItem[];
  security_tools: SecurityTool[];
  compliance_status: ComplianceStatus;
  risk_score: number;
  vulnerabilities: Vulnerability[];
  last_scan: Date;
  created_at: Date;
  updated_at: Date;
}

export interface OSInfo {
  name: string;
  version: string;
  architecture: string;
  build_number?: string;
  kernel_version?: string;
  last_boot_time?: Date;
  timezone: string;
}

export interface HardwareInfo {
  manufacturer: string;
  model: string;
  serial_number?: string;
  cpu: CPUInfo;
  memory: MemoryInfo;
  storage: StorageInfo[];
  network_interfaces: NetworkInterface[];
}

export interface CPUInfo {
  model: string;
  cores: number;
  threads: number;
  frequency_mhz: number;
  architecture: string;
}

export interface MemoryInfo {
  total_gb: number;
  available_gb: number;
  type: string; // DDR4, DDR5, etc.
  speed_mhz?: number;
}

export interface StorageInfo {
  device: string;
  type: 'hdd' | 'ssd' | 'nvme' | 'network';
  size_gb: number;
  free_gb: number;
  mount_point?: string;
  file_system?: string;
}

export interface NetworkInterface {
  name: string;
  type: 'ethernet' | 'wifi' | 'vpn' | 'loopback';
  ip_addresses: string[];
  mac_address: string;
  status: 'up' | 'down';
  speed_mbps?: number;
}

export interface SoftwareItem {
  name: string;
  version: string;
  vendor: string;
  install_date?: Date;
  size_mb?: number;
  license_type?: string;
  is_security_related: boolean;
}

export interface SecurityTool {
  name: string;
  vendor: string;
  version: string;
  type: 'edr' | 'antivirus' | 'firewall' | 'ids' | 'dlp' | 'backup';
  status: 'active' | 'inactive' | 'error' | 'updating';
  last_update: Date;
  configuration_status: 'optimal' | 'suboptimal' | 'misconfigured';
  license_status: 'valid' | 'expired' | 'expiring_soon';
  license_expiry?: Date;
}

export interface Vulnerability {
  id: string;
  cve_id?: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cvss_score?: number;
  affected_software: string;
  patch_available: boolean;
  patch_details?: string;
  discovered_date: Date;
  remediation_status: 'open' | 'patched' | 'mitigated' | 'accepted_risk';
}

export interface DataSource {
  id: string;
  tenant_id: string;
  name: string;
  type: DataSourceType;
  connection_config: ConnectionConfig;
  status: DataSourceStatus;
  last_heartbeat: Date;
  events_processed: number;
  error_count: number;
  last_error?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ConnectionConfig {
  endpoint?: string;
  port?: number;
  username?: string;
  password?: string;
  api_key?: string;
  certificate?: string;
  ssl_enabled: boolean;
  timeout_seconds: number;
  retry_attempts: number;
  custom_headers?: Record<string, string>;
  authentication_method: 'basic' | 'api_key' | 'certificate' | 'oauth2';
}

export interface SecurityEvent {
  id: string;
  source_type: DataSourceType;
  source_id: string;
  tenant_id: string;
  asset_id?: string;
  agent_id?: string;
  event_type: string;
  severity: AlertSeverity;
  timestamp: Date;
  raw_data: Record<string, any>;
  normalized_data: NormalizedEvent;
  tags: string[];
  correlation_id?: string;
  processed_at: Date;
  created_at: Date;
}

export interface NormalizedEvent {
  event_category: string;
  event_action: string;
  source_ip?: string;
  destination_ip?: string;
  user?: string;
  process?: string;
  file_path?: string;
  command_line?: string;
  threat_indicators: ThreatIndicator[];
  risk_score: number;
}

export interface ThreatIndicator {
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'file_path';
  value: string;
  confidence: number;
  source: string;
  first_seen?: Date;
  last_seen?: Date;
}

// Agent Deployment types
export interface AgentDeployment {
  id: string;
  tenant_id: string;
  deployment_name: string;
  target_count: number;
  deployed_count: number;
  failed_count: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  deployment_config: DeploymentConfig;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface DeploymentConfig {
  os_targets: string[]; // ['windows', 'linux', 'macos']
  tools_to_install: ToolInstallationConfig[];
  auto_register: boolean;
  deployment_method: 'manual' | 'group_policy' | 'script' | 'msi' | 'package_manager';
  installation_params: Record<string, any>;
}

export interface AgentInstallationScript {
  id: string;
  tenant_id: string;
  os_type: 'windows' | 'linux' | 'macos';
  script_content: string;
  script_hash: string;
  deployment_key: string;
  expires_at: Date;
  download_count: number;
  created_at: Date;
}

export interface AgentRegistration {
  agent_id: string;
  tenant_id: string;
  registration_token: string;
  hostname: string;
  ip_address: string;
  os_info: OSInfo;
  hardware_info: HardwareInfo;
  agent_version: string;
  registration_status: 'pending' | 'approved' | 'rejected';
  registered_at: Date;
  approved_at?: Date;
  approved_by?: string;
}

export interface HeartbeatData {
  agent_id: string;
  timestamp: Date;
  status: AgentStatus;
  health_metrics: AgentHealthMetrics;
  installed_tools: InstalledTool[];
  system_info: {
    os_info: OSInfo;
    hardware_info: HardwareInfo;
    software_inventory: SoftwareItem[];
  };
  security_events?: SecurityEvent[];
}

// Firewall Integration types - exported from firewall.ts
export * from './firewall';

// EDR Integration types - exported from edr.ts
export * from './edr';

// Reports Module types - exported from reports.ts
export * from './reports';
