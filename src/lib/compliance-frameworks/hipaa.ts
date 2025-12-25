// HIPAA Compliance Framework Implementation
// Health Insurance Portability and Accountability Act (HIPAA) Security Rule

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

export const HIPAA_FRAMEWORK: ComplianceFramework = {
    id: 'framework-hipaa-2024',
    tenant_id: '', // Will be set per tenant
    name: 'HIPAA Security Rule',
    version: '2024.1',
    description: 'Health Insurance Portability and Accountability Act (HIPAA) Security Rule compliance framework for protecting electronic protected health information (ePHI)',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
};

export const HIPAA_CONTROLS: Omit<_HybridComplianceControl, 'id' | 'framework_id' | 'created_at' | 'updated_at'>[] = [
    // Administrative Safeguards
    {
        control_id: 'HIPAA-164.308(a)(1)(i)',
        title: 'Security Officer',
        description: 'Assign security responsibilities to an individual who is accountable for the covered entity\'s or business associate\'s security policies and procedures.',
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
        control_id: 'HIPAA-164.308(a)(1)(ii)(A)',
        title: 'Workforce Training',
        description: 'Implement procedures to ensure that all members of its workforce have appropriate access to electronic protected health information and prevent those workforce members who do not have access.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 90,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-training-records',
                control_id: 'HIPAA-164.308(a)(1)(ii)(A)',
                check_type: 'document_analysis',
                data_source: 'training_system',
                query: 'SELECT COUNT(*) FROM training_records WHERE completion_date > DATE_SUB(NOW(), INTERVAL 1 YEAR)',
                expected_result: { min_completion_rate: 95 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Annual HIPAA training completion rate' }
            }
        ],
        human_validation_required: true,
    },
    {
        control_id: 'HIPAA-164.308(a)(2)',
        title: 'Assigned Security Responsibilities',
        description: 'Identify the security official who is responsible for the development and implementation of the policies and procedures required by this subpart for the entity.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.MANUAL,
        weight: 85,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [],
        human_validation_required: true,
    },
    {
        control_id: 'HIPAA-164.308(a)(3)(i)',
        title: 'Workforce Access Management',
        description: 'Implement procedures for the authorization and/or supervision of workforce members who work with electronic protected health information or in locations where it might be accessed.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 92,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-access-controls',
                control_id: 'HIPAA-164.308(a)(3)(i)',
                check_type: 'agent_policy',
                data_source: 'active_directory',
                query: 'Get-ADUser -Filter * -Properties LastLogonDate, PasswordLastSet | Where-Object {$_.Enabled -eq $true}',
                expected_result: { inactive_accounts: 0, password_age_max_days: 90 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Active Directory user access management' }
            }
        ],
        human_validation_required: false,
    },
    {
        control_id: 'HIPAA-164.308(a)(4)(i)',
        title: 'Information Access Management',
        description: 'Implement policies and procedures for authorizing access to electronic protected health information that are consistent with the applicable requirements of subpart E of this part.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 94,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-rbac-implementation',
                control_id: 'HIPAA-164.308(a)(4)(i)',
                check_type: 'security_tool',
                data_source: 'identity_management',
                query: 'SELECT role_name, permission_count FROM user_roles WHERE active = 1',
                expected_result: { min_roles: 3, principle_of_least_privilege: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Role-based access control implementation' }
            }
        ],
        human_validation_required: true,
    },
    {
        control_id: 'HIPAA-164.308(a)(5)(i)',
        title: 'Security Awareness and Training',
        description: 'Implement a security awareness and training program for all members of its workforce (including management).',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AI_ASSISTED,
        weight: 88,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-training-program',
                control_id: 'HIPAA-164.308(a)(5)(i)',
                check_type: 'document_analysis',
                data_source: 'training_documents',
                query: 'ANALYZE training_materials FOR hipaa_content, frequency, completion_tracking',
                expected_result: { annual_training: true, role_specific: true, completion_tracking: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                confidence_score: 0,
                metadata: { description: 'AI analysis of training program documentation' }
            }
        ],
        human_validation_required: true,
    },

    // Physical Safeguards
    {
        control_id: 'HIPAA-164.310(a)(1)',
        title: 'Facility Access Controls',
        description: 'Implement policies and procedures to limit physical access to its electronic information systems and the facility or facilities in which they are housed, while ensuring that properly authorized access is allowed.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.MANUAL,
        weight: 87,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [],
        human_validation_required: true,
    },
    {
        control_id: 'HIPAA-164.310(a)(2)(i)',
        title: 'Workstation Use',
        description: 'Implement policies and procedures that specify the proper functions to be performed, the manner in which those functions are to be performed, and the physical attributes of the surroundings of a specific workstation or class of workstation that can access electronic protected health information.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 83,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-workstation-security',
                control_id: 'HIPAA-164.310(a)(2)(i)',
                check_type: 'agent_policy',
                data_source: 'endpoint_management',
                query: 'Get-WmiObject -Class Win32_ComputerSystem | Select-Object Name, Domain, ScreenSaverActive, ScreenSaverTimeout',
                expected_result: { screen_saver_enabled: true, timeout_minutes: 15, domain_joined: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Workstation security configuration check' }
            }
        ],
        human_validation_required: true,
    },
    {
        control_id: 'HIPAA-164.310(d)(1)',
        title: 'Device and Media Controls',
        description: 'Implement policies and procedures that govern the receipt and removal of hardware and electronic media that contain electronic protected health information into and out of a facility, and the movement of these items within the facility.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 89,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-usb-controls',
                control_id: 'HIPAA-164.310(d)(1)',
                check_type: 'edr_config',
                data_source: 'endpoint_protection',
                query: 'SELECT device_type, policy_action FROM device_control_policies WHERE active = 1',
                expected_result: { usb_blocked: true, removable_media_encrypted: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'USB and removable media control policies' }
            }
        ],
        human_validation_required: false,
    },

    // Technical Safeguards
    {
        control_id: 'HIPAA-164.312(a)(1)',
        title: 'Access Control',
        description: 'Implement technical policies and procedures for electronic information systems that maintain electronic protected health information to allow access only to those persons or software programs that have been granted access rights.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 96,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-technical-access-controls',
                control_id: 'HIPAA-164.312(a)(1)',
                check_type: 'security_tool',
                data_source: 'identity_provider',
                query: 'SELECT user_id, mfa_enabled, last_login, failed_attempts FROM user_accounts WHERE active = 1',
                expected_result: { mfa_enabled_percentage: 100, max_failed_attempts: 5 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Technical access control implementation' }
            }
        ],
        human_validation_required: false,
    },
    {
        control_id: 'HIPAA-164.312(a)(2)(i)',
        title: 'Unique User Identification',
        description: 'Assign a unique name and/or number for identifying and tracking user identity.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 91,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-unique-user-ids',
                control_id: 'HIPAA-164.312(a)(2)(i)',
                check_type: 'agent_policy',
                data_source: 'user_directory',
                query: 'SELECT username, COUNT(*) as count FROM users GROUP BY username HAVING count > 1',
                expected_result: { duplicate_usernames: 0 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Unique user identification verification' }
            }
        ],
        human_validation_required: false,
    },
    {
        control_id: 'HIPAA-164.312(a)(2)(ii)',
        title: 'Emergency Access Procedure',
        description: 'Establish (and implement as needed) procedures for obtaining necessary electronic protected health information during an emergency.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.MANUAL,
        weight: 78,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [],
        human_validation_required: true,
    },
    {
        control_id: 'HIPAA-164.312(a)(2)(iii)',
        title: 'Automatic Logoff',
        description: 'Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 85,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-session-timeout',
                control_id: 'HIPAA-164.312(a)(2)(iii)',
                check_type: 'agent_policy',
                data_source: 'system_configuration',
                query: 'Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name InactivityTimeoutSecs',
                expected_result: { max_timeout_minutes: 15 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Automatic session timeout configuration' }
            }
        ],
        human_validation_required: false,
    },
    {
        control_id: 'HIPAA-164.312(a)(2)(iv)',
        title: 'Encryption and Decryption',
        description: 'Implement a mechanism to encrypt and decrypt electronic protected health information.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 98,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-encryption-at-rest',
                control_id: 'HIPAA-164.312(a)(2)(iv)',
                check_type: 'agent_policy',
                data_source: 'disk_encryption',
                query: 'Get-BitLockerVolume | Select-Object MountPoint, EncryptionPercentage, VolumeStatus',
                expected_result: { encryption_percentage: 100, all_volumes_encrypted: true },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Disk encryption verification' }
            },
            {
                id: 'check-encryption-in-transit',
                control_id: 'HIPAA-164.312(a)(2)(iv)',
                check_type: 'security_tool',
                data_source: 'network_monitoring',
                query: 'SELECT protocol, encryption_status FROM network_connections WHERE data_classification = "PHI"',
                expected_result: { unencrypted_phi_connections: 0 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Network encryption for PHI transmission' }
            }
        ],
        human_validation_required: false,
    },
    {
        control_id: 'HIPAA-164.312(b)',
        title: 'Audit Controls',
        description: 'Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use electronic protected health information.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 93,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-audit-logging',
                control_id: 'HIPAA-164.312(b)',
                check_type: 'security_tool',
                data_source: 'siem_system',
                query: 'SELECT log_source, events_per_day FROM audit_logs WHERE date >= CURDATE() - INTERVAL 1 DAY',
                expected_result: { min_log_sources: 5, events_per_day_min: 1000 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Audit log collection and retention' }
            }
        ],
        human_validation_required: false,
    },
    {
        control_id: 'HIPAA-164.312(c)(1)',
        title: 'Integrity',
        description: 'Implement policies and procedures to protect electronic protected health information from improper alteration or destruction.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 90,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-file-integrity',
                control_id: 'HIPAA-164.312(c)(1)',
                check_type: 'security_tool',
                data_source: 'file_integrity_monitoring',
                query: 'SELECT file_path, hash_status FROM monitored_files WHERE classification = "PHI"',
                expected_result: { integrity_violations: 0 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'File integrity monitoring for PHI' }
            }
        ],
        human_validation_required: true,
    },
    {
        control_id: 'HIPAA-164.312(d)',
        title: 'Person or Entity Authentication',
        description: 'Implement procedures to verify that a person or entity seeking access to electronic protected health information is the one claimed.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 95,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-authentication-mechanisms',
                control_id: 'HIPAA-164.312(d)',
                check_type: 'identity_management',
                data_source: 'authentication_system',
                query: 'SELECT auth_method, success_rate FROM authentication_logs WHERE date >= CURDATE() - INTERVAL 7 DAYS',
                expected_result: { mfa_usage_percentage: 100, auth_success_rate_min: 95 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Authentication mechanism effectiveness' }
            }
        ],
        human_validation_required: false,
    },
    {
        control_id: 'HIPAA-164.312(e)(1)',
        title: 'Transmission Security',
        description: 'Implement technical security measures to guard against unauthorized access to electronic protected health information that is being transmitted over an electronic communications network.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.AUTOMATED,
        weight: 94,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-transmission-encryption',
                control_id: 'HIPAA-164.312(e)(1)',
                check_type: 'network_monitoring',
                data_source: 'network_security',
                query: 'SELECT protocol, encryption_cipher FROM network_transmissions WHERE contains_phi = true',
                expected_result: { unencrypted_phi_transmissions: 0, min_cipher_strength: 'AES-256' },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'PHI transmission encryption verification' }
            }
        ],
        human_validation_required: false,
    }
];

// HIPAA Risk Assessment Controls
export const HIPAA_RISK_ASSESSMENT_CONTROLS: Omit<_HybridComplianceControl, 'id' | 'framework_id' | 'created_at' | 'updated_at'>[] = [
    {
        control_id: 'HIPAA-164.308(a)(1)(ii)(B)',
        title: 'Conduct an accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of electronic protected health information held by the covered entity or business associate.',
        description: 'Regular risk assessments must be conducted to identify threats to ePHI and implement appropriate safeguards.',
        status: ComplianceStatus.NOT_STARTED,
        control_type: ControlType.HYBRID,
        weight: 97,
        automated_status: AutomatedComplianceStatus.NOT_APPLICABLE,
        manual_status: ManualComplianceStatus.NOT_REVIEWED,
        overall_status: ComplianceStatus.NOT_STARTED,
        automated_checks: [
            {
                id: 'check-vulnerability-scans',
                control_id: 'HIPAA-164.308(a)(1)(ii)(B)',
                check_type: 'security_tool',
                data_source: 'vulnerability_scanner',
                query: 'SELECT scan_date, critical_vulns, high_vulns FROM vulnerability_scans WHERE scan_date >= CURDATE() - INTERVAL 30 DAYS',
                expected_result: { max_critical_vulns: 0, max_high_vulns: 5, scan_frequency_days: 30 },
                actual_result: null,
                status: AutomatedComplianceStatus.NOT_APPLICABLE,
                last_checked: new Date(),
                metadata: { description: 'Regular vulnerability assessment scanning' }
            }
        ],
        human_validation_required: true,
    }
];

export const getAllHIPAAControls = (): Omit<_HybridComplianceControl, 'id' | 'framework_id' | 'created_at' | 'updated_at'>[] => {
    return [...HIPAA_CONTROLS, ...HIPAA_RISK_ASSESSMENT_CONTROLS];
};