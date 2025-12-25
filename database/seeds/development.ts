import { db } from '../../src/lib/database';
import { tenants, users, systemSettings } from '../schemas/main';
import {
  tickets,
  alerts,
  complianceFrameworks,
  complianceControls,
} from '../schemas/tenant';
import bcrypt from 'bcryptjs';
import {
  UserRole,
  TicketStatus,
  TicketSeverity,
  TicketPriority,
  TicketCategory,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  ComplianceStatus,
} from '../../src/types';

export async function seedDevelopmentData() {
  console.log('🌱 Seeding development data...');

  if (!db) {
    throw new Error('Database connection not available');
  }

  try {
    // Create system settings
    await db.insert(systemSettings).values([
      {
        key: 'platform_name',
        value: { name: 'AVIAN Cybersecurity Platform' },
        description: 'Platform display name',
        is_public: true,
      },
      {
        key: 'default_sla_hours',
        value: { response: 4, resolution: 24 },
        description: 'Default SLA timeframes in hours',
        is_public: false,
      },
      {
        key: 'max_file_size',
        value: { size: 10485760 }, // 10MB
        description: 'Maximum file upload size in bytes',
        is_public: false,
      },
    ]);

    // Create demo tenant
    const [demoTenant] = await db
      .insert(tenants)
      .values({
        name: 'Demo Corporation',
        domain: 'demo.avian-platform.com',
        theme_color: '#00D4FF',
        settings: {
          max_users: 100,
          features_enabled: [
            'tickets',
            'alerts',
            'compliance',
            'reports',
            'notifications',
          ],
          notification_settings: {
            email_enabled: true,
            sms_enabled: false,
            push_enabled: true,
            digest_frequency: 'daily',
          },
          sla_settings: {
            response_time_hours: 4,
            resolution_time_hours: 24,
            escalation_enabled: true,
            escalation_time_hours: 8,
          },
          branding: {
            primary_color: '#00D4FF',
            secondary_color: '#0A1628',
            logo_url: null,
            favicon_url: null,
          },
        },
      })
      .returning();

    console.log(`✅ Created demo tenant: ${demoTenant.name}`);

    // Create demo users
    const passwordHash = await bcrypt.hash('password123', 12);

    const demoUsers = await db
      .insert(users)
      .values([
        {
          tenant_id: demoTenant.id,
          email: 'admin@demo.avian-platform.com',
          first_name: 'Super',
          last_name: 'Admin',
          role: UserRole.SUPER_ADMIN,
          password_hash: passwordHash,
          mfa_enabled: false,
        },
        {
          tenant_id: demoTenant.id,
          email: 'tenant.admin@demo.avian-platform.com',
          first_name: 'Tenant',
          last_name: 'Admin',
          role: UserRole.TENANT_ADMIN,
          password_hash: passwordHash,
          mfa_enabled: false,
        },
        {
          tenant_id: demoTenant.id,
          email: 'analyst@demo.avian-platform.com',
          first_name: 'Security',
          last_name: 'Analyst',
          role: UserRole.SECURITY_ANALYST,
          password_hash: passwordHash,
          mfa_enabled: false,
        },
        {
          tenant_id: demoTenant.id,
          email: 'user@demo.avian-platform.com',
          first_name: 'Regular',
          last_name: 'User',
          role: UserRole.USER,
          password_hash: passwordHash,
          mfa_enabled: false,
        },
        {
          tenant_id: demoTenant.id,
          email: 'mr.linux@demo.avian-platform.com',
          first_name: 'Mr',
          last_name: 'Linux',
          role: UserRole.IT_HELPDESK_ANALYST,
          password_hash: passwordHash,
          mfa_enabled: true,
        },
      ])
      .returning();

    console.log(`✅ Created ${demoUsers.length} demo users`);

    // Create sample tickets
    const ticketData = [
      {
        tenant_id: demoTenant.id,
        created_by: demoUsers[0].id,
        requester: 'user@demo.avian-platform.com',
        assignee: 'analyst@demo.avian-platform.com',
        title: 'Suspicious Email Attachment Detected',
        description:
          'User received an email with a suspicious attachment that was flagged by our email security system.',
        category: TicketCategory.SECURITY_INCIDENT,
        severity: TicketSeverity.HIGH,
          priority: TicketPriority.HIGH,
          status: TicketStatus.IN_PROGRESS,
          tags: ['email', 'malware', 'phishing'],
          sla_deadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        },
        {
          tenant_id: demoTenant.id,
          created_by: demoUsers[0].id,
          requester: 'analyst@demo.avian-platform.com',
          title: 'Quarterly Vulnerability Assessment',
          description:
            'Conduct quarterly vulnerability assessment of all critical systems.',
          category: TicketCategory.VULNERABILITY,
          severity: TicketSeverity.MEDIUM,
          priority: TicketPriority.MEDIUM,
          status: TicketStatus.NEW,
          tags: ['vulnerability', 'assessment', 'quarterly'],
          sla_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
        {
          tenant_id: demoTenant.id,
          created_by: demoUsers[0].id,
          requester: 'user@demo.avian-platform.com',
          assignee: 'tenant.admin@demo.avian-platform.com',
          title: 'Access Request for Financial Database',
          description:
            'Request access to financial database for quarterly reporting.',
          category: TicketCategory.ACCESS_REQUEST,
          severity: TicketSeverity.LOW,
          priority: TicketPriority.MEDIUM,
          status: TicketStatus.AWAITING_RESPONSE,
          tags: ['access', 'database', 'financial'],
        },
      ];

    const sampleTickets = await db
      .insert(tickets)
      .values(ticketData)
      .returning();

    console.log(`✅ Created ${sampleTickets.length} sample tickets`);

    // Create sample alerts
    const sampleAlerts = await db
      .insert(alerts)
      .values([
        {
          tenant_id: demoTenant.id,
          source: 'Firewall-01',
          title: 'Multiple Failed Login Attempts',
          description:
            'Detected 15 failed login attempts from IP 192.168.1.100 within 5 minutes.',
          severity: AlertSeverity.HIGH,
          category: AlertCategory.INTRUSION,
          status: AlertStatus.OPEN,
          metadata: {
            source_ip: '192.168.1.100',
            failed_attempts: 15,
            time_window: '5 minutes',
            target_service: 'SSH',
          },
        },
        {
          tenant_id: demoTenant.id,
          source: 'Email-Security',
          title: 'Phishing Email Detected',
          description:
            'Suspicious email with malicious link detected and quarantined.',
          severity: AlertSeverity.MEDIUM,
          category: AlertCategory.PHISHING,
          status: AlertStatus.INVESTIGATING,
          metadata: {
            sender: 'suspicious@example.com',
            recipient: 'user@demo.avian-platform.com',
            subject: 'Urgent: Verify Your Account',
            quarantined: true,
          },
        },
        {
          tenant_id: demoTenant.id,
          source: 'DLP-System',
          title: 'Sensitive Data Transfer Detected',
          description:
            'Large file containing potential PII transferred to external location.',
          severity: AlertSeverity.CRITICAL,
          category: AlertCategory.DATA_BREACH,
          status: AlertStatus.OPEN,
          metadata: {
            file_size: '50MB',
            destination: 'external-cloud-storage.com',
            data_classification: 'PII',
            user: 'employee@demo.avian-platform.com',
          },
        },
      ])
      .returning();

    console.log(`✅ Created ${sampleAlerts.length} sample alerts`);

    // Create sample compliance framework
    const [hipaaFramework] = await db
      .insert(complianceFrameworks)
      .values({
        tenant_id: demoTenant.id,
        name: 'HIPAA',
        version: '2013',
        description:
          'Health Insurance Portability and Accountability Act compliance framework',
      })
      .returning();

    // Create sample compliance controls
    const sampleControls = await db
      .insert(complianceControls)
      .values([
        {
          framework_id: hipaaFramework.id,
          control_id: '164.308(a)(1)(i)',
          title: 'Security Officer',
          description:
            'Assign security responsibilities to an individual or organization.',
          status: ComplianceStatus.COMPLETED,
          assigned_to: demoUsers[1].id, // Tenant Admin
          last_reviewed: new Date(),
          next_review_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        },
        {
          framework_id: hipaaFramework.id,
          control_id: '164.308(a)(3)(i)',
          title: 'Workforce Training',
          description:
            'Implement procedures for authorizing access to electronic protected health information.',
          status: ComplianceStatus.IN_PROGRESS,
          assigned_to: demoUsers[2].id, // Analyst
          next_review_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        },
        {
          framework_id: hipaaFramework.id,
          control_id: '164.312(a)(1)',
          title: 'Access Control',
          description:
            'Implement technical policies and procedures for electronic information systems.',
          status: ComplianceStatus.NOT_STARTED,
          assigned_to: demoUsers[2].id, // Analyst
          next_review_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      ])
      .returning();

    console.log(`✅ Created HIPAA framework with ${sampleControls.length} controls`);

    console.log('🎉 Development data seeding completed successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('Super Admin: admin@demo.avian-platform.com / password123');
    console.log('Tenant Admin: tenant.admin@demo.avian-platform.com / password123');
    console.log('Analyst: analyst@demo.avian-platform.com / password123');
    console.log('User: user@demo.avian-platform.com / password123');
    console.log('Mr Linux: mr.linux@demo.avian-platform.com / password123');

    return {
      tenant: demoTenant,
      users: demoUsers,
      tickets: sampleTickets,
      alerts: sampleAlerts,
      framework: hipaaFramework,
      controls: sampleControls,
    };
  } catch (error) {
    console.error('❌ Error seeding development data:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDevelopmentData()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}