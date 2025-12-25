/**
 * Content Review Service
 * 
 * Implements content review and approval workflow for sensitive information
 * to ensure all generated content is board-room appropriate and client-ready.
 * 
 * Requirements: 6.1, 6.2, 6.3, professional standards
 */

import { logger } from '@/lib/logger';

/**
 * Content sensitivity levels
 */
export enum ContentSensitivityLevel {
    PUBLIC = 'public',           // Safe for any audience
    INTERNAL = 'internal',       // Internal business use only
    CONFIDENTIAL = 'confidential', // Restricted to authorized personnel
    SENSITIVE = 'sensitive'      // Requires review before client delivery
}

/**
 * Content review status
 */
export enum ContentReviewStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    REQUIRES_REVISION = 'requires_revision'
}

/**
 * Content review result
 */
export interface ContentReviewResult {
    status: ContentReviewStatus;
    sensitivityLevel: ContentSensitivityLevel;
    reviewedBy: string;
    reviewedAt: Date;
    comments?: string;
    suggestedRevisions?: string[];
    clientAppropriate: boolean;
    boardRoomReady: boolean;
}

/**
 * Content item for review
 */
export interface ContentItem {
    id: string;
    type: 'executive_summary' | 'key_takeaway' | 'recommendation' | 'metric' | 'narrative';
    content: string;
    context: {
        reportType: 'weekly' | 'monthly' | 'quarterly';
        tenantId: string;
        dateRange: {
            startDate: Date;
            endDate: Date;
        };
    };
    metadata?: Record<string, any>;
}

/**
 * Content standards configuration
 */
interface ContentStandards {
    // Prohibited terms that should not appear in client-facing content
    prohibitedTerms: string[];

    // Sensitive terms that require review
    sensitiveTerms: string[];

    // Required professional language patterns
    professionalLanguagePatterns: {
        pattern: RegExp;
        replacement: string;
        description: string;
    }[];

    // Client type specific customizations
    clientTypeCustomizations: {
        [clientType: string]: {
            preferredTerminology: Record<string, string>;
            avoidedTopics: string[];
            emphasisAreas: string[];
        };
    };
}

/**
 * Content Review Service
 * 
 * Provides automated and manual content review capabilities to ensure
 * all report content meets professional standards and is appropriate
 * for direct client delivery.
 */
export class ContentReviewService {
    private readonly contentStandards: ContentStandards;

    constructor() {
        this.contentStandards = this.initializeContentStandards();
    }

    /**
     * Review content for client appropriateness
     */
    async reviewContent(contentItem: ContentItem): Promise<ContentReviewResult> {
        try {
            logger.info('Starting content review', {
                contentId: contentItem.id,
                contentType: contentItem.type,
                reportType: contentItem.context.reportType,
                category: 'reports'
            });

            // Automated content analysis
            const automatedAnalysis = this.performAutomatedAnalysis(contentItem);

            // Determine if manual review is required
            const requiresManualReview = this.requiresManualReview(contentItem, automatedAnalysis);

            // Generate review result
            const reviewResult: ContentReviewResult = {
                status: requiresManualReview ? ContentReviewStatus.PENDING : ContentReviewStatus.APPROVED,
                sensitivityLevel: automatedAnalysis.sensitivityLevel,
                reviewedBy: requiresManualReview ? 'system_pending' : 'automated_system',
                reviewedAt: new Date(),
                comments: automatedAnalysis.comments,
                suggestedRevisions: automatedAnalysis.suggestedRevisions,
                clientAppropriate: automatedAnalysis.clientAppropriate,
                boardRoomReady: automatedAnalysis.boardRoomReady
            };

            logger.info('Content review completed', {
                contentId: contentItem.id,
                status: reviewResult.status,
                sensitivityLevel: reviewResult.sensitivityLevel,
                clientAppropriate: reviewResult.clientAppropriate,
                boardRoomReady: reviewResult.boardRoomReady,
                category: 'reports'
            });

            return reviewResult;

        } catch (error) {
            logger.error('Content review failed', error instanceof Error ? error : new Error(String(error)), {
                contentId: contentItem.id,
                contentType: contentItem.type,
                category: 'reports'
            });

            // Return conservative review result on error
            return {
                status: ContentReviewStatus.REQUIRES_REVISION,
                sensitivityLevel: ContentSensitivityLevel.SENSITIVE,
                reviewedBy: 'system_error',
                reviewedAt: new Date(),
                comments: 'Content review failed - manual review required',
                clientAppropriate: false,
                boardRoomReady: false
            };
        }
    }

    /**
     * Apply client-ready content standards to text
     */
    applyContentStandards(content: string, clientType?: string): string {
        let processedContent = content;

        // Apply professional language patterns
        this.contentStandards.professionalLanguagePatterns.forEach(pattern => {
            processedContent = processedContent.replace(pattern.pattern, pattern.replacement);
        });

        // Apply client-specific terminology if specified
        if (clientType && this.contentStandards.clientTypeCustomizations[clientType]) {
            const customization = this.contentStandards.clientTypeCustomizations[clientType];
            Object.entries(customization.preferredTerminology).forEach(([original, preferred]) => {
                const regex = new RegExp(original, 'gi');
                processedContent = processedContent.replace(regex, preferred);
            });
        }

        // Remove or replace prohibited terms
        this.contentStandards.prohibitedTerms.forEach(term => {
            const regex = new RegExp(term, 'gi');
            processedContent = processedContent.replace(regex, '[REDACTED]');
        });

        return processedContent;
    }

    /**
     * Validate content for board-room appropriateness
     */
    validateBoardRoomAppropriate(content: string): {
        isAppropriate: boolean;
        issues: string[];
        suggestions: string[];
    } {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check for technical jargon
        const technicalTerms = [
            'SOC', 'SIEM', 'EDR', 'API', 'SQL injection', 'XSS', 'CSRF',
            'vulnerability scan', 'penetration test', 'threat hunting',
            'malware analysis', 'incident response', 'alert triage'
        ];

        technicalTerms.forEach(term => {
            if (content.toLowerCase().includes(term.toLowerCase())) {
                issues.push(`Technical term "${term}" may not be appropriate for executive audience`);
                suggestions.push(`Consider replacing "${term}" with business-friendly language`);
            }
        });

        // Check for overly detailed operational information
        const operationalPatterns = [
            /\d+\s*(alerts?|incidents?|vulnerabilities?)\s*processed/gi,
            /security\s*operations\s*center/gi,
            /threat\s*detection\s*rate/gi,
            /incident\s*response\s*time/gi
        ];

        operationalPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                issues.push('Content contains operational details that may be too technical for board presentation');
                suggestions.push('Focus on business impact and value delivered rather than operational metrics');
            }
        });

        // Check for appropriate executive language
        const executiveIndicators = [
            'business value', 'risk reduction', 'operational continuity',
            'business protection', 'strategic investment', 'compliance assurance'
        ];

        const hasExecutiveLanguage = executiveIndicators.some(indicator =>
            content.toLowerCase().includes(indicator.toLowerCase())
        );

        if (!hasExecutiveLanguage) {
            suggestions.push('Consider adding business value and strategic impact language for executive audience');
        }

        return {
            isAppropriate: issues.length === 0,
            issues,
            suggestions
        };
    }

    /**
     * Generate executive summary templates for different client types
     */
    generateExecutiveSummaryTemplate(
        clientType: 'healthcare' | 'financial' | 'technology' | 'manufacturing' | 'retail' | 'generic',
        reportType: 'weekly' | 'monthly' | 'quarterly'
    ): {
        template: string;
        customizations: Record<string, string>;
        emphasisAreas: string[];
    } {
        const templates = {
            healthcare: {
                weekly: 'Healthcare security operations maintained HIPAA compliance and patient data protection throughout the reporting period. Our security program successfully managed {totalEvents} security events while ensuring zero patient data exposure and maintaining operational continuity for critical healthcare services.',
                monthly: 'Monthly healthcare security performance demonstrates strong HIPAA compliance and patient data protection. Security investments delivered {riskReduction}% risk reduction while supporting healthcare delivery and regulatory requirements.',
                quarterly: 'Quarterly healthcare security review shows exceptional patient data protection and regulatory compliance. Strategic security investments have strengthened healthcare delivery capabilities while maintaining the highest standards of patient privacy and data security.'
            },
            financial: {
                weekly: 'Financial services security operations maintained regulatory compliance and customer data protection throughout the reporting period. Our security program successfully managed {totalEvents} security events while ensuring zero financial data exposure and maintaining operational continuity for critical financial services.',
                monthly: 'Monthly financial security performance demonstrates strong regulatory compliance and customer data protection. Security investments delivered {riskReduction}% risk reduction while supporting financial operations and regulatory requirements.',
                quarterly: 'Quarterly financial security review shows exceptional customer data protection and regulatory compliance. Strategic security investments have strengthened financial service delivery while maintaining the highest standards of customer privacy and regulatory adherence.'
            },
            technology: {
                weekly: 'Technology sector security operations maintained intellectual property protection and customer data security throughout the reporting period. Our security program successfully managed {totalEvents} security events while ensuring zero IP exposure and maintaining operational continuity for technology services.',
                monthly: 'Monthly technology security performance demonstrates strong IP protection and customer data security. Security investments delivered {riskReduction}% risk reduction while supporting innovation and technology delivery.',
                quarterly: 'Quarterly technology security review shows exceptional intellectual property protection and customer data security. Strategic security investments have strengthened technology capabilities while maintaining competitive advantage and customer trust.'
            },
            manufacturing: {
                weekly: 'Manufacturing security operations maintained operational technology protection and supply chain security throughout the reporting period. Our security program successfully managed {totalEvents} security events while ensuring zero production disruption and maintaining operational continuity.',
                monthly: 'Monthly manufacturing security performance demonstrates strong operational technology protection and supply chain security. Security investments delivered {riskReduction}% risk reduction while supporting production efficiency and supply chain reliability.',
                quarterly: 'Quarterly manufacturing security review shows exceptional operational technology protection and supply chain security. Strategic security investments have strengthened manufacturing capabilities while maintaining production efficiency and supply chain resilience.'
            },
            retail: {
                weekly: 'Retail security operations maintained customer data protection and payment security throughout the reporting period. Our security program successfully managed {totalEvents} security events while ensuring zero customer data exposure and maintaining operational continuity for retail operations.',
                monthly: 'Monthly retail security performance demonstrates strong customer data protection and payment security. Security investments delivered {riskReduction}% risk reduction while supporting retail operations and customer experience.',
                quarterly: 'Quarterly retail security review shows exceptional customer data protection and payment security. Strategic security investments have strengthened retail capabilities while maintaining customer trust and operational excellence.'
            },
            generic: {
                weekly: 'Business security operations maintained data protection and operational continuity throughout the reporting period. Our security program successfully managed {totalEvents} security events while ensuring zero business disruption and maintaining operational excellence.',
                monthly: 'Monthly security performance demonstrates strong business protection and risk management. Security investments delivered {riskReduction}% risk reduction while supporting business operations and strategic objectives.',
                quarterly: 'Quarterly security review shows exceptional business protection and risk management. Strategic security investments have strengthened business capabilities while maintaining operational excellence and competitive advantage.'
            }
        };

        const customizations = {
            healthcare: {
                'security events': 'healthcare security events',
                'data protection': 'patient data protection',
                'compliance': 'HIPAA compliance',
                'business operations': 'healthcare delivery'
            },
            financial: {
                'security events': 'financial security events',
                'data protection': 'customer financial data protection',
                'compliance': 'regulatory compliance',
                'business operations': 'financial services'
            },
            technology: {
                'security events': 'technology security events',
                'data protection': 'intellectual property protection',
                'compliance': 'industry compliance',
                'business operations': 'technology innovation'
            },
            manufacturing: {
                'security events': 'operational security events',
                'data protection': 'operational data protection',
                'compliance': 'industry compliance',
                'business operations': 'manufacturing operations'
            },
            retail: {
                'security events': 'retail security events',
                'data protection': 'customer data protection',
                'compliance': 'payment compliance',
                'business operations': 'retail operations'
            },
            generic: {
                'security events': 'business security events',
                'data protection': 'business data protection',
                'compliance': 'regulatory compliance',
                'business operations': 'business operations'
            }
        };

        const emphasisAreas = {
            healthcare: ['patient privacy', 'HIPAA compliance', 'healthcare delivery continuity'],
            financial: ['customer data security', 'regulatory compliance', 'financial service reliability'],
            technology: ['intellectual property protection', 'innovation security', 'competitive advantage'],
            manufacturing: ['operational continuity', 'supply chain security', 'production efficiency'],
            retail: ['customer experience', 'payment security', 'brand protection'],
            generic: ['business continuity', 'data protection', 'operational excellence']
        };

        return {
            template: templates[clientType][reportType],
            customizations: customizations[clientType],
            emphasisAreas: emphasisAreas[clientType]
        };
    }

    /**
     * Perform automated content analysis
     */
    private performAutomatedAnalysis(contentItem: ContentItem): {
        sensitivityLevel: ContentSensitivityLevel;
        clientAppropriate: boolean;
        boardRoomReady: boolean;
        comments?: string;
        suggestedRevisions?: string[];
    } {
        const content = contentItem.content.toLowerCase();
        const suggestedRevisions: string[] = [];
        let sensitivityLevel = ContentSensitivityLevel.PUBLIC;
        let clientAppropriate = true;
        let boardRoomReady = true;
        const comments: string[] = [];

        // Check for prohibited terms
        const foundProhibitedTerms = this.contentStandards.prohibitedTerms.filter(term =>
            content.includes(term.toLowerCase())
        );

        if (foundProhibitedTerms.length > 0) {
            sensitivityLevel = ContentSensitivityLevel.SENSITIVE;
            clientAppropriate = false;
            boardRoomReady = false;
            comments.push(`Contains prohibited terms: ${foundProhibitedTerms.join(', ')}`);
            suggestedRevisions.push('Remove or replace prohibited terms with client-appropriate language');
        }

        // Check for sensitive terms
        const foundSensitiveTerms = this.contentStandards.sensitiveTerms.filter(term =>
            content.includes(term.toLowerCase())
        );

        if (foundSensitiveTerms.length > 0) {
            if (sensitivityLevel === ContentSensitivityLevel.PUBLIC) {
                sensitivityLevel = ContentSensitivityLevel.INTERNAL;
            }
            comments.push(`Contains sensitive terms: ${foundSensitiveTerms.join(', ')}`);
            suggestedRevisions.push('Review sensitive terms for client appropriateness');
        }

        // Validate board-room appropriateness
        const boardRoomValidation = this.validateBoardRoomAppropriate(contentItem.content);
        if (!boardRoomValidation.isAppropriate) {
            boardRoomReady = false;
            comments.push(...boardRoomValidation.issues);
            suggestedRevisions.push(...boardRoomValidation.suggestions);
        }

        return {
            sensitivityLevel,
            clientAppropriate,
            boardRoomReady,
            comments: comments.length > 0 ? comments.join('; ') : undefined,
            suggestedRevisions: suggestedRevisions.length > 0 ? suggestedRevisions : undefined
        };
    }

    /**
     * Determine if content requires manual review
     */
    private requiresManualReview(
        contentItem: ContentItem,
        automatedAnalysis: ReturnType<typeof this.performAutomatedAnalysis>
    ): boolean {
        // Quarterly reports always require manual review for board presentation
        if (contentItem.context.reportType === 'quarterly') {
            return true;
        }

        // Content with sensitive information requires manual review
        if (automatedAnalysis.sensitivityLevel === ContentSensitivityLevel.SENSITIVE) {
            return true;
        }

        // Content that's not board-room ready requires manual review
        if (!automatedAnalysis.boardRoomReady) {
            return true;
        }

        // Executive summaries and recommendations require manual review
        if (['executive_summary', 'recommendation'].includes(contentItem.type)) {
            return true;
        }

        return false;
    }

    /**
     * Initialize content standards configuration
     */
    private initializeContentStandards(): ContentStandards {
        return {
            prohibitedTerms: [
                // Internal system names and technical details
                'SOC analyst', 'SIEM system', 'EDR agent', 'security operations center',
                'threat hunting', 'malware analysis', 'incident response team',
                'vulnerability scanner', 'penetration testing', 'red team',

                // Internal processes and tools
                'alert triage', 'ticket escalation', 'runbook execution',
                'playbook automation', 'SOAR platform', 'security orchestration',

                // Technical implementation details
                'API endpoint', 'database query', 'log aggregation',
                'correlation rules', 'detection signatures', 'IOC matching'
            ],

            sensitiveTerms: [
                // Terms that may need context or explanation
                'security incident', 'data breach', 'vulnerability',
                'threat actor', 'attack vector', 'security control',
                'risk assessment', 'compliance violation', 'audit finding',

                // Operational terms that may be too technical
                'false positive', 'true positive', 'mean time to detection',
                'mean time to response', 'security metrics', 'KPI dashboard'
            ],

            professionalLanguagePatterns: [
                {
                    pattern: /security operations/gi,
                    replacement: 'security program',
                    description: 'Use business-focused terminology'
                },
                {
                    pattern: /alerts? processed/gi,
                    replacement: 'security events managed',
                    description: 'Emphasize management over processing'
                },
                {
                    pattern: /threat detection/gi,
                    replacement: 'business protection',
                    description: 'Focus on business value'
                },
                {
                    pattern: /incident response/gi,
                    replacement: 'security response',
                    description: 'Simplify technical terminology'
                },
                {
                    pattern: /vulnerability remediation/gi,
                    replacement: 'risk resolution',
                    description: 'Use business-friendly language'
                }
            ],

            clientTypeCustomizations: {
                healthcare: {
                    preferredTerminology: {
                        'data protection': 'patient data protection',
                        'compliance': 'HIPAA compliance',
                        'business operations': 'healthcare delivery'
                    },
                    avoidedTopics: ['specific patient information', 'medical device vulnerabilities'],
                    emphasisAreas: ['patient privacy', 'regulatory compliance', 'healthcare continuity']
                },
                financial: {
                    preferredTerminology: {
                        'data protection': 'customer financial data protection',
                        'compliance': 'regulatory compliance',
                        'business operations': 'financial services'
                    },
                    avoidedTopics: ['specific transaction details', 'customer account information'],
                    emphasisAreas: ['customer trust', 'regulatory adherence', 'financial stability']
                },
                technology: {
                    preferredTerminology: {
                        'data protection': 'intellectual property protection',
                        'compliance': 'industry standards compliance',
                        'business operations': 'technology innovation'
                    },
                    avoidedTopics: ['proprietary algorithms', 'source code vulnerabilities'],
                    emphasisAreas: ['innovation protection', 'competitive advantage', 'customer trust']
                }
            }
        };
    }
}

/**
 * Factory function to create ContentReviewService instance
 */
export function createContentReviewService(): ContentReviewService {
    return new ContentReviewService();
}