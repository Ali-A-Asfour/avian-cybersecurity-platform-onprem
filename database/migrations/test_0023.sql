-- Test file for Migration 0023: Alerts & Security Incidents Module
-- Tests table creation, constraints, indexes, and basic functionality

-- ============================================================================
-- Test Data Setup
-- ============================================================================

-- Create test tenant (assuming tenants table exists)
INSERT INTO tenants (id, name, domain) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Test Tenant', 'test.example.com')
ON CONFLICT (id) DO NOTHING;

-- Create test users (assuming users table exists)
INSERT INTO users (id, tenant_id, email, first_name, last_name, role, password_hash) 
VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'analyst@test.com', 'Test', 'Analyst', 'security_analyst', 'dummy_hash'),
    ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'admin@test.com', 'Test', 'Admin', 'super_admin', 'dummy_hash')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Test Security Alerts Table
-- ============================================================================

-- Test basic alert insertion
INSERT INTO security_alerts (
    id,
    tenant_id,
    source_system,
    source_id,
    alert_type,
    classification,
    severity,
    title,
    description,
    detected_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440010',
    '550e8400-e29b-41d4-a716-446655440000',
    'edr',
    'EDR-001',
    'malware_detection',
    'malware',
    'high',
    'Malware detected on endpoint',
    'Suspicious file detected by EDR system',
    NOW() - INTERVAL '1 hour'
);

-- Test alert assignment
UPDATE security_alerts 
SET status = 'assigned', 
    assigned_to = '550e8400-e29b-41d4-a716-446655440001',
    assigned_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440010';

-- Test deduplication (should update existing alert)
INSERT INTO security_alerts (
    tenant_id,
    source_system,
    source_id,
    alert_type,
    classification,
    severity,
    title,
    description,
    detected_at,
    seen_count,
    last_seen_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'edr',
    'EDR-001',
    'malware_detection',
    'malware',
    'high',
    'Malware detected on endpoint (duplicate)',
    'Duplicate detection',
    NOW(),
    2,
    NOW()
) ON CONFLICT (tenant_id, source_system, source_id) 
DO UPDATE SET 
    seen_count = security_alerts.seen_count + 1,
    last_seen_at = NOW();

-- ============================================================================
-- Test Security Incidents Table
-- ============================================================================

-- Test incident creation with SLA tracking
INSERT INTO security_incidents (
    id,
    tenant_id,
    owner_id,
    title,
    description,
    severity,
    sla_acknowledge_by,
    sla_investigate_by,
    sla_resolve_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440020',
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    'Security Incident - Malware Detection',
    'Escalated from alert EDR-001',
    'high',
    NOW() + INTERVAL '30 minutes',  -- High severity: 30 min acknowledge
    NOW() + INTERVAL '2 hours',     -- High severity: 2 hour investigate
    NOW() + INTERVAL '8 hours'      -- High severity: 8 hour resolve
);

-- Test incident status update
UPDATE security_incidents 
SET status = 'in_progress',
    acknowledged_at = NOW(),
    investigation_started_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440020';

-- ============================================================================
-- Test Investigation Playbooks Table
-- ============================================================================

-- Test playbook creation
INSERT INTO investigation_playbooks (
    id,
    name,
    version,
    status,
    purpose,
    initial_validation_steps,
    source_investigation_steps,
    containment_checks,
    decision_guidance,
    created_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440030',
    'Malware Investigation Playbook',
    '1.0',
    'active',
    'Guide analysts through malware investigation process',
    '["Verify alert authenticity", "Check system status"]',
    '["Analyze file hash", "Check network connections", "Review process tree"]',
    '["Isolate affected system", "Block malicious IPs"]',
    '{"escalateToIncident": "If malware is confirmed active", "resolveBenign": "If file is whitelisted", "resolveFalsePositive": "If detection is incorrect"}',
    '550e8400-e29b-41d4-a716-446655440002'
);

-- ============================================================================
-- Test Junction Tables
-- ============================================================================

-- Test incident-alert linking
INSERT INTO incident_alert_links (
    incident_id,
    alert_id,
    is_primary
) VALUES (
    '550e8400-e29b-41d4-a716-446655440020',
    '550e8400-e29b-41d4-a716-446655440010',
    true
);

-- Test playbook-classification linking
INSERT INTO playbook_classification_links (
    playbook_id,
    classification,
    is_primary,
    playbook_status
) VALUES (
    '550e8400-e29b-41d4-a716-446655440030',
    'malware',
    true,
    'active'
);

-- ============================================================================
-- Test Constraints
-- ============================================================================

-- Test that only one primary alert per incident is allowed
DO $$
BEGIN
    -- This should fail due to unique constraint
    INSERT INTO incident_alert_links (
        incident_id,
        alert_id,
        is_primary
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440020',
        '550e8400-e29b-41d4-a716-446655440010',
        true
    );
    RAISE EXCEPTION 'Constraint test failed: Multiple primary alerts allowed';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'PASS: Only one primary alert per incident constraint working';
END $$;

-- Test that only one active primary playbook per classification is allowed
DO $$
BEGIN
    -- This should fail due to unique constraint
    INSERT INTO playbook_classification_links (
        playbook_id,
        classification,
        is_primary,
        playbook_status
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440030',
        'malware',
        true,
        'active'
    );
    RAISE EXCEPTION 'Constraint test failed: Multiple active primary playbooks allowed';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'PASS: Only one active primary playbook per classification constraint working';
END $$;

-- ============================================================================
-- Test Queries for Performance
-- ============================================================================

-- Test tenant-scoped alert queries (should use tenant indexes)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM security_alerts 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000' 
AND status = 'open'
ORDER BY severity, created_at ASC;

-- Test incident owner queries (should use tenant + owner indexes)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM security_incidents 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000' 
AND owner_id = '550e8400-e29b-41d4-a716-446655440001';

-- Test playbook classification lookup (should use classification index)
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.* FROM investigation_playbooks p
JOIN playbook_classification_links pcl ON p.id = pcl.playbook_id
WHERE pcl.classification = 'malware' 
AND pcl.is_primary = true 
AND pcl.playbook_status = 'active';

-- ============================================================================
-- Test Trigger Functionality
-- ============================================================================

-- Test updated_at trigger for alerts
UPDATE security_alerts 
SET description = 'Updated description'
WHERE id = '550e8400-e29b-41d4-a716-446655440010';

-- Verify updated_at was changed
SELECT 
    id,
    description,
    created_at,
    updated_at,
    (updated_at > created_at) as updated_at_changed
FROM security_alerts 
WHERE id = '550e8400-e29b-41d4-a716-446655440010';

-- Test playbook status synchronization trigger
UPDATE investigation_playbooks 
SET status = 'deprecated'
WHERE id = '550e8400-e29b-41d4-a716-446655440030';

-- Verify playbook_status was synchronized in links table
SELECT 
    pcl.playbook_id,
    p.status as playbook_status,
    pcl.playbook_status as link_status,
    (p.status = pcl.playbook_status) as status_synchronized
FROM playbook_classification_links pcl
JOIN investigation_playbooks p ON pcl.playbook_id = p.id
WHERE pcl.playbook_id = '550e8400-e29b-41d4-a716-446655440030';

-- ============================================================================
-- Cleanup Test Data
-- ============================================================================

-- Clean up in reverse dependency order
DELETE FROM playbook_classification_links WHERE playbook_id = '550e8400-e29b-41d4-a716-446655440030';
DELETE FROM incident_alert_links WHERE incident_id = '550e8400-e29b-41d4-a716-446655440020';
DELETE FROM investigation_playbooks WHERE id = '550e8400-e29b-41d4-a716-446655440030';
DELETE FROM security_incidents WHERE id = '550e8400-e29b-41d4-a716-446655440020';
DELETE FROM security_alerts WHERE id = '550e8400-e29b-41d4-a716-446655440010';
DELETE FROM users WHERE id IN ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002');
DELETE FROM tenants WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- ============================================================================
-- Summary
-- ============================================================================

SELECT 'Migration 0023 test completed successfully' as result;