-- Create admin user for testing
-- Password: password123 (hashed with bcrypt)

-- First, ensure we have a tenant
INSERT INTO tenants (name, domain, is_active, created_at, updated_at)
VALUES (
  'Demo Corporation',
  'demo.avian-platform.com',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (domain) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW()
RETURNING id;

-- Store tenant ID for later use
DO $$
DECLARE
  tenant_uuid UUID;
BEGIN
  -- Get the tenant ID
  SELECT id INTO tenant_uuid FROM tenants WHERE domain = 'demo.avian-platform.com';

  -- Delete existing users if they exist
  DELETE FROM users WHERE email IN ('admin@demo.com', 'tenant.admin@demo.com', 'analyst@demo.com', 'helpdesk@demo.com', 'user@demo.com') AND tenant_id = tenant_uuid;

  -- Create Super Admin user
  -- Email: admin@demo.com
  -- Password: password123
  INSERT INTO users (
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    password_hash,
    mfa_enabled,
    mfa_setup_completed,
    is_active,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    tenant_uuid,
    'admin@demo.com',
    'Super',
    'Admin',
    'super_admin',
    '$2b$12$LXCZ.cNJu7CWWJgHq.E3MOzLBPVXYSv7b/.Kk8/ctYz044cvmbgjC', -- password123
    false,
    false,
    true,
    true,
    NOW(),
    NOW()
  );

  -- Create Tenant Admin user
  -- Email: tenant.admin@demo.com
  -- Password: password123
  INSERT INTO users (
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    password_hash,
    mfa_enabled,
    mfa_setup_completed,
    is_active,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    tenant_uuid,
    'tenant.admin@demo.com',
    'Tenant',
    'Admin',
    'tenant_admin',
    '$2b$12$LXCZ.cNJu7CWWJgHq.E3MOzLBPVXYSv7b/.Kk8/ctYz044cvmbgjC', -- password123
    false,
    false,
    true,
    true,
    NOW(),
    NOW()
  );

  -- Create Security Analyst user
  -- Email: analyst@demo.com
  -- Password: password123
  INSERT INTO users (
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    password_hash,
    mfa_enabled,
    mfa_setup_completed,
    is_active,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    tenant_uuid,
    'analyst@demo.com',
    'Security',
    'Analyst',
    'security_analyst',
    '$2b$12$LXCZ.cNJu7CWWJgHq.E3MOzLBPVXYSv7b/.Kk8/ctYz044cvmbgjC', -- password123
    false,
    false,
    true,
    true,
    NOW(),
    NOW()
  );

  -- Create IT Helpdesk Analyst user
  -- Email: helpdesk@demo.com
  -- Password: password123
  INSERT INTO users (
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    password_hash,
    mfa_enabled,
    mfa_setup_completed,
    is_active,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    tenant_uuid,
    'helpdesk@demo.com',
    'IT',
    'Helpdesk',
    'it_helpdesk_analyst',
    '$2b$12$LXCZ.cNJu7CWWJgHq.E3MOzLBPVXYSv7b/.Kk8/ctYz044cvmbgjC', -- password123
    false,
    false,
    true,
    true,
    NOW(),
    NOW()
  );

  -- Create Regular User
  -- Email: user@demo.com
  -- Password: password123
  INSERT INTO users (
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    password_hash,
    mfa_enabled,
    mfa_setup_completed,
    is_active,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    tenant_uuid,
    'user@demo.com',
    'Demo',
    'User',
    'user',
    '$2b$12$LXCZ.cNJu7CWWJgHq.E3MOzLBPVXYSv7b/.Kk8/ctYz044cvmbgjC', -- password123
    false,
    false,
    true,
    true,
    NOW(),
    NOW()
  );

  -- Display created users
  RAISE NOTICE 'Created users for tenant: %', tenant_uuid;
END $$;

-- Display created users
\echo ''
\echo '==================================='
\echo 'Demo Users Created Successfully!'
\echo '==================================='
\echo ''
SELECT 
  email,
  role,
  first_name || ' ' || last_name as name,
  'password123' as password
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE t.domain = 'demo.avian-platform.com'
ORDER BY role;
