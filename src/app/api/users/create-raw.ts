import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/database';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { config } from '../../../lib/config';

// Raw SQL user creation to bypass ORM issues
export async function createUserRaw(
  email: string,
  firstName: string,
  lastName: string,
  role: string,
  tenantId: string,
  password: string
) {
  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);
  
  // Create direct postgres connection
  const sql = postgres(config.database.url);
  
  try {
    // Use raw SQL to insert user with only essential fields
    const result = await sql`
      INSERT INTO users (
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        password_hash,
        email_verified,
        is_active
      ) VALUES (
        ${tenantId},
        ${email},
        ${firstName},
        ${lastName},
        ${role},
        ${passwordHash},
        ${true},
        ${true}
      ) RETURNING id, tenant_id, email, first_name, last_name, role, is_active, created_at
    `;
    
    await sql.end();
    return result[0];
  } catch (error) {
    await sql.end();
    throw error;
  }
}