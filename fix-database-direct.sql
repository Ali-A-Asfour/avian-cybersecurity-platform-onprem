-- Direct database fix for account inactive issue
-- Run this inside the PostgreSQL container

-- Check current status
SELECT email, is_active, account_locked, failed_login_attempts, locked_until FROM users WHERE email = 'admin@avian.local';

-- Update admin account to be active
UPDATE users SET 
    is_active = true,
    account_locked = false,
    failed_login_attempts = 0,
    locked_until = NULL,
    last_failed_login = NULL
WHERE email = 'admin@avian.local';

-- Verify the update
SELECT email, is_active, account_locked, failed_login_attempts, locked_until FROM users WHERE email = 'admin@avian.local';