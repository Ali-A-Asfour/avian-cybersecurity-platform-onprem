/**
 * NarrativeGenerator Service Tests
 * 
 * Tests for intelligent narrative generation, executive summaries,
 * key takeaways, and context-aware recommendations.
 */

import { NarrativeGenerator, ExecutiveSummaryData } from '../NarrativeGenerator';
import {
    EnhancedDateRange,
    AlertsDigest,
    UpdatesSummary,
    VulnerabilityPosture,
    AlertClassification,
    AlertSource,
    AlertSeverity
} from '@/types/reports';

describe('NarrativeGenerator', () => {
    let narrativeGenerator: NarrativeGenerator;
    let mockExecutiveSummaryData: ExecutiveSummaryData;

    beforeEach(() => {
        narrativeGenerator = new NarrativeGenerator();

        // Create mock data for testing
        const mockDateRange: EnhancedDateRange = {
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-07'),
            timezone: 'America/Toronto',
            weekStart: 'monday'
        };

        const mockAlertsDigest: AlertsDigest = {
            totalAlertsDigested: 45,
            alertClassification: {
                [AlertClassification.PHISHING]: 10,
                [AlertClassification.MALWARE]: 8,
                [AlertClassification.SPYWARE]: 5,
                [AlertClassification.AUTHENTICATION]: 12,
                [AlertClassification.NETWORK]: 7,
                [AlertClassification.OTHER]: 3
            },
            alertOutcomes: {
                securityIncidents: 2,
                benignActivity: 35,
                falsePositives: 8
            },
            weeklyTimeline: [
                { date: '2024-01-01', dayOfWeek: 'monday', count: 8 },
                { date: '2024-01-02', dayOfWeek: 'tuesday', count: 6 },
                { date: '2024-01-03', dayOfWeek: 'wednesday', count: 7 },
                { date: '2024-01-04', dayOfWeek: 'thursday', count: 9 },
                { date: '2024-01-05', dayOfWeek: 'friday', count: 5 },
                { date: '2024-01-06', dayOfWeek: 'saturday', count: 4 },
                { date: '2024-01-07', dayOfWeek: 'sunday', count: 6 }
            ],
            sourceBreakdown: {
                [AlertSource.DEFENDER]: 20,
                [AlertSource.SONICWALL]: 15,
                [AlertSource.AVAST]: 8,
                [AlertSource.FIREWALL_EMAIL]: 2
            }
        };

        const mockUpdatesSummary: UpdatesSummary = {
            totalUpdatesApplied: 127,
            updatesBySource: {
                windows: 85,
                microsoftOffice: 25,
                firewall: 12,
                other: 5
            }
        };

        const mockVulnerabilityPosture: VulnerabilityPosture = {
            totalDetected: 23,
            totalMitigated: 18,
            severityBreakdown: {
                critical: 2,
                high: 6,
                medium: 15
            }
        };

        mockExecutiveSummaryData = {
            alertsDigest: mockAlertsDigest,
            updatesSummary: mockUpdatesSummary,
            vulnerabilityPosture: mockVulnerabilityPosture,
            reportType: 'weekly',
            dateRange: mockDateRange
        };
    });

    describe('generateExecutiveNarrative', () => {
        it('should generate complete narrative content for weekly reports', async () => {
            const narrative = await narrativeGenerator.generateExecutiveNarrative(mockExecutiveSummaryData);

            expect(narrative).toHaveProperty('executiveSummary');
            expect(narrative).toHaveProperty('keyTakeaways');
            expect(narrative).toHaveProperty('recommendedActions');
            expect(narrative).toHaveProperty('riskTrendDirection');
            expect(narrative).toHaveProperty('businessImpactAssessment');

            // Validate executive summary content
            expect(narrative.executiveSummary).toContain('45'); // Total alerts
            expect(narrative.executiveSummary).toContain('2'); // Security incidents
            expect(narrative.executiveSummary.length).toBeGreaterThan(100);

            // Validate key takeaways (max 3)
            expect(narrative.keyTakeaways).toHaveLength(3);
            expect(narrative.keyTakeaways.every(takeaway => typeof takeaway === 'string')).toBe(true);

            // Validate risk trend direction
            expect(['increasing', 'stable', 'decreasing']).toContain(narrative.riskTrendDirection);

            // Validate business impact assessment
            expect(narrative.businessImpactAssessment.length).toBeGreaterThan(50);
        });

        it('should generate different narratives for different report types', async () => {
            const weeklyNarrative = await narrativeGenerator.generateExecutiveNarrative({
                ...mockExecutiveSummaryData,
                reportType: 'weekly'
            });

            const monthlyNarrative = await narrativeGenerator.generateExecutiveNarrative({
                ...mockExecutiveSummaryData,
                reportType: 'monthly'
            });

            const quarterlyNarrative = await narrativeGenerator.generateExecutiveNarrative({
                ...mockExecutiveSummaryData,
                reportType: 'quarterly'
            });

            // Narratives should be different for different report types
            expect(weeklyNarrative.executiveSummary).not.toBe(monthlyNarrative.executiveSummary);
            expect(monthlyNarrative.executiveSummary).not.toBe(quarterlyNarrative.executiveSummary);

            // Quarterly should be more business-focused
            expect(quarterlyNarrative.executiveSummary.toLowerCase()).toMatch(/business|value|strategic|operational/);
        });

        it('should adapt narrative based on security incident count', async () => {
            // Test with zero incidents
            const zeroIncidentsData = {
                ...mockExecutiveSummaryData,
                alertsDigest: {
                    ...mockExecutiveSummaryData.alertsDigest,
                    alertOutcomes: {
                        securityIncidents: 0,
                        benignActivity: 40,
                        falsePositives: 5
                    }
                }
            };

            const zeroIncidentsNarrative = await narrativeGenerator.generateExecutiveNarrative(zeroIncidentsData);

            // Test with high incidents
            const highIncidentsData = {
                ...mockExecutiveSummaryData,
                alertsDigest: {
                    ...mockExecutiveSummaryData.alertsDigest,
                    alertOutcomes: {
                        securityIncidents: 8,
                        benignActivity: 30,
                        falsePositives: 7
                    }
                }
            };

            const highIncidentsNarrative = await narrativeGenerator.generateExecutiveNarrative(highIncidentsData);

            // Zero incidents should have positive tone
            expect(zeroIncidentsNarrative.executiveSummary.toLowerCase()).toMatch(/excellent|zero|no.*incident/);
            expect(zeroIncidentsNarrative.riskTrendDirection).toBe('decreasing');

            // High incidents should have more cautious tone
            expect(highIncidentsNarrative.recommendedActions.length).toBeGreaterThan(0);
        });

        it('should include recommended actions for high-risk scenarios', async () => {
            const highRiskData = {
                ...mockExecutiveSummaryData,
                alertsDigest: {
                    ...mockExecutiveSummaryData.alertsDigest,
                    alertOutcomes: {
                        securityIncidents: 6,
                        benignActivity: 25,
                        falsePositives: 14
                    }
                },
                vulnerabilityPosture: {
                    ...mockExecutiveSummaryData.vulnerabilityPosture,
                    severityBreakdown: {
                        critical: 8,
                        high: 12,
                        medium: 15
                    }
                }
            };

            const narrative = await narrativeGenerator.generateExecutiveNarrative(highRiskData);

            expect(narrative.recommendedActions.length).toBeGreaterThan(0);
            expect(narrative.riskTrendDirection).toBe('increasing');
        });
    });

    describe('analyzeRiskTrends', () => {
        it('should correctly analyze risk trends from security data', () => {
            const riskAnalysis = (narrativeGenerator as any).analyzeRiskTrends(mockExecutiveSummaryData);

            expect(riskAnalysis).toHaveProperty('direction');
            expect(riskAnalysis).toHaveProperty('confidence');
            expect(riskAnalysis).toHaveProperty('primaryFactors');
            expect(riskAnalysis).toHaveProperty('riskScore');

            expect(['increasing', 'stable', 'decreasing']).toContain(riskAnalysis.direction);
            expect(['high', 'medium', 'low']).toContain(riskAnalysis.confidence);
            expect(Array.isArray(riskAnalysis.primaryFactors)).toBe(true);
            expect(riskAnalysis.riskScore).toBeGreaterThanOrEqual(0);
            expect(riskAnalysis.riskScore).toBeLessThanOrEqual(100);
        });

        it('should identify positive risk factors for good security posture', () => {
            const goodPostureData = {
                ...mockExecutiveSummaryData,
                alertsDigest: {
                    ...mockExecutiveSummaryData.alertsDigest,
                    alertOutcomes: {
                        securityIncidents: 0,
                        benignActivity: 40,
                        falsePositives: 5
                    }
                },
                vulnerabilityPosture: {
                    ...mockExecutiveSummaryData.vulnerabilityPosture,
                    totalDetected: 20,
                    totalMitigated: 18,
                    severityBreakdown: {
                        critical: 0,
                        high: 2,
                        medium: 18
                    }
                }
            };

            const riskAnalysis = (narrativeGenerator as any).analyzeRiskTrends(goodPostureData);

            expect(riskAnalysis.direction).toBe('decreasing');
            expect(riskAnalysis.primaryFactors).toContain('Zero security incidents');
            expect(riskAnalysis.riskScore).toBeLessThan(50);
        });
    });

    describe('generateContextAwareRecommendations', () => {
        it('should generate context-aware recommendations based on risk analysis', () => {
            const mockRiskAnalysis = {
                direction: 'increasing' as const,
                confidence: 'high' as const,
                primaryFactors: ['Elevated incident count', 'Critical vulnerabilities present'],
                riskScore: 75
            };

            const recommendations = narrativeGenerator.generateContextAwareRecommendations(
                mockExecutiveSummaryData,
                mockRiskAnalysis
            );

            expect(recommendations).toHaveProperty('immediate');
            expect(recommendations).toHaveProperty('shortTerm');
            expect(recommendations).toHaveProperty('strategic');
            expect(recommendations).toHaveProperty('priority');

            expect(Array.isArray(recommendations.immediate)).toBe(true);
            expect(Array.isArray(recommendations.shortTerm)).toBe(true);
            expect(Array.isArray(recommendations.strategic)).toBe(true);
            expect(['low', 'medium', 'high', 'critical']).toContain(recommendations.priority);

            // High risk score should generate recommendations
            expect(recommendations.immediate.length + recommendations.shortTerm.length).toBeGreaterThan(0);
        });

        it('should prioritize recommendations based on risk level', () => {
            const criticalRiskAnalysis = {
                direction: 'increasing' as const,
                confidence: 'high' as const,
                primaryFactors: ['Multiple security incidents', 'Critical vulnerabilities'],
                riskScore: 85
            };

            const criticalData = {
                ...mockExecutiveSummaryData,
                alertsDigest: {
                    ...mockExecutiveSummaryData.alertsDigest,
                    alertOutcomes: {
                        securityIncidents: 8,
                        benignActivity: 20,
                        falsePositives: 17
                    }
                }
            };

            const recommendations = narrativeGenerator.generateContextAwareRecommendations(
                criticalData,
                criticalRiskAnalysis
            );

            expect(recommendations.priority).toBe('critical');
            expect(recommendations.immediate.length).toBeGreaterThan(0);
        });
    });

    describe('performEnhancedRiskTrendAnalysis', () => {
        it('should perform comprehensive risk trend analysis', () => {
            const analysis = narrativeGenerator.performEnhancedRiskTrendAnalysis(mockExecutiveSummaryData);

            expect(analysis).toHaveProperty('currentRiskScore');
            expect(analysis).toHaveProperty('trendDirection');
            expect(analysis).toHaveProperty('confidenceLevel');
            expect(analysis).toHaveProperty('riskFactors');
            expect(analysis).toHaveProperty('projectedRiskScore');
            expect(analysis).toHaveProperty('timeToNextReview');

            expect(analysis.currentRiskScore).toBeGreaterThanOrEqual(0);
            expect(analysis.currentRiskScore).toBeLessThanOrEqual(100);
            expect(analysis.projectedRiskScore).toBeGreaterThanOrEqual(0);
            expect(analysis.projectedRiskScore).toBeLessThanOrEqual(100);
            expect(analysis.timeToNextReview).toBeGreaterThan(0);
            expect(Array.isArray(analysis.riskFactors)).toBe(true);
        });

        it('should include detailed risk factors with impact assessment', () => {
            const analysis = narrativeGenerator.performEnhancedRiskTrendAnalysis(mockExecutiveSummaryData);

            expect(analysis.riskFactors.length).toBeGreaterThan(0);

            analysis.riskFactors.forEach(factor => {
                expect(factor).toHaveProperty('factor');
                expect(factor).toHaveProperty('impact');
                expect(factor).toHaveProperty('weight');
                expect(factor).toHaveProperty('description');
                expect(['positive', 'negative', 'neutral']).toContain(factor.impact);
                expect(factor.weight).toBeGreaterThan(0);
                expect(factor.weight).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('generateDynamicTemplate', () => {
        it('should select appropriate template based on data patterns', () => {
            const template = narrativeGenerator.generateDynamicTemplate(
                mockExecutiveSummaryData,
                {
                    direction: 'stable',
                    confidence: 'medium',
                    primaryFactors: [],
                    riskScore: 45
                }
            );

            expect(template).toHaveProperty('templateId');
            expect(template).toHaveProperty('templateName');
            expect(template).toHaveProperty('applicabilityScore');
            expect(template).toHaveProperty('customizations');

            expect(template.applicabilityScore).toBeGreaterThan(0);
            expect(template.applicabilityScore).toBeLessThanOrEqual(1);
            expect(typeof template.templateId).toBe('string');
            expect(typeof template.templateName).toBe('string');
        });

        it('should provide different templates for different report types', () => {
            const weeklyTemplate = narrativeGenerator.generateDynamicTemplate(
                { ...mockExecutiveSummaryData, reportType: 'weekly' },
                { direction: 'stable', confidence: 'medium', primaryFactors: [], riskScore: 45 }
            );

            const quarterlyTemplate = narrativeGenerator.generateDynamicTemplate(
                { ...mockExecutiveSummaryData, reportType: 'quarterly' },
                { direction: 'decreasing', confidence: 'high', primaryFactors: [], riskScore: 30 }
            );

            expect(weeklyTemplate.templateId).not.toBe(quarterlyTemplate.templateId);
        });
    });

    describe('analyzeDataPatterns', () => {
        it('should correctly analyze data patterns', () => {
            const patterns = narrativeGenerator.analyzeDataPatterns(mockExecutiveSummaryData);

            expect(patterns).toHaveProperty('alertVolumePattern');
            expect(patterns).toHaveProperty('incidentSeverityPattern');
            expect(patterns).toHaveProperty('vulnerabilityTrendPattern');
            expect(patterns).toHaveProperty('overallRiskAssessment');

            expect(['low', 'normal', 'high', 'very_high']).toContain(patterns.alertVolumePattern);
            expect(['none', 'low', 'moderate', 'high']).toContain(patterns.incidentSeverityPattern);
            expect(['improving', 'stable', 'concerning']).toContain(patterns.vulnerabilityTrendPattern);
            expect(['low', 'moderate', 'elevated', 'high']).toContain(patterns.overallRiskAssessment);
        });

        it('should identify high-risk patterns correctly', () => {
            const highRiskData = {
                ...mockExecutiveSummaryData,
                alertsDigest: {
                    ...mockExecutiveSummaryData.alertsDigest,
                    totalAlertsDigested: 250, // Very high volume
                    alertOutcomes: {
                        securityIncidents: 8, // High incidents
                        benignActivity: 200,
                        falsePositives: 42
                    }
                },
                vulnerabilityPosture: {
                    ...mockExecutiveSummaryData.vulnerabilityPosture,
                    totalDetected: 50,
                    totalMitigated: 15, // Low mitigation rate
                    severityBreakdown: {
                        critical: 10, // Many critical vulns
                        high: 20,
                        medium: 20
                    }
                }
            };

            const patterns = narrativeGenerator.analyzeDataPatterns(highRiskData);

            expect(patterns.alertVolumePattern).toBe('very_high');
            expect(patterns.incidentSeverityPattern).toBe('high');
            expect(patterns.vulnerabilityTrendPattern).toBe('concerning');
            expect(['elevated', 'high']).toContain(patterns.overallRiskAssessment);
        });
    });

    describe('error handling', () => {
        it('should handle missing trend data gracefully', async () => {
            const dataWithoutTrends = {
                ...mockExecutiveSummaryData,
                trends: undefined
            };

            const narrative = await narrativeGenerator.generateExecutiveNarrative(dataWithoutTrends);

            expect(narrative).toHaveProperty('executiveSummary');
            expect(narrative).toHaveProperty('keyTakeaways');
            expect(narrative.keyTakeaways).toHaveLength(3);
        });

        it('should provide fallback narrative on generation failure', async () => {
            // Create invalid data that might cause errors
            const invalidData = {
                ...mockExecutiveSummaryData,
                alertsDigest: null as any
            };

            const narrative = await narrativeGenerator.generateExecutiveNarrative(invalidData);

            // Should still return a valid narrative structure
            expect(narrative).toHaveProperty('executiveSummary');
            expect(narrative).toHaveProperty('keyTakeaways');
            expect(narrative).toHaveProperty('riskTrendDirection');
            expect(narrative.riskTrendDirection).toBe('stable');
        });
    });
});