# Input Validation Guide

This document provides comprehensive guidance on implementing input validation in the AVIAN platform.

## Overview

The input validation system provides:
- **Request body size limits** (Requirement 15.1)
- **Schema validation** for all API inputs (Requirement 15.2)
- **HTML sanitization** for user input (Requirement 15.4)
- **File upload validation** (Requirement 15.5)

## Components

### 1. Input Validation Library (`src/lib/input-validation.ts`)

Core validation utilities:
- `sanitizeHtml()` - Sanitize HTML content (allows safe tags)
- `sanitizeText()` - Remove all HTML tags
- `sanitizeObject()` - Recursively sanitize object properties
- `validateBodySize()` - Check request body size
- `validateAndParseJson()` - Parse and validate JSON
- `validateSchema()` - Validate against Zod schema
- `validateFileUpload()` - Validate single file upload
- `validateMultipleFileUploads()` - Validate multiple file uploads

### 2. Validation Middleware (`src/middleware/validation.middleware.ts`)

Middleware functions for API routes:
- `validateRequest()` - Validate request body with schema and sanitization
- `validateQueryParams()` - Validate query parameters
- `validateFileUpload()` - Validate file upload from FormData
- `validateMultipleFileUploads()` - Validate multiple file uploads

## Usage Examples

### Basic Request Validation

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/middleware/validation.middleware';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
});

export async function POST(request: NextRequest) {
  const result = await validateRequest(request, {
    schema: loginSchema,
    sanitize: true,
  });

  if (result.error) {
    return result.error;
  }

  const { email, password } = result.data;
  // ... handle login
}
```

### Query Parameter Validation

```typescript
import { validateQueryParams } from '@/middleware/validation.middleware';

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number),
  limit: z.string().regex(/^\d+$/).transform(Number),
});

export async function GET(request: NextRequest) {
  const result = validateQueryParams(request, querySchema);

  if (result.error) {
    return result.error;
  }

  const { page, limit } = result.data;
  // ... handle request
}
```

### File Upload Validation

```typescript
import { validateFileUpload } from '@/middleware/validation.middleware';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZES } from '@/lib/input-validation';

export async function POST(request: NextRequest) {
  const result = await validateFileUpload(request, {
    allowedTypes: ALLOWED_FILE_TYPES.IMAGES,
    maxSize: MAX_FILE_SIZES.IMAGE,
    fieldName: 'avatar',
  });

  if (result.error) {
    return result.error;
  }

  const { file } = result.data;
  // ... handle file upload
}
```

### Multiple File Upload Validation

```typescript
import { validateMultipleFileUploads } from '@/middleware/validation.middleware';

export async function POST(request: NextRequest) {
  const result = await validateMultipleFileUploads(request, {
    allowedTypes: ALLOWED_FILE_TYPES.DOCUMENTS,
    maxSize: MAX_FILE_SIZES.DOCUMENT,
    maxFiles: 5,
    fieldName: 'documents',
  });

  if (result.error) {
    return result.error;
  }

  const { files } = result.data;
  // ... handle file uploads
}
```

## Body Size Limits

Default limits (Requirement 15.1):
- **JSON requests**: 1MB
- **File uploads**: 10MB per file
- **Multipart uploads**: 50MB total

Configure in `next.config.ts`:
```typescript
api: {
  bodyParser: {
    sizeLimit: '1mb',
  },
},
```

## HTML Sanitization

The sanitization system (Requirement 15.4) provides three levels:

### 1. HTML Sanitization (`sanitizeHtml`)
Allows safe HTML tags:
- Text formatting: `<b>`, `<i>`, `<em>`, `<strong>`
- Links: `<a>` (with `href`, `target`, `rel` attributes)
- Structure: `<p>`, `<br>`, `<ul>`, `<ol>`, `<li>`

```typescript
import { sanitizeHtml } from '@/lib/input-validation';

const userInput = '<p>Hello <script>alert("xss")</script></p>';
const safe = sanitizeHtml(userInput);
// Result: '<p>Hello </p>'
```

### 2. Text Sanitization (`sanitizeText`)
Removes all HTML tags:

```typescript
import { sanitizeText } from '@/lib/input-validation';

const userInput = '<p>Hello <b>World</b></p>';
const safe = sanitizeText(userInput);
// Result: 'Hello World'
```

### 3. Object Sanitization (`sanitizeObject`)
Recursively sanitizes all string properties:

```typescript
import { sanitizeObject } from '@/lib/input-validation';

const userInput = {
  name: '<script>alert("xss")</script>John',
  bio: '<p>Developer</p>',
  nested: {
    field: '<b>Value</b>',
  },
};

const safe = sanitizeObject(userInput);
// All string values are sanitized
```

## Schema Validation

Use Zod schemas for type-safe validation (Requirement 15.2):

### Common Schemas

```typescript
import { commonSchemas } from '@/lib/input-validation';

// Pre-defined schemas
commonSchemas.email        // Email validation
commonSchemas.password     // Password (12-128 chars)
commonSchemas.username     // Username (3-50 chars, alphanumeric)
commonSchemas.uuid         // UUID validation
commonSchemas.url          // URL validation
commonSchemas.phoneNumber  // Phone number validation
commonSchemas.date         // ISO datetime validation
```

### Custom Schemas

```typescript
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  age: z.number().int().min(18).max(120),
  role: z.enum(['user', 'admin', 'moderator']),
  preferences: z.object({
    notifications: z.boolean(),
    theme: z.enum(['light', 'dark']),
  }).optional(),
});
```

## File Upload Validation

File validation (Requirement 15.5) checks:
1. **MIME type** - Must be in allowed types list
2. **File size** - Must not exceed maximum size
3. **Extension match** - File extension must match MIME type
4. **Total size** - For multiple uploads, total size must not exceed limit

### Allowed File Types

```typescript
import { ALLOWED_FILE_TYPES } from '@/lib/input-validation';

ALLOWED_FILE_TYPES.IMAGES       // JPEG, PNG, GIF, WebP
ALLOWED_FILE_TYPES.DOCUMENTS    // PDF, DOC, DOCX
ALLOWED_FILE_TYPES.SPREADSHEETS // XLS, XLSX
ALLOWED_FILE_TYPES.TEXT         // TXT, CSV
```

### Maximum File Sizes

```typescript
import { MAX_FILE_SIZES } from '@/lib/input-validation';

MAX_FILE_SIZES.IMAGE       // 5MB
MAX_FILE_SIZES.DOCUMENT    // 10MB
MAX_FILE_SIZES.SPREADSHEET // 10MB
MAX_FILE_SIZES.TEXT        // 1MB
```

## Error Handling

All validation functions throw `ValidationError` with:
- `message` - Human-readable error message
- `field` - Field name that failed validation (optional)
- `code` - Error code for programmatic handling

```typescript
try {
  validateSchema(schema, data);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Error:', error.message);
    console.log('Field:', error.field);
    console.log('Code:', error.code);
  }
}
```

### Error Codes

- `BODY_TOO_LARGE` - Request body exceeds size limit
- `INVALID_JSON` - Invalid JSON in request body
- `SCHEMA_VALIDATION_FAILED` - Data doesn't match schema
- `INVALID_FILE_TYPE` - File type not allowed
- `FILE_TOO_LARGE` - File exceeds size limit
- `EXTENSION_MISMATCH` - File extension doesn't match MIME type
- `TOO_MANY_FILES` - Too many files in upload
- `TOTAL_SIZE_TOO_LARGE` - Total upload size exceeds limit

## Middleware Response Format

Validation middleware returns errors in consistent format:

```json
{
  "error": "Validation error message",
  "field": "fieldName",
  "code": "ERROR_CODE"
}
```

HTTP status code: `400 Bad Request`

## Best Practices

1. **Always validate input** - Never trust user input
2. **Use schemas** - Define clear validation rules with Zod
3. **Sanitize HTML** - Always sanitize user-provided HTML content
4. **Check file types** - Validate both MIME type and extension
5. **Limit sizes** - Enforce reasonable size limits
6. **Provide clear errors** - Return helpful error messages
7. **Log validation failures** - Track validation failures for security monitoring

## Testing

Property tests are provided in `src/lib/__tests__/input-validation.property.test.ts`:
- 20 property tests covering all validation scenarios
- Tests for HTML sanitization, body size limits, schema validation, and file uploads
- All tests passing

Run tests:
```bash
npm test -- input-validation.property.test.ts
```

## Security Considerations

1. **XSS Prevention** - HTML sanitization removes dangerous tags and attributes
2. **DoS Prevention** - Body size limits prevent memory exhaustion
3. **File Upload Security** - MIME type and extension validation prevent malicious uploads
4. **Schema Validation** - Type checking prevents injection attacks
5. **Error Messages** - Don't expose sensitive information in error messages

## Integration with Existing Code

To add validation to existing API routes:

1. Import validation middleware
2. Define Zod schema for request
3. Call `validateRequest()` at start of handler
4. Check for `result.error` and return if present
5. Use `result.data` for validated input

Example:
```typescript
// Before
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;
  // ... handle request
}

// After
export async function POST(request: NextRequest) {
  const result = await validateRequest(request, {
    schema: loginSchema,
    sanitize: true,
  });

  if (result.error) {
    return result.error;
  }

  const { email, password } = result.data;
  // ... handle request
}
```

## Requirements Traceability

- **Requirement 15.1**: Body size limits implemented in `next.config.ts` and `validateBodySize()`
- **Requirement 15.2**: Schema validation implemented with Zod in `validateSchema()`
- **Requirement 15.4**: HTML sanitization implemented with DOMPurify in `sanitizeHtml()`, `sanitizeText()`, `sanitizeObject()`
- **Requirement 15.5**: File upload validation implemented in `validateFileUpload()` and `validateMultipleFileUploads()`
