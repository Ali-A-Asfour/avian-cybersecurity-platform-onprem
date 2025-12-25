// PHIPA Compliance Framework Implementation
// Personal Health Information Protection Act (Ontario, Canada)

import {
    ComplianceFramework,
    ComplianceControl,
    ControlType,
    AutomatedComplianceStatus,
    ManualComplianceStatus,
    ComplianceStatus,
    AutomatedCheck,
    _HybridComplianceControl
} from '@/types';

export const PHIPA_FRAMEWORK: ComplianceFramework = {
    id: 'framework-phipa-2024',
    tenant_id: '', // Will be set per tenant
    name: 'PHIPA (Ontario)',
    version: '2024.1',
    description: 'Personal Health Information Protection Act (Ontario) compliance framework for protecting personal health information in Ontario, Canada',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
};

export const PHIPA_CONTROLS: Omit<_HybridComplianceControl, 'id' | 'framework_id' | 'created_at' | 'updated_at'>[] = [
    // Section 12 - Collection of Personal Health Information
    {
        control_id: 'PHIPA-12(1)',
        title: 'Collection Limitation',
        description: 'A health information custodian shall not collect personal health information unless the collection is necessary for a lawful purpose related to a function or activity of the custodian.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.MANUAL,
        weight: 95,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [],
        human_validation_required: true,
    },
    {
        control_id: 'PHIPA-12(2)',
        title: 'Collection Methods',
        description: 'A health information custodian shall collect personal health information directly from the individual, unless another method of collection is permitted or required under this Act.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AI_ASSISTED,
        weight: 88,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-collection-methods',
                control_id: 'PHIPA-12(2)',
                check_type: 'document_analysis',
                data_source: 'data_collection_policies',
                query: 'ANALYZE collection_procedures FOR direct_collection, consent_mechanisms, third_party_collection',
                expected_result: { direct_collection_primary: true, consent_documented: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                confidence_score: 0,
                metadata: { description: 'AI analysis of data collection method documentation' }
            }
        ],
        human_validation_required: true,
    },

    // Section 13 - Notice of Collection
    {
        control_id: 'PHIPA-13(1)',
        title: 'Notice Requirements',
        description: 'When collecting personal health information directly from an individual, a health information custodian shall inform the individual of the purposes for which the information is being collected.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 92,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-privacy-notices',
                control_id: 'PHIPA-13(1)',
                check_type: 'document_analysis',
                data_source: 'privacy_notices',
                query: 'ANALYZE privacy_notices FOR collection_purposes, contact_information, complaint_procedures',
                expected_result: { purposes_documented: true, contact_info_present: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                confidence_score: 0,
                metadata: { description: 'Privacy notice completeness verification' }
            }
        ],
        human_validation_required: true,
    },

    // Section 29 - Safeguards
    {
        control_id: 'PHIPA-29(1)',
        title: 'Administrative Safeguards',
        description: 'A health information custodian shall take steps that are reasonable in the circumstances to ensure that personal health information in the custodian\'s custody or control is protected against theft, loss and unauthorized use or disclosure.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 98,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-administrative-safeguards',
                control_id: 'PHIPA-29(1)',
                check_type: 'security_tool',
                data_source: 'access_management',
                query: 'SELECT user_role, access_level, last_review_date FROM user_access_reviews WHERE phi_access = true',
                expected_result: { review_frequency_days: 90, unauthorized_access_incidents: 0 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Administrative safeguards for PHI protection' }
            }
        ],
        human_validation_required: true,
    },
    {
        control_id: 'PHIPA-29(2)',
        title: 'Physical Safeguards',
        description: 'Physical safeguards must be implemented to protect personal health information from unauthorized access, use, or disclosure.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.MANUAL,
        weight: 89,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [],
        human_validation_required: true,
    },
    {
        control_id: 'PHIPA-29(3)',
        title: 'Technical Safeguards',
        description: 'Technical safeguards must be implemented to protect personal health information in electronic form.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 96,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-encryption-standards',
                control_id: 'PHIPA-29(3)',
                check_type: 'agent_policy',
                data_source: 'encryption_systems',
                query: 'Get-BitLockerVolume | Select-Object MountPoint, EncryptionMethod, ProtectionStatus',
                expected_result: { encryption_method_min: 'AES256', all_volumes_protected: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Technical safeguards - encryption verification' }
            },
            {
                id: 'check-access-controls',
                control_id: 'PHIPA-29(3)',
                check_type: 'security_tool',
                data_source: 'identity_management',
                query: 'SELECT authentication_method, mfa_enabled, session_timeout FROM user_sessions WHERE phi_access = true',
                expected_result: { mfa_required: true, max_session_timeout_minutes: 30 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Technical access controls for PHI systems' }
            }
        ],
        human_validation_required: false,
    },

    // Section 30 - Retention and Disposal
    {
        control_id: 'PHIPA-30(1)',
        title: 'Retention Requirements',
        description: 'A health information custodian shall retain personal health information for only as long as is necessary to fulfill the purpose for which it was collected or created.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 85,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-retention-policies',
                control_id: 'PHIPA-30(1)',
                check_type: 'document_analysis',
                data_source: 'retention_schedules',
                query: 'ANALYZE retention_policies FOR phi_categories, retention_periods, disposal_procedures',
                expected_result: { retention_schedule_documented: true, disposal_procedures_defined: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                confidence_score: 0,
                metadata: { description: 'Retention policy documentation analysis' }
            },
            {
                id: 'check-automated-disposal',
                control_id: 'PHIPA-30(1)',
                check_type: 'security_tool',
                data_source: 'data_lifecycle_management',
                query: 'SELECT data_category, retention_period, auto_disposal_enabled FROM data_retention_rules WHERE phi_data = true',
                expected_result: { auto_disposal_enabled: true, overdue_data_count: 0 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Automated data disposal verification' }
            }
        ],
        human_validation_required: true,
    },
    {
        control_id: 'PHIPA-30(2)',
        title: 'Secure Disposal',
        description: 'Personal health information must be disposed of in a secure manner that prevents unauthorized access, use, or disclosure.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 87,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-secure-deletion',
                control_id: 'PHIPA-30(2)',
                check_type: 'security_tool',
                data_source: 'data_destruction',
                query: 'SELECT deletion_method, verification_status FROM secure_deletions WHERE phi_data = true AND deletion_date >= CURDATE() - INTERVAL 30 DAYS',
                expected_result: { secure_deletion_method: 'DoD 5220.22-M', verification_required: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Secure deletion method verification' }
            }
        ],
        human_validation_required: false,
    },

    // Section 54 - Breach Notification
    {
        control_id: 'PHIPA-54(1)',
        title: 'Breach Notification to Commissioner',
        description: 'A health information custodian shall notify the Commissioner if there has been a theft, loss or unauthorized use or disclosure of personal health information in the custodian\'s custody or control.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 94,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-breach-detection',
                control_id: 'PHIPA-54(1)',
                check_type: 'security_tool',
                data_source: 'incident_management',
                query: 'SELECT incident_type, detection_time, notification_time FROM security_incidents WHERE phi_involved = true',
                expected_result: { max_notification_delay_hours: 24, detection_coverage: 100 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Breach detection and notification timing' }
            }
        ],
        human_validation_required: true,
    },
    {
        control_id: 'PHIPA-54(2)',
        title: 'Individual Notification',
        description: 'If there is a real risk of significant harm to an individual as a result of the theft, loss or unauthorized use or disclosure, the custodian shall also notify the individual.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.MANUAL,
        weight: 91,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [],
        human_validation_required: true,
    },

    // Section 55 - Access Rights
    {
        control_id: 'PHIPA-55(1)',
        title: 'Individual Access Rights',
        description: 'An individual has a right of access to a record of personal health information about the individual that is in the custody or under the control of a health information custodian.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 86,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-access-request-system',
                control_id: 'PHIPA-55(1)',
                check_type: 'security_tool',
                data_source: 'access_request_system',
                query: 'SELECT request_date, response_date, status FROM access_requests WHERE request_date >= CURDATE() - INTERVAL 90 DAYS',
                expected_result: { max_response_time_days: 30, fulfillment_rate: 95 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Individual access request processing' }
            }
        ],
        human_validation_required: true,
    },

    // Section 56 - Correction Rights
    {
        control_id: 'PHIPA-56(1)',
        title: 'Correction of Personal Health Information',
        description: 'An individual who believes there is an error or omission in a record of personal health information about the individual may request the health information custodian that has custody or control of the record to correct the record.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.MANUAL,
        weight: 82,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [],
        human_validation_required: true,
    },

    // Consent Management
    {
        control_id: 'PHIPA-20(1)',
        title: 'Consent for Use and Disclosure',
        description: 'A health information custodian shall not use or disclose personal health information about an individual unless the use or disclosure is permitted or required under this Act.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 97,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-consent-management',
                control_id: 'PHIPA-20(1)',
                check_type: 'security_tool',
                data_source: 'consent_management_system',
                query: 'SELECT consent_type, consent_status, expiry_date FROM patient_consents WHERE active = true',
                expected_result: { expired_consents: 0, consent_coverage: 100 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Consent management system verification' }
            }
        ],
        human_validation_required: true,
    },

    // Audit and Monitoring
    {
        control_id: 'PHIPA-AUDIT-1',
        title: 'Audit Trail Requirements',
        description: 'Maintain comprehensive audit trails for all access, use, and disclosure of personal health information to ensure accountability and enable investigation of potential breaches.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 93,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-audit-completeness',
                control_id: 'PHIPA-AUDIT-1',
                check_type: 'security_tool',
                data_source: 'audit_system',
                query: 'SELECT log_source, event_count, coverage_percentage FROM audit_coverage WHERE phi_systems = true',
                expected_result: { min_coverage_percentage: 95, log_retention_days: 2555 }, // 7 years
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Audit trail completeness and retention' }
            },
            {
                id: 'check-audit-integrity',
                control_id: 'PHIPA-AUDIT-1',
                check_type: 'security_tool',
                data_source: 'log_integrity',
                query: 'SELECT log_file, hash_verification, tampering_detected FROM audit_log_integrity WHERE check_date >= CURDATE() - INTERVAL 1 DAY',
                expected_result: { tampering_incidents: 0, hash_verification_success: 100 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Audit log integrity verification' }
            }
        ],
        human_validation_required: false,
    },

    // Privacy Impact Assessments
    {
        control_id: 'PHIPA-PIA-1',
        title: 'Privacy Impact Assessments',
        description: 'Conduct privacy impact assessments for new systems, processes, or significant changes that involve personal health information.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.MANUAL,
        weight: 88,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [],
        human_validation_required: true,
    },

    // Staff Training and Awareness
    {
        control_id: 'PHIPA-TRAINING-1',
        title: 'Privacy Training Program',
        description: 'Implement comprehensive privacy training for all staff who handle personal health information, including initial training and regular updates.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 90,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-training-completion',
                control_id: 'PHIPA-TRAINING-1',
                check_type: 'document_analysis',
                data_source: 'training_system',
                query: 'SELECT employee_id, training_completion_date, training_type FROM privacy_training WHERE completion_date >= CURDATE() - INTERVAL 1 YEAR',
                expected_result: { completion_rate: 100, annual_training_required: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Privacy training completion tracking' }
            }
        ],
        human_validation_required: true,
    }
];

export const getAllPHIPAControls = (): Omit<_HybridComplianceControl, 'id' | 'framework_id' | 'created_at' | 'updated_at'>[] => {
    return PHIPA_CONTROLS;
};