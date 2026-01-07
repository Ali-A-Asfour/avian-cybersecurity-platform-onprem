/**
 * Validation Middleware
 * 
 * Provides middleware functions for validating API requests
 * 
 * Requirements:
 * - 15.1: Request body size limits
 * - 15.2: Schema validation for all API inputs
 * - 15.4: HTML sanitization for user input
 * - 15.5: File upload validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import {
  validateAndParseJson,
  validateSchema,
  sanitizeObject,
  ValidationError,
  BODY_SIZE_LIMITS,
} from '@/lib/input-validation';

/**
 * Validation middleware options
 */
export interface ValidationOptions {
  /** Zod schema to validate request body against */
  schema?: ZodSchema;
  /** Maximum body size in bytes */
  maxBodySize?: number;
  /** Whether to sanitize string inputs */
  sanitize?: boolean;
  /** Custom error handler */
  onError?: (error: ValidationError) => NextResponse;
}

/**
 * Create a validation middleware for API routes
 * 
 * Requirements:
 * - 15.1: Request body size limits
 * - 15.2: Schema validation for all API inputs
 * - 15.4: HTML sanitization for user input
 * 
 * @param options - Validation options
 * @returns Middleware function
 * 
 * @example
 * ```typescript
 * const loginSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(12),
 * });
 * 
 * export async function POST(request: NextRequest) {
 *   const result = await validateRequest(request, {
 *     schema: loginSchema,
 *     sanitize: true,
 *   });
 *   
 *   if (result.error) {
 *     return result.error;
 *   }
 *   
 *   const { email, password } = result.data;
 *   // ... handle login
 * }
 * ```
 */
export async function validateRequest<T = any>(
  request: NextRequest,
  options: ValidationOptions = {}
): Promise<{ data?: T; error?: NextResponse }> {
  const {
    schema,
    maxBodySize = BODY_SIZE_LIMITS.JSON,
    sanitize = true,
    onError,
  } = options;

  try {
    // Get request body as text
    const bodyText = await request.text();
    
    // Validate and parse JSON
    let data = validateAndParseJson(bodyText, maxBodySize);
    
    // Sanitize if requested
    if (sanitize && typeof data === 'object' && data !== null) {
      data = sanitizeObject(data);
    }
    
    // Validate against schema if provided
    if (schema) {
      data = validateSchema(schema, data);
    }
    
    return { data: data as T };
  } catch (error) {
    if (error instanceof ValidationError) {
      if (onError) {
        return { error: onError(error) };
      }
      
      return {
        error: NextResponse.json(
          {
            error: error.message,
            field: error.field,
            code: error.code,
          },
          { status: 400 }
        ),
      };
    }
    
    // Unexpected error
    console.error('Validation error:', error);
    return {
      error: NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate query parameters
 * 
 * Requirement 15.2: Schema validation for all API inputs
 * 
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @returns Validation result
 * 
 * @example
 * ```typescript
 * const querySchema = z.object({
 *   page: z.string().regex(/^\d+$/).transform(Number),
 *   limit: z.string().regex(/^\d+$/).transform(Number),
 * });
 * 
 * export async function GET(request: NextRequest) {
 *   const result = validateQueryParams(request, querySchema);
 *   
 *   if (result.error) {
 *     return result.error;
 *   }
 *   
 *   const { page, limit } = result.data;
 *   // ... handle request
 * }
 * ```
 */
export function validateQueryParams<T = any>(
  request: NextRequest,
  schema: ZodSchema<T>
): { data?: T; error?: NextResponse } {
  try {
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};
    
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    const data = validateSchema(schema, params);
    return { data };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        error: NextResponse.json(
          {
            error: error.message,
            field: error.field,
            code: error.code,
          },
          { status: 400 }
        ),
      };
    }
    
    return {
      error: NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate file upload from FormData
 * 
 * Requirement 15.5: File upload validation
 * 
 * @param request - Next.js request object
 * @param options - File validation options
 * @returns Validation result with file and optional form data
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const result = await validateFileUpload(request, {
 *     allowedTypes: ALLOWED_FILE_TYPES.IMAGES,
 *     maxSize: MAX_FILE_SIZES.IMAGE,
 *     fieldName: 'avatar',
 *   });
 *   
 *   if (result.error) {
 *     return result.error;
 *   }
 *   
 *   const { file, formData } = result.data;
 *   // ... handle file upload
 * }
 * ```
 */
export async function validateFileUpload(
  request: NextRequest,
  options: {
    allowedTypes: readonly string[];
    maxSize: number;
    fieldName?: string;
    schema?: ZodSchema;
  }
): Promise<{
  data?: { file: File; formData?: any };
  error?: NextResponse;
}> {
  const { allowedTypes, maxSize, fieldName = 'file', schema } = options;

  try {
    const formData = await request.formData();
    const file = formData.get(fieldName);
    
    if (!file || !(file instanceof File)) {
      throw new ValidationError(
        `No file provided in field '${fieldName}'`,
        fieldName,
        'FILE_REQUIRED'
      );
    }
    
    // Validate file
    const { validateFileUpload: validateFile } = await import('@/lib/input-validation');
    validateFile(
      {
        name: file.name,
        type: file.type,
        size: file.size,
      },
      allowedTypes,
      maxSize
    );
    
    // Validate additional form data if schema provided
    let validatedFormData;
    if (schema) {
      const formDataObj: Record<string, any> = {};
      formData.forEach((value, key) => {
        if (key !== fieldName) {
          formDataObj[key] = value;
        }
      });
      validatedFormData = validateSchema(schema, formDataObj);
    }
    
    return {
      data: {
        file,
        formData: validatedFormData,
      },
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        error: NextResponse.json(
          {
            error: error.message,
            field: error.field,
            code: error.code,
          },
          { status: 400 }
        ),
      };
    }
    
    return {
      error: NextResponse.json(
        { error: 'Invalid file upload' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate multiple file uploads from FormData
 * 
 * Requirement 15.5: File upload validation
 * 
 * @param request - Next.js request object
 * @param options - File validation options
 * @returns Validation result with files and optional form data
 */
export async function validateMultipleFileUploads(
  request: NextRequest,
  options: {
    allowedTypes: readonly string[];
    maxSize: number;
    maxFiles?: number;
    fieldName?: string;
    schema?: ZodSchema;
  }
): Promise<{
  data?: { files: File[]; formData?: any };
  error?: NextResponse;
}> {
  const {
    allowedTypes,
    maxSize,
    maxFiles = 10,
    fieldName = 'files',
    schema,
  } = options;

  try {
    const formData = await request.formData();
    const files = formData.getAll(fieldName);
    
    if (files.length === 0) {
      throw new ValidationError(
        `No files provided in field '${fieldName}'`,
        fieldName,
        'FILES_REQUIRED'
      );
    }
    
    // Ensure all entries are files
    const fileObjects = files.filter((f): f is File => f instanceof File);
    if (fileObjects.length !== files.length) {
      throw new ValidationError(
        'Invalid file data',
        fieldName,
        'INVALID_FILE_DATA'
      );
    }
    
    // Validate files
    const { validateMultipleFileUploads: validateFiles } = await import('@/lib/input-validation');
    validateFiles(
      fileObjects.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
      })),
      allowedTypes,
      maxSize,
      maxFiles
    );
    
    // Validate additional form data if schema provided
    let validatedFormData;
    if (schema) {
      const formDataObj: Record<string, any> = {};
      formData.forEach((value, key) => {
        if (key !== fieldName) {
          formDataObj[key] = value;
        }
      });
      validatedFormData = validateSchema(schema, formDataObj);
    }
    
    return {
      data: {
        files: fileObjects,
        formData: validatedFormData,
      },
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        error: NextResponse.json(
          {
            error: error.message,
            field: error.field,
            code: error.code,
          },
          { status: 400 }
        ),
      };
    }
    
    return {
      error: NextResponse.json(
        { error: 'Invalid file upload' },
        { status: 400 }
      ),
    };
  }
}
