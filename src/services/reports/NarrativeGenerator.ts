/**
 * Narrative Generator Service
 * 
 * Implements intelligent narrative generation for executive summaries, key takeaways,
 * and recommended actions based on data trends and patterns.
 * 
 * Requirements: 5.4, 6.1, 6.2, 6.4, 6.5, automated insights, executive communication
 */

import { logger } from '@/lib/logger';
import {
    EnhancedDateRange,
    AlertsDigest,
    UpdatesSummary,
    VulnerabilityPosture,
    TrendData,
    RecurringAlertType,
    VulnerabilityAging,
    AlertClassification,
    AlertSeverity
} from '@/types/reports';

/**
 * Executive summary data for narrative generation
 */
export interface ExecutiveSummaryData {
    alertsDigest: AlertsDigest;
    updatesSummary: UpdatesSummary;
    vulnerabilityPosture: VulnerabilityPosture;
    trends?: {
        weekOverWeekTrends: TrendData[];
        recurringAlertTypes: RecurringAlertType[];
        vulnerabilityAging: VulnerabilityAging;
    };
    reportType: 'weekly' | 'monthly' | 'quarterly';
    dateRange: EnhancedDateRange;
}

/**
 * Generated narrative content
 */
export interface NarrativeContent {
    executiveSummary: string;
    keyTakeaways: string[];
    recommendedActions: string[];
    riskTrendDirection: 'increasing' | 'stable' | 'decreasing';
    businessImpactAssessment: string;
}

/**
 * Risk trend analysis result
 */
export interface RiskTrendAnalysis {
    direction: 'increasing' | 'stable' | 'decreasing';
    confidence: 'high' | 'medium' | 'low';
    primaryFactors: string[];
    riskScore: number; // 0-100, where 100 is highest risk
}

/**
 * Narrative template for different scenarios
 */
interface NarrativeTemplate {
    scenario: string;
    executiveSummaryTemplate: string;
    keyTakeawaysTemplates: string[];
    recommendedActionsTemplates: string[];
    businessImpactTemplate: string;
}

/**
 * Narrative Generator Service
 * 
 * Analyzes security data trends and generates executive-friendly narratives
 * with context-aware recommendations and risk trend analysis.
 */
export class NarrativeGenerator {
    private readonly narrativeTemplates: Map<string, NarrativeTemplate>;

    constructor() {
        this.narrativeTemplates = this.initializeNarrativeTemplates();
    }

    /**
     * Generate complete narrative content for executive summaries
     */
    async generateExecutiveNarrative(data: ExecutiveSummaryData): Promise<NarrativeContent> {
        try {
            logger.info('Starting executive narrative generation', {
                reportType: data.reportType,
                dateRange: { start: data.dateRange.startDate, end: data.dateRange.endDate },
                category: 'reports'
            });

            // Analyze risk trends
            const riskTrendAnalysis = this.analyzeRiskTrends(data);

            // Determine narrative scenario based on data patterns
            const scenario = this.determineNarrativeScenario(data, riskTrendAnalysis);

            // Generate executive summary
            const executiveSummary = this.generateExecutiveSummary(data, scenario, riskTrendAnalysis);

            // Generate key takeaways (max 3 bullet points)
            const keyTakeaways = this.generateKeyTakeaways(data, scenario, riskTrendAnalysis);

            // Generate recommended actions when applicable
            const recommendedActions = this.generateRecommendedActions(data, scenario, riskTrendAnalysis);

            // Generate business impact assessment
            const businessImpactAssessment = this.generateBusinessImpactAssessment(data, riskTrendAnalysis);

            const narrative: NarrativeContent = {
                executiveSummary,
                keyTakeaways: keyTakeaways.slice(0, 3), // Ensure max 3 takeaways
                recommendedActions,
                riskTrendDirection: riskTrendAnalysis.direction,
                businessImpactAssessment
            };

            logger.info('Executive narrative generation completed', {
                reportType: data.reportType,
                scenario,
                riskTrendDirection: riskTrendAnalysis.direction,
                keyTakeawaysCount: narrative.keyTakeaways.length,
                recommendedActionsCount: narrative.recommendedActions.length,
                category: 'reports'
            });

            return narrative;

        } catch (error) {
            logger.error('Failed to generate executive narrative', error instanceof Error ? error : new Error(String(error)), {
                reportType: data.reportType,
                dateRange: { start: data.dateRange.startDate, end: data.dateRange.endDate },
                category: 'reports'
            });

            // Return fallback narrative
            return this.generateFallbackNarrative(data);
        }
    }

    /**
     * Analyze risk trends from security data
     */
    private analyzeRiskTrends(data: ExecutiveSummaryData): RiskTrendAnalysis {
        let riskScore = 50; // Base risk score
        let direction: 'increasing' | 'stable' | 'decreasing' = 'stable';
        let confidence: 'high' | 'medium' | 'low' = 'medium';
        const primaryFactors: string[] = [];

        // Validate input data
        if (!data.alertsDigest || !data.alertsDigest.alertOutcomes) {
            return {
                direction: 'stable',
                confidence: 'low',
                primaryFactors: ['Insufficient data for analysis'],
                riskScore: 50
            };
        }

        // Analyze security incidents
        const securityIncidents = data.alertsDigest.alertOutcomes.securityIncidents;
        if (securityIncidents === 0) {
            riskScore -= 20;
            primaryFactors.push('Zero security incidents');
            direction = 'decreasing';
        } else if (securityIncidents > 5) {
            riskScore += 25;
            primaryFactors.push('Elevated incident count');
            direction = 'increasing';
        }

        // Analyze vulnerability posture
        const vulnMitigationRate = data.vulnerabilityPosture.totalDetected > 0
            ? (data.vulnerabilityPosture.totalMitigated / data.vulnerabilityPosture.totalDetected) * 100
            : 100;

        if (vulnMitigationRate >= 80) {
            riskScore -= 15;
            primaryFactors.push('High vulnerability remediation rate');
            if (direction !== 'increasing') direction = 'decreasing';
        } else if (vulnMitigationRate < 50) {
            riskScore += 20;
            primaryFactors.push('Low vulnerability remediation rate');
            direction = 'increasing';
        }

        // Analyze critical vulnerabilities
        const criticalVulns = data.vulnerabilityPosture.severityBreakdown.critical;
        if (criticalVulns > 0) {
            riskScore += 15;
            primaryFactors.push('Critical vulnerabilities present');
            if (direction !== 'decreasing') direction = 'increasing';
        }

        // Analyze trends for monthly/quarterly reports
        if (data.trends && data.trends.weekOverWeekTrends.length > 0) {
            const alertTrend = data.trends.weekOverWeekTrends.find(t =>
                t.metric.toLowerCase().includes('alert')
            );

            if (alertTrend) {
                if (alertTrend.trend === 'down' && alertTrend.changePercentage > 10) {
                    riskScore -= 10;
                    primaryFactors.push('Declining alert volume');
                    confidence = 'high';
                } else if (alertTrend.trend === 'up' && alertTrend.changePercentage > 20) {
                    riskScore += 15;
                    primaryFactors.push('Increasing alert volume');
                    confidence = 'high';
                }
            }
        }

        // Analyze recurring alert patterns
        if (data.trends && data.trends.recurringAlertTypes.length > 0) {
            const highFrequencyAlerts = data.trends.recurringAlertTypes.filter(
                alert => alert.frequency > 10
            );
            if (highFrequencyAlerts.length > 0) {
                riskScore += 10;
                primaryFactors.push('Recurring security patterns detected');
            }
        }

        // Normalize risk score
        riskScore = Math.max(0, Math.min(100, riskScore));

        // Determine final direction if still stable
        if (direction === 'stable') {
            if (riskScore < 40) {
                direction = 'decreasing';
            } else if (riskScore > 60) {
                direction = 'increasing';
            }
        }

        return {
            direction,
            confidence,
            primaryFactors: primaryFactors.slice(0, 3), // Top 3 factors
            riskScore
        };
    }

    /**
     * Determine narrative scenario based on data patterns
     */
    private determineNarrativeScenario(
        data: ExecutiveSummaryData,
        riskAnalysis: RiskTrendAnalysis
    ): string {
        const { alertsDigest, vulnerabilityPosture, reportType } = data;

        // Validate input data
        if (!alertsDigest || !alertsDigest.alertOutcomes) {
            return 'generic_fallback';
        }

        const securityIncidents = alertsDigest.alertOutcomes.securityIncidents;
        const totalAlerts = alertsDigest.totalAlertsDigested;

        // Quarterly scenarios (business-focused)
        if (reportType === 'quarterly') {
            if (securityIncidents === 0 && riskAnalysis.direction === 'decreasing') {
                return 'quarterly_excellent_posture';
            } else if (securityIncidents <= 2 && riskAnalysis.riskScore < 50) {
                return 'quarterly_strong_performance';
            } else {
                return 'quarterly_improvement_focus';
            }
        }

        // Monthly scenarios (trend-focused)
        if (reportType === 'monthly') {
            if (riskAnalysis.direction === 'decreasing' && securityIncidents <= 1) {
                return 'monthly_positive_trends';
            } else if (riskAnalysis.direction === 'increasing') {
                return 'monthly_elevated_activity';
            } else {
                return 'monthly_stable_operations';
            }
        }

        // Weekly scenarios (operational focus)
        if (securityIncidents === 0 && totalAlerts < 50) {
            return 'weekly_quiet_period';
        } else if (securityIncidents === 0 && totalAlerts >= 50) {
            return 'weekly_active_monitoring';
        } else if (securityIncidents <= 2) {
            return 'weekly_managed_incidents';
        } else {
            return 'weekly_elevated_activity';
        }
    }

    /**
     * Generate executive summary based on scenario and data
     */
    private generateExecutiveSummary(
        data: ExecutiveSummaryData,
        scenario: string,
        riskAnalysis: RiskTrendAnalysis
    ): string {
        const template = this.narrativeTemplates.get(scenario);
        if (!template) {
            return this.generateGenericExecutiveSummary(data, riskAnalysis);
        }

        // Replace template variables with actual data
        let summary = template.executiveSummaryTemplate;

        // Common replacements
        summary = summary.replace('{totalAlerts}', data.alertsDigest.totalAlertsDigested.toString());
        summary = summary.replace('{securityIncidents}', data.alertsDigest.alertOutcomes.securityIncidents.toString());
        summary = summary.replace('{totalUpdates}', data.updatesSummary.totalUpdatesApplied.toString());
        summary = summary.replace('{vulnerabilitiesDetected}', data.vulnerabilityPosture.totalDetected.toString());
        summary = summary.replace('{vulnerabilitiesMitigated}', data.vulnerabilityPosture.totalMitigated.toString());

        // Calculate mitigation rate
        const mitigationRate = data.vulnerabilityPosture.totalDetected > 0
            ? Math.round((data.vulnerabilityPosture.totalMitigated / data.vulnerabilityPosture.totalDetected) * 100)
            : 0;
        summary = summary.replace('{mitigationRate}', mitigationRate.toString());

        // Risk trend context
        const riskTrendText = this.getRiskTrendDescription(riskAnalysis);
        summary = summary.replace('{riskTrend}', riskTrendText);

        // Report period context
        const periodText = this.getReportPeriodDescription(data.reportType);
        summary = summary.replace('{reportPeriod}', periodText);

        return summary;
    }

    /**
     * Generate key takeaways (max 3 bullet points)
     */
    private generateKeyTakeaways(
        data: ExecutiveSummaryData,
        scenario: string,
        riskAnalysis: RiskTrendAnalysis
    ): string[] {
        const template = this.narrativeTemplates.get(scenario);
        const takeaways: string[] = [];

        if (template && template.keyTakeawaysTemplates.length > 0) {
            // Use template-based takeaways
            template.keyTakeawaysTemplates.forEach(takeawayTemplate => {
                let takeaway = takeawayTemplate;
                takeaway = takeaway.replace('{securityIncidents}', data.alertsDigest.alertOutcomes.securityIncidents.toString());
                takeaway = takeaway.replace('{totalAlerts}', data.alertsDigest.totalAlertsDigested.toString());
                takeaway = takeaway.replace('{vulnerabilitiesMitigated}', data.vulnerabilityPosture.totalMitigated.toString());

                const mitigationRate = data.vulnerabilityPosture.totalDetected > 0
                    ? Math.round((data.vulnerabilityPosture.totalMitigated / data.vulnerabilityPosture.totalDetected) * 100)
                    : 0;
                takeaway = takeaway.replace('{mitigationRate}', mitigationRate.toString());

                takeaways.push(takeaway);
            });
        } else {
            // Generate generic takeaways
            takeaways.push(...this.generateGenericKeyTakeaways(data, riskAnalysis));
        }

        return takeaways.slice(0, 3); // Ensure max 3 takeaways
    }

    /**
     * Generate recommended actions when applicable
     */
    private generateRecommendedActions(
        data: ExecutiveSummaryData,
        scenario: string,
        riskAnalysis: RiskTrendAnalysis
    ): string[] {
        const template = this.narrativeTemplates.get(scenario);
        const actions: string[] = [];

        // Only provide recommendations if there are actionable items
        if (riskAnalysis.riskScore > 60 || data.alertsDigest.alertOutcomes.securityIncidents > 2) {
            if (template && template.recommendedActionsTemplates.length > 0) {
                actions.push(...template.recommendedActionsTemplates);
            } else {
                actions.push(...this.generateGenericRecommendedActions(data, riskAnalysis));
            }
        }

        return actions;
    }

    /**
     * Generate business impact assessment
     */
    private generateBusinessImpactAssessment(
        data: ExecutiveSummaryData,
        riskAnalysis: RiskTrendAnalysis
    ): string {
        const securityIncidents = data.alertsDigest.alertOutcomes.securityIncidents;
        const mitigationRate = data.vulnerabilityPosture.totalDetected > 0
            ? Math.round((data.vulnerabilityPosture.totalMitigated / data.vulnerabilityPosture.totalDetected) * 100)
            : 0;

        if (securityIncidents === 0 && mitigationRate >= 80) {
            return 'Excellent security posture with no business disruption and strong risk mitigation. Security investments are delivering measurable value through threat prevention and operational continuity.';
        } else if (securityIncidents <= 2 && mitigationRate >= 60) {
            return 'Strong security performance with minimal business impact. Proactive security measures are effectively protecting business operations while maintaining compliance and customer trust.';
        } else if (riskAnalysis.direction === 'decreasing') {
            return 'Improving security posture with positive risk reduction trends. Enhanced security measures are strengthening business resilience and reducing potential operational disruptions.';
        } else {
            return 'Security operations are maintaining business continuity while addressing identified risks. Continued focus on threat mitigation will further strengthen business protection and compliance posture.';
        }
    }

    /**
     * Initialize narrative templates for different scenarios
     */
    private initializeNarrativeTemplates(): Map<string, NarrativeTemplate> {
        const templates = new Map<string, NarrativeTemplate>();

        // Quarterly templates (business-focused)
        templates.set('quarterly_excellent_posture', {
            scenario: 'quarterly_excellent_posture',
            executiveSummaryTemplate: 'Outstanding quarterly business protection with zero security incidents and {riskTrend}. Our comprehensive security program successfully managed {totalAlerts} security events while achieving {mitigationRate}% risk remediation rate. Strategic security investments have delivered exceptional business value through threat prevention, compliance assurance, and operational excellence.',
            keyTakeawaysTemplates: [
                'Zero business disruptions achieved through effective threat prevention',
                '{mitigationRate}% risk remediation rate strengthens business resilience',
                'Security investment delivers measurable business value and operational excellence'
            ],
            recommendedActionsTemplates: [],
            businessImpactTemplate: 'Exceptional security performance with zero business disruption and maximum risk mitigation effectiveness.'
        });

        templates.set('quarterly_strong_performance', {
            scenario: 'quarterly_strong_performance',
            executiveSummaryTemplate: 'Strong quarterly security performance with {securityIncidents} contained security incidents and {riskTrend}. Security operations successfully managed {totalAlerts} alerts while achieving {mitigationRate}% vulnerability remediation. Our proactive security approach continues to protect business operations and maintain regulatory compliance.',
            keyTakeawaysTemplates: [
                '{securityIncidents} security incidents successfully contained with no business impact',
                'Proactive vulnerability management achieved {mitigationRate}% remediation rate',
                'Security investments support business growth while maintaining protection'
            ],
            recommendedActionsTemplates: [],
            businessImpactTemplate: 'Strong security performance supporting business objectives with minimal operational impact.'
        });

        templates.set('quarterly_improvement_focus', {
            scenario: 'quarterly_improvement_focus',
            executiveSummaryTemplate: 'Quarterly security operations managed {securityIncidents} security incidents while processing {totalAlerts} alerts. Vulnerability management efforts achieved {mitigationRate}% remediation rate. Enhanced security measures and process improvements will strengthen our defensive capabilities and business protection.',
            keyTakeawaysTemplates: [
                'Security incidents contained and resolved without major business disruption',
                'Vulnerability management processes show {mitigationRate}% effectiveness',
                'Opportunity for enhanced security measures to strengthen business protection'
            ],
            recommendedActionsTemplates: [
                'Enhance incident response procedures to reduce resolution time',
                'Accelerate vulnerability remediation processes for critical findings',
                'Strengthen preventive security controls to reduce incident frequency'
            ],
            businessImpactTemplate: 'Security operations maintaining business continuity while identifying opportunities for enhanced protection.'
        });

        // Monthly templates (trend-focused)
        templates.set('monthly_positive_trends', {
            scenario: 'monthly_positive_trends',
            executiveSummaryTemplate: 'Positive monthly security trends with {securityIncidents} security incidents and declining risk indicators. Security operations processed {totalAlerts} alerts while achieving {mitigationRate}% vulnerability remediation. Improved security posture reflects the effectiveness of our enhanced monitoring and response capabilities.',
            keyTakeawaysTemplates: [
                'Declining security risk trends indicate improving defensive capabilities',
                'Minimal security incidents demonstrate effective threat prevention',
                'Enhanced monitoring and response processes showing measurable results'
            ],
            recommendedActionsTemplates: [],
            businessImpactTemplate: 'Improving security trends supporting enhanced business resilience and operational confidence.'
        });

        templates.set('monthly_elevated_activity', {
            scenario: 'monthly_elevated_activity',
            executiveSummaryTemplate: 'Elevated monthly security activity with {securityIncidents} security incidents requiring enhanced monitoring. Security teams processed {totalAlerts} alerts while maintaining {mitigationRate}% vulnerability remediation rate. Increased security vigilance and response measures are addressing the elevated threat landscape.',
            keyTakeawaysTemplates: [
                'Elevated security activity requires enhanced monitoring and response',
                'Security teams maintaining {mitigationRate}% vulnerability remediation effectiveness',
                'Proactive security measures addressing increased threat activity'
            ],
            recommendedActionsTemplates: [
                'Increase security monitoring frequency during elevated threat periods',
                'Review and enhance incident response procedures',
                'Consider additional security controls for high-risk areas'
            ],
            businessImpactTemplate: 'Enhanced security vigilance maintaining business protection during elevated threat activity.'
        });

        templates.set('monthly_stable_operations', {
            scenario: 'monthly_stable_operations',
            executiveSummaryTemplate: 'Stable monthly security operations with {securityIncidents} security incidents and consistent threat management. Security teams processed {totalAlerts} alerts while achieving {mitigationRate}% vulnerability remediation. Steady security performance maintains business protection and operational continuity.',
            keyTakeawaysTemplates: [
                'Consistent security performance maintaining business protection',
                'Steady vulnerability management with {mitigationRate}% remediation rate',
                'Reliable security operations supporting business continuity'
            ],
            recommendedActionsTemplates: [],
            businessImpactTemplate: 'Stable security operations providing consistent business protection and operational support.'
        });

        // Weekly templates (operational focus)
        templates.set('weekly_quiet_period', {
            scenario: 'weekly_quiet_period',
            executiveSummaryTemplate: 'Quiet security week with zero incidents and {totalAlerts} alerts processed. Excellent security posture maintained through proactive monitoring and threat prevention. All systems remained secure and operational with {mitigationRate}% vulnerability remediation effectiveness.',
            keyTakeawaysTemplates: [
                'Zero security incidents demonstrate effective threat prevention',
                'Proactive monitoring maintained secure operational environment',
                'All security systems performing optimally with no disruptions'
            ],
            recommendedActionsTemplates: [],
            businessImpactTemplate: 'Excellent security posture with zero business disruption and optimal system performance.'
        });

        templates.set('weekly_active_monitoring', {
            scenario: 'weekly_active_monitoring',
            executiveSummaryTemplate: 'Active security monitoring week with zero incidents despite processing {totalAlerts} alerts. Strong defensive capabilities successfully identified and addressed potential threats before they could impact operations. Vulnerability management achieved {mitigationRate}% remediation rate.',
            keyTakeawaysTemplates: [
                'Zero security incidents despite high alert volume shows strong defenses',
                'Proactive threat detection and response preventing business impact',
                'Security monitoring systems performing effectively under load'
            ],
            recommendedActionsTemplates: [],
            businessImpactTemplate: 'Strong security defenses maintaining business protection during active threat monitoring period.'
        });

        templates.set('weekly_managed_incidents', {
            scenario: 'weekly_managed_incidents',
            executiveSummaryTemplate: 'Security operations successfully managed {securityIncidents} incidents while processing {totalAlerts} alerts. Rapid response and containment prevented business disruption. Vulnerability management maintained {mitigationRate}% remediation effectiveness throughout incident response activities.',
            keyTakeawaysTemplates: [
                '{securityIncidents} security incidents successfully contained and resolved',
                'Rapid incident response prevented business operational disruption',
                'Security team maintained effectiveness during incident management'
            ],
            recommendedActionsTemplates: [],
            businessImpactTemplate: 'Effective incident management maintaining business continuity and operational stability.'
        });

        templates.set('weekly_elevated_activity', {
            scenario: 'weekly_elevated_activity',
            executiveSummaryTemplate: 'Elevated security activity week with {securityIncidents} incidents requiring enhanced response efforts. Security teams processed {totalAlerts} alerts while maintaining {mitigationRate}% vulnerability remediation. Increased security vigilance and response measures addressing heightened threat activity.',
            keyTakeawaysTemplates: [
                'Elevated security incidents requiring enhanced monitoring and response',
                'Security teams maintaining operational effectiveness under pressure',
                'Enhanced security measures addressing increased threat activity'
            ],
            recommendedActionsTemplates: [
                'Review incident response procedures for optimization opportunities',
                'Consider temporary security control enhancements',
                'Increase monitoring frequency for critical systems'
            ],
            businessImpactTemplate: 'Enhanced security response maintaining business protection during elevated threat activity.'
        });

        return templates;
    }

    /**
     * Generate generic executive summary when no template matches
     */
    private generateGenericExecutiveSummary(
        data: ExecutiveSummaryData,
        riskAnalysis: RiskTrendAnalysis
    ): string {
        const { alertsDigest, updatesSummary, vulnerabilityPosture, reportType } = data;
        const securityIncidents = alertsDigest.alertOutcomes.securityIncidents;
        const totalAlerts = alertsDigest.totalAlertsDigested;
        const mitigationRate = vulnerabilityPosture.totalDetected > 0
            ? Math.round((vulnerabilityPosture.totalMitigated / vulnerabilityPosture.totalDetected) * 100)
            : 0;

        const periodText = this.getReportPeriodDescription(reportType);
        const riskTrendText = this.getRiskTrendDescription(riskAnalysis);

        return `${periodText} security operations summary shows ${securityIncidents} security incidents and ${totalAlerts} alerts processed. ${riskTrendText} Vulnerability management achieved ${mitigationRate}% remediation rate while maintaining operational continuity. Our security program continues to deliver effective business protection through proactive monitoring and rapid response capabilities.`;
    }

    /**
     * Generate generic key takeaways
     */
    private generateGenericKeyTakeaways(
        data: ExecutiveSummaryData,
        riskAnalysis: RiskTrendAnalysis
    ): string[] {
        const takeaways: string[] = [];
        const { alertsDigest, vulnerabilityPosture } = data;

        // Security incidents takeaway
        if (alertsDigest.alertOutcomes.securityIncidents === 0) {
            takeaways.push('Zero security incidents achieved, demonstrating effective threat prevention');
        } else {
            takeaways.push(`${alertsDigest.alertOutcomes.securityIncidents} security incidents successfully managed and contained`);
        }

        // Vulnerability management takeaway
        const mitigationRate = vulnerabilityPosture.totalDetected > 0
            ? Math.round((vulnerabilityPosture.totalMitigated / vulnerabilityPosture.totalDetected) * 100)
            : 0;
        takeaways.push(`${mitigationRate}% vulnerability remediation rate strengthens security posture`);

        // Risk trend takeaway
        if (riskAnalysis.direction === 'decreasing') {
            takeaways.push('Declining risk trends indicate improving security effectiveness');
        } else if (riskAnalysis.direction === 'increasing') {
            takeaways.push('Enhanced security measures addressing elevated risk indicators');
        } else {
            takeaways.push('Stable security operations maintaining consistent business protection');
        }

        return takeaways;
    }

    /**
     * Generate generic recommended actions
     */
    private generateGenericRecommendedActions(
        data: ExecutiveSummaryData,
        riskAnalysis: RiskTrendAnalysis
    ): string[] {
        const actions: string[] = [];

        if (riskAnalysis.riskScore > 70) {
            actions.push('Strengthen protective measures for critical business areas');
            actions.push('Prioritize resolution of high-risk security exposures');
        } else if (riskAnalysis.riskScore > 50) {
            actions.push('Enhance response procedures for business continuity');
            actions.push('Strengthen preventive measures for business protection');
        }

        if (data.vulnerabilityPosture.severityBreakdown.critical > 0) {
            actions.push('Address critical business risk exposures immediately');
        }

        if (data.alertsDigest.alertOutcomes.securityIncidents > 3) {
            actions.push('Strengthen business protection and prevention capabilities');
        }

        return actions;
    }

    /**
     * Get risk trend description for narrative
     */
    private getRiskTrendDescription(riskAnalysis: RiskTrendAnalysis): string {
        switch (riskAnalysis.direction) {
            case 'decreasing':
                return 'declining risk indicators and improving security posture';
            case 'increasing':
                return 'elevated risk indicators requiring enhanced security measures';
            default:
                return 'stable risk levels and consistent security performance';
        }
    }

    /**
     * Get report period description
     */
    private getReportPeriodDescription(reportType: 'weekly' | 'monthly' | 'quarterly'): string {
        switch (reportType) {
            case 'weekly':
                return 'Weekly';
            case 'monthly':
                return 'Monthly';
            case 'quarterly':
                return 'Quarterly';
        }
    }

    /**
     * Generate fallback narrative when generation fails
     */
    private generateFallbackNarrative(data: ExecutiveSummaryData): NarrativeContent {
        const periodText = this.getReportPeriodDescription(data.reportType);

        const alertCount = data.alertsDigest?.totalAlertsDigested || 0;

        return {
            executiveSummary: `${periodText} security program delivered continuous business protection and risk management. Our security investment successfully managed ${alertCount} security events while maintaining operational excellence and business continuity.`,
            keyTakeaways: [
                'Business protection and risk management capabilities maintained',
                'Operations secured through continuous security investment',
                'Security program delivered consistent business value'
            ],
            recommendedActions: [],
            riskTrendDirection: 'stable',
            businessImpactAssessment: 'Security investment delivering business continuity and operational resilience.'
        };
    }

    /**
     * Context-aware recommendations engine
     * 
     * Requirements: 5.4, 6.1, 6.2, automated insights
     * - Add context-aware recommendations engine
     */
    generateContextAwareRecommendations(
        data: ExecutiveSummaryData,
        riskAnalysis: RiskTrendAnalysis
    ): {
        immediate: string[];
        shortTerm: string[];
        strategic: string[];
        priority: 'low' | 'medium' | 'high' | 'critical';
    } {
        const immediate: string[] = [];
        const shortTerm: string[] = [];
        const strategic: string[] = [];
        let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';

        const patterns = this.analyzeDataPatterns(data);

        // Critical priority recommendations
        if (patterns.incidentSeverityPattern === 'high' || patterns.overallRiskAssessment === 'high') {
            priority = 'critical';
            immediate.push('Activate enhanced security monitoring and incident response protocols');
            immediate.push('Conduct immediate security posture assessment');
            shortTerm.push('Review and strengthen security controls for high-risk areas');
        }

        // High priority recommendations
        else if (patterns.vulnerabilityTrendPattern === 'concerning' || patterns.overallRiskAssessment === 'elevated') {
            priority = 'high';
            immediate.push('Accelerate critical vulnerability remediation efforts');
            shortTerm.push('Enhance vulnerability management processes and automation');
            strategic.push('Invest in advanced threat detection and prevention capabilities');
        }

        // Medium priority recommendations
        else if (patterns.alertVolumePattern === 'very_high' || riskAnalysis.direction === 'increasing') {
            priority = 'medium';
            shortTerm.push('Optimize alert filtering and prioritization mechanisms');
            shortTerm.push('Review security monitoring thresholds and tuning');
            strategic.push('Consider security operations center (SOC) capability enhancements');
        }

        // Analyze recurring patterns for specific recommendations
        if (data.trends && data.trends.recurringAlertTypes.length > 0) {
            const highFrequencyAlerts = data.trends.recurringAlertTypes.filter(alert => alert.frequency > 5);
            if (highFrequencyAlerts.length > 0) {
                shortTerm.push('Address recurring alert patterns through targeted security controls');
                strategic.push('Implement automated response for common alert types');
            }
        }

        // Vulnerability aging recommendations
        if (data.trends && data.trends.vulnerabilityAging.openVulnerabilities.moreThan90Days > 0) {
            immediate.push('Prioritize remediation of long-standing vulnerabilities (>90 days)');
            shortTerm.push('Establish vulnerability aging policies and escalation procedures');
        }

        // Positive trend reinforcement
        if (riskAnalysis.direction === 'decreasing' && patterns.overallRiskAssessment === 'low') {
            strategic.push('Maintain current security practices and consider expansion to other areas');
            strategic.push('Document successful security practices for organizational knowledge sharing');
        }

        // Report type specific recommendations
        if (data.reportType === 'quarterly') {
            strategic.push('Align security investments with business growth and digital transformation initiatives');
            strategic.push('Review security program effectiveness and ROI for board reporting');
        }

        return {
            immediate: immediate.slice(0, 3), // Max 3 immediate actions
            shortTerm: shortTerm.slice(0, 3), // Max 3 short-term actions
            strategic: strategic.slice(0, 2), // Max 2 strategic actions
            priority
        };
    }

    /**
     * Enhanced risk trend analysis with confidence scoring
     * 
     * Requirements: 5.4, 6.1, 6.2, automated insights
     * - Implement risk trend analysis (increasing/stable/decreasing)
     */
    performEnhancedRiskTrendAnalysis(data: ExecutiveSummaryData): {
        currentRiskScore: number;
        trendDirection: 'increasing' | 'stable' | 'decreasing';
        confidenceLevel: 'high' | 'medium' | 'low';
        riskFactors: Array<{
            factor: string;
            impact: 'positive' | 'negative' | 'neutral';
            weight: number;
            description: string;
        }>;
        projectedRiskScore: number;
        timeToNextReview: number; // days
    } {
        const riskFactors: Array<{
            factor: string;
            impact: 'positive' | 'negative' | 'neutral';
            weight: number;
            description: string;
        }> = [];

        let currentRiskScore = 50; // Base risk score
        let confidenceLevel: 'high' | 'medium' | 'low' = 'medium';

        // Analyze security incidents
        const incidents = data.alertsDigest.alertOutcomes.securityIncidents;
        if (incidents === 0) {
            riskFactors.push({
                factor: 'Zero Security Incidents',
                impact: 'positive',
                weight: 0.3,
                description: 'No confirmed security incidents demonstrate effective threat prevention'
            });
            currentRiskScore -= 20;
        } else if (incidents > 5) {
            riskFactors.push({
                factor: 'Elevated Incident Count',
                impact: 'negative',
                weight: 0.4,
                description: `${incidents} security incidents indicate elevated threat activity`
            });
            currentRiskScore += 25;
        }

        // Analyze vulnerability management effectiveness
        const vulnMitigationRate = data.vulnerabilityPosture.totalDetected > 0
            ? (data.vulnerabilityPosture.totalMitigated / data.vulnerabilityPosture.totalDetected) * 100
            : 100;

        if (vulnMitigationRate >= 80) {
            riskFactors.push({
                factor: 'High Vulnerability Remediation Rate',
                impact: 'positive',
                weight: 0.25,
                description: `${Math.round(vulnMitigationRate)}% remediation rate shows effective vulnerability management`
            });
            currentRiskScore -= 15;
        } else if (vulnMitigationRate < 50) {
            riskFactors.push({
                factor: 'Low Vulnerability Remediation Rate',
                impact: 'negative',
                weight: 0.3,
                description: `${Math.round(vulnMitigationRate)}% remediation rate indicates process improvements needed`
            });
            currentRiskScore += 20;
        }

        // Analyze critical vulnerabilities
        const criticalVulns = data.vulnerabilityPosture.severityBreakdown.critical;
        if (criticalVulns > 0) {
            riskFactors.push({
                factor: 'Critical Vulnerabilities Present',
                impact: 'negative',
                weight: 0.35,
                description: `${criticalVulns} critical vulnerabilities require immediate attention`
            });
            currentRiskScore += 15;
        }

        // Analyze trends for confidence and projection
        let trendDirection: 'increasing' | 'stable' | 'decreasing' = 'stable';
        let projectedRiskScore = currentRiskScore;

        if (data.trends && data.trends.weekOverWeekTrends.length > 0) {
            confidenceLevel = 'high';
            const alertTrend = data.trends.weekOverWeekTrends.find(t =>
                t.metric.toLowerCase().includes('alert')
            );

            if (alertTrend) {
                if (alertTrend.trend === 'down' && alertTrend.changePercentage > 10) {
                    trendDirection = 'decreasing';
                    projectedRiskScore = Math.max(0, currentRiskScore - 10);
                    riskFactors.push({
                        factor: 'Declining Alert Volume',
                        impact: 'positive',
                        weight: 0.2,
                        description: `${Math.abs(alertTrend.changePercentage)}% decrease in alert volume indicates improving security posture`
                    });
                } else if (alertTrend.trend === 'up' && alertTrend.changePercentage > 20) {
                    trendDirection = 'increasing';
                    projectedRiskScore = Math.min(100, currentRiskScore + 15);
                    riskFactors.push({
                        factor: 'Increasing Alert Volume',
                        impact: 'negative',
                        weight: 0.25,
                        description: `${alertTrend.changePercentage}% increase in alert volume requires enhanced monitoring`
                    });
                }
            }
        }

        // Normalize risk scores
        currentRiskScore = Math.max(0, Math.min(100, currentRiskScore));
        projectedRiskScore = Math.max(0, Math.min(100, projectedRiskScore));

        // Determine time to next review based on risk level
        let timeToNextReview = 30; // Default 30 days
        if (currentRiskScore > 70) {
            timeToNextReview = 7; // Weekly review for high risk
        } else if (currentRiskScore > 50) {
            timeToNextReview = 14; // Bi-weekly review for medium risk
        }

        return {
            currentRiskScore,
            trendDirection,
            confidenceLevel,
            riskFactors: riskFactors.sort((a, b) => b.weight - a.weight), // Sort by weight
            projectedRiskScore,
            timeToNextReview
        };
    }

    /**
     * Generate template system for executive summaries based on data patterns
     * 
     * Requirements: 5.4, 6.1, 6.2, automated insights
     * - Build template system for executive summaries based on data patterns
     */
    generateDynamicTemplate(
        data: ExecutiveSummaryData,
        riskAnalysis: RiskTrendAnalysis
    ): {
        templateId: string;
        templateName: string;
        applicabilityScore: number;
        customizations: Record<string, any>;
    } {
        const patterns = this.analyzeDataPatterns(data);
        let templateId = 'generic';
        let templateName = 'Generic Security Report';
        let applicabilityScore = 0.5;
        const customizations: Record<string, any> = {};

        // Determine best template based on data patterns
        if (data.reportType === 'quarterly') {
            if (patterns.overallRiskAssessment === 'low' && riskAnalysis.direction === 'decreasing') {
                templateId = 'quarterly_excellence';
                templateName = 'Quarterly Excellence Report';
                applicabilityScore = 0.95;
                customizations.emphasis = 'business_value';
                customizations.tone = 'confident';
            } else if (patterns.overallRiskAssessment === 'elevated' || patterns.overallRiskAssessment === 'high') {
                templateId = 'quarterly_improvement';
                templateName = 'Quarterly Improvement Focus';
                applicabilityScore = 0.85;
                customizations.emphasis = 'risk_mitigation';
                customizations.tone = 'proactive';
            } else {
                templateId = 'quarterly_standard';
                templateName = 'Quarterly Standard Report';
                applicabilityScore = 0.7;
                customizations.emphasis = 'balanced';
                customizations.tone = 'professional';
            }
        } else if (data.reportType === 'monthly') {
            if (riskAnalysis.direction === 'decreasing') {
                templateId = 'monthly_positive_trends';
                templateName = 'Monthly Positive Trends';
                applicabilityScore = 0.9;
                customizations.emphasis = 'trend_analysis';
                customizations.tone = 'optimistic';
            } else if (patterns.alertVolumePattern === 'very_high' || patterns.alertVolumePattern === 'high') {
                templateId = 'monthly_high_activity';
                templateName = 'Monthly High Activity';
                applicabilityScore = 0.8;
                customizations.emphasis = 'operational_focus';
                customizations.tone = 'vigilant';
            } else {
                templateId = 'monthly_standard';
                templateName = 'Monthly Standard Report';
                applicabilityScore = 0.75;
                customizations.emphasis = 'operational';
                customizations.tone = 'informative';
            }
        } else { // weekly
            if (patterns.incidentSeverityPattern === 'none' && patterns.alertVolumePattern === 'low') {
                templateId = 'weekly_quiet';
                templateName = 'Weekly Quiet Period';
                applicabilityScore = 0.9;
                customizations.emphasis = 'stability';
                customizations.tone = 'reassuring';
            } else if (patterns.incidentSeverityPattern === 'high' || patterns.incidentSeverityPattern === 'moderate') {
                templateId = 'weekly_active';
                templateName = 'Weekly Active Response';
                applicabilityScore = 0.85;
                customizations.emphasis = 'incident_management';
                customizations.tone = 'responsive';
            } else {
                templateId = 'weekly_standard';
                templateName = 'Weekly Standard Report';
                applicabilityScore = 0.7;
                customizations.emphasis = 'operational';
                customizations.tone = 'professional';
            }
        }

        // Add data-driven customizations
        customizations.includeMetrics = data.vulnerabilityPosture.totalDetected > 0;
        customizations.includeTrends = data.trends && data.trends.weekOverWeekTrends.length > 0;
        customizations.includeRecommendations = riskAnalysis.riskScore > 60;
        customizations.riskLevel = patterns.overallRiskAssessment;
        customizations.confidenceLevel = riskAnalysis.confidence;

        return {
            templateId,
            templateName,
            applicabilityScore,
            customizations
        };
    }

    /**
     * Analyze data patterns for context-aware recommendations
     */
    analyzeDataPatterns(data: ExecutiveSummaryData): {
        alertVolumePattern: 'low' | 'normal' | 'high' | 'very_high';
        incidentSeverityPattern: 'none' | 'low' | 'moderate' | 'high';
        vulnerabilityTrendPattern: 'improving' | 'stable' | 'concerning';
        overallRiskAssessment: 'low' | 'moderate' | 'elevated' | 'high';
    } {
        const { alertsDigest, vulnerabilityPosture } = data;

        // Analyze alert volume pattern
        let alertVolumePattern: 'low' | 'normal' | 'high' | 'very_high' = 'normal';
        if (alertsDigest.totalAlertsDigested < 20) {
            alertVolumePattern = 'low';
        } else if (alertsDigest.totalAlertsDigested > 200) {
            alertVolumePattern = 'very_high';
        } else if (alertsDigest.totalAlertsDigested > 100) {
            alertVolumePattern = 'high';
        }

        // Analyze incident severity pattern
        let incidentSeverityPattern: 'none' | 'low' | 'moderate' | 'high' = 'none';
        const incidents = alertsDigest.alertOutcomes.securityIncidents;
        if (incidents === 0) {
            incidentSeverityPattern = 'none';
        } else if (incidents <= 2) {
            incidentSeverityPattern = 'low';
        } else if (incidents <= 5) {
            incidentSeverityPattern = 'moderate';
        } else {
            incidentSeverityPattern = 'high';
        }

        // Analyze vulnerability trend pattern
        let vulnerabilityTrendPattern: 'improving' | 'stable' | 'concerning' = 'stable';
        const mitigationRate = vulnerabilityPosture.totalDetected > 0
            ? (vulnerabilityPosture.totalMitigated / vulnerabilityPosture.totalDetected) * 100
            : 100;

        if (mitigationRate >= 80) {
            vulnerabilityTrendPattern = 'improving';
        } else if (mitigationRate < 50 || vulnerabilityPosture.severityBreakdown.critical > 5) {
            vulnerabilityTrendPattern = 'concerning';
        }

        // Overall risk assessment
        let overallRiskAssessment: 'low' | 'moderate' | 'elevated' | 'high' = 'moderate';
        if (incidentSeverityPattern === 'none' && vulnerabilityTrendPattern === 'improving') {
            overallRiskAssessment = 'low';
        } else if (incidentSeverityPattern === 'high' || vulnerabilityTrendPattern === 'concerning') {
            overallRiskAssessment = 'elevated';
        } else if (incidentSeverityPattern === 'high' && vulnerabilityTrendPattern === 'concerning') {
            overallRiskAssessment = 'high';
        }

        return {
            alertVolumePattern,
            incidentSeverityPattern,
            vulnerabilityTrendPattern,
            overallRiskAssessment
        };
    }
}