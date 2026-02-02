# Help Desk Error Handling and Validation

This directory contains comprehensive error handling and validation utilities specifically designed for the help desk system. The implementation provides robust error recovery, user-friendly error messages, and graceful degradation when services are unavailable.

## Overview

The help desk error handling system consists of several key components:

1. **Input Validation** - Comprehensive validation using Zod schemas
2. **Business Rule Validation** - Domain-specific validation logic
3. **Error Handling** - Structured error types and user-friendly messages
4. **File Upload Handling** - Secure file upload with validation and retry logic
5. **Notification Service** - Email notifications with retry and fallback mechanisms
6. **React Error Boundaries** - UI error handling and recovery

## Components

### Error Handling (`error-handling.ts`)

The core error handling module provides:

- **HelpDeskErrorCode**: Enum of help desk specific error codes
- **HelpDeskValidationSchemas**: Zod schemas for input validation
- **HelpDeskBusinessRules**: Business logic validation
- **HelpDeskValidator**: Input validation and sanitization utilities
- **HelpDeskErrors**: Error factory for creating structured errors
- **HelpDeskRetryManager**: Retry mechanism for external services

#### Usage Example

```typescript
import { HelpDeskValidator, HelpDeskErrors } from '@/lib/help-desk/error-handling';

// Validate ticket creation
const validation = HelpDeskValidator.validateTicketCreation(requestData);
if (!validation.valid) {
  throw ApiErrors.validation('Invalid ticket data', { errors: validation.errors });
}

// Business rule validation
const assignmentValidation = HelpDeskBusinessRules.validateTicketAssignment(
  ticket, 
  userId, 
  userRole
);
if (!assignmentValidation.valid) {
  throw HelpDeskErrors.ticketAlreadyAssigned(ticket.assignee);
}
```

### File Upload Handler (`file-upload-handler.ts`)

Handles file uploads with comprehensive validation and error recovery:

- File size and type validation
- Attachment limit enforcement
- Retry mechanism for upload failures
- Secure filename generation
- Cleanup on errors

#### Usage Example

```typescript
import { HelpDeskFileUploadHandler } from '@/lib/help-desk/file-upload-handler';

const uploadResult = await HelpDeskFileUploadHandler.uploadFile(
  file,
  ticketId,
  userId,
  existingAttachmentCount
);

if (!uploadResult.success) {
  // Handle validation errors or upload failures
  console.error('Upload failed:', uploadResult.error);
}
```

### Notification Service (`notification-service.ts`)

Email notification service with retry logic and graceful degradation:

- Template-based email generation
- Retry mechanism for delivery failures
- Service availability checking
- Notification queuing when service is unavailable

#### Usage Example

```typescript
import { HelpDeskNotificationService } from '@/lib/help-desk/notification-service';

// Send ticket creation notification
await HelpDeskNotificationService.sendTicketCreatedNotification({
  ticketId: ticket.id,
  ticketTitle: ticket.title,
  requesterEmail: user.email,
  tenantName: tenant.name,
  // ... other context
});
```

### React Error Boundaries (`ErrorBoundary.tsx`)

React components for handling UI errors gracefully:

- **HelpDeskErrorBoundaryComponent**: Class-based error boundary
- **HelpDeskErrorDisplay**: Simple error display component
- **HelpDeskLoadingWithError**: Loading state with error fallback
- **withHelpDeskErrorBoundary**: HOC for wrapping components

#### Usage Example

```tsx
import { HelpDeskErrorBoundaryComponent, HelpDeskErrorDisplay } from '@/components/help-desk/ErrorBoundary';

// Wrap components with error boundary
<HelpDeskErrorBoundaryComponent>
  <TicketForm />
</HelpDeskErrorBoundaryComponent>

// Display specific errors
{error && (
  <HelpDeskErrorDisplay
    error={error}
    onRetry={handleRetry}
    onDismiss={handleDismiss}
  />
)}
```

### Validation Messages (`ValidationMessage.tsx`)

Reusable components for displaying validation errors:

- **ValidationMessage**: Single validation message
- **ValidationMessages**: Multiple validation messages
- **FieldValidation**: Field-level validation display
- **FormValidationSummary**: Form-wide validation summary

#### Usage Example

```tsx
import { ValidationMessages, FieldValidation } from '@/components/help-desk/ValidationMessage';

// Display field validation
<FieldValidation 
  error={fieldError}
  warning={fieldWarning}
/>

// Display multiple validation errors
<ValidationMessages 
  messages={validationErrors}
  type="error"
/>
```

## Error Types

### Help Desk Specific Errors

- `INVALID_TICKET_DATA` - Invalid ticket creation/update data
- `TICKET_NOT_FOUND` - Ticket does not exist
- `TICKET_ALREADY_ASSIGNED` - Ticket is already assigned to another user
- `INVALID_STATE_TRANSITION` - Invalid ticket status transition
- `FILE_TOO_LARGE` - Uploaded file exceeds size limit
- `INVALID_FILE_TYPE` - Unsupported file type
- `EMAIL_SERVICE_UNAVAILABLE` - Email service is down
- `QUEUE_ACCESS_DENIED` - User cannot access ticket queue/category

### Standard API Errors

The system also uses standard API error codes from `@/lib/api-errors`:

- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `VALIDATION_ERROR` - Input validation failed
- `NOT_FOUND` - Resource not found
- `INTERNAL_ERROR` - Server error

## Validation Schemas

### Ticket Creation

```typescript
{
  title: string (1-200 chars, required),
  description: string (1-5000 chars, required),
  impactLevel: 'critical' | 'medium' | 'low' (required),
  deviceId: string (optional, alphanumeric + hyphens/underscores),
  contactMethod: 'email' | 'phone' (default: 'email'),
  phoneNumber: string (required if contactMethod is 'phone')
}
```

### Ticket Resolution

```typescript
{
  resolution: string (10-2000 chars, required),
  createKnowledgeArticle: boolean (default: false),
  knowledgeArticleTitle: string (required if createKnowledgeArticle is true)
}
```

### File Upload

```typescript
{
  filename: string (required),
  size: number (1 byte - 10MB),
  mimeType: string (must be in allowed types list)
}
```

## Business Rules

### Ticket Assignment

- Tickets can only be assigned if currently unassigned
- Users can only assign tickets in categories they have access to
- IT Help Desk Analysts: IT Support, Hardware, Software categories
- Security Analysts: Security Incident, Compliance categories
- Tenant/Super Admins: All categories

### State Transitions

Valid ticket state transitions:
- `NEW` → `IN_PROGRESS`, `RESOLVED`
- `IN_PROGRESS` → `WAITING_ON_USER`, `RESOLVED`, `NEW`
- `WAITING_ON_USER` → `IN_PROGRESS`, `RESOLVED`
- `RESOLVED` → `IN_PROGRESS`, `CLOSED`
- `CLOSED` → (no transitions allowed)

Special rules:
- Resolution description required when transitioning to `RESOLVED`
- Only help desk analysts can close tickets
- Users cannot directly close tickets

### File Upload Rules

- Maximum file size: 10MB
- Maximum attachments per ticket: 5
- Allowed file types: Images (JPEG, PNG, GIF, WebP), PDF, Text, Word documents
- Filename sanitization to prevent security issues

## Error Recovery Strategies

### Retry Mechanisms

The system implements exponential backoff retry for:
- Email service failures
- File upload failures
- Database connection issues
- External service calls

Default retry configuration:
- Maximum retries: 3
- Base delay: 1 second
- Exponential backoff multiplier: 2
- Maximum delay: 30 seconds

### Graceful Degradation

When services are unavailable:
- Email notifications are queued for later delivery
- File uploads show clear error messages with retry options
- UI components display fallback content
- Non-critical errors don't block core functionality

### User Experience

- Clear, non-technical error messages
- Actionable error recovery options
- Progress indicators for long-running operations
- Validation feedback in real-time
- Consistent error styling across the application

## Testing

The error handling system includes comprehensive tests:

- Unit tests for validation logic
- Integration tests for API error handling
- Property-based tests for business rules
- Component tests for UI error handling

Run tests with:
```bash
npm test src/lib/help-desk/__tests__/error-handling.test.ts
npm test src/app/api/tickets/__tests__/error-handling.integration.test.ts
```

## Configuration

### Email Service Configuration

```typescript
const notificationConfig = {
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUser: 'notifications@company.com',
  smtpPassword: 'password',
  fromEmail: 'helpdesk@company.com',
  fromName: 'Help Desk',
  retryAttempts: 3,
  retryDelay: 1000,
};

HelpDeskNotificationService.initialize(notificationConfig);
```

### File Upload Configuration

```typescript
const uploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxAttachments: 5,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  uploadPath: '/uploads/help-desk',
  retryAttempts: 3,
};
```

## Best Practices

1. **Always validate input** - Use the provided validation schemas
2. **Handle errors gracefully** - Provide clear error messages and recovery options
3. **Use structured errors** - Use the error factory functions for consistency
4. **Implement retry logic** - For external service calls and file operations
5. **Log errors appropriately** - Include context for debugging
6. **Test error scenarios** - Include error cases in your tests
7. **Provide user feedback** - Show loading states and error messages
8. **Sanitize user input** - Prevent XSS and injection attacks

## Security Considerations

- Input sanitization prevents XSS attacks
- File upload validation prevents malicious file uploads
- Filename sanitization prevents directory traversal
- Error messages don't expose sensitive information
- Rate limiting prevents abuse
- Proper authentication and authorization checks

## Performance Considerations

- Validation is performed client-side and server-side
- File uploads include progress tracking
- Retry mechanisms use exponential backoff to prevent overwhelming services
- Error boundaries prevent entire page crashes
- Caching is used for frequently accessed data

## Future Enhancements

- Integration with monitoring services (Sentry, DataDog)
- Advanced file upload features (drag & drop, multiple files)
- Real-time notification delivery status
- Enhanced error analytics and reporting
- Automated error recovery workflows
- Machine learning for error prediction and prevention