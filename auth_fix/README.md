# AWS SDK Client Component Fix

## Files in this package:
- New API routes: `api/auth/login/route.ts`, `api/auth/logout/route.ts`, `api/auth/validate/route.ts`
- Modified: `contexts/AuthContext.tsx` (removed AWS SDK imports, uses fetch)
- Modified AWS files: Added `import 'server-only';` to cognito-auth.ts, dynamodb-sessions.ts, s3-service.ts, parameter-store.ts
- New: `next.config.js` (externalizes AWS SDK)

## Steps after copying:
1. Run: `npm install server-only`
2. Test: `npm run build`

## What this fixes:
- Removes AWS SDK from client components
- Moves all AWS operations to server-side API routes
- Prevents "server-only" and "http2 module not found" errors
