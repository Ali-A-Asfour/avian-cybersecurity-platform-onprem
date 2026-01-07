/**
 * Input Validation Utilities
 * 
 * Provides comprehensive input validation, sanitization, and schema validation
 * for API endpoints.
 * 
 * Requirements:
 * - 15.1: Request body size limits
 * - 15.2: Schema validation for all API inputs
 * - 15.4: HTML sanitization for user input
 * - 15.5: File upload validation
 */

import { z, ZodSchema } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Body size limits (in bytes)
 * Requirement 15.1: Request body size limits
 */
export const BODY_SIZE_LIMITS = {
  DEFAULT: 1024 * 1024, // 1MB default
  JSON: 1024 * 1024, // 1MB for JSON
  FILE_UPLOAD: 10 * 1024 * 1024, // 10MB for file uploads
  MULTIPART: 50 * 1024 * 1024, // 50MB for multipart (multiple files)
} as const;

/**
 * Allowed file types for uploads
 * Requirement 15.5: File upload validation
 */
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  SPREADSHEETS: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  TEXT: ['text/plain', 'text/csv'],
} as const;

/**
 * Maximum file sizes by type (in bytes)
 * Requirement 15.5: File upload validation
 */
export const MAX_FILE_SIZES = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  SPREADSHEET: 10 * 1024 * 1024, // 10MB
  TEXT: 1024 * 1024, // 1MB
} as const;

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * Requirement 15.4: HTML sanitization for user input
 * 
 * @param input - Raw HTML string
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize plain text input
 * Removes all HTML tags and dangerous characters
 * Requirement 15.4: HTML sanitization for user input
 * 
 * @param input - Raw text string
 * @returns Sanitized text string
 */
export function sanitizeText(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize object recursively
 * Applies text sanitization to all string values
 * Requirement 15.4: HTML sanitization for user input
 * 
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'object' && item !== null 
          ? sanitizeObject(item)
          : typeof item === 'string'
          ? sanitizeText(item)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Validate request body size
 * Requirement 15.1: Request body size limits
 * 
 * @param body - Request body string
 * @param maxSize - Maximum allowed size in bytes
 * @throws ValidationError if body exceeds size limit
 */
export function validateBodySize(body: string, maxSize: number = BODY_SIZE_LIMITS.DEFAULT): void {
  const bodySize = Buffer.byteLength(body, 'utf8');
  
  if (bodySize > maxSize) {
    throw new ValidationError(
      `Request body too large: ${bodySize} bytes (max: ${maxSize} bytes)`,
      undefined,
      'BODY_TOO_LARGE'
    );
  }
}

/**
 * Validate and parse JSON with size limit
 * Requirement 15.1: Request body size limits
 * Requirement 15.2: Schema validation for all API inputs
 * 
 * @param body - Request body string
 * @param maxSize - Maximum allowed size in bytes
 * @returns Parsed JSON object
 * @throws ValidationError if body is invalid or too large
 */
export function validateAndParseJson<T = any>(
  body: string,
  maxSize: number = BODY_SIZE_LIMITS.JSON
): T {
  validateBodySize(body, maxSize);
  
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    throw new ValidationError(
      'Invalid JSON in request body',
      undefined,
      'INVALID_JSON'
    );
  }
}

/**
 * Validate data against Zod schema
 * Requirement 15.2: Schema validation for all API inputs
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and typed data
 * @throws ValidationError if validation fails
 */
export function validateSchema<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (!error.issues || error.issues.length === 0) {
        throw new ValidationError(
          'Schema validation failed',
          undefined,
          'SCHEMA_VALIDATION_FAILED'
        );
      }
      const firstError = error.issues[0];
      const fieldPath = firstError.path.length > 0 ? firstError.path.join('.') : undefined;
      throw new ValidationError(
        firstError.message,
        fieldPath,
        'SCHEMA_VALIDATION_FAILED'
      );
    }
    throw error;
  }
}

/**
 * Validate file upload
 * Requirement 15.5: File upload validation
 * 
 * @param file - File object with name, type, and size
 * @param allowedTypes - Array of allowed MIME types
 * @param maxSize - Maximum file size in bytes
 * @throws ValidationError if file is invalid
 */
export function validateFileUpload(
  file: { name: string; type: string; size: number },
  allowedTypes: readonly string[],
  maxSize: number
): void {
  // Validate file type
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError(
      `Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`,
      'file',
      'INVALID_FILE_TYPE'
    );
  }
  
  // Validate file size
  if (file.size > maxSize) {
    throw new ValidationError(
      `File too large: ${file.size} bytes (max: ${maxSize} bytes)`,
      'file',
      'FILE_TOO_LARGE'
    );
  }
  
  // Validate file extension matches MIME type
  const extension = file.name.split('.').pop()?.toLowerCase();
  const expectedExtensions = getExpectedExtensions(file.type);
  
  if (extension && !expectedExtensions.includes(extension)) {
    throw new ValidationError(
      `File extension .${extension} does not match MIME type ${file.type}`,
      'file',
      'EXTENSION_MISMATCH'
    );
  }
}

/**
 * Get expected file extensions for a MIME type
 * 
 * @param mimeType - MIME type
 * @returns Array of expected file extensions
 */
function getExpectedExtensions(mimeType: string): string[] {
  const extensionMap: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
    'application/msword': ['doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
    'application/vnd.ms-excel': ['xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'text/plain': ['txt'],
    'text/csv': ['csv'],
  };
  
  return extensionMap[mimeType] || [];
}

/**
 * Validate multiple file uploads
 * Requirement 15.5: File upload validation
 * 
 * @param files - Array of file objects
 * @param allowedTypes - Array of allowed MIME types
 * @param maxSize - Maximum file size per file in bytes
 * @param maxFiles - Maximum number of files allowed
 * @throws ValidationError if any file is invalid
 */
export function validateMultipleFileUploads(
  files: Array<{ name: string; type: string; size: number }>,
  allowedTypes: readonly string[],
  maxSize: number,
  maxFiles: number = 10
): void {
  // Validate number of files
  if (files.length > maxFiles) {
    throw new ValidationError(
      `Too many files: ${files.length} (max: ${maxFiles})`,
      'files',
      'TOO_MANY_FILES'
    );
  }
  
  // Validate each file
  files.forEach((file, index) => {
    try {
      validateFileUpload(file, allowedTypes, maxSize);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(
          `File ${index + 1} (${file.name}): ${error.message}`,
          `files[${index}]`,
          error.code
        );
      }
      throw error;
    }
  });
  
  // Validate total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > BODY_SIZE_LIMITS.MULTIPART) {
    throw new ValidationError(
      `Total upload size too large: ${totalSize} bytes (max: ${BODY_SIZE_LIMITS.MULTIPART} bytes)`,
      'files',
      'TOTAL_SIZE_TOO_LARGE'
    );
  }
}

/**
 * Common validation schemas
 * Requirement 15.2: Schema validation for all API inputs
 */
export const commonSchemas = {
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  uuid: z.string().uuid(),
  url: z.string().url().max(2048),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  date: z.string().datetime(),
  positiveInteger: z.number().int().positive(),
  nonNegativeInteger: z.number().int().min(0),
};
