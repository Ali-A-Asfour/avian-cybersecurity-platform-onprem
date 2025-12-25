# Requirements Document

## Introduction

This document specifies the requirements for integrating Microsoft Defender for Endpoint and Microsoft Intune into the AVIAN cybersecurity platform. The integration will be cloud-to-cloud, leveraging Microsoft Graph API to retrieve device data, security alerts, vulnerabilities, compliance status, and enable remote actions. No AVIAN agent will be deployed to endpoints; all telemetry and management will occur through Microsoft's existing infrastructure.

## Glossary

- **AVIAN Platform**: The multi-tenant cybersecurity management system
- **Microsoft Defender for Endpoint**: Microsoft's endpoint detection and response (EDR) solution
- **Microsoft Intune**: Microsoft's cloud-based endpoint management service
- **Microsoft Graph API**: The unified API endpoint for accessing Microsoft 365 services
- **Tenant**: A customer organization within the AVIAN platform with isolated data
- **Device**: An endpoint (workstation, server, mobile device) managed by Defender/Intune
- **Alert**: A security event or threat detected by Microsoft Defender
- **Vulnerability**: A known security weakness (CVE) identified on a device
- **Compliance State**: The status of a device against Intune security policies
- **Exposure Score**: Microsoft's calculated risk metric for a device
- **Remote Action**: A command sent to a device via Microsoft APIs (isolate, scan, etc.)
- **Polling Worker**: A background service that periodically fetches data from Microsoft APIs
- **Normalization Layer**: The component that transforms Microsoft API responses into AVIAN's data model

## Requirements

### Requirement 1

**User Story:** As a security analyst, I want to view all managed devices from Microsoft Defender and Intune in the AVIAN platform, so that I can monitor endpoint security across my organization.

**Data Sources:**
- **Microsoft Defender provides:** Device security information, risk/exposure scores, threat detection status
- **Microsoft Intune provides:** Device compliance state, enrollment status, management status

#### Acceptance Criteria

1. WHEN the Polling Worker executes THEN the system SHALL retrieve device data from Microsoft Graph API including device name, operating system, primary user, Defender health status, Intune compliance state, risk score, and last check-in timestamp
2. WHEN device data is retrieved THEN the system SHALL normalize the data into AVIAN's device model and store it in the tenant-scoped devices table
3. WHEN a device exists in both Defender and Intune THEN the system SHALL merge the data into a single device record
4. WHEN the frontend requests device data THEN the system SHALL return all devices for the authenticated tenant with current status information
5. WHEN device data is displayed THEN the system SHALL show device name, OS type, compliance status, risk level, and last seen timestamp

### Requirement 2

**User Story:** As a security analyst, I want to view security alerts from Microsoft Defender in the AVIAN platform, so that I can respond to threats affecting my endpoints.

**Data Sources:**
- **Microsoft Defender provides:** All threat/alert data, severity classifications, threat types, detection timestamps

#### Acceptance Criteria

1. WHEN the Polling Worker executes THEN the system SHALL retrieve alerts from Microsoft Defender API including alert ID, severity, threat type, affected device, status, and timestamp
2. WHEN alert data is retrieved THEN the system SHALL store each alert in the tenant-scoped alerts table with proper device association
3. WHEN duplicate alerts are detected THEN the system SHALL update existing alert records rather than creating duplicates
4. WHEN the frontend requests alerts THEN the system SHALL return alerts filtered by tenant with support for severity, device, status, and date range filters
5. WHEN an alert is displayed THEN the system SHALL show severity, threat name, affected device, status, and timestamp

### Requirement 3

**User Story:** As a security analyst, I want to view vulnerabilities detected by Microsoft Defender on my devices, so that I can prioritize patching and remediation efforts.

**Data Sources:**
- **Microsoft Defender provides:** All vulnerability/CVE data, severity ratings, exploitability assessments, affected device lists

#### Acceptance Criteria

1. WHEN the Polling Worker executes THEN the system SHALL retrieve vulnerability data from Microsoft Defender API including CVE identifier, severity, exploitability status, and affected devices
2. WHEN vulnerability data is retrieved THEN the system SHALL store each vulnerability with associations to affected devices in the tenant-scoped vulnerabilities table
3. WHEN a vulnerability affects multiple devices THEN the system SHALL maintain the relationship between the vulnerability and all affected devices
4. WHEN the frontend requests vulnerability data THEN the system SHALL return vulnerabilities with device counts and severity information
5. WHEN vulnerabilities are displayed THEN the system SHALL show CVE ID, severity, exploitability status, and number of affected devices

### Requirement 4

**User Story:** As a security analyst, I want to view device compliance status from Microsoft Intune, so that I can identify devices that do not meet security policies.

**Data Sources:**
- **Microsoft Intune provides:** Device compliance state, failed compliance rules, security baseline status, required apps status, policy adherence

#### Acceptance Criteria

1. WHEN the Polling Worker executes THEN the system SHALL retrieve compliance data from Microsoft Intune API including compliance state, failed policy rules, security baseline status, and required application status
2. WHEN compliance data is retrieved THEN the system SHALL store the compliance state for each device in the tenant-scoped device compliance table
3. WHEN a device fails compliance THEN the system SHALL store the specific policy violations and baseline failures
4. WHEN the frontend requests compliance data THEN the system SHALL return compliance status with details of failed policies
5. WHEN compliance status is displayed THEN the system SHALL show overall compliance state, failed rules count, and baseline adherence

### Requirement 5

**User Story:** As a security analyst, I want to execute remote actions on devices through the AVIAN platform, so that I can respond to security incidents without accessing multiple consoles.

**Data Sources:**
- **Microsoft Defender provides:** Remote security actions (isolate device, unisolate device, run antivirus scan, resolve alert)

#### Acceptance Criteria

1. WHEN a user initiates a remote action THEN the system SHALL validate the user has permission for the target device's tenant
2. WHEN a remote action is validated THEN the system SHALL send the action request to Microsoft Defender API with the appropriate device identifier and action type
3. WHEN a remote action is sent THEN the system SHALL log the action in the actions table including user, device, action type, and timestamp
4. WHEN a remote action completes THEN the system SHALL update the action log with the result status
5. WHEN the frontend displays device details THEN the system SHALL show available actions including isolate, unisolate, run scan, and resolve alert

### Requirement 6

**User Story:** As a security analyst, I want to see an overall security posture score for my organization, so that I can track security improvements over time.

#### Acceptance Criteria

1. WHEN device and alert data is stored THEN the system SHALL calculate an AVIAN posture score based on device risk scores, active alerts, vulnerability counts, and compliance status
2. WHEN the posture score is calculated THEN the system SHALL store the score with a timestamp for historical tracking
3. WHEN the frontend requests posture data THEN the system SHALL return the current score and trend information
4. WHEN the posture score is displayed THEN the system SHALL show the numeric score, trend direction, and contributing factors
5. WHEN posture data is unavailable THEN the system SHALL display a message indicating insufficient data

### Requirement 7

**User Story:** As a system administrator, I want the polling worker to run on a configurable schedule, so that device and security data remains current without manual intervention.

#### Acceptance Criteria

1. WHEN the polling worker is deployed THEN the system SHALL configure a CloudWatch Events schedule with a default interval of 15 minutes
2. WHEN polling interval is configured THEN the system SHALL support per-environment or per-tenant interval customization
3. WHEN the polling schedule triggers THEN the system SHALL execute the polling worker for all active tenants
4. WHEN polling begins THEN the system SHALL authenticate with Microsoft Graph API using stored credentials from AWS Secrets Manager
5. WHEN polling completes successfully THEN the system SHALL log the execution time, record count, and configured interval
6. WHEN polling fails THEN the system SHALL log the error and retry with exponential backoff

### Requirement 8

**User Story:** As a system administrator, I want Microsoft API credentials stored securely, so that authentication tokens are protected from unauthorized access.

#### Acceptance Criteria

1. WHEN API credentials are configured THEN the system SHALL store them in AWS Secrets Manager with encryption at rest
2. WHEN the polling worker needs credentials THEN the system SHALL retrieve them from Secrets Manager using IAM role-based authentication
3. WHEN credentials are retrieved THEN the system SHALL cache them in memory for the duration of the polling cycle only
4. WHEN credentials expire THEN the system SHALL refresh the access token using the stored refresh token
5. WHEN credential refresh fails THEN the system SHALL log an error and notify administrators

### Requirement 9

**User Story:** As a security analyst, I want all EDR data isolated by tenant, so that customers cannot access other organizations' security information.

#### Acceptance Criteria

1. WHEN device data is stored THEN the system SHALL include the tenant ID in all device records
2. WHEN alerts are stored THEN the system SHALL include the tenant ID in all alert records
3. WHEN vulnerabilities are stored THEN the system SHALL include the tenant ID in all vulnerability records
4. WHEN the API retrieves data THEN the system SHALL filter all queries by the authenticated user's tenant ID
5. WHEN a user attempts to access data from another tenant THEN the system SHALL return a 403 Forbidden error

### Requirement 10

**User Story:** As a compliance officer, I want all remote actions logged with user attribution, so that security operations can be audited.

#### Acceptance Criteria

1. WHEN a remote action is initiated THEN the system SHALL record the user ID, username, tenant ID, device ID, action type, and timestamp
2. WHEN a remote action completes THEN the system SHALL update the log entry with the result status and completion timestamp
3. WHEN an audit report is requested THEN the system SHALL retrieve all actions for the specified tenant and date range
4. WHEN action logs are displayed THEN the system SHALL show user, device, action, timestamp, and result
5. WHEN action logs are queried THEN the system SHALL support filtering by user, device, action type, and date range

### Requirement 11

**User Story:** As a system administrator, I want the system to handle Microsoft API rate limits gracefully, so that polling operations do not fail due to throttling.

#### Acceptance Criteria

1. WHEN the system receives a 429 rate limit response THEN the system SHALL parse the Retry-After header value
2. WHEN a rate limit is encountered THEN the system SHALL wait for the specified retry duration before retrying the request
3. WHEN multiple rate limits occur THEN the system SHALL implement exponential backoff with a maximum wait time of 5 minutes
4. WHEN rate limiting occurs THEN the system SHALL log the event with the affected API endpoint and retry time
5. WHEN rate limits are consistently hit THEN the system SHALL alert administrators to review polling frequency

### Requirement 12

**User Story:** As a security analyst, I want the device dashboard to automatically refresh when new data arrives, so that I see current security status without manual page reloads.

#### Acceptance Criteria

1. WHEN the frontend loads the device dashboard THEN the system SHALL establish a polling interval to check for data updates every 30 seconds
2. WHEN new device data is available THEN the system SHALL update the displayed device list without full page reload
3. WHEN new alerts are available THEN the system SHALL update the alert count badges and list displays
4. WHEN a remote action completes THEN the system SHALL update the device status display to reflect the new state
5. WHEN the user navigates away from the dashboard THEN the system SHALL stop the polling interval to conserve resources

## Explicit MVP Exclusions

This MVP integration is strictly cloud-to-cloud via Microsoft Graph API. The following capabilities are explicitly OUT OF SCOPE:

**No AVIAN Endpoint Agent:**
- No AVIAN agent will be installed on any endpoints
- No custom scripts will be executed on endpoints
- No local telemetry collection by AVIAN software

**No Raw Log Ingestion:**
- No Windows Event Logs ingestion
- No Microsoft Defender raw log ingestion
- No SIEM functionality
- No log aggregation or storage
- No packet captures
- No memory scans or forensic telemetry

**No Real-Time Streaming:**
- No real-time event streaming from endpoints
- All data retrieval is poll-based via scheduled API calls

**No Configuration Push:**
- No policy enforcement from AVIAN to endpoints
- No configuration management
- No software deployment

**No Advanced Hunting:**
- No Threat Analytics ingestion
- No KQL query execution
- No Advanced Hunting log ingestion
- No custom detection rules

**Future AVIAN Agent Note:**
AVIAN will develop and deploy its own endpoint agent in future releases to provide additional telemetry, custom policy enforcement, and enhanced security capabilities. However, this agent is NOT part of the current MVP and should not influence the current development scope. All telemetry for this MVP comes strictly from Microsoft Defender and Intune via Microsoft Graph API.

## Frontend Dashboard Requirements

### Requirement 13

**User Story:** As a security analyst, I want a comprehensive devices dashboard, so that I can view and manage all endpoints in a single interface.

#### Acceptance Criteria

1. WHEN the devices dashboard loads THEN the system SHALL display a table view with columns for hostname, operating system, primary user, compliance status, risk score, and last seen timestamp
2. WHEN the devices dashboard is displayed THEN the system SHALL provide search functionality to filter devices by hostname or user
3. WHEN the devices dashboard is displayed THEN the system SHALL provide filter controls for operating system, risk level, compliance status, and last seen date range
4. WHEN a user clicks on a device row THEN the system SHALL navigate to a device detail page showing Defender health, Intune compliance, vulnerability list, active alerts, available remote actions, and contribution to posture score
5. WHEN the devices dashboard receives new data THEN the system SHALL automatically update the display every 30 seconds without full page reload

### Requirement 14

**User Story:** As a security analyst, I want an alerts dashboard, so that I can monitor and respond to security threats across all devices.

#### Acceptance Criteria

1. WHEN the alerts dashboard loads THEN the system SHALL display a list of Defender alerts with severity, threat name, affected device, status, and timestamp
2. WHEN the alerts dashboard is displayed THEN the system SHALL provide filter controls for severity level, device, alert status, and date range
3. WHEN an alert is displayed THEN the system SHALL show a color-coded severity badge for visual identification
4. WHEN the alerts dashboard receives new data THEN the system SHALL automatically refresh the display every 30 seconds
5. WHEN a user clicks on an alert THEN the system SHALL display detailed information including threat description, affected device link, and available actions

### Requirement 15

**User Story:** As a security analyst, I want a vulnerability dashboard, so that I can prioritize patching efforts based on CVE severity and device impact.

#### Acceptance Criteria

1. WHEN the vulnerability dashboard loads THEN the system SHALL display a list of CVEs with severity, exploitability status, and number of affected devices
2. WHEN the vulnerability dashboard is displayed THEN the system SHALL provide filter controls for severity level and exploitability status
3. WHEN a vulnerability is displayed THEN the system SHALL show the CVE identifier as a clickable link to external vulnerability databases
4. WHEN a user clicks on a vulnerability THEN the system SHALL display the list of affected devices with links to device detail pages
5. WHEN the vulnerability dashboard receives new data THEN the system SHALL automatically update the display every 30 seconds

### Requirement 16

**User Story:** As a security analyst, I want a compliance dashboard, so that I can identify devices that fail to meet security policies.

#### Acceptance Criteria

1. WHEN the compliance dashboard loads THEN the system SHALL display a summary count of compliant versus non-compliant devices
2. WHEN the compliance dashboard is displayed THEN the system SHALL show a list of devices with failed compliance rules
3. WHEN the compliance dashboard is displayed THEN the system SHALL provide filter controls for compliance state and specific policy violations
4. WHEN a non-compliant device is displayed THEN the system SHALL show the specific failed rules and security baseline violations
5. WHEN the compliance dashboard receives new data THEN the system SHALL automatically update the display every 30 seconds

### Requirement 17

**User Story:** As a security analyst, I want a posture score widget, so that I can quickly assess the overall security health of my organization.

#### Acceptance Criteria

1. WHEN the posture widget is displayed THEN the system SHALL show a numeric score from 0 to 100
2. WHEN the posture widget is displayed THEN the system SHALL show a trend indicator with an up or down arrow based on recent score changes
3. WHEN the posture widget is displayed THEN the system SHALL provide an explanation of contributing factors including device risk scores, active alert counts, vulnerability counts, and compliance percentages
4. WHEN a user clicks on the posture widget THEN the system SHALL navigate to a detailed posture page with historical trend graphs
5. WHEN the posture score is unavailable THEN the system SHALL display a message indicating insufficient data for calculation

### Requirement 18

**User Story:** As a security analyst, I want all dashboards to automatically update, so that I always see current security data without manual refreshes.

#### Acceptance Criteria

1. WHEN any dashboard is loaded THEN the system SHALL establish a 30-second polling interval to check for new backend data
2. WHEN new data arrives THEN the system SHALL update the dashboard display without full page reload
3. WHEN a user interacts with filters or search THEN the system SHALL maintain the auto-refresh behavior with the applied filters
4. WHEN a user navigates away from a dashboard THEN the system SHALL stop the polling interval to conserve browser resources
5. WHEN network connectivity is lost THEN the system SHALL display a connection status indicator and pause auto-refresh until connectivity is restored

## Future Expansion: AVIAN Endpoint Agent

AVIAN will develop and deploy its own endpoint agent in future releases to complement the Microsoft Defender and Intune integration. This future agent will provide:

**Additional Telemetry:**
- Custom health checks and system metrics
- Application inventory and usage tracking
- Network connection monitoring
- File integrity monitoring

**Enhanced Policy Enforcement:**
- AVIAN-specific security policies
- Custom compliance rules
- Automated remediation scripts
- Configuration drift detection

**Advanced Capabilities:**
- Script execution for incident response
- Offline device detection and alerting
- Custom log collection and forwarding
- Enhanced forensic data collection

**Important Note:** The AVIAN agent is NOT part of this MVP specification and should not influence current development priorities. The current integration relies entirely on Microsoft's existing infrastructure and APIs. The agent will be designed and implemented as a separate project after the MVP is successfully deployed.
