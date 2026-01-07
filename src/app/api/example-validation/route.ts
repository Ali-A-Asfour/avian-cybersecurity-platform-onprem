/**
 * Example API Route with Input Validation
 * 
 * Demonstrates how to use the validation middleware for:
 * - Request body validation with schema
 * - HTML sanitization
 * - Query parameter validation
 * 
 * Requirements:
 * - 15.1: Request body size limits
 * - 15.2: Schema validation for all API inputs
 * - 15.4: HTML sanitization for user input
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest, validateQueryParams } from '@/middleware/validation.middleware';

// Define validation schema for POST request
const createUserSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  bio: z.string().max(500).optional(),
  age: z.number().int().min(18).max(120),
});

// Define validation schema for query parameters
const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

/**
 * POST /api/example-validation
 * 
 * Example endpoint demonstrating input validation
 */
export async function POST(request: NextRequest) {
  // Validate request body with schema and sanitization
  const result = await validateRequest(request, {
    schema: createUserSchema,
    sanitize: true, // Automatically sanitizes string inputs
  });

  if (result.error) {
    return result.error;
  }

  const { email, username, bio, age } = result.data;

  // At this point, data is validated and sanitized
  // - email is a valid email address
  // - username matches the regex pattern
  // - bio is sanitized (HTML tags removed)
  // - age is between 18 and 120

  return NextResponse.json({
    message: 'User created successfully',
    user: {
      email,
      username,
      bio,
      age,
    },
  });
}

/**
 * GET /api/example-validation
 * 
 * Example endpoint demonstrating query parameter validation
 */
export async function GET(request: NextRequest) {
  // Validate query parameters
  const result = validateQueryParams(request, querySchema);

  if (result.error) {
    return result.error;
  }

  const { page = 1, limit = 10 } = result.data;

  // At this point, query parameters are validated and transformed
  // - page and limit are numbers (transformed from strings)
  // - default values are applied if not provided

  return NextResponse.json({
    message: 'Query parameters validated',
    pagination: {
      page,
      limit,
    },
  });
}
