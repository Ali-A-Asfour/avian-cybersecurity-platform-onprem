import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  index,
  integer,
  bigint,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'tenant_admin',
  'security_analyst',
  'it_helpdesk_analyst',
  'user',
]);

// Main platform tables (shared across all tenants)

// Tenants table - stores tenant information
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    domain: varchar('domain', { length: 255 }).notNull().unique(),
    logo_url: text('logo_url'),
    theme_color: varchar('theme_color', { length: 7 }), // Hex color
    settings: jsonb('settings').notNull().default('{}'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    domainIdx: index('tenants_domain_idx').on(table.domain),
    activeIdx: index('tenants_active_idx').on(table.is_active),
  })
);

// Users table - stores all users across tenants
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    first_name: varchar('first_name', { length: 100 }).notNull(),
    last_name: varchar('last_name', { length: 100 }).notNull(),
    role: userRoleEnum('role').notNull().default('user'),
    mfa_enabled: boolean('mfa_enabled').notNull().default(false),
    mfa_secret: text('mfa_secret'), // Encrypted TOTP secret
    mfa_backup_codes: jsonb('mfa_backup_codes').default('[]'), // Array of encrypted backup codes
    mfa_setup_completed: boolean('mfa_setup_completed').notNull().default(false),
    account_locked: boolean('account_locked').notNull().default(false),
    failed_login_attempts: integer('failed_login_attempts').notNull().default(0),
    last_failed_login: timestamp('last_failed_login'),
    locked_until: timestamp('locked_until'),
    password_hash: text('password_hash').notNull(),
    email_verified: boolean('email_verified').notNull().default(false),
    last_login: timestamp('last_login'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    emailTenantIdx: index('users_email_tenant_idx').on(
      table.email,
      table.tenant_id
    ),
    tenantIdx: index('users_tenant_idx').on(table.tenant_id),
    roleIdx: index('users_role_idx').on(table.role),
    activeIdx: index('users_active_idx').on(table.is_active),
  })
);

// Audit logs table - platform-wide audit logging
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade',
    }),
    user_id: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: varchar('action', { length: 100 }).notNull(),
    resource_type: varchar('resource_type', { length: 50 }).notNull(),
    resource_id: uuid('resource_id'),
    details: jsonb('details').notNull().default('{}'),
    ip_address: varchar('ip_address', { length: 45 }), // IPv6 support
    user_agent: text('user_agent'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('audit_logs_tenant_idx').on(table.tenant_id),
    userIdx: index('audit_logs_user_idx').on(table.user_id),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    resourceIdx: index('audit_logs_resource_idx').on(
      table.resource_type,
      table.resource_id
    ),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.created_at),
  })
);

// System settings table - platform-wide configuration
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  is_public: boolean('is_public').notNull().default(false),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

// Sessions table - JWT token management and session tracking
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_hash: varchar('token_hash', { length: 255 }).notNull(),
    ip_address: varchar('ip_address', { length: 45 }),
    user_agent: text('user_agent'),
    expires_at: timestamp('expires_at').notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.user_id),
    tokenHashIdx: index('sessions_token_hash_idx').on(table.token_hash),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expires_at),
    createdAtIdx: index('sessions_created_at_idx').on(table.created_at),
  })
);

// Password history table - prevents password reuse
export const passwordHistory = pgTable(
  'password_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('password_history_user_id_idx').on(table.user_id),
    createdAtIdx: index('password_history_created_at_idx').on(table.created_at),
  })
);

// Auth audit logs table - comprehensive authentication event logging
export const authAuditLogs = pgTable(
  'auth_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    email: varchar('email', { length: 255 }),
    action: varchar('action', { length: 100 }).notNull(),
    result: varchar('result', { length: 50 }).notNull(),
    ip_address: varchar('ip_address', { length: 45 }),
    user_agent: text('user_agent'),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('auth_audit_logs_user_id_idx').on(table.user_id),
    emailIdx: index('auth_audit_logs_email_idx').on(table.email),
    actionIdx: index('auth_audit_logs_action_idx').on(table.action),
    resultIdx: index('auth_audit_logs_result_idx').on(table.result),
    createdAtIdx: index('auth_audit_logs_created_at_idx').on(table.created_at),
    ipAddressIdx: index('auth_audit_logs_ip_address_idx').on(table.ip_address),
  })
);

// Email verification tokens table
export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expires_at: timestamp('expires_at').notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('email_verification_tokens_user_id_idx').on(table.user_id),
    tokenIdx: index('email_verification_tokens_token_idx').on(table.token),
    expiresAtIdx: index('email_verification_tokens_expires_at_idx').on(
      table.expires_at
    ),
  })
);

// Password reset tokens table
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expires_at: timestamp('expires_at').notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('password_reset_tokens_user_id_idx').on(table.user_id),
    tokenIdx: index('password_reset_tokens_token_idx').on(table.token),
    expiresAtIdx: index('password_reset_tokens_expires_at_idx').on(
      table.expires_at
    ),
  })
);

// Firewall tables are now defined in database/schemas/firewall.ts
// Import them here for backwards compatibility
export * from './firewall';

// Alerts & Incidents audit logs
export * from './audit-logs';

// SLA Breach Tracking
export * from './sla-breaches';



// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  auditLogs: many(auditLogs),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenant_id],
    references: [tenants.id],
  }),
  auditLogs: many(auditLogs),
  sessions: many(sessions),
  passwordHistory: many(passwordHistory),
  authAuditLogs: many(authAuditLogs),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenant_id],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [auditLogs.user_id],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.user_id],
    references: [users.id],
  }),
}));

export const passwordHistoryRelations = relations(passwordHistory, ({ one }) => ({
  user: one(users, {
    fields: [passwordHistory.user_id],
    references: [users.id],
  }),
}));

export const authAuditLogsRelations = relations(authAuditLogs, ({ one }) => ({
  user: one(users, {
    fields: [authAuditLogs.user_id],
    references: [users.id],
  }),
}));

export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.user_id],
      references: [users.id],
    }),
  })
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.user_id],
      references: [users.id],
    }),
  })
);