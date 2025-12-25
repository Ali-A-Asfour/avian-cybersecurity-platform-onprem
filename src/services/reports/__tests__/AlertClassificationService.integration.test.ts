/**
 * Alert Classification Service Integration Tests
 * 
 * Tests the integration of AlertClassificationService with the reports module
 * and verifies it works correctly with the controlled vocabulary requirements.
 */

import { AlertClassificationService, alertClassificationService } from '../AlertClassificationService';
import { AlertClassification, AlertSource } from '@/types/reports';

describe('AlertClassificationService Integration', () => {
    describe('Default Instance', () => {
        it('should provide a working default instance', () => {
            expect(alertClassificationService).toBeInstanceOf(AlertClassificationService);

            // Test that the default instance works
            const classification = alertClassificationService.classifyAlert('malware detected', AlertSource.DEFENDER);
            expect(Object.values(AlertClassification)).toContain(classification);
        });

        it('should maintain state across multiple calls', () => {
            // Reset stats to start clean
            alertClassificationService.resetStats();

            // Make some classifications
            alertClassificationService.classifyAlert('malware detected', AlertSource.DEFENDER);
            alertClassificationService.classifyAlert('phishing email', AlertSource.DEFENDER);

            const stats = alertClassificationService.getClassificationStats();
            expect(Object.keys(stats).length).toBeGreaterThan(0);
        });
    });

    describe('Controlled Vocabulary Compliance', () => {
        it('should only return valid AVIAN classifications for all sources', () => {
            const service = new AlertClassificationService();
            const testAlerts = [
                'malware detected',
                'phishing attempt',
                'spyware installation',
                'authentication failed',
                'network intrusion',
                'unknown threat',
                'completely random text'
            ];

            Object.values(AlertSource).forEach(source => {
                testAlerts.forEach(alertType => {
                    const classification = service.classifyAlert(alertType, source);
                    expect(Object.values(AlertClassification)).toContain(classification);
                });
            });
        });

        it('should provide consistent mappings for vendor-specific alerts', () => {
            const service = new AlertClassificationService();

            // Test Microsoft Defender specific alerts
            expect(service.classifyAlert('Windows Defender ATP alert', AlertSource.DEFENDER))
                .toBe(AlertClassification.OTHER); // Should use default since no specific pattern matches

            // Test SonicWall specific alerts  
            expect(service.classifyAlert('SonicWall IPS blocked attack', AlertSource.SONICWALL))
                .toBe(AlertClassification.NETWORK);

            // Test Avast specific alerts
            expect(service.classifyAlert('Avast detected ransomware', AlertSource.AVAST))
                .toBe(AlertClassification.MALWARE);

            // Test email alerts
            expect(service.classifyAlert('Critical security alert from firewall', AlertSource.FIREWALL_EMAIL))
                .toBe(AlertClassification.NETWORK);
        });
    });

    describe('Source Attribution and Tracking', () => {
        it('should track source attribution in statistics', () => {
            const service = new AlertClassificationService();
            service.resetStats();

            // Classify alerts from different sources
            service.classifyAlert('malware detected', AlertSource.DEFENDER);
            service.classifyAlert('malware blocked', AlertSource.SONICWALL);
            service.classifyAlert('virus quarantined', AlertSource.AVAST);

            const stats = service.getClassificationStats();

            // Should have entries for each source
            expect(stats[`${AlertSource.DEFENDER}:${AlertClassification.MALWARE}`]).toBe(1);
            expect(stats[`${AlertSource.SONICWALL}:${AlertClassification.MALWARE}`]).toBe(1);
            expect(stats[`${AlertSource.AVAST}:${AlertClassification.MALWARE}`]).toBe(1);
        });

        it('should provide source-specific mapping configurations', () => {
            const service = new AlertClassificationService();

            Object.values(AlertSource).forEach(source => {
                const mapping = service.getSourceMapping(source);
                expect(mapping.source).toBe(source);
                expect(Object.values(AlertClassification)).toContain(mapping.defaultClassification);
                expect(typeof mapping.mappings).toBe('object');
            });
        });
    });

    describe('Extensibility and Configuration', () => {
        it('should support adding new classification patterns', () => {
            const service = new AlertClassificationService();

            // Add a custom pattern
            service.addClassificationPattern(
                AlertSource.DEFENDER,
                /custom.*threat.*pattern/i,
                AlertClassification.NETWORK,
                0.95
            );

            // Test that the new pattern works
            expect(service.classifyAlert('custom threat pattern detected', AlertSource.DEFENDER))
                .toBe(AlertClassification.NETWORK);
        });

        it('should support configuration export and import', () => {
            const service1 = new AlertClassificationService();

            // Add a custom pattern to service1
            service1.addClassificationPattern(
                AlertSource.DEFENDER,
                /test.*export.*pattern/i,
                AlertClassification.SPYWARE,
                0.9
            );

            // Export configuration
            const config = service1.exportMappings();

            // Create new service and import configuration
            const service2 = new AlertClassificationService();
            service2.importMappings(config);

            // Test that imported configuration works
            expect(service2.classifyAlert('test export pattern', AlertSource.DEFENDER))
                .toBe(AlertClassification.SPYWARE);
        });
    });

    describe('Error Handling and Robustness', () => {
        it('should handle malformed inputs gracefully', () => {
            const service = new AlertClassificationService();

            // Test various malformed inputs
            expect(() => {
                service.classifyAlert('', AlertSource.DEFENDER);
            }).not.toThrow();

            expect(() => {
                service.classifyAlert(null as any, AlertSource.DEFENDER);
            }).not.toThrow();

            expect(() => {
                service.classifyAlert('test', 'invalid_source' as AlertSource);
            }).not.toThrow();
        });

        it('should validate confidence levels in pattern management', () => {
            const service = new AlertClassificationService();

            expect(() => {
                service.addClassificationPattern(
                    AlertSource.DEFENDER,
                    /test/,
                    AlertClassification.NETWORK,
                    1.5 // Invalid confidence
                );
            }).toThrow();

            expect(() => {
                service.addClassificationPattern(
                    AlertSource.DEFENDER,
                    /test/,
                    AlertClassification.NETWORK,
                    -0.1 // Invalid confidence
                );
            }).toThrow();
        });
    });

    describe('Performance and Scalability', () => {
        it('should handle large numbers of classifications efficiently', () => {
            const service = new AlertClassificationService();
            const startTime = Date.now();

            // Perform many classifications
            for (let i = 0; i < 1000; i++) {
                service.classifyAlert(`test alert ${i}`, AlertSource.DEFENDER);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (less than 1 second)
            expect(duration).toBeLessThan(1000);
        });

        it('should maintain consistent performance with pattern additions', () => {
            const service = new AlertClassificationService();

            // Add many patterns
            for (let i = 0; i < 100; i++) {
                service.addClassificationPattern(
                    AlertSource.DEFENDER,
                    new RegExp(`pattern${i}`, 'i'),
                    AlertClassification.NETWORK,
                    0.8
                );
            }

            const startTime = Date.now();

            // Test classification performance
            for (let i = 0; i < 100; i++) {
                service.classifyAlert(`test pattern${i}`, AlertSource.DEFENDER);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should still be reasonably fast
            expect(duration).toBeLessThan(500);
        });
    });
});