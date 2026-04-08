-- Production cleanup: remove all demo data, keep only super admin
-- Run this once before handing to a real client

BEGIN;

-- Remove all users except super admin
DELETE FROM users WHERE email != 'admin@demo.com';

-- Remove all tenants except the one the super admin belongs to
DELETE FROM tenants WHERE id NOT IN (
    SELECT tenant_id FROM users WHERE email = 'admin@demo.com'
);

-- Clear any demo/test tickets, alerts, sessions
DELETE FROM tickets;
DELETE FROM ticket_comments;
DELETE FROM ticket_attachments;
DELETE FROM alerts;
DELETE FROM security_alerts;
DELETE FROM security_incidents;
DELETE FROM sessions WHERE user_id NOT IN (
    SELECT id FROM users WHERE email = 'admin@demo.com'
);
DELETE FROM audit_logs;
DELETE FROM auth_audit_logs;
DELETE FROM notifications;

COMMIT;

-- Confirm what's left
SELECT email, role, first_name, last_name FROM users;
SELECT name, domain FROM tenants;
