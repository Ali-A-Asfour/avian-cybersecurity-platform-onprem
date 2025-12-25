# Implementation Plan

- [x] 1. Set up database schema and migrations
  - Create migration file for EDR tables (devices, alerts, vulnerabilities, compliance, actions, posture_scores)
  - Add indexes for performance (tenant_id, severity, risk_score, compliance_state, timestamps)
  - Create junction table for device-vulnerability many-to-many relationships
  - Add foreign key constraints with CASCADE delete
  - Test migration applies cleanly and rollback works
  - _Requirements: 1.2, 2.2, 3.2, 4.2, 5.3, 6.2, 9.1, 9.2, 9.3_

- [x] 2. Implement Microsoft Graph API client
  - Create TypeScript interfaces for Microsoft API responses (DefenderDevice, IntuneDevice, DefenderAlert, etc.)
  - Implement OAuth 2.0 client credentials authentication flow
  - Implement token caching and refresh logic
  - Create methods for device retrieval (getDefenderDevices, getIntuneDevices)
  - Create methods for alert retrieval (getDefenderAlerts)
  - Create methods for vulnerability retrieval (getVulnerabilities)
  - Create methods for compliance retrieval (getDeviceCompliance)
  - Create methods for remote actions (isolateDevice, unisolateDevice, runAntivirusScan)
  - Implement rate limiting handler with Retry-After header parsing
  - Implement exponential backoff with 5-minute maximum
  - Add comprehensive error handling for 401, 403, 404, 429, 500 responses
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.2, 7.4, 8.2, 8.3, 8.4, 11.1, 11.2, 11.3_

- [ ]* 2.1 Write property test for authentication and token refresh
  - **Property 21: Token refresh on expiration**
  - **Validates: Requirements 8.4**

- [ ]* 2.2 Write property test for rate limiting behavior
  - **Property 22: Rate limit header parsing**
  - **Property 23: Rate limit retry delay**
  - **Property 24: Exponential backoff with cap**
  - **Validates: Requirements 11.1, 11.2, 11.3**

- [x] 3. Implement data normalization layer
  - Create TypeScript interfaces for normalized AVIAN data models
  - Implement device normalization (DefenderDevice + IntuneDevice → NormalizedDevice)
  - Implement device merging logic (match by device ID, hostname, serial number)
  - Implement alert normalization (DefenderAlert → NormalizedAlert)
  - Implement vulnerability normalization (Vulnerability → NormalizedVulnerability)
  - Implement compliance normalization (ComplianceStatus → NormalizedCompliance)
  - Implement risk score mapping (Microsoft Low/Medium/High → AVIAN 0-100)
  - Implement severity mapping (Microsoft severity → AVIAN severity)
  - Handle null/missing fields with default values
  - _Requirements: 1.2, 1.3, 2.2, 3.2, 4.2_

- [ ]* 3.1 Write property test for device normalization
  - **Property 2: Device normalization and storage**
  - **Validates: Requirements 1.2**

- [ ]* 3.2 Write property test for device merging
  - **Property 3: Device merging from multiple sources**
  - **Validates: Requirements 1.3**

- [x] 4. Implement database operations layer
  - Create Drizzle schema definitions for all EDR tables
  - Implement device upsert operations (insert or update by microsoft_device_id)
  - Implement alert upsert operations (insert or update by microsoft_alert_id)
  - Implement vulnerability upsert operations (insert or update by cve_id)
  - Implement device-vulnerability junction table operations
  - Implement compliance upsert operations (insert or update by device_id)
  - Implement remote action logging (insert with user attribution)
  - Implement action status update operations
  - Implement posture score storage operations
  - Add tenant_id to all insert/update operations
  - _Requirements: 1.2, 2.2, 2.3, 3.2, 4.2, 5.3, 5.4, 6.2, 9.1, 9.2, 9.3, 10.1, 10.2_

- [ ]* 4.1 Write property test for alert upsert behavior
  - **Property 5: Alert upsert behavior**
  - **Validates: Requirements 2.3**

- [ ]* 4.2 Write property test for vulnerability-device relationships
  - **Property 6: Vulnerability-device relationship integrity**
  - **Validates: Requirements 3.2, 3.3**

- [ ]* 4.3 Write property test for tenant ID presence
  - **Property 9: Tenant ID presence in all records**
  - **Validates: Requirements 9.1, 9.2, 9.3**

- [x] 5. Implement posture score calculator
  - Create posture score calculation algorithm
  - Weight factors: device risk scores (30%), active alerts (25%), vulnerabilities (25%), compliance (20%)
  - Calculate device risk average from all devices
  - Count active alerts by severity (high/medium/low)
  - Count critical vulnerabilities (CVSS >= 7.0)
  - Calculate compliance percentage (compliant devices / total devices)
  - Combine factors into 0-100 score
  - Store score with contributing factors and timestamp
  - _Requirements: 6.1, 6.2_

- [ ]* 5.1 Write property test for posture score calculation
  - **Property 15: Posture score calculation**
  - **Validates: Requirements 6.1**

- [ ]* 5.2 Write property test for posture score storage
  - **Property 16: Posture score storage**
  - **Validates: Requirements 6.2**

- [x] 6. Implement polling worker service
  - Create polling worker main execution function
  - Retrieve list of active tenants with Microsoft integration enabled
  - Iterate through tenants with error isolation (one failure doesn't affect others)
  - Retrieve credentials from AWS Secrets Manager per tenant
  - Call Graph API client for each data type (devices, alerts, vulnerabilities, compliance)
  - Pass retrieved data to normalization layer
  - Store normalized data in database
  - Calculate and store posture score
  - Log execution metrics (duration, record counts, errors)
  - Implement retry logic with exponential backoff for transient failures
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 8.2, 8.3_

- [ ]* 6.1 Write property test for multi-tenant polling
  - **Property 18: Multi-tenant polling**
  - **Validates: Requirements 7.3**

- [ ]* 6.2 Write property test for credential caching scope
  - **Property 20: Credential caching scope**
  - **Validates: Requirements 8.3**

- [x] 7. Set up AWS infrastructure for polling
  - Create Lambda function or ECS task definition for polling worker
  - Configure CloudWatch Events rule for 15-minute schedule (configurable)
  - Set up environment variables (DATABASE_URL, AWS_REGION, LOG_LEVEL)
  - Configure IAM role with Secrets Manager and RDS permissions
  - Set up CloudWatch Logs for worker execution logs
  - Configure CloudWatch Metrics for custom metrics (polling success/failure, duration)
  - Set up CloudWatch Alarms for polling failures and high error rates
  - _Requirements: 7.1, 7.2, 7.5, 8.1, 8.2_

- [x] 8. Implement REST API endpoints for devices
  - Create GET /api/edr/devices endpoint with query parameters (search, os, riskLevel, complianceState, lastSeenAfter)
  - Implement JWT authentication middleware
  - Extract tenant ID from JWT claims
  - Filter all queries by authenticated tenant ID
  - Implement search functionality (hostname, user)
  - Implement filters (OS, risk level, compliance state, last seen date range)
  - Implement pagination (page, limit)
  - Return device list with total count
  - Create GET /api/edr/devices/:id endpoint for device details
  - Return device with related alerts, vulnerabilities, compliance, and available actions
  - Add input validation for all parameters
  - Add error handling (400, 401, 403, 404, 500)
  - _Requirements: 1.4, 8.4, 9.4, 9.5, 13.2, 13.3, 13.4_

- [ ]* 8.1 Write property test for device query tenant filtering
  - **Property 8: Query tenant filtering**
  - **Validates: Requirements 1.4, 9.4**

- [ ]* 8.2 Write property test for cross-tenant access rejection
  - **Property 10: Cross-tenant access rejection**
  - **Validates: Requirements 9.5**

- [ ]* 8.3 Write property test for device search and filtering
  - **Property 27: Device search and filtering**
  - **Validates: Requirements 13.2, 13.3**

- [ ]* 8.4 Write property test for device detail data completeness
  - **Property 30: Device detail data completeness**
  - **Validates: Requirements 13.4**

- [x] 9. Implement REST API endpoints for alerts
  - Create GET /api/edr/alerts endpoint with query parameters (severity, deviceId, status, startDate, endDate, page, limit)
  - Implement JWT authentication and tenant extraction
  - Filter all queries by authenticated tenant ID
  - Implement filters (severity, device, status, date range)
  - Implement pagination
  - Return alert list with total count
  - Create GET /api/edr/alerts/:id endpoint for alert details
  - Add input validation and error handling
  - _Requirements: 2.4, 9.4, 14.2, 14.5_

- [ ]* 9.1 Write property test for alert filtering
  - **Property 26: Alert filtering**
  - **Validates: Requirements 2.4, 14.2**

- [x] 10. Implement REST API endpoints for vulnerabilities
  - Create GET /api/edr/vulnerabilities endpoint with query parameters (severity, exploitability, page, limit)
  - Implement JWT authentication and tenant extraction
  - Filter all queries by authenticated tenant ID
  - Implement filters (severity, exploitability)
  - Include affected device count in response
  - Implement pagination
  - Create GET /api/edr/vulnerabilities/:cveId/devices endpoint
  - Return list of devices affected by the vulnerability
  - Add input validation and error handling
  - _Requirements: 3.4, 9.4, 15.2, 15.4_

- [ ]* 10.1 Write property test for vulnerability filtering
  - **Property 28: Vulnerability filtering**
  - **Validates: Requirements 15.2**

- [ ]* 10.2 Write property test for vulnerability affected devices
  - **Property 31: Vulnerability affected devices**
  - **Validates: Requirements 15.4**

- [x] 11. Implement REST API endpoints for compliance
  - Create GET /api/edr/compliance endpoint with query parameters (state, deviceId)
  - Implement JWT authentication and tenant extraction
  - Filter all queries by authenticated tenant ID
  - Implement filters (compliance state, device)
  - Return compliance records with failed rules
  - Create GET /api/edr/compliance/summary endpoint
  - Calculate and return counts of compliant vs non-compliant devices
  - Add input validation and error handling
  - _Requirements: 4.4, 9.4, 16.1, 16.2, 16.3, 16.4_

- [ ]* 11.1 Write property test for compliance summary accuracy
  - **Property 29: Compliance summary accuracy**
  - **Validates: Requirements 16.1**

- [x] 12. Implement REST API endpoints for remote actions
  - Create POST /api/edr/actions endpoint with body (deviceId, actionType)
  - Implement JWT authentication and tenant extraction
  - Validate user has permission for target device's tenant
  - Reject cross-tenant action attempts with 403
  - Call Graph API client to execute remote action
  - Log action in actions table with user attribution
  - Return action record with status
  - Create GET /api/edr/actions endpoint with query parameters (deviceId, userId, startDate, endDate)
  - Filter actions by tenant and query parameters
  - Return action history
  - Add input validation and error handling
  - _Requirements: 5.1, 5.2, 5.3, 9.4, 10.1, 10.3, 10.5_

- [ ]* 12.1 Write property test for remote action authorization
  - **Property 11: Remote action authorization**
  - **Validates: Requirements 5.1**

- [ ]* 12.2 Write property test for remote action audit logging
  - **Property 12: Remote action audit logging**
  - **Validates: Requirements 5.3, 10.1**

- [ ]* 12.3 Write property test for action completion updates
  - **Property 13: Action completion updates**
  - **Validates: Requirements 5.4, 10.2**

- [ ]* 12.4 Write property test for audit log filtering
  - **Property 14: Audit log filtering**
  - **Validates: Requirements 10.3, 10.5**

- [x] 13. Implement REST API endpoints for posture
  - Create GET /api/edr/posture endpoint
  - Implement JWT authentication and tenant extraction
  - Retrieve most recent posture score for tenant
  - Calculate trend (up/down/stable) by comparing to previous score
  - Return score, trend, and contributing factors
  - Create GET /api/edr/posture/history endpoint with query parameters (startDate, endDate)
  - Return historical posture scores for trend graphs
  - Add input validation and error handling
  - _Requirements: 6.3, 9.4, 17.2, 17.3, 17.4_

- [ ]* 13.1 Write property test for posture trend calculation
  - **Property 17: Posture trend calculation**
  - **Validates: Requirements 6.3, 17.2**

- [ ]* 13.2 Write property test for posture contributing factors
  - **Property 32: Posture contributing factors**
  - **Validates: Requirements 17.3**

- [x] 14. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement devices dashboard frontend
  - Create DevicesDashboard React component
  - Implement table view with columns (hostname, OS, user, compliance, risk score, last seen)
  - Implement search input for hostname/user filtering
  - Implement filter controls (OS dropdown, risk level dropdown, compliance state dropdown, last seen date picker)
  - Implement pagination controls
  - Fetch data from GET /api/edr/devices endpoint
  - Implement 30-second auto-refresh polling
  - Handle loading states
  - Handle error states (network error, 401, 403, 500)
  - Implement click handler to navigate to device detail page
  - Clean up polling interval on component unmount
  - _Requirements: 12.1, 12.5, 13.1, 13.2, 13.3, 13.5, 18.1, 18.4_

- [x] 16. Implement device detail page frontend
  - Create DeviceDetailPage React component
  - Fetch device details from GET /api/edr/devices/:id endpoint
  - Display Defender health status
  - Display Intune compliance status with failed rules
  - Display vulnerability list with CVE links
  - Display active alerts list
  - Display available remote actions as buttons (isolate, unisolate, scan)
  - Display posture score contribution
  - Implement remote action button handlers (call POST /api/edr/actions)
  - Implement 30-second auto-refresh polling
  - Handle loading and error states
  - Clean up polling interval on component unmount
  - _Requirements: 12.4, 13.4, 18.1, 18.4_

- [x] 17. Implement alerts dashboard frontend
  - Create AlertsDashboard React component
  - Implement list view with severity badges, threat name, device, status, timestamp
  - Implement filter controls (severity dropdown, device dropdown, status dropdown, date range picker)
  - Implement pagination controls
  - Fetch data from GET /api/edr/alerts endpoint
  - Implement 30-second auto-refresh polling
  - Handle loading and error states
  - Implement click handler to show alert details
  - Clean up polling interval on component unmount
  - _Requirements: 12.1, 12.3, 14.1, 14.2, 14.4, 18.1, 18.4_

- [x] 18. Implement vulnerability dashboard frontend
  - Create VulnerabilityDashboard React component
  - Implement list view with CVE ID, severity, exploitability, affected device count
  - Implement filter controls (severity dropdown, exploitability dropdown)
  - Implement pagination controls
  - Fetch data from GET /api/edr/vulnerabilities endpoint
  - Implement CVE ID as clickable link to external databases
  - Implement 30-second auto-refresh polling
  - Handle loading and error states
  - Implement click handler to show affected devices
  - Clean up polling interval on component unmount
  - _Requirements: 12.1, 15.1, 15.2, 15.4, 18.1, 18.4_

- [x] 19. Implement compliance dashboard frontend
  - Create ComplianceDashboard React component
  - Implement summary counts (compliant vs non-compliant)
  - Fetch summary from GET /api/edr/compliance/summary endpoint
  - Implement list view of non-compliant devices with failed rules
  - Implement filter controls (compliance state dropdown, policy violation dropdown)
  - Fetch data from GET /api/edr/compliance endpoint
  - Implement 30-second auto-refresh polling
  - Handle loading and error states
  - Clean up polling interval on component unmount
  - _Requirements: 12.1, 16.1, 16.2, 16.3, 16.4, 18.1, 18.4_

- [x] 20. Implement posture score widget frontend
  - Create PostureScoreWidget React component
  - Fetch posture data from GET /api/edr/posture endpoint
  - Display numeric score (0-100) with visual styling
  - Display trend indicator (up/down/stable arrow)
  - Display contributing factors (device risk, alerts, vulnerabilities, compliance)
  - Handle insufficient data case with appropriate message
  - Implement click handler to navigate to posture history page
  - Implement 30-second auto-refresh polling
  - Handle loading and error states
  - Clean up polling interval on component unmount
  - _Requirements: 12.1, 17.1, 17.2, 17.3, 17.4, 17.5, 18.1, 18.4_

- [x] 21. Implement posture history page frontend
  - Create PostureHistoryPage React component
  - Fetch historical data from GET /api/edr/posture/history endpoint
  - Implement date range picker for filtering
  - Display line chart showing score over time
  - Display contributing factors breakdown over time
  - Handle loading and error states
  - _Requirements: 17.4_

- [x] 22. Implement auto-refresh and network error handling
  - Create useAutoRefresh custom hook for 30-second polling
  - Implement network connectivity detection
  - Display connection status indicator when offline
  - Pause auto-refresh when network is unavailable
  - Resume auto-refresh when connectivity is restored
  - Maintain filter state across refreshes
  - Clean up intervals on component unmount
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 23. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 24. Set up AWS Secrets Manager for Microsoft credentials
  - Create secret structure: edr/tenant/{tenantId}/microsoft-credentials
  - Store client ID, client secret, tenant ID for each customer tenant
  - Configure IAM permissions for polling worker to read secrets
  - Test credential retrieval from Lambda/ECS
  - Document secret rotation process (manual for MVP)
  - _Requirements: 8.1, 8.2_

- [x] 25. Deploy polling worker to AWS
  - Package polling worker as Lambda function or Docker image for ECS
  - Deploy to AWS environment (dev/staging/prod)
  - Configure CloudWatch Events schedule (15-minute default)
  - Verify worker executes successfully
  - Verify data appears in database after execution
  - Monitor CloudWatch Logs for errors
  - _Requirements: 7.1, 7.2, 7.5_

- [x] 26. Configure monitoring and alerting
  - Set up CloudWatch Alarms for polling failures
  - Set up CloudWatch Alarms for high error rates
  - Set up CloudWatch Alarms for rate limiting events
  - Configure SNS topics for administrator notifications
  - Test alarm triggers
  - Document alarm response procedures
  - _Requirements: 7.6, 8.5, 11.5_

- [ ]* 27. Integration testing - Full polling cycle
  - Deploy polling worker to test environment
  - Configure test tenant with Microsoft credentials
  - Trigger polling execution manually
  - Verify devices are stored in database
  - Verify alerts are stored in database
  - Verify vulnerabilities are stored in database
  - Verify compliance is stored in database
  - Verify posture score is calculated and stored
  - Verify tenant isolation (data only for test tenant)

- [ ]* 28. Integration testing - Device detail page
  - Create test device with alerts, vulnerabilities, and compliance data
  - Navigate to device detail page in frontend
  - Verify all sections display correct data
  - Verify remote action buttons are present
  - Test remote action execution
  - Verify action is logged in database

- [ ]* 29. Integration testing - Multi-tenant isolation
  - Create devices, alerts, vulnerabilities for multiple test tenants
  - Authenticate as tenant A user
  - Verify only tenant A data is returned
  - Attempt to access tenant B device by ID
  - Verify 403 Forbidden response
  - Authenticate as tenant B user
  - Verify only tenant B data is returned

- [ ]* 30. Security testing - Authentication and authorization
  - Test JWT validation on all endpoints
  - Test expired token handling
  - Test invalid token rejection
  - Test cross-tenant access attempts
  - Test permission checks for remote actions
  - Verify credentials never appear in logs or responses

- [x] 31. Documentation
  - Document Microsoft API permissions required
  - Document Azure AD app registration process
  - Document credential setup in Secrets Manager
  - Document polling worker configuration
  - Document API endpoint usage with examples
  - Document dashboard features and usage
  - Document troubleshooting common issues
  - Document deployment process
  - _Requirements: All_

- [x] 32. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.
