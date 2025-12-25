/**
 * Incident Creation Blocking Tests
 * 
 * Verifies that all direct Security Incident creation paths are blocked
 * and that incidents can ONLY be created through alert escalation workflow.
 * 
 * Requirements: 13.1, 13.2, 13.7, 13.9
 */

import { IncidentManager } from '../IncidentManager';
import { IncidentCreationValidationService } from '../IncidentCreationValidationService';
import { validateNoDirectIncidentCreation, validateSystemWideIncidentCreation } from '../../../middleware/incident-workflow.middleware';
import { NextRequest } from 'next/server';

describe('Incident Creation Blocking', () => {

    // ========================================================================
    // Direct Service Method Blocking Tests
    // ========================================================================

    describe('IncidentManager Direct Creation Blocking', () => {
        it('should block direct createIncident method', async () => {
            await expect(IncidentManager.createIncident()).rejects.toThrow(
                'Direct incident creation is blocked. Security Incidents can only be created through alert escalation workflow.'
            );
        });

        it('should block bulk createIncidents method', async () => {
            await expect(IncidentManager.createIncidents()).rejects.toThrow(
                'Bulk incident creation is blocked. Security Incidents can only be created through individual alert escalation workflow.'
            );
        });

        it('should block administrative createIncident method', async () => {
            await expect(IncidentManager.adminCreateIncident()).rejects.toThrow(
                'Administrative incident creation is blocked. Security Incidents can only be created through alert escalation workflow.'
            );
        });

        it('should validate incident creation path requirements', () => {
            // Missing alert ID
            expect(() => IncidentManager.validateIncidentCreationPath()).toThrow(
                'Incident creation is only allowed through alert escalation workflow. Alert ID and escalation context are required.'
            );

            // Missing escalation context
            expect(() => IncidentManager.validateIncidentCreationPath('alert-123')).toThrow(
                'Incident creation is only allowed through alert escalation workflow. Alert ID and escalation context are required.'
            );

            // Valid escalation context should not throw
            expect(() => IncidentManager.validateIncidentCreationPath('alert-123', true)).not.toThrow();
        });
    });

    // ========================================================================
    // Validation Service Blocking Tests
    // ========================================================================

    describe('IncidentCreationValidationService Blocking', () => {
        it('should block creation without alert context', () => {
            const result = IncidentCreationValidationService.validateIncidentCreation({
                source: 'api',
                endpoint: '/api/alerts-incidents/incidents',
                method: 'POST'
            });

            expect(result.isAllowed).toBe(false);
            expect(result.error?.code).toBe('NO_ALERT_CONTEXT');
            expect(result.error?.message).toContain('Security Incidents can only be created by escalating an existing alert');
        });

        it('should block direct API creation', () => {
            const result = IncidentCreationValidationService.validateIncidentCreation({
                source: 'api',
                endpoint: '/api/alerts-incidents/incidents',
                method: 'POST',
                alertId: 'alert-123'
            });

            expect(result.isAllowed).toBe(false);
            expect(result.error?.code).toBe('DIRECT_API_CREATION_BLOCKED');
            expect(result.error?.message).toContain('Direct API incident creation is not allowed');
        });

        it('should block webhook creation', () => {
            const result = IncidentCreationValidationService.validateIncidentCreation({
                source: 'webhook',
                alertId: 'alert-123'
            });

            expect(result.isAllowed).toBe(false);
            expect(result.error?.code).toBe('EXTERNAL_CREATION_BLOCKED');
            expect(result.error?.message).toContain('External systems cannot create incidents directly');
        });

        it('should block integration creation', () => {
            const result = IncidentCreationValidationService.validateIncidentCreation({
                source: 'integration',
                alertId: 'alert-123'
            });

            expect(result.isAllowed).toBe(false);
            expect(result.error?.code).toBe('EXTERNAL_CREATION_BLOCKED');
        });

        it('should block bulk creation', () => {
            const result = IncidentCreationValidationService.validateIncidentCreation({
                source: 'bulk',
                alertId: 'alert-123'
            });

            expect(result.isAllowed).toBe(false);
            expect(result.error?.code).toBe('BULK_CREATION_BLOCKED');
            expect(result.error?.message).toContain('Bulk incident creation is not allowed');
        });

        it('should block admin creation', () => {
            const result = IncidentCreationValidationService.validateIncidentCreation({
                source: 'admin',
                alertId: 'alert-123'
            });

            expect(result.isAllowed).toBe(false);
            expect(result.error?.code).toBe('ADMIN_CREATION_BLOCKED');
        });

        it('should block system creation', () => {
            const result = IncidentCreationValidationService.validateIncidentCreation({
                source: 'system',
                alertId: 'alert-123'
            });

            expect(result.isAllowed).toBe(false);
            expect(result.error?.code).toBe('ADMIN_CREATION_BLOCKED');
        });

        it('should validate authorized escalation endpoint', () => {
            expect(IncidentCreationValidationService.isAuthorizedEscalationEndpoint(
                '/api/alerts-incidents/alerts/123/escalate'
            )).toBe(true);

            expect(IncidentCreationValidationService.isAuthorizedEscalationEndpoint(
                '/api/alerts-incidents/incidents'
            )).toBe(false);

            expect(IncidentCreationValidationService.isAuthorizedEscalationEndpoint(
                '/api/alerts-incidents/bulk/incidents'
            )).toBe(false);
        });
    });

    // ========================================================================
    // Middleware Blocking Tests
    // ========================================================================

    describe('Middleware Blocking', () => {
        it('should block direct incident creation via middleware', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents', {
                method: 'POST'
            });

            const result = await validateNoDirectIncidentCreation(request);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('DIRECT_INCIDENT_CREATION_BLOCKED');
        });

        it('should block bulk incident creation via middleware', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents?bulk=true', {
                method: 'POST'
            });

            const result = await validateNoDirectIncidentCreation(request);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('BULK_INCIDENT_CREATION_BLOCKED');
        });

        it('should block global incident creation via middleware', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/incidents?global=true', {
                method: 'POST'
            });

            const result = await validateNoDirectIncidentCreation(request);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('GLOBAL_INCIDENT_CREATION_BLOCKED');
        });

        it('should allow incident management operations', async () => {
            const startWorkRequest = new NextRequest('http://localhost/api/alerts-incidents/incidents/123/start-work', {
                method: 'POST'
            });

            const resolveRequest = new NextRequest('http://localhost/api/alerts-incidents/incidents/123/resolve', {
                method: 'POST'
            });

            const dismissRequest = new NextRequest('http://localhost/api/alerts-incidents/incidents/123/dismiss', {
                method: 'POST'
            });

            expect((await validateNoDirectIncidentCreation(startWorkRequest)).success).toBe(true);
            expect((await validateNoDirectIncidentCreation(resolveRequest)).success).toBe(true);
            expect((await validateNoDirectIncidentCreation(dismissRequest)).success).toBe(true);
        });

        it('should block unauthorized incident creation patterns via system-wide validation', async () => {
            const patterns = [
                '/api/incidents',
                '/api/create-incident',
                '/api/new-incident',
                '/api/add-incident'
            ];

            for (const pattern of patterns) {
                const request = new NextRequest(`http://localhost${pattern}`, {
                    method: 'POST'
                });

                const result = await validateSystemWideIncidentCreation(request);

                expect(result.success).toBe(false);
                expect(result.error?.code).toBe('UNAUTHORIZED_INCIDENT_CREATION');
            }
        });

        it('should allow escalation endpoint via system-wide validation', async () => {
            const request = new NextRequest('http://localhost/api/alerts-incidents/alerts/123/escalate', {
                method: 'POST'
            });

            const result = await validateSystemWideIncidentCreation(request);

            expect(result.success).toBe(true);
        });
    });

    // ========================================================================
    // Comprehensive Blocking Verification
    // ========================================================================

    describe('Comprehensive Blocking Verification', () => {
        it('should block all known incident creation patterns', async () => {
            const blockedPatterns = [
                // Direct API patterns
                { url: '/api/alerts-incidents/incidents', method: 'POST' },
                { url: '/api/incidents', method: 'POST' },
                { url: '/api/create-incident', method: 'POST' },
                { url: '/api/new-incident', method: 'POST' },

                // Bulk patterns
                { url: '/api/alerts-incidents/incidents?bulk=true', method: 'POST' },
                { url: '/api/bulk-incidents', method: 'POST' },
                { url: '/api/batch-incidents', method: 'POST' },

                // Admin patterns
                { url: '/api/admin/incidents', method: 'POST' },
                { url: '/api/alerts-incidents/incidents?admin=true', method: 'POST' },

                // Global patterns
                { url: '/api/global/incidents', method: 'POST' },
                { url: '/api/alerts-incidents/incidents?global=true', method: 'POST' }
            ];

            for (const pattern of blockedPatterns) {
                const request = new NextRequest(`http://localhost${pattern.url}`, {
                    method: pattern.method
                });

                // Test both middleware functions
                const directResult = await validateNoDirectIncidentCreation(request);
                const systemResult = await validateSystemWideIncidentCreation(request);

                // At least one should block (depending on the pattern)
                const isBlocked = !directResult.success || !systemResult.success;

                expect(isBlocked).toBe(true);
            }
        });

        it('should only allow the single authorized escalation path', async () => {
            const authorizedRequest = new NextRequest('http://localhost/api/alerts-incidents/alerts/123/escalate', {
                method: 'POST'
            });

            const directResult = await validateNoDirectIncidentCreation(authorizedRequest);
            const systemResult = await validateSystemWideIncidentCreation(authorizedRequest);

            expect(directResult.success).toBe(true);
            expect(systemResult.success).toBe(true);
        });
    });
});