#!/usr/bin/env node

/**
 * Fix the login user with correct password hash
 */

const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function fixLoginUser() {
    console.log('🔧 Fixing login user...');
    
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

        // Generate correct password hash for "password"
        const password = 'password';
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        console.log('🔐 Generated password hash for "password":', passwordHash);

        // Update the user with the correct password hash
        const result = await client.query(`
            UPDATE users 
            SET password_hash = $1 
            WHERE email = 'test@test.com'
            RETURNING id, email, role
        `, [passwordHash]);

        if (result.rows.length > 0) {
            console.log('✅ User updated:', result.rows[0]);
            
            // Test the hash
            const isValid = await bcrypt.compare(password, passwordHash);
            console.log('🧪 Password hash test:', isValid ? '✅ Valid' : '❌ Invalid');
            
        } else {
            console.log('❌ No user found to update');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

fixLoginUser().catch(console.error);