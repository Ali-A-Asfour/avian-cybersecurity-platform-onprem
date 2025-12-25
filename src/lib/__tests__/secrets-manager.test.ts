/**
 * Unit tests for AWS Secrets Manager client
 * 
 * Tests credential retrieval, storage, caching, and error handling
 */

import {
    getCredentials,
    storeCredentials,
    getSecretMetadata,
    credentialsExist,
    clearCache,
    clearTenantCache,
    getCacheStats,
    getSecretName,
    type MicrosoftCredentials,
} from '../secrets-manager';
import {
    SecretsManagerClient,
    GetSecretValueCommand,
    CreateSecretCommand,
    DescribeSecretCommand,
    PutSecretValueCommand,
    ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager';

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager', () => {
    const actual = jest.requireActual('@aws-sdk/client-secrets-manager');
    return {
        ...actual,
        SecretsManagerClient: jest.fn(),
    };
});

describe('Secrets Manager', () => {
    let mockSend: jest.Mock;
    const testTenantId = '123e4567-e89b-12d3-a456-426614174000';
    const testCredentials: MicrosoftCredentials = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tenantId: 'test-ms-tenant-id',
        authority: 'https://login.microsoftonline.com',
    };

    beforeEach(() => {
        // Clear cache before each test
        clearCache();

        // Setup mock
        mockSend = jest.fn();
        (SecretsManagerClient as unknown as jest.Mock).mockImplementation(() => ({
            send: mockSend,
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getSecretName', () => {
        it('should generate correct secret name format', () => {
            const secretName = getSecretName(testTenantId);
            expect(secretName).toBe(`edr/tenant/${testTenantId}/microsoft-credentials`);
        });

        it('should handle different tenant IDs', () => {
            const tenantId = '987fcdeb-51a2-43f7-9876-543210fedcba';
            const secretName = getSecretName(tenantId);
            expect(secretName).toBe(`edr/tenant/${tenantId}/microsoft-credentials`);
        });
    });

    describe('getCredentials', () => {
        it('should retrieve credentials from Secrets Manager', async () => {
            mockSend.mockResolvedValueOnce({
                SecretString: JSON.stringify(testCredentials),
            });

            const credentials = await getCredentials(testTenantId);

            expect(credentials).toEqual(testCredentials);
            expect(mockSend).toHaveBeenCalledTimes(1);
            expect(mockSend).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
        });

        it('should cache credentials after first retrieval', async () => {
            mockSend.mockResolvedValueOnce({
                SecretString: JSON.stringify(testCredentials),
            });

            // First call - should hit Secrets Manager
            const credentials1 = await getCredentials(testTenantId);
            expect(mockSend).toHaveBeenCalledTimes(1);

            // Second call - should use cache
            const credentials2 = await getCredentials(testTenantId);
            expect(mockSend).toHaveBeenCalledTimes(1); // Still 1, not 2
            expect(credentials2).toEqual(credentials1);
        });

        it('should throw error if secret not found', async () => {
            mockSend.mockRejectedValueOnce(new ResourceNotFoundException({
                message: 'Secret not found',
                $metadata: {},
            }));

            await expect(getCredentials(testTenantId)).rejects.toThrow(
                `Credentials not found for tenant ${testTenantId}`
            );
        });

        it('should throw error if SecretString is missing', async () => {
            mockSend.mockResolvedValueOnce({
                SecretString: undefined,
            });

            await expect(getCredentials(testTenantId)).rejects.toThrow(
                'has no SecretString value'
            );
        });

        it('should throw error if credentials are invalid', async () => {
            mockSend.mockResolvedValueOnce({
                SecretString: JSON.stringify({ clientId: 'only-client-id' }),
            });

            await expect(getCredentials(testTenantId)).rejects.toThrow(
                'Invalid credentials format'
            );
        });

        it('should handle optional authority field', async () => {
            const credentialsWithoutAuthority = {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                tenantId: 'test-ms-tenant-id',
            };

            mockSend.mockResolvedValueOnce({
                SecretString: JSON.stringify(credentialsWithoutAuthority),
            });

            const credentials = await getCredentials(testTenantId);
            expect(credentials).toEqual(credentialsWithoutAuthority);
        });
    });

    describe('storeCredentials', () => {
        it('should create new secret if not exists', async () => {
            // DescribeSecret fails (secret doesn't exist)
            mockSend.mockRejectedValueOnce(new ResourceNotFoundException({
                message: 'Secret not found',
                $metadata: {},
            }));

            // CreateSecret succeeds
            mockSend.mockResolvedValueOnce({
                ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test',
            });

            const arn = await storeCredentials(testTenantId, testCredentials);

            expect(arn).toBe('arn:aws:secretsmanager:us-east-1:123456789012:secret:test');
            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockSend).toHaveBeenNthCalledWith(1, expect.any(DescribeSecretCommand));
            expect(mockSend).toHaveBeenNthCalledWith(2, expect.any(CreateSecretCommand));
        });

        it('should update existing secret', async () => {
            // DescribeSecret succeeds (secret exists)
            mockSend.mockResolvedValueOnce({
                Name: getSecretName(testTenantId),
            });

            // PutSecretValue succeeds
            mockSend.mockResolvedValueOnce({
                ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test',
            });

            const arn = await storeCredentials(testTenantId, testCredentials);

            expect(arn).toBe('arn:aws:secretsmanager:us-east-1:123456789012:secret:test');
            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockSend).toHaveBeenNthCalledWith(1, expect.any(DescribeSecretCommand));
            expect(mockSend).toHaveBeenNthCalledWith(2, expect.any(PutSecretValueCommand));
        });

        it('should validate credentials before storing', async () => {
            const invalidCredentials = {
                clientId: 'only-client-id',
            } as MicrosoftCredentials;

            await expect(
                storeCredentials(testTenantId, invalidCredentials)
            ).rejects.toThrow('Invalid credentials');
        });

        it('should clear cache after storing', async () => {
            // First, cache some credentials
            mockSend.mockResolvedValueOnce({
                SecretString: JSON.stringify(testCredentials),
            });
            await getCredentials(testTenantId);

            // Verify cache has entry
            let stats = getCacheStats();
            expect(stats.size).toBe(1);

            // Now store new credentials
            mockSend.mockResolvedValueOnce({ Name: getSecretName(testTenantId) });
            mockSend.mockResolvedValueOnce({ ARN: 'test-arn' });
            await storeCredentials(testTenantId, testCredentials);

            // Verify cache was cleared for this tenant
            stats = getCacheStats();
            expect(stats.size).toBe(0);
        });
    });

    describe('getSecretMetadata', () => {
        it('should retrieve secret metadata', async () => {
            const mockMetadata = {
                Name: getSecretName(testTenantId),
                CreatedDate: new Date('2024-01-01'),
                LastAccessedDate: new Date('2024-01-15'),
                LastChangedDate: new Date('2024-01-10'),
            };

            mockSend.mockResolvedValueOnce(mockMetadata);

            const metadata = await getSecretMetadata(testTenantId);

            expect(metadata.secretName).toBe(getSecretName(testTenantId));
            expect(metadata.createdDate).toEqual(mockMetadata.CreatedDate);
            expect(metadata.lastAccessedDate).toEqual(mockMetadata.LastAccessedDate);
            expect(metadata.lastChangedDate).toEqual(mockMetadata.LastChangedDate);
        });

        it('should throw error if secret not found', async () => {
            mockSend.mockRejectedValueOnce(new ResourceNotFoundException({
                message: 'Secret not found',
                $metadata: {},
            }));

            await expect(getSecretMetadata(testTenantId)).rejects.toThrow(
                `Credentials not found for tenant ${testTenantId}`
            );
        });
    });

    describe('credentialsExist', () => {
        it('should return true if credentials exist', async () => {
            mockSend.mockResolvedValueOnce({
                Name: getSecretName(testTenantId),
            });

            const exists = await credentialsExist(testTenantId);
            expect(exists).toBe(true);
        });

        it('should return false if credentials do not exist', async () => {
            mockSend.mockRejectedValueOnce(new ResourceNotFoundException({
                message: 'Secret not found',
                $metadata: {},
            }));

            const exists = await credentialsExist(testTenantId);
            expect(exists).toBe(false);
        });
    });

    describe('Cache Management', () => {
        it('should clear all cache entries', async () => {
            // Cache credentials for multiple tenants
            const tenant1 = '111e1111-e11b-11d1-a111-111111111111';
            const tenant2 = '222e2222-e22b-22d2-a222-222222222222';

            mockSend.mockResolvedValue({
                SecretString: JSON.stringify(testCredentials),
            });

            await getCredentials(tenant1);
            await getCredentials(tenant2);

            let stats = getCacheStats();
            expect(stats.size).toBe(2);

            clearCache();

            stats = getCacheStats();
            expect(stats.size).toBe(0);
        });

        it('should clear cache for specific tenant', async () => {
            const tenant1 = '111e1111-e11b-11d1-a111-111111111111';
            const tenant2 = '222e2222-e22b-22d2-a222-222222222222';

            mockSend.mockResolvedValue({
                SecretString: JSON.stringify(testCredentials),
            });

            await getCredentials(tenant1);
            await getCredentials(tenant2);

            let stats = getCacheStats();
            expect(stats.size).toBe(2);

            clearTenantCache(tenant1);

            stats = getCacheStats();
            expect(stats.size).toBe(1);
            expect(stats.tenantIds).toContain(tenant2);
            expect(stats.tenantIds).not.toContain(tenant1);
        });

        it('should provide cache statistics', async () => {
            const tenant1 = '111e1111-e11b-11d1-a111-111111111111';
            const tenant2 = '222e2222-e22b-22d2-a222-222222222222';

            mockSend.mockResolvedValue({
                SecretString: JSON.stringify(testCredentials),
            });

            await getCredentials(tenant1);
            await getCredentials(tenant2);

            const stats = getCacheStats();
            expect(stats.size).toBe(2);
            expect(stats.tenantIds).toContain(tenant1);
            expect(stats.tenantIds).toContain(tenant2);
        });

        it('should expire cache after TTL', async () => {
            // Mock Date.now to control time
            const originalDateNow = Date.now;
            let currentTime = 1000000;
            Date.now = jest.fn(() => currentTime);

            mockSend.mockResolvedValue({
                SecretString: JSON.stringify(testCredentials),
            });

            // First call
            await getCredentials(testTenantId);
            expect(mockSend).toHaveBeenCalledTimes(1);

            // Advance time by 4 minutes (within TTL)
            currentTime += 4 * 60 * 1000;
            await getCredentials(testTenantId);
            expect(mockSend).toHaveBeenCalledTimes(1); // Still cached

            // Advance time by 2 more minutes (beyond TTL)
            currentTime += 2 * 60 * 1000;
            await getCredentials(testTenantId);
            expect(mockSend).toHaveBeenCalledTimes(2); // Cache expired, new call

            // Restore Date.now
            Date.now = originalDateNow;
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors', async () => {
            mockSend.mockRejectedValueOnce(new Error('Network error'));

            await expect(getCredentials(testTenantId)).rejects.toThrow('Network error');
        });

        it('should handle malformed JSON', async () => {
            mockSend.mockResolvedValueOnce({
                SecretString: 'not-valid-json',
            });

            await expect(getCredentials(testTenantId)).rejects.toThrow();
        });

        it('should handle empty secret string', async () => {
            mockSend.mockResolvedValueOnce({
                SecretString: '',
            });

            await expect(getCredentials(testTenantId)).rejects.toThrow();
        });

        it('should propagate AWS SDK errors', async () => {
            const awsError = new Error('AWS SDK Error');
            mockSend.mockRejectedValueOnce(awsError);

            await expect(getCredentials(testTenantId)).rejects.toThrow('AWS SDK Error');
        });
    });
});
