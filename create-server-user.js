#!/usr/bin/env node

/**
 * Create the exact same user that exists on the server
 */

const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function createServerUser() {
    console.log('👤 Creating server user locally...');
    
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'avian',
        user: 'avian',
        password: 'avian_dev_password'
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Get or create a tenant (use existing one)
        let tenantResult = await client.query('SELECT id FROM tenants LIMIT 1');
        let tenantId = tenantResult.rows[0]?.id;
        
        if (!tenantId) {
            console.log('📋 Creating tenant...');
            await client.query(`
                INSERT INTO tenants (id, name, domain) 
                VALUES (gen_random_uuid(), 'TCC Company', 'tcc.com')
                RETURNING id
            `);
            tenantResult = await client.query('SELECT id FROM tenants WHERE domain = \'tcc.com\'');
            tenantId = tenantResult.rows[0].id;
        }

        console.log('📋 Using tenant ID:', tenantId);

        // Generate password hash for "12345678"
        const password = '12345678';
        const passwordHash = await bcrypt.hash(password, 12);
        
        console.log('🔐 Generated password hash for "12345678"');

        // Create the exact user from the server
        const result = await client.query(`
            INSERT INTO users (
                id, tenant_id, email, first_name, last_name, role, 
                password_hash, email_verified, is_active
            ) VALUES (
                gen_random_uuid(), $1, 'h@tcc.com', 'Helpdesk', 'One', 'analyst', 
                $2, true, true
            )
            ON CONFLICT (email) DO UPDATE SET
                password_hash = $2,
                role = 'analyst',
                first_name = 'Helpdesk',
                last_name = 'One',
                tenant_id = $1,
                email_verified = true,
                is_active = true
            RETURNING id, email, role
        `, [tenantId, passwordHash]);

        if (result.rows.length > 0) {
            console.log('✅ Server user created/updated:', result.rows[0]);
            
            // Test the password
            const isValid = await bcrypt.compare(password, passwordHash);
            console.log('🧪 Password test:', isValid ? '✅ Valid' : '❌ Invalid');
            
        } else {
            console.log('❌ Failed to create user');
        }

        // Show current users
        console.log('\n📊 Current users:');
        const allUsers = await client.query(`
            SELECT id, email, role, first_name, last_name 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.table(allUsers.rows);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

createServerUser().catch(console.error);