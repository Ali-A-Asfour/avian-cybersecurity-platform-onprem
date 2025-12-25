/**
 * Alert Classification Service Tests
 * 
 * Tests for the AlertClassificationService that normalizes vendor-specific
 * alert types to AVIAN standard classifications.
 * 
 * Requirements: 2.3, controlled vocabulary
 */

import { AlertClassificationService } from '../AlertClassificationService';
import { AlertClassification, AlertSource } from '@/types/reports';

describe('AlertClassificationService', () => {
    let service: AlertClassificationService;

    beforeEach(() => {
        service = new AlertClassificationService();
    });

    describe('Alert Classification', () => {
        describe('Microsoft Defender mappings', () => {
            it('should classify phishing alerts correctly', () => {
                expect(service.classifyAlert('phishing email detected', AlertSource.DEFENDER))
                    .toBe(AlertClassification.PHISHING);
                expect(service.classifyAlert('suspicious email threat', AlertSource.DEFENDER))
                    .toBe(AlertClassification.PHISHING);
                expect(service.classifyAlert('credential harvesting attempt', AlertSource.DEFENDER))
                    .toBe(AlertClassification.PHISHING);
                expect(service.classifyAlert('spear phishing campaign', AlertSource.DEFENDER))
                    .toBe(AlertClassification.PHISHING);
                expect(service.classifyAlert('business email compromise detected', AlertSource.DEFENDER))
                    .toBe(AlertClassification.PHISHING);
            });

            it('should classify malware alerts correctly', () => {
                expect(service.classifyAlert('malware detected on endpoint', AlertSource.DEFENDER))
                    .toBe(AlertClassification.MALWARE);
                expect(service.classifyAlert('trojan horse found', AlertSource.DEFENDER))
                    .toBe(AlertClassification.MALWARE);
                expect(service.classifyAlert('ransomware activity detected', AlertSource.DEFENDER))
                    .toBe(AlertClassification.MALWARE);
                expect(service.classifyAlert('wannacry variant detected', AlertSource.DEFENDER))
                    .toBe(AlertClassification.MALWARE);
                expect(service.classifyAlert('ryuk ransomware', AlertSource.DEFENDER))
                    .toBe(AlertClassification.MALWARE);
            });

            it('should classify spyware alerts correctly', () => {
                expect(service.classifyAlert('spyware installation detected', AlertSource.DEFENDER))
                    .toBe(AlertClassification.SPYWARE);
                expect(service.classifyAlert('keylogger activity', AlertSource.DEFENDER))
                    .toBe(AlertClassification.SPYWARE);
                expect(service.classifyAlert('credential theft attempt', AlertSource.DEFENDER))
                    .toBe(AlertClassification.SPYWARE);
                expect(service.classifyAlert('mimikatz usage detected', AlertSource.DEFENDER))
                    .toBe(AlertClassification.SPYWARE);
                expect(service.classifyAlert('cobalt strike beacon', AlertSource.DEFENDER))
                    .toBe(AlertClassification.SPYWARE);
            });

            it('should classify authentication alerts correctly', () => {
                expect(service.classifyAlert('authentication failure', AlertSource.DEFENDER))
                    .toBe(AlertClassification.AUTHENTICATION);
                expect(service.classifyAlert('brute force attack detected', AlertSource.DEFENDER))
                    .toBe(AlertClassification.AUTHENTICATION);
                expect(service.classifyAlert('password spray attack', AlertSource.DEFENDER))
                    .toBe(AlertClassification.AUTHENTICATION);
                expect(service.classifyAlert('suspicious sign-in activity', AlertSource.DEFENDER))
                    .toBe(AlertClassification.AUTHENTICATION);
            });

            it('should classify network alerts correctly', () => {
                expect(service.classifyAlert('suspicious network connection', AlertSource.DEFENDER))
                    .toBe(AlertClassification.NETWORK);
                expect(service.classifyAlert('command and control communication', AlertSource.DEFENDER))
                    .toBe(AlertClassification.NETWORK);
                expect(service.classifyAlert('lateral movement detected', AlertSource.DEFENDER))
                    .toBe(AlertClassification.NETWORK);
                expect(service.classifyAlert('network scan activity', AlertSource.DEFENDER))
                    .toBe(AlertClassification.NETWORK);
            });

            it('should use default classification for unknown alerts', () => {
                expect(service.classifyAlert('unknown alert type', AlertSource.DEFENDER))
                    .toBe(AlertClassification.OTHER);
                expect(service.classifyAlert('generic system alert', AlertSource.DEFENDER))
                    .toBe(AlertClassification.OTHER);
            });
        });

        describe('SonicWall mappings', () => {
            it('should classify network-based threats correctly', () => {
                expect(service.classifyAlert('IPS attack detected', AlertSource.SONICWALL))
                    .toBe(AlertClassification.NETWORK);
                expect(service.classifyAlert('intrusion attempt blocked', AlertSource.SONICWALL))
                    .toBe(AlertClassification.NETWORK);
                expect(service.classifyAlert('DDoS attack in progress', AlertSource.SONICWALL))
                    .toBe(AlertClassification.NETWORK);
                expect(service.classifyAlert('SYN flood detected', AlertSource.SONICWALL))
                    .toBe(AlertClassification.NETWORK);
            });

            it('should classify malware detection correctly', () => {
                expect(service.classifyAlert('Gateway AntiVirus detected threat', AlertSource.SONICWALL))
                    .toBe(AlertClassification.MALWARE);
                expect(service.classifyAlert('botnet communication blocked', AlertSource.SONICWALL))
                    .toBe(AlertClassification.MALWARE);
                expect(service.classifyAlert('command and control traffic', AlertSource.SONICWALL))
                    .toBe(AlertClassification.MALWARE);
            });

            it('should classify authentication issues correctly', () => {
                expect(service.classifyAlert('VPN authentication failed', AlertSource.SONICWALL))
                    .toBe(AlertClassification.AUTHENTICATION);
                expect(service.classifyAlert('brute force login attempt', AlertSource.SONICWALL))
                    .toBe(AlertClassification.AUTHENTICATION);
                expect(service.classifyAlert('dictionary attack detected', AlertSource.SONICWALL))
                    .toBe(AlertClassification.AUTHENTICATION);
            });

            it('should classify content filtering as phishing', () => {
                expect(service.classifyAlert('content filter blocked site', AlertSource.SONICWALL))
                    .toBe(AlertClassification.PHISHING);
                expect(service.classifyAlert('phishing site blocked', AlertSource.SONICWALL))
                    .toBe(AlertClassification.PHISHING);
                expect(service.classifyAlert('malicious domain blocked', AlertSource.SONICWALL))
                    .toBe(AlertClassification.PHISHING);
            });

            it('should use network as default for SonicWall', () => {
                expect(service.classifyAlert('unknown firewall alert', AlertSource.SONICWALL))
                    .toBe(AlertClassification.NETWORK);
            });
        });

        describe('Avast Business mappings', () => {
            it('should classify malware detection correctly', () => {
                expect(service.classifyAlert('virus detected and quarantined', AlertSource.AVAST))
                    .toBe(AlertClassification.MALWARE);
                expect(service.classifyAlert('ransomware blocked', AlertSource.AVAST))
                    .toBe(AlertClassification.MALWARE);
                expect(service.classifyAlert('adware removal required', AlertSource.AVAST))
                    .toBe(AlertClassification.MALWARE);
            });

            it('should classify spyware correctly', () => {
                expect(service.classifyAlert('password stealer detected', AlertSource.AVAST))
                    .toBe(AlertClassification.SPYWARE);
                expect(service.classifyAlert('banking trojan found', AlertSource.AVAST))
                    .toBe(AlertClassification.SPYWARE);
                expect(service.classifyAlert('information stealer blocked', AlertSource.AVAST))
                    .toBe(AlertClassification.SPYWARE);
            });

            it('should classify phishing correctly', () => {
                expect(service.classifyAlert('phishing website blocked', AlertSource.AVAST))
                    .toBe(AlertClassification.PHISHING);
                expect(service.classifyAlert('fake website detected', AlertSource.AVAST))
                    .toBe(AlertClassification.PHISHING);
                expect(service.classifyAlert('social engineering attempt', AlertSource.AVAST))
                    .toBe(AlertClassification.PHISHING);
            });

            it('should use malware as default for Avast', () => {
                expect(service.classifyAlert('unknown threat detected', AlertSource.AVAST))
                    .toBe(AlertClassification.MALWARE);
            });
        });

        describe('Firewall Email mappings', () => {
            it('should classify high-level threats correctly', () => {
                expect(service.classifyAlert('High Priority Security Alert', AlertSource.FIREWALL_EMAIL))
                    .toBe(AlertClassification.NETWORK);
                expect(service.classifyAlert('malware detected in traffic', AlertSource.FIREWALL_EMAIL))
                    .toBe(AlertClassification.MALWARE);
                expect(service.classifyAlert('intrusion attempt detected', AlertSource.FIREWALL_EMAIL))
                    .toBe(AlertClassification.NETWORK);
                expect(service.classifyAlert('authentication failure reported', AlertSource.FIREWALL_EMAIL))
                    .toBe(AlertClassification.AUTHENTICATION);
                expect(service.classifyAlert('botnet activity detected', AlertSource.FIREWALL_EMAIL))
                    .toBe(AlertClassification.MALWARE);
            });

            it('should use other as default for email alerts', () => {
                expect(service.classifyAlert('general system notification', AlertSource.FIREWALL_EMAIL))
                    .toBe(AlertClassification.OTHER);
            });
        });
    });

    describe('Input Validation', () => {
        it('should handle invalid alert types gracefully', () => {
            expect(service.classifyAlert('', AlertSource.DEFENDER))
                .toBe(AlertClassification.OTHER);
            expect(service.classifyAlert(null as any, AlertSource.DEFENDER))
                .toBe(AlertClassification.OTHER);
            expect(service.classifyAlert(undefined as any, AlertSource.DEFENDER))
                .toBe(AlertClassification.OTHER);
            expect(service.classifyAlert(123 as any, AlertSource.DEFENDER))
                .toBe(AlertClassification.OTHER);
        });

        it('should handle unknown alert sources', () => {
            expect(service.classifyAlert('test alert', 'unknown_source' as AlertSource))
                .toBe(AlertClassification.OTHER);
        });
    });

    describe('Source Mapping Configuration', () => {
        it('should return mapping configuration for known sources', () => {
            const defenderMapping = service.getSourceMapping(AlertSource.DEFENDER);
            expect(defenderMapping.source).toBe(AlertSource.DEFENDER);
            expect(defenderMapping.defaultClassification).toBe(AlertClassification.OTHER);
            expect(defenderMapping.mappings).toBeDefined();
            expect(Object.keys(defenderMapping.mappings).length).toBeGreaterThan(0);
        });

        it('should return default mapping for unknown sources', () => {
            const unknownMapping = service.getSourceMapping('unknown' as AlertSource);
            expect(unknownMapping.source).toBe('unknown');
            expect(unknownMapping.defaultClassification).toBe(AlertClassification.OTHER);
            expect(Object.keys(unknownMapping.mappings)).toHaveLength(0);
        });
    });

    describe('Pattern Management', () => {
        it('should allow adding new classification patterns', () => {
            const testPattern = /test.*pattern/i;
            service.addClassificationPattern(
                AlertSource.DEFENDER,
                testPattern,
                AlertClassification.NETWORK,
                0.95
            );

            expect(service.classifyAlert('test pattern match', AlertSource.DEFENDER))
                .toBe(AlertClassification.NETWORK);
        });

        it('should validate confidence levels', () => {
            expect(() => {
                service.addClassificationPattern(
                    AlertSource.DEFENDER,
                    /test/,
                    AlertClassification.NETWORK,
                    1.5 // Invalid confidence > 1
                );
            }).toThrow('Confidence must be between 0 and 1');

            expect(() => {
                service.addClassificationPattern(
                    AlertSource.DEFENDER,
                    /test/,
                    AlertClassification.NETWORK,
                    -0.1 // Invalid confidence < 0
                );
            }).toThrow('Confidence must be between 0 and 1');
        });

        it('should allow updating default classifications', () => {
            service.updateDefaultClassification(AlertSource.DEFENDER, AlertClassification.MALWARE);

            // Test with an alert that doesn't match any patterns
            expect(service.classifyAlert('completely unknown alert type xyz123', AlertSource.DEFENDER))
                .toBe(AlertClassification.MALWARE);
        });

        it('should prioritize higher confidence patterns', () => {
            // Add two overlapping patterns with different confidence levels
            service.addClassificationPattern(
                AlertSource.DEFENDER,
                /priority.*test/i,
                AlertClassification.NETWORK,
                0.7
            );

            service.addClassificationPattern(
                AlertSource.DEFENDER,
                /priority.*test/i,
                AlertClassification.MALWARE,
                0.9
            );

            // Should use the higher confidence pattern (malware)
            expect(service.classifyAlert('priority test alert', AlertSource.DEFENDER))
                .toBe(AlertClassification.MALWARE);
        });
    });

    describe('Statistics and Monitoring', () => {
        it('should track classification statistics', () => {
            // Clear any existing stats
            service.resetStats();

            // Classify some alerts
            service.classifyAlert('malware detected', AlertSource.DEFENDER);
            service.classifyAlert('phishing email', AlertSource.DEFENDER);
            service.classifyAlert('malware blocked', AlertSource.SONICWALL);

            const stats = service.getClassificationStats();
            expect(stats[`${AlertSource.DEFENDER}:${AlertClassification.MALWARE}`]).toBe(1);
            expect(stats[`${AlertSource.DEFENDER}:${AlertClassification.PHISHING}`]).toBe(1);
            expect(stats[`${AlertSource.SONICWALL}:${AlertClassification.MALWARE}`]).toBe(1);
        });

        it('should reset statistics correctly', () => {
            service.classifyAlert('test alert', AlertSource.DEFENDER);
            expect(Object.keys(service.getClassificationStats()).length).toBeGreaterThan(0);

            service.resetStats();
            expect(Object.keys(service.getClassificationStats())).toHaveLength(0);
        });
    });

    describe('Mapping Coverage Validation', () => {
        it('should identify missing classifications for a source', () => {
            // Create a new service with limited mappings
            const limitedService = new AlertClassificationService();

            // Check coverage for a source (should show missing classifications)
            const missing = limitedService.validateMappingCoverage(AlertSource.DEFENDER);

            // Should be an array (might be empty if all classifications are covered)
            expect(Array.isArray(missing)).toBe(true);

            // Each missing item should be a valid AlertClassification
            missing.forEach(classification => {
                expect(Object.values(AlertClassification)).toContain(classification);
            });
        });

        it('should return all classifications as missing for unknown sources', () => {
            const missing = service.validateMappingCoverage('unknown' as AlertSource);
            expect(missing).toEqual(Object.values(AlertClassification));
        });
    });

    describe('Configuration Import/Export', () => {
        it('should export mapping configuration', () => {
            const exported = service.exportMappings();

            expect(exported).toBeDefined();
            expect(typeof exported).toBe('object');

            // Should contain known sources
            expect(exported[AlertSource.DEFENDER]).toBeDefined();
            expect(exported[AlertSource.SONICWALL]).toBeDefined();
            expect(exported[AlertSource.AVAST]).toBeDefined();
            expect(exported[AlertSource.FIREWALL_EMAIL]).toBeDefined();

            // Each source should have patterns and defaultClassification
            Object.values(exported).forEach((config: any) => {
                expect(config.patterns).toBeDefined();
                expect(Array.isArray(config.patterns)).toBe(true);
                expect(config.defaultClassification).toBeDefined();
                expect(Object.values(AlertClassification)).toContain(config.defaultClassification);
            });
        });

        it('should import mapping configuration', () => {
            const originalExport = service.exportMappings();

            // Create new service and import the configuration
            const newService = new AlertClassificationService();
            newService.importMappings(originalExport);

            // Test that imported mappings work the same way
            expect(newService.classifyAlert('malware detected', AlertSource.DEFENDER))
                .toBe(service.classifyAlert('malware detected', AlertSource.DEFENDER));
            expect(newService.classifyAlert('phishing email', AlertSource.DEFENDER))
                .toBe(service.classifyAlert('phishing email', AlertSource.DEFENDER));
        });

        it('should handle invalid import data gracefully', () => {
            const invalidConfig = {
                'invalid_source': {
                    patterns: [],
                    defaultClassification: AlertClassification.OTHER
                }
            };

            // Should not throw an error
            expect(() => {
                service.importMappings(invalidConfig);
            }).not.toThrow();
        });
    });

    describe('Case Sensitivity', () => {
        it('should handle case-insensitive matching', () => {
            expect(service.classifyAlert('MALWARE DETECTED', AlertSource.DEFENDER))
                .toBe(AlertClassification.MALWARE);
            expect(service.classifyAlert('Phishing Email', AlertSource.DEFENDER))
                .toBe(AlertClassification.PHISHING);
            expect(service.classifyAlert('brute FORCE attack', AlertSource.DEFENDER))
                .toBe(AlertClassification.AUTHENTICATION);
        });
    });

    describe('Pattern Matching Edge Cases', () => {
        it('should handle partial word matches correctly', () => {
            // These should match because patterns use word boundaries or partial matching
            expect(service.classifyAlert('malware-like behavior', AlertSource.DEFENDER))
                .toBe(AlertClassification.MALWARE);
            expect(service.classifyAlert('phishing attempt detected', AlertSource.DEFENDER))
                .toBe(AlertClassification.PHISHING);
        });

        it('should handle special characters in alert types', () => {
            expect(service.classifyAlert('malware (trojan.win32.test)', AlertSource.DEFENDER))
                .toBe(AlertClassification.MALWARE);
            expect(service.classifyAlert('phishing: credential theft attempt', AlertSource.DEFENDER))
                .toBe(AlertClassification.PHISHING);
            expect(service.classifyAlert('network-based attack [IPS]', AlertSource.SONICWALL))
                .toBe(AlertClassification.NETWORK);
        });
    });

    describe('Controlled Vocabulary Compliance', () => {
        it('should only return valid AVIAN classifications', () => {
            const testAlerts = [
                'malware detected',
                'phishing email',
                'spyware installation',
                'authentication failure',
                'network intrusion',
                'unknown alert type',
                'random text that matches nothing'
            ];

            testAlerts.forEach(alertType => {
                Object.values(AlertSource).forEach(source => {
                    const classification = service.classifyAlert(alertType, source);
                    expect(Object.values(AlertClassification)).toContain(classification);
                });
            });
        });

        it('should maintain consistent classification for identical inputs', () => {
            const alertType = 'malware detected on endpoint';
            const source = AlertSource.DEFENDER;

            const classification1 = service.classifyAlert(alertType, source);
            const classification2 = service.classifyAlert(alertType, source);
            const classification3 = service.classifyAlert(alertType, source);

            expect(classification1).toBe(classification2);
            expect(classification2).toBe(classification3);
        });
    });
});