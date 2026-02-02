/**
 * Property Tests for Input Validation
 * 
 * Tests universal properties of input validation, sanitization, and file upload validation
 * 
 * Requirements tested:
 * - 15.1: Request body size limits
 * - 15.2: Schema validation for all API inputs
 * - 15.4: HTML sanitization for user input
 * - 15.5: File upload validation
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { z } from 'zod';
import {
  sanitizeHtml,
  sanitizeText,
  sanitizeObject,
  validateBodySize,
  validateAndParseJson,
  validateSchema,
  validateFileUpload,
  validateMultipleFileUploads,
  ValidationError,
  BODY_SIZE_LIMITS,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZES,
} from '../input-validation';

describe('Input Validation Property Tests', () => {
  describe('HTML Sanitization (Requirement 15.4)', () => {
    it('Property 65: HTML sanitization removes script tags', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (content) => {
            const maliciousHtml = `<script>alert('xss')</script>${content}`;
            const sanitized = sanitizeHtml(maliciousHtml);
            
            // Script tags should be removed
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).not.toContain('</script>');
            expect(sanitized).not.toContain("alert('xss')");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 66: Text sanitization removes all HTML tags', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom('div', 'span', 'script', 'img', 'a'),
          (content, tag) => {
            const html = `<${tag}>${content}</${tag}>`;
            const sanitized = sanitizeText(html);
            
            // All HTML tags should be removed
            expect(sanitized).not.toContain(`<${tag}>`);
            expect(sanitized).not.toContain(`</${tag}>`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 67: Object sanitization recursively sanitizes strings', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (key, value) => {
            const obj = {
              [key]: `<script>${value}</script>`,
              nested: {
                field: `<div>${value}</div>`,
              },
            };
            
            const sanitized = sanitizeObject(obj);
            
            // Script tags should be removed from all string values
            expect(JSON.stringify(sanitized)).not.toContain('<script>');
            expect(JSON.stringify(sanitized)).not.toContain('</script>');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 68: Sanitization preserves safe content', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.includes('<') && !s.includes('>')),
          (safeContent) => {
            const sanitized = sanitizeText(safeContent);
            
            // Safe content should be preserved
            expect(sanitized).toBe(safeContent);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Body Size Validation (Requirement 15.1)', () => {
    it('Property 69: Body size validation accepts bodies within limit', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 100 }),
          (content) => {
            const maxSize = 1024; // 1KB
            
            // Should not throw for small content
            expect(() => validateBodySize(content, maxSize)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 70: Body size validation rejects oversized bodies', () => {
      const largeContent = 'x'.repeat(2000);
      const maxSize = 1000;
      
      expect(() => validateBodySize(largeContent, maxSize)).toThrow(ValidationError);
      expect(() => validateBodySize(largeContent, maxSize)).toThrow('Request body too large');
    });

    it('Property 71: JSON parsing validates size before parsing', () => {
      const largeJson = JSON.stringify({ data: 'x'.repeat(2000) });
      const maxSize = 1000;
      
      expect(() => validateAndParseJson(largeJson, maxSize)).toThrow(ValidationError);
      expect(() => validateAndParseJson(largeJson, maxSize)).toThrow('Request body too large');
    });

    it('Property 72: JSON parsing rejects invalid JSON', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => {
            try {
              JSON.parse(s);
              return false;
            } catch (error) {
              return true;
            }
          }),
          (invalidJson) => {
            expect(() => validateAndParseJson(invalidJson)).toThrow(ValidationError);
            expect(() => validateAndParseJson(invalidJson)).toThrow('Invalid JSON');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Schema Validation (Requirement 15.2)', () => {
    it('Property 73: Schema validation accepts valid data', () => {
      const schema = z.object({
        username: z.string().min(3).max(20),
        age: z.number().int().positive(),
      });

      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
          fc.integer({ min: 1, max: 120 }),
          (username, age) => {
            const data = { username, age };
            const result = validateSchema(schema, data);
            
            expect(result).toEqual(data);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 74: Schema validation rejects invalid data', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().int().positive(),
      });

      fc.assert(
        fc.property(
          fc.string().filter(s => !s.includes('@') && s.length > 0),
          (invalidEmail) => {
            const data = { email: invalidEmail, age: 25 };
            
            expect(() => validateSchema(schema, data)).toThrow(ValidationError);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 75: Schema validation provides field information', () => {
      const schema = z.object({
        username: z.string().min(3),
      });

      try {
        validateSchema(schema, { username: 'ab' });
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).field).toBe('username');
      }
    });
  });

  describe('File Upload Validation (Requirement 15.5)', () => {
    it('Property 76: File validation accepts valid files', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_FILE_TYPES.IMAGES),
          fc.integer({ min: 1, max: MAX_FILE_SIZES.IMAGE }),
          (mimeType, size) => {
            const extension = mimeType.split('/')[1];
            const file = {
              name: `test.${extension}`,
              type: mimeType,
              size,
            };
            
            expect(() => 
              validateFileUpload(file, ALLOWED_FILE_TYPES.IMAGES, MAX_FILE_SIZES.IMAGE)
            ).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 77: File validation rejects invalid MIME types', () => {
      const file = {
        name: 'test.exe',
        type: 'application/x-msdownload',
        size: 1000,
      };
      
      expect(() => 
        validateFileUpload(file, ALLOWED_FILE_TYPES.IMAGES, MAX_FILE_SIZES.IMAGE)
      ).toThrow(ValidationError);
      expect(() => 
        validateFileUpload(file, ALLOWED_FILE_TYPES.IMAGES, MAX_FILE_SIZES.IMAGE)
      ).toThrow('Invalid file type');
    });

    it('Property 78: File validation rejects oversized files', () => {
      const file = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: MAX_FILE_SIZES.IMAGE + 1,
      };
      
      expect(() => 
        validateFileUpload(file, ALLOWED_FILE_TYPES.IMAGES, MAX_FILE_SIZES.IMAGE)
      ).toThrow(ValidationError);
      expect(() => 
        validateFileUpload(file, ALLOWED_FILE_TYPES.IMAGES, MAX_FILE_SIZES.IMAGE)
      ).toThrow('File too large');
    });

    it('Property 79: File validation checks extension-MIME type match', () => {
      const file = {
        name: 'test.jpg',
        type: 'image/png', // Mismatch: .jpg extension but PNG MIME type
        size: 1000,
      };
      
      expect(() => 
        validateFileUpload(file, ALLOWED_FILE_TYPES.IMAGES, MAX_FILE_SIZES.IMAGE)
      ).toThrow(ValidationError);
      expect(() => 
        validateFileUpload(file, ALLOWED_FILE_TYPES.IMAGES, MAX_FILE_SIZES.IMAGE)
      ).toThrow('does not match MIME type');
    });

    it('Property 80: Multiple file validation enforces file count limit', () => {
      const maxFiles = 5;
      const files = Array.from({ length: maxFiles + 1 }, (_, i) => ({
        name: `test${i}.jpg`,
        type: 'image/jpeg',
        size: 1000,
      }));
      
      expect(() => 
        validateMultipleFileUploads(
          files,
          ALLOWED_FILE_TYPES.IMAGES,
          MAX_FILE_SIZES.IMAGE,
          maxFiles
        )
      ).toThrow(ValidationError);
      expect(() => 
        validateMultipleFileUploads(
          files,
          ALLOWED_FILE_TYPES.IMAGES,
          MAX_FILE_SIZES.IMAGE,
          maxFiles
        )
      ).toThrow('Too many files');
    });

    it('Property 81: Multiple file validation enforces total size limit', () => {
      // Create files that individually are valid but exceed total limit
      const fileSize = 15 * 1024 * 1024; // 15MB each
      const files = Array.from({ length: 4 }, (_, i) => ({
        name: `test${i}.jpg`,
        type: 'image/jpeg',
        size: fileSize,
      }));
      
      // Total: 60MB, exceeds BODY_SIZE_LIMITS.MULTIPART (50MB)
      expect(() => 
        validateMultipleFileUploads(
          files,
          ALLOWED_FILE_TYPES.IMAGES,
          20 * 1024 * 1024 // 20MB per file is OK
        )
      ).toThrow(ValidationError);
      expect(() => 
        validateMultipleFileUploads(
          files,
          ALLOWED_FILE_TYPES.IMAGES,
          20 * 1024 * 1024
        )
      ).toThrow('Total upload size too large');
    });

    it('Property 82: Multiple file validation validates each file individually', () => {
      const files = [
        { name: 'valid.jpg', type: 'image/jpeg', size: 1000 },
        { name: 'invalid.exe', type: 'application/x-msdownload', size: 1000 },
      ];
      
      expect(() => 
        validateMultipleFileUploads(
          files,
          ALLOWED_FILE_TYPES.IMAGES,
          MAX_FILE_SIZES.IMAGE
        )
      ).toThrow(ValidationError);
      expect(() => 
        validateMultipleFileUploads(
          files,
          ALLOWED_FILE_TYPES.IMAGES,
          MAX_FILE_SIZES.IMAGE
        )
      ).toThrow('File 2');
    });
  });

  describe('Validation Error Handling', () => {
    it('Property 83: ValidationError includes error code', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          (message, field, code) => {
            const error = new ValidationError(message, field, code);
            
            expect(error.message).toBe(message);
            expect(error.field).toBe(field);
            expect(error.code).toBe(code);
            expect(error.name).toBe('ValidationError');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 84: Validation errors are catchable', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      fc.assert(
        fc.property(
          fc.string().filter(s => !s.includes('@')),
          (invalidEmail) => {
            let caught = false;
            
            try {
              validateSchema(schema, { email: invalidEmail });
            } catch (error) {
              if (error instanceof ValidationError) {
                caught = true;
              }
            }
            
            expect(caught).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
