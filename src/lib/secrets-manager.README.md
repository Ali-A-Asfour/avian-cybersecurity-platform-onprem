# AWS Secrets Manager - Microsoft Credentials

## Overview

This module provides secure storage and retrieval of Microsoft Graph API credentials for the EDR integration. Credentials are stored per-tenant in AWS Secrets Manager with automatic caching and IAM-based access control.

## Secret Structure

### Naming Convention
```
edr/tenant/{tenantId}/microsoft-credentials
```

Example:
```
edr/tenant/123e4567-e89b-12d3-a456-426614174000/microsoft-credentials
```

### Secret Format
```json
{
  "clientId": "abc123-def456-ghi789",
  "clientSecret": "secret~value~here",
  "tenantId": "987fcdeb-51a2-43f7-9876-543210fedcba",
  "authority": "https://login.microsoftonline.com"
}
```

**Required Fields:**
- `clientId`: Azure AD application (client) ID
- `clientSecret`: Azure AD application client secret
- `tenantId`: Microsoft tenant ID (not AVIAN tenant ID)

**Optional Fields:**
- `authority`: OAuth authority URL (defaults to `https://login.microsoftonline.com`)

## Usage

### Retrieve Credentials

```typescript
import { getCredentials } from '@/lib/secrets-manager';

// In polling worker
const credentials = await getCredentials(tenantId);
console.log(credentials.clientId); // "abc123..."
```

### Store/Update Credentials

```typescript
import { storeCredentials } from '@/lib/secrets-manager';

// Create or update credentials
await storeCredentials(tenantId, {
  clientId: 'abc123-def456-ghi789',
  clientSecret: 'secret~value~here',
  tenantId: '987fcdeb-51a2-43f7-9876-543210fedcba'
});
```

### Check if Credentials Exist

```typescript
import { credentialsExist } from '@/lib/secrets-manager';

if (await credentialsExist(tenantId)) {
  console.log('Credentials configured');
} else {
  console.log('Credentials not found');
}
```

### Get Secret Metadata

```typescript
import { getSecretMetadata } from '@/lib/secrets-manager';

const metadata = await getSecretMetadata(tenantId);
console.log('Created:', metadata.createdDate);
console.log('Last changed:', metadata.lastChangedDate);
```

### Cache Management

```typescript
import { clearCache, clearTenantCache, getCacheStats } from '@/lib/secrets-manager';

// Clear all cached credentials (call after polling cycle)
clearCache();

// Clear cache for specific tenant (call after credential update)
clearTenantCache(tenantId);

// Get cache statistics
const stats = getCacheStats();
console.log(`Cached credentials: ${stats.size}`);
```

## Security Features

### IAM Role-Based Authentication
- No hardcoded AWS credentials
- Uses IAM role from Lambda/ECS execution environment
- Least privilege access (only GetSecretValue permission)

### In-Memory Caching
- Credentials cached for 5 minutes maximum
- Cache cleared after each polling cycle
- Reduces Secrets Manager API calls
- No persistent storage of credentials

### Audit Logging
- All Secrets Manager access logged to CloudTrail
- Includes: who accessed, when, which secret
- Enables compliance and security monitoring

### Encryption
- Secrets encrypted at rest using AWS KMS
- Secrets encrypted in transit using TLS 1.2+
- No credentials logged or exposed in responses

## IAM Permissions

### Polling Worker Role

The Lambda/ECS role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:edr/tenant/*"
    }
  ]
}
```

### Admin Role (for credential management)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecrets"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:edr/tenant/*"
    }
  ]
}
```

## Setup Instructions

### 1. Create Secret via AWS CLI

```bash
# Set variables
TENANT_ID="123e4567-e89b-12d3-a456-426614174000"
CLIENT_ID="abc123-def456-ghi789"
CLIENT_SECRET="secret~value~here"
MS_TENANT_ID="987fcdeb-51a2-43f7-9876-543210fedcba"

# Create secret
aws secretsmanager create-secret \
  --name "edr/tenant/${TENANT_ID}/microsoft-credentials" \
  --description "Microsoft Graph API credentials for tenant ${TENANT_ID}" \
  --secret-string "{\"clientId\":\"${CLIENT_ID}\",\"clientSecret\":\"${CLIENT_SECRET}\",\"tenantId\":\"${MS_TENANT_ID}\"}" \
  --tags Key=TenantId,Value=${TENANT_ID} Key=Purpose,Value=EDR-Integration \
  --region us-east-1
```

### 2. Create Secret via AWS Console

1. Navigate to AWS Secrets Manager
2. Click "Store a new secret"
3. Select "Other type of secret"
4. Add key-value pairs:
   - `clientId`: Your Azure AD app client ID
   - `clientSecret`: Your Azure AD app client secret
   - `tenantId`: Your Microsoft tenant ID
5. Name the secret: `edr/tenant/{tenantId}/microsoft-credentials`
6. Add tags:
   - `TenantId`: Your AVIAN tenant ID
   - `Purpose`: EDR-Integration
7. Configure rotation: Manual (for MVP)
8. Review and store

### 3. Create Secret via TypeScript

```typescript
import { storeCredentials } from '@/lib/secrets-manager';

await storeCredentials('123e4567-e89b-12d3-a456-426614174000', {
  clientId: 'abc123-def456-ghi789',
  clientSecret: 'secret~value~here',
  tenantId: '987fcdeb-51a2-43f7-9876-543210fedcba'
});
```

## Testing Credential Retrieval

### Test from Lambda/ECS

```typescript
// test-credentials.ts
import { getCredentials } from '@/lib/secrets-manager';

async function testCredentials(tenantId: string) {
  try {
    const credentials = await getCredentials(tenantId);
    console.log('✓ Credentials retrieved successfully');
    console.log('Client ID:', credentials.clientId);
    console.log('Tenant ID:', credentials.tenantId);
    console.log('Has client secret:', !!credentials.clientSecret);
  } catch (error) {
    console.error('✗ Failed to retrieve credentials:', error);
  }
}

testCredentials('123e4567-e89b-12d3-a456-426614174000');
```

### Test from AWS CLI

```bash
# Retrieve secret
aws secretsmanager get-secret-value \
  --secret-id "edr/tenant/123e4567-e89b-12d3-a456-426614174000/microsoft-credentials" \
  --region us-east-1 \
  --query SecretString \
  --output text | jq .
```

## Secret Rotation (Manual for MVP)

### When to Rotate
- Every 90 days (recommended)
- When credentials are compromised
- When team member with access leaves
- As part of security audit

### Rotation Process

1. **Generate new credentials in Azure AD:**
   ```bash
   # Create new client secret in Azure portal
   # Note the new secret value
   ```

2. **Update secret in Secrets Manager:**
   ```bash
   aws secretsmanager update-secret \
     --secret-id "edr/tenant/${TENANT_ID}/microsoft-credentials" \
     --secret-string "{\"clientId\":\"${CLIENT_ID}\",\"clientSecret\":\"${NEW_SECRET}\",\"tenantId\":\"${MS_TENANT_ID}\"}"
   ```

3. **Verify new credentials work:**
   ```bash
   # Test authentication with new credentials
   # Run test polling cycle
   ```

4. **Delete old credentials in Azure AD:**
   ```bash
   # Remove old client secret from Azure portal
   ```

### Automatic Rotation (Future Enhancement)

AWS Secrets Manager supports automatic rotation with Lambda functions. This will be implemented in a future phase:

1. Create rotation Lambda function
2. Configure rotation schedule (e.g., every 90 days)
3. Lambda function:
   - Generates new credentials in Azure AD
   - Updates secret in Secrets Manager
   - Validates new credentials
   - Deletes old credentials

## Troubleshooting

### Error: Credentials not found

**Cause:** Secret doesn't exist in Secrets Manager

**Solution:**
```bash
# List all EDR secrets
aws secretsmanager list-secrets \
  --filters Key=name,Values=edr/tenant/ \
  --region us-east-1

# Create missing secret
aws secretsmanager create-secret \
  --name "edr/tenant/${TENANT_ID}/microsoft-credentials" \
  --secret-string "{...}"
```

### Error: Access Denied

**Cause:** IAM role lacks permissions

**Solution:**
1. Check IAM role attached to Lambda/ECS
2. Verify role has `secretsmanager:GetSecretValue` permission
3. Verify resource ARN matches secret name pattern

### Error: Invalid credentials format

**Cause:** Secret JSON is malformed or missing required fields

**Solution:**
```bash
# Retrieve and validate secret
aws secretsmanager get-secret-value \
  --secret-id "edr/tenant/${TENANT_ID}/microsoft-credentials" \
  --query SecretString \
  --output text | jq .

# Update with correct format
aws secretsmanager put-secret-value \
  --secret-id "edr/tenant/${TENANT_ID}/microsoft-credentials" \
  --secret-string "{\"clientId\":\"...\",\"clientSecret\":\"...\",\"tenantId\":\"...\"}"
```

### Cache Not Clearing

**Cause:** `clearCache()` not called after polling cycle

**Solution:**
```typescript
// In polling worker
try {
  await pollAllTenants();
} finally {
  clearCache(); // Always clear cache
}
```

## Monitoring

### CloudWatch Metrics

Track these metrics:
- Secret retrieval count
- Secret retrieval errors
- Cache hit rate
- Credential age

### CloudWatch Alarms

Set up alarms for:
- Failed credential retrievals
- Credentials older than 90 days
- High error rate

### CloudTrail Events

Monitor these events:
- `GetSecretValue`: Who accessed credentials
- `PutSecretValue`: Who updated credentials
- `CreateSecret`: Who created new credentials

## Cost Optimization

### Secrets Manager Pricing
- $0.40 per secret per month
- $0.05 per 10,000 API calls

### Cost Reduction Strategies
1. **Use caching**: Reduces API calls by 95%+
2. **Batch operations**: Retrieve multiple secrets in parallel
3. **Monitor usage**: Track API calls per tenant
4. **Clean up unused secrets**: Delete secrets for inactive tenants

### Example Cost Calculation

For 100 tenants with 15-minute polling:
- Secrets: 100 × $0.40 = $40/month
- API calls: 100 tenants × 96 polls/day × 30 days = 288,000 calls
- With caching: ~2,880 calls (99% cache hit rate)
- API cost: $0.05 × (2,880 / 10,000) = $0.01/month
- **Total: ~$40/month**

## Best Practices

1. **Never log credentials**: Credentials should never appear in logs
2. **Use IAM roles**: Never hardcode AWS credentials
3. **Clear cache regularly**: Call `clearCache()` after each polling cycle
4. **Rotate credentials**: Rotate every 90 days minimum
5. **Monitor access**: Review CloudTrail logs regularly
6. **Use least privilege**: Grant only required permissions
7. **Tag secrets**: Use consistent tagging for organization
8. **Test in dev first**: Always test credential changes in development
9. **Document tenant mappings**: Maintain mapping of AVIAN tenant → Microsoft tenant
10. **Backup credentials**: Store backup copy in secure location (e.g., 1Password)

## Related Documentation

- [Microsoft Graph Client](./microsoft-graph-client.README.md)
- [EDR Polling Worker](../services/edr-polling-worker.README.md)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Azure AD App Registration](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
