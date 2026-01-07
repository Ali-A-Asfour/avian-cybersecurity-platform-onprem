---
inclusion: always
---

# ProServe Coding Standards

## Critical Workflow Requirements

### Artifact Generation Only
- ✅ **Generate complete artifacts** in `generated/build/solution/`
- ✅ **Always run `cdk synth`** to validate CloudFormation templates
- ✅ **Create deploy handoff document** for Deploy Agent
- ❌ **Never run `cdk deploy`** - Coding Agent generates, Deploy Agent deploys
- ❌ **Never run `aws cloudformation deploy`** - No deployment commands
- ❌ **Never run `aws cloudformation create-stack`** - No deployment commands

### Collaborative Approach
- ✅ **Always propose stack organization** and get user confirmation
- ✅ **Always ask for clarification** when design is ambiguous
- ✅ **Always document assumptions** when making implementation decisions
- ✅ **Always provide transparency** about what you're building and why

### Test Planning Only
- ✅ **Document test requirements** in `docs/test-plan.md`
- ✅ **Map testing needs** to functional requirements
- ✅ **Suggest testing approaches** (unit, integration, e2e)
- ❌ **Never generate test code** - agent not mature enough for quality test generation

## Mandatory Security Requirements

### Authentication
- ✅ **Always use AWS Cognito** - Never implement custom authentication
- ✅ **Implement Lambda authorizers** for API Gateway endpoints
- ✅ **Secure session management** with httpOnly cookies and secure flags
- ❌ Never create custom JWT signing or session management

### Secrets Management
- ✅ **Use AWS Secrets Manager** for sensitive data (API keys, passwords, tokens)
- ✅ **Use Parameter Store** for non-sensitive configuration
- ❌ Never hardcode secrets in code or configuration files
- ❌ Never store secrets in environment variables

### Encryption
- ✅ **Use AWS KMS** for all encryption operations
- ✅ **Enable encryption at rest** by default for all data stores
- ✅ **Implement TLS 1.2+** for all network communication
- ✅ **Encrypt sensitive data** before storing in databases

### IAM and Access Control
- ✅ **Implement least privilege principle** for all IAM policies
- ✅ **Use IAM roles** instead of IAM users for applications
- ✅ **Implement MFA** where applicable
- ❌ Never use root accounts for operations
- ❌ Never share IAM credentials

### Input Validation
- ✅ **Use AWS Lambda Powertools** for event validation
- ✅ **Validate and sanitize all user input** before processing
- ✅ **Implement OWASP Top 10 protections**
- ❌ Never trust user input
- ❌ Never construct SQL queries with string concatenation

### Logging and Monitoring
- ✅ **Use CloudWatch** for centralized logging and monitoring
- ✅ **Implement audit trails** with CloudTrail for security events
- ✅ **Set up proper log retention** policies (minimum 90 days)
- ✅ **Log security events** (authentication, authorization, data access)
- ❌ Never log sensitive data (passwords, tokens, PII)

---

## Code Implementation Patterns

### Authentication with Cognito

```typescript
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

// Initialize SDK client outside handler (ProServe requirement)
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

export async function authenticateUser(credentials: Credentials): Promise<AuthToken> {
  // 1. Validate input
  if (!credentials.username || !credentials.password) {
    throw new ValidationError('Username and password required');
  }
  
  // 2. Sanitize inputs
  const sanitizedUsername = sanitizeInput(credentials.username);
  
  // 3. Use AWS Cognito
  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: process.env.COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: sanitizedUsername,
      PASSWORD: credentials.password
    }
  });
  
  const response = await cognitoClient.send(command);
  
  // 4. Audit successful authentication
  await auditLog.record('auth_success', { userId: sanitizedUsername });
  
  return {
    accessToken: response.AuthenticationResult?.AccessToken,
    refreshToken: response.AuthenticationResult?.RefreshToken
  };
}
```

### Secrets Management with Secrets Manager

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Initialize outside handler
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

// Cache secrets to reduce API calls
let cachedSecret: string | null = null;
let cacheExpiry: number = 0;

export async function getApiKey(): Promise<string> {
  if (cachedSecret && Date.now() < cacheExpiry) {
    return cachedSecret;
  }
  
  const command = new GetSecretValueCommand({
    SecretId: process.env.API_KEY_SECRET_NAME
  });
  
  const response = await secretsClient.send(command);
  cachedSecret = response.SecretString!;
  cacheExpiry = Date.now() + (5 * 60 * 1000); // Cache for 5 minutes
  
  return cachedSecret;
}
```

### Input Validation with Lambda Powertools

```typescript
import { validator } from '@aws-lambda-powertools/validator';
import { JSONSchemaType } from 'ajv';

interface UserInput {
  email: string;
  age: number;
  username: string;
}

const schema: JSONSchemaType<UserInput> = {
  type: 'object',
  required: ['email', 'age', 'username'],
  properties: {
    email: { type: 'string', format: 'email', maxLength: 255 },
    age: { type: 'number', minimum: 18, maximum: 120 },
    username: { type: 'string', pattern: '^[a-zA-Z0-9_-]{3,20}$' }
  }
};

@validator({ inboundSchema: schema })
export async function handler(event: APIGatewayProxyEvent) {
  const input = JSON.parse(event.body!) as UserInput;
  
  // Additional sanitization
  const sanitizedInput = {
    email: input.email.toLowerCase().trim(),
    age: input.age,
    username: input.username.replace(/[^a-zA-Z0-9_-]/g, '')
  };
  
  return processUser(sanitizedInput);
}
```

### Encryption with KMS

```typescript
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

export async function encryptSensitiveData(plaintext: string): Promise<string> {
  const command = new EncryptCommand({
    KeyId: process.env.KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext, 'utf-8')
  });
  
  const response = await kmsClient.send(command);
  return Buffer.from(response.CiphertextBlob!).toString('base64');
}

export async function decryptSensitiveData(ciphertext: string): Promise<string> {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64')
  });
  
  const response = await kmsClient.send(command);
  return Buffer.from(response.Plaintext!).toString('utf-8');
}
```

### Logging with CloudWatch

```typescript
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({
  serviceName: 'user-service',
  logLevel: process.env.LOG_LEVEL || 'INFO'
});

export async function processUserRequest(userId: string, action: string) {
  logger.info('Processing user request', { userId, action });
  
  try {
    const result = await performAction(userId, action);
    logger.info('User action completed', { userId, action, result: 'success' });
    return result;
  } catch (error) {
    logger.error('User action failed', { userId, action, error: error.message });
    throw error;
  }
}
```

---

## Anti-Patterns to Avoid

❌ **Custom authentication schemes** - Always use AWS Cognito
❌ **Hardcoded credentials** - Use Secrets Manager
❌ **Secrets in environment variables** - Use Secrets Manager
❌ **No input validation** - Validate all user input
❌ **Plaintext sensitive data** - Encrypt with KMS
❌ **Using IAM users for applications** - Use IAM roles
❌ **Silent error handling** - Log errors and throw appropriately
❌ **Console.log for logging** - Use structured logging with CloudWatch

---

## Testing Requirements

### Coverage Standards
- **Minimum 80% code coverage** for all production code
- **100% coverage** for security-critical functions
- Write tests as you implement, not after

### Test Types Required
- **Unit tests** - Business logic and component functionality
- **Integration tests** - API endpoints and service interactions
- **Security tests** - Authentication, authorization, encryption validation
- **Performance tests** - Critical paths and scalability

### Requirements Traceability
Maintain clear mapping between requirements, implementation, and tests:

```
REQ-001: User Authentication
├─ Implementation: src/auth/cognito-auth.ts
├─ Tests: tests/auth/cognito-auth.test.ts
└─ Security Control: TM-001 (Authentication)

REQ-002: Data Encryption
├─ Implementation: src/security/kms-encryption.ts
├─ Tests: tests/security/kms-encryption.test.ts
└─ Security Control: TM-005 (Data Protection)
```

---

## Code Quality Standards

### General Principles
- **Initialize SDK clients outside handlers** - Reuse connections
- **Handle errors explicitly** - No silent failures
- **Document WHY, not WHAT** - Code shows what, comments explain why
- **Follow single responsibility** - One function, one purpose
- **Keep functions focused** - Maximum 50 lines per function

### Code Structure
- **Include copyright headers** - ProServe requirement
- **Use TypeScript strict mode** - Enable all strict checks
- **Follow consistent naming** - camelCase for variables, PascalCase for classes
- **Organize imports** - AWS SDK, third-party, local

---

## Infrastructure as Code Standards

### CloudFormation/CDK Requirements
- ✅ **Use nested stacks** for complex deployments
- ✅ **Implement stack policies** for critical resources
- ✅ **Use NoEcho** for sensitive parameters
- ✅ **Tag all resources** with project, environment, owner
- ❌ Never hardcode credentials in templates

### Security Configuration
- ✅ **Enable encryption** for all data stores (S3, DynamoDB, RDS)
- ✅ **Configure VPC** with private subnets for sensitive resources
- ✅ **Implement security groups** with least privilege
- ✅ **Enable CloudTrail** for audit logging
- ✅ **Configure KMS keys** with proper key policies

---

## References

- [ProServe Secure Coding Guidelines](https://w.amazon.com/bin/view/AWS/Teams/Proserve/SRC/EngagementSecurity/SecureCodingGuidelines)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS Security Best Practices](https://docs.aws.amazon.com/security/)
