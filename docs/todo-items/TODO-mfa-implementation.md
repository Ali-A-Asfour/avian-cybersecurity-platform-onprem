# TODO: MFA Implementation

## Status
**DEFERRED** - Skipped for now to focus on core functionality

## Overview
Task 6 in the self-hosted security migration involves implementing Multi-Factor Authentication (MFA) using TOTP (Time-based One-Time Password) with QR codes and backup codes.

## Requirements
From `.kiro/specs/self-hosted-security-migration/requirements.md`:
- **Requirement 4.1**: TOTP-based MFA support
- **Requirement 4.2**: QR code generation for MFA setup
- **Requirement 4.3**: Backup code generation (10 codes)
- **Requirement 4.4**: MFA secret encryption at rest
- **Requirement 4.5**: MFA requirement after password verification
- **Requirement 4.6**: TOTP validation with time window (±1 period)
- **Requirement 4.7**: MFA data encryption
- **Requirement 4.8**: Backup code invalidation after use

## Implementation Tasks
From `.kiro/specs/self-hosted-security-migration/tasks.md`:

### Task 6.1: Implement TOTP-based MFA
- Install otplib and qrcode libraries
- Create MFA setup endpoint (generate secret, QR code)
- Create MFA verification endpoint
- Implement backup code generation (10 codes)
- Encrypt MFA secrets and backup codes at rest

### Task 6.2: Write property tests for MFA
- **Property 17**: TOTP Secret Generation
- **Property 18**: QR Code Generation
- **Property 19**: Backup Code Generation
- **Property 22**: MFA Data Encryption

### Task 6.3: Implement MFA login flow
- Add MFA requirement check after password verification
- Implement TOTP validation with time window (±1 period)
- Implement backup code validation and invalidation
- Update login endpoint to handle MFA

### Task 6.4: Write property tests for MFA login
- **Property 20**: MFA Requirement After Password
- **Property 21**: TOTP Time Window Validation
- **Property 23**: Backup Code Invalidation

## Database Schema
The database already has MFA fields in the `users` table:
- `mfa_enabled` (boolean)
- `mfa_secret` (text) - Encrypted TOTP secret
- `mfa_backup_codes` (jsonb) - Array of encrypted backup codes
- `mfa_setup_completed` (boolean)

## Libraries to Install
```bash
npm install otplib qrcode
npm install --save-dev @types/qrcode
```

## Implementation Notes

### TOTP Secret Generation
- Use `otplib` to generate TOTP secrets
- Secrets should be 32 characters (base32 encoded)
- Store encrypted in database using KMS or similar

### QR Code Generation
- Use `qrcode` library to generate QR codes
- Format: `otpauth://totp/AVIAN:user@example.com?secret=SECRET&issuer=AVIAN`
- Return as data URL or SVG

### Backup Codes
- Generate 10 random backup codes (8-10 characters each)
- Hash each code before storing (like passwords)
- Mark as used when consumed
- Allow regeneration of all codes

### Encryption
- Encrypt MFA secrets before storing in database
- Encrypt backup codes before storing
- Use environment variable for encryption key
- Consider using `crypto` module for encryption

### Time Window
- TOTP codes are valid for 30 seconds
- Allow ±1 period (90 seconds total window)
- Prevents clock drift issues

## Testing Strategy
- Property tests for secret generation (uniqueness, format)
- Property tests for QR code generation (valid format)
- Property tests for backup code generation (uniqueness, count)
- Property tests for TOTP validation (time window)
- Property tests for backup code invalidation
- Integration tests for complete MFA flow

## Priority
**Medium** - MFA is important for security but not critical for MVP. Core authentication is working without it.

## Related Files
- `src/lib/auth-service.ts` - Will need MFA methods
- `database/schemas/main.ts` - Already has MFA fields
- `.kiro/specs/self-hosted-security-migration/tasks.md` - Task 6
- `.kiro/specs/self-hosted-security-migration/requirements.md` - Requirements 4.1-4.8
- `.kiro/specs/self-hosted-security-migration/design.md` - MFA design details

## When to Implement
Implement MFA after:
1. Core authentication is stable and tested ✅
2. Email service is implemented (for MFA setup notifications)
3. User management is complete
4. Basic security features are in place

Or implement MFA when:
- Security requirements mandate it
- User requests it
- Moving to production deployment

## Estimated Effort
- Implementation: 4-6 hours
- Testing: 2-3 hours
- Total: 6-9 hours
