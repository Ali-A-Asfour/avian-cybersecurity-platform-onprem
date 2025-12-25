/**
 * Alert Classification Service
 * 
 * Normalizes vendor-specific alert types to AVIAN standard classifications.
 * Implements mapping configuration for different alert sources with source tracking
 * and attribution logic for controlled vocabulary compliance.
 * 
 * Requirements: 2.3, controlled vocabulary
 */

import { logger } from '@/lib/logger';
import {
    AlertClassification,
    AlertSource,
    ClassificationMapping
} from '@/types/reports';

/**
 * Vendor-specific alert type mappings to AVIAN classifications
 */
interface VendorMapping {
    patterns: Array<{
        pattern: RegExp;
        classification: AlertClassification;
        confidence: number; // 0-1, higher is more confident
    }>;
    defaultClassification: AlertClassification;
}

/**
 * Alert Classification Service
 * 
 * Provides normalization of vendor alert types to standardized AVIAN classifications
 * with extensible mapping configuration and source attribution.
 */
export class AlertClassificationService {
    private readonly vendorMappings: Map<AlertSource, VendorMapping>;
    private readonly classificationStats: Map<string, number>;

    constructor() {
        this.vendorMappings = new Map();
        this.classificationStats = new Map();
        this.initializeDefaultMappings();
    }

    /**
     * Initializes default vendor mappings for known alert sources
     */
    private initializeDefaultMappings(): void {
        // Microsoft Defender mappings
        this.vendorMappings.set(AlertSource.DEFENDER, {
            patterns: [
                // Phishing patterns
                { pattern: /phish|email.*threat|suspicious.*email|credential.*harvest/i, classification: AlertClassification.PHISHING, confidence: 0.9 },
                { pattern: /spear.*phish|business.*email.*compromise|bec/i, classification: AlertClassification.PHISHING, confidence: 0.95 },

                // Malware patterns
                { pattern: /malware|virus|trojan|backdoor|ransomware|cryptolocker/i, classification: AlertClassification.MALWARE, confidence: 0.9 },
                { pattern: /wannacry|petya|ryuk|maze|conti|lockbit/i, classification: AlertClassification.MALWARE, confidence: 0.95 },

                // Spyware patterns
                { pattern: /spyware|keylogger|infostealer|credential.*theft|data.*exfiltration/i, classification: AlertClassification.SPYWARE, confidence: 0.9 },
                { pattern: /mimikatz|cobalt.*strike|powershell.*empire/i, classification: AlertClassification.SPYWARE, confidence: 0.95 },

                // Authentication patterns
                { pattern: /authentication|login.*failure|brute.*force|credential.*attack/i, classification: AlertClassification.AUTHENTICATION, confidence: 0.85 },
                { pattern: /password.*spray|credential.*stuffing|suspicious.*sign.*in/i, classification: AlertClassification.AUTHENTICATION, confidence: 0.9 },

                // Network patterns
                { pattern: /network|connection|communication|c2|command.*control/i, classification: AlertClassification.NETWORK, confidence: 0.8 },
                { pattern: /lateral.*movement|network.*scan|port.*scan|beacon/i, classification: AlertClassification.NETWORK, confidence: 0.85 }
            ],
            defaultClassification: AlertClassification.OTHER
        });

        // SonicWall firewall mappings
        this.vendorMappings.set(AlertSource.SONICWALL, {
            patterns: [
                // Network-based threats
                { pattern: /ips.*attack|intrusion|exploit|vulnerability.*exploit/i, classification: AlertClassification.NETWORK, confidence: 0.9 },
                { pattern: /dos|ddos|flood|syn.*flood|icmp.*flood/i, classification: AlertClassification.NETWORK, confidence: 0.95 },

                // Malware detection
                { pattern: /malware|virus|trojan|gateway.*antivirus|gav/i, classification: AlertClassification.MALWARE, confidence: 0.9 },
                { pattern: /botnet|c&c|command.*control/i, classification: AlertClassification.MALWARE, confidence: 0.85 },

                // Authentication issues
                { pattern: /vpn.*failure|authentication.*failed|login.*denied/i, classification: AlertClassification.AUTHENTICATION, confidence: 0.8 },
                { pattern: /brute.*force|dictionary.*attack|password.*attack/i, classification: AlertClassification.AUTHENTICATION, confidence: 0.9 },

                // Content filtering (often phishing related)
                { pattern: /content.*filter|web.*filter|url.*block|phishing.*site/i, classification: AlertClassification.PHISHING, confidence: 0.7 },
                { pattern: /suspicious.*url|malicious.*domain|reputation.*block/i, classification: AlertClassification.PHISHING, confidence: 0.8 }
            ],
            defaultClassification: AlertClassification.NETWORK
        });

        // Avast Business mappings
        this.vendorMappings.set(AlertSource.AVAST, {
            patterns: [
                // Spyware and data theft (more specific patterns first with higher confidence)
                { pattern: /spyware|keylogger|password.*stealer|banking.*trojan/i, classification: AlertClassification.SPYWARE, confidence: 0.95 },
                { pattern: /data.*theft|information.*stealer|credential.*harvest/i, classification: AlertClassification.SPYWARE, confidence: 0.9 },

                // Malware detection (general patterns with lower confidence)
                { pattern: /malware|virus|trojan|worm|adware|pup/i, classification: AlertClassification.MALWARE, confidence: 0.85 },
                { pattern: /ransomware|cryptolocker|file.*encryption/i, classification: AlertClassification.MALWARE, confidence: 0.95 },

                // Phishing and email threats
                { pattern: /phishing|email.*threat|suspicious.*attachment/i, classification: AlertClassification.PHISHING, confidence: 0.85 },
                { pattern: /fake.*website|credential.*phishing|social.*engineering/i, classification: AlertClassification.PHISHING, confidence: 0.9 },

                // Network threats
                { pattern: /network.*threat|suspicious.*connection|c2.*communication/i, classification: AlertClassification.NETWORK, confidence: 0.8 }
            ],
            defaultClassification: AlertClassification.MALWARE
        });

        // Firewall email alerts (parsed from email notifications)
        this.vendorMappings.set(AlertSource.FIREWALL_EMAIL, {
            patterns: [
                // High-level threat categories from email subjects/bodies
                { pattern: /high.*priority|critical.*alert|security.*incident/i, classification: AlertClassification.NETWORK, confidence: 0.7 },
                { pattern: /malware.*detected|virus.*found|threat.*blocked/i, classification: AlertClassification.MALWARE, confidence: 0.8 },
                { pattern: /intrusion.*attempt|attack.*detected|suspicious.*activity/i, classification: AlertClassification.NETWORK, confidence: 0.8 },
                { pattern: /authentication.*failure|login.*attempt|access.*denied/i, classification: AlertClassification.AUTHENTICATION, confidence: 0.75 },
                { pattern: /botnet|command.*control|c2.*detected/i, classification: AlertClassification.MALWARE, confidence: 0.85 }
            ],
            defaultClassification: AlertClassification.OTHER
        });

        logger.info('Alert classification mappings initialized', {
            sources: Array.from(this.vendorMappings.keys()),
            totalPatterns: Array.from(this.vendorMappings.values()).reduce((sum, mapping) => sum + mapping.patterns.length, 0),
            category: 'reports'
        });
    }

    /**
     * Classifies an alert based on its type and source
     * 
     * @param alertType - Raw alert type from vendor
     * @param source - Alert source (vendor)
     * @returns AlertClassification - Normalized AVIAN classification
     */
    classifyAlert(alertType: string, source: AlertSource): AlertClassification {
        if (!alertType || typeof alertType !== 'string') {
            logger.warn('Invalid alert type provided for classification', {
                alertType,
                source,
                category: 'reports'
            });
            return AlertClassification.OTHER;
        }

        const mapping = this.vendorMappings.get(source);
        if (!mapping) {
            logger.warn('No mapping found for alert source', {
                source,
                alertType,
                category: 'reports'
            });
            return AlertClassification.OTHER;
        }

        // Find the best matching pattern
        let bestMatch: { classification: AlertClassification; confidence: number } | null = null;

        for (const pattern of mapping.patterns) {
            if (pattern.pattern.test(alertType)) {
                if (!bestMatch || pattern.confidence > bestMatch.confidence) {
                    bestMatch = {
                        classification: pattern.classification,
                        confidence: pattern.confidence
                    };
                }
            }
        }

        const classification = bestMatch ? bestMatch.classification : mapping.defaultClassification;

        // Update statistics
        const statsKey = `${source}:${classification}`;
        this.classificationStats.set(statsKey, (this.classificationStats.get(statsKey) || 0) + 1);

        logger.debug('Alert classified', {
            alertType,
            source,
            classification,
            confidence: bestMatch?.confidence || 0,
            category: 'reports'
        });

        return classification;
    }

    /**
     * Gets the source mapping configuration for a specific alert source
     * 
     * @param source - Alert source to get mapping for
     * @returns ClassificationMapping - Mapping configuration
     */
    getSourceMapping(source: AlertSource): ClassificationMapping {
        const mapping = this.vendorMappings.get(source);
        if (!mapping) {
            return {
                source,
                mappings: {},
                defaultClassification: AlertClassification.OTHER
            };
        }

        // Convert patterns to simple string mappings for external consumption
        const mappings: Record<string, AlertClassification> = {};
        mapping.patterns.forEach((pattern, index) => {
            mappings[`pattern_${index}`] = pattern.classification;
        });

        return {
            source,
            mappings,
            defaultClassification: mapping.defaultClassification
        };
    }

    /**
     * Adds or updates a classification pattern for a source
     * 
     * @param source - Alert source
     * @param pattern - Regular expression pattern
     * @param classification - AVIAN classification to map to
     * @param confidence - Confidence level (0-1)
     */
    addClassificationPattern(
        source: AlertSource,
        pattern: RegExp,
        classification: AlertClassification,
        confidence: number = 0.8
    ): void {
        if (confidence < 0 || confidence > 1) {
            throw new Error('Confidence must be between 0 and 1');
        }

        let mapping = this.vendorMappings.get(source);
        if (!mapping) {
            mapping = {
                patterns: [],
                defaultClassification: AlertClassification.OTHER
            };
            this.vendorMappings.set(source, mapping);
        }

        mapping.patterns.push({
            pattern,
            classification,
            confidence
        });

        // Sort patterns by confidence (highest first) for better matching
        mapping.patterns.sort((a, b) => b.confidence - a.confidence);

        logger.info('Classification pattern added', {
            source,
            pattern: pattern.source,
            classification,
            confidence,
            category: 'reports'
        });
    }

    /**
     * Updates the default classification for a source
     * 
     * @param source - Alert source
     * @param defaultClassification - Default classification to use
     */
    updateDefaultClassification(source: AlertSource, defaultClassification: AlertClassification): void {
        let mapping = this.vendorMappings.get(source);
        if (!mapping) {
            mapping = {
                patterns: [],
                defaultClassification
            };
            this.vendorMappings.set(source, mapping);
        } else {
            mapping.defaultClassification = defaultClassification;
        }

        logger.info('Default classification updated', {
            source,
            defaultClassification,
            category: 'reports'
        });
    }

    /**
     * Gets classification statistics for monitoring and tuning
     * 
     * @returns Record<string, number> - Classification counts by source:classification
     */
    getClassificationStats(): Record<string, number> {
        return Object.fromEntries(this.classificationStats);
    }

    /**
     * Resets classification statistics
     */
    resetStats(): void {
        this.classificationStats.clear();
        logger.info('Classification statistics reset', {
            category: 'reports'
        });
    }

    /**
     * Validates that all required AVIAN classifications are covered by mappings
     * 
     * @param source - Alert source to validate
     * @returns Array of missing classifications
     */
    validateMappingCoverage(source: AlertSource): AlertClassification[] {
        const mapping = this.vendorMappings.get(source);
        if (!mapping) {
            return Object.values(AlertClassification);
        }

        const coveredClassifications = new Set<AlertClassification>();
        coveredClassifications.add(mapping.defaultClassification);

        mapping.patterns.forEach(pattern => {
            coveredClassifications.add(pattern.classification);
        });

        const allClassifications = Object.values(AlertClassification);
        const missing = allClassifications.filter(classification =>
            !coveredClassifications.has(classification)
        );

        return missing;
    }

    /**
     * Exports mapping configuration for backup or transfer
     * 
     * @returns Serializable mapping configuration
     */
    exportMappings(): Record<string, any> {
        const exported: Record<string, any> = {};

        this.vendorMappings.forEach((mapping, source) => {
            exported[source] = {
                patterns: mapping.patterns.map(p => ({
                    pattern: p.pattern.source,
                    flags: p.pattern.flags,
                    classification: p.classification,
                    confidence: p.confidence
                })),
                defaultClassification: mapping.defaultClassification
            };
        });

        return exported;
    }

    /**
     * Imports mapping configuration from exported data
     * 
     * @param mappings - Exported mapping configuration
     */
    importMappings(mappings: Record<string, any>): void {
        Object.entries(mappings).forEach(([source, config]) => {
            if (!Object.values(AlertSource).includes(source as AlertSource)) {
                logger.warn('Unknown alert source in import', { source, category: 'reports' });
                return;
            }

            const patterns = config.patterns.map((p: any) => ({
                pattern: new RegExp(p.pattern, p.flags),
                classification: p.classification,
                confidence: p.confidence
            }));

            this.vendorMappings.set(source as AlertSource, {
                patterns,
                defaultClassification: config.defaultClassification
            });
        });

        logger.info('Mapping configuration imported', {
            sources: Object.keys(mappings),
            category: 'reports'
        });
    }
}

/**
 * Default instance for use throughout the application
 */
export const alertClassificationService = new AlertClassificationService();