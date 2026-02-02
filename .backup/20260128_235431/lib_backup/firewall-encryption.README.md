# Firewall Credential Encryption

This module provides AES-256-GCM encryption for SonicWall firewall API credentials.

## Setup

### 1. Generate Encryption Key

Generate a secure 256-bit encryption key:

```typescript
import { FirewallEncryption } from './lib/firewall-encryption';

const key = FirewallEncryption.generateEncryptionKey();
console.log('Add this to your .env file:');
console.log(`FIREWALL_ENCRYPTION_KEY=${key}`);
```

### 2. Configure Environment Variable

Add the generated key to your environment configuration:

```bash
# .env or environment configuration
FIREWALL_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

**Important:** 
- The key must be exactly 64 hexadecimal characters (256 bits)
- Keep this key secure and never commit it to version control
- Use different keys for development, staging, and production environments

### 3. Validate Configuration

Before using encryption in production, validate the setup:

```typescript
import { FirewallEncryption } from './lib/firewall-encryption';

try {
  await FirewallEncryption.validateEncryption();
  console.log('Encryption is properly configured');
} catch (error) {
  console.error('Encryption configuration error:', error);
}
```

## Usage

### Encrypting Credentials

```typescript
import { FirewallEncryption } from './lib/firewall-encryption';

// Encrypt API credentials
const credentials = 'admin:mySecurePassword123';
const encrypted = await FirewallEncryption.encryptCredentials(credentials);

console.log(encrypted);
// {
//   encrypted: '4a5b6c7d8e9f...',  // Hex-encoded encrypted data
//   iv: '1a2b3c4d5e6f...'          // Hex-encoded initialization vector
// }

// Store in database
await db.insert(firewallDevices).values({
  apiUsername: 'admin',
  apiPasswordEncrypted: JSON.stringify(encrypted),
  // ... other fields
});
```

### Decrypting Credentials

```typescript
import { FirewallEncryption } from './lib/firewall-encryption';

// Retrieve from database
const device = await db.query.firewallDevices.findFirst({
  where: eq(firewallDevices.deviceId, deviceId)
});

// Decrypt credentials
const encrypted = JSON.parse(device.apiPasswordEncrypted);
const password = await FirewallEncryption.decryptCredentials(encrypted);

// Use for API authentication
const apiClient = new SonicWallAPI({
  baseUrl: device.managementIp,
  username: device.apiUsername,
  password: password
});
```

### Convenience Methods

For simpler usage with JSON strings:

```typescript
// Encrypt password to JSON string
const encryptedJson = await FirewallEncryption.encryptPassword('myPassword123');
// Store directly in database
await db.update(firewallDevices)
  .set({ apiPasswordEncrypted: encryptedJson })
  .where(eq(firewallDevices.deviceId, deviceId));

// Decrypt password from JSON string
const device = await db.query.firewallDevices.findFirst(...);
const password = await FirewallEncryption.decryptPassword(device.apiPasswordEncrypted);
```

## Security Features

### AES-256-GCM Encryption
- **Algorithm:** AES-256 in Galois/Counter Mode (GCM)
- **Key Size:** 256 bits (32 bytes)
- **IV Size:** 96 bits (12 bytes)
- **Authentication:** Built-in authentication tag prevents tampering

### Key Management
- Encryption key stored in environment variable
- Key never exposed in API responses or logs
- Separate keys recommended for each environment

### Data Protection
- Each encryption uses a unique random IV
- Same plaintext produces different ciphertext each time
- Authenticated encryption prevents tampering
- Additional authenticated data (AAD) includes "AVIAN-SECURITY" tag

## Error Handling

```typescript
try {
  const encrypted = await FirewallEncryption.encryptCredentials(password);
} catch (error) {
  if (error.message.includes('Encryption key not configured')) {
    // Key not set in environment
  } else if (error.message.includes('Invalid encryption key format')) {
    // Key format is incorrect
  } else if (error.message.includes('Credentials cannot be empty')) {
    // Empty input provided
  }
}
```

## Testing

Run the test suite:

```bash
npm test -- src/lib/__tests__/firewall-encryption.test.ts
```

The tests verify:
- Key generation produces valid 256-bit keys
- Encryption produces different outputs for same input
- Decryption correctly recovers original data
- Round-trip encryption/decryption works for various inputs
- Error handling for invalid inputs and configurations

## Migration Guide

If you have existing unencrypted credentials in the database:

```typescript
import { FirewallEncryption } from './lib/firewall-encryption';
import { db } from './lib/database';
import { firewallDevices } from './database/schemas/firewall';

async function migrateCredentials() {
  const devices = await db.query.firewallDevices.findMany();
  
  for (const device of devices) {
    if (device.apiPasswordEncrypted && !device.apiPasswordEncrypted.startsWith('{')) {
      // Assume it's plain text, encrypt it
      const encrypted = await FirewallEncryption.encryptPassword(device.apiPasswordEncrypted);
      
      await db.update(firewallDevices)
        .set({ apiPasswordEncrypted: encrypted })
        .where(eq(firewallDevices.deviceId, device.deviceId));
      
      console.log(`Encrypted credentials for device ${device.deviceId}`);
    }
  }
}
```

## Best Practices

1. **Key Rotation:** Periodically rotate encryption keys and re-encrypt credentials
2. **Access Control:** Limit access to environment variables containing encryption keys
3. **Audit Logging:** Log credential access for security monitoring
4. **Secure Storage:** Use secure secret management systems (AWS Secrets Manager, HashiCorp Vault) in production
5. **Testing:** Always test encryption/decryption in staging before production deployment

## Troubleshooting

### "Encryption key not configured"
- Ensure `FIREWALL_ENCRYPTION_KEY` is set in your environment
- Check that the environment variable is loaded before using encryption

### "Invalid encryption key format"
- Key must be exactly 64 hexadecimal characters
- Use `FirewallEncryption.generateEncryptionKey()` to generate a valid key

### "Failed to decrypt password"
- Ensure you're using the same key that was used for encryption
- Check that the encrypted data hasn't been corrupted
- Verify the JSON format is correct

### Decryption fails after key change
- If you change the encryption key, you must re-encrypt all existing credentials
- Keep the old key available during migration period
