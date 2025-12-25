/**
 * Custom Branding Service
 * 
 * Implements customizable branding options per tenant to ensure
 * reports are appropriately branded for each client organization.
 * 
 * Requirements: 6.1, 6.2, 6.3, professional standards
 */

import { logger } from '@/lib/logger';

/**
 * Branding color scheme
 */
export interface BrandingColorScheme {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    success: string;
    warning: string;
    error: string;
}

/**
 * Logo configuration
 */
export interface LogoConfiguration {
    logoUrl?: string;
    logoWidth?: number;
    logoHeight?: number;
    logoPosition: 'top-left' | 'top-center' | 'top-right';
    showAvianLogo: boolean;
    avianLogoPosition: 'footer' | 'header-secondary' | 'hidden';
}

/**
 * Typography configuration
 */
export interface TypographyConfiguration {
    primaryFont: string;
    secondaryFont: string;
    headingFont: string;
    fontSize: {
        small: string;
        medium: string;
        large: string;
        xlarge: string;
    };
}

/**
 * Report layout configuration
 */
export interface ReportLayoutConfiguration {
    headerHeight: number;
    footerHeight: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    slideSpacing: number;
}

/**
 * Custom branding configuration
 */
export interface CustomBrandingConfiguration {
    tenantId: string;
    organizationName: string;
    brandingEnabled: boolean;
    colorScheme: BrandingColorScheme;
    logo: LogoConfiguration;
    typography: TypographyConfiguration;
    layout: ReportLayoutConfiguration;
    customFooterText?: string;
    confidentialityNotice?: string;
    reportTitle?: {
        weekly?: string;
        monthly?: string;
        quarterly?: string;
    };
    executiveMessage?: string;
    contactInformation?: {
        companyName: string;
        address?: string;
        phone?: string;
        email?: string;
        website?: string;
    };
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy: string;
}

/**
 * Branding template for different industries
 */
export interface BrandingTemplate {
    id: string;
    name: string;
    description: string;
    industry: string;
    colorScheme: BrandingColorScheme;
    typography: TypographyConfiguration;
    layout: ReportLayoutConfiguration;
    defaultSettings: Partial<CustomBrandingConfiguration>;
}

/**
 * Custom Branding Service
 * 
 * Manages tenant-specific branding configurations and applies
 * custom branding to reports for professional client delivery.
 */
export class CustomBrandingService {
    private readonly brandingTemplates: Map<string, BrandingTemplate>;
    private readonly brandingConfigurations: Map<string, CustomBrandingConfiguration>;

    constructor() {
        this.brandingTemplates = this.initializeBrandingTemplates();
        this.brandingConfigurations = new Map();
    }

    /**
     * Get branding configuration for tenant
     */
    async getBrandingConfiguration(tenantId: string): Promise<CustomBrandingConfiguration> {
        try {
            // Check cache first
            if (this.brandingConfigurations.has(tenantId)) {
                return this.brandingConfigurations.get(tenantId)!;
            }

            // Load from database (simulated - would be actual DB call)
            const configuration = await this.loadBrandingConfiguration(tenantId);

            // Cache the configuration
            this.brandingConfigurations.set(tenantId, configuration);

            return configuration;

        } catch (error) {
            logger.error('Failed to get branding configuration', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                category: 'reports'
            });

            // Return default AVIAN branding
            return this.getDefaultBrandingConfiguration(tenantId);
        }
    }

    /**
     * Update branding configuration for tenant
     */
    async updateBrandingConfiguration(
        tenantId: string,
        updates: Partial<CustomBrandingConfiguration>,
        updatedBy: string
    ): Promise<CustomBrandingConfiguration> {
        try {
            const currentConfig = await this.getBrandingConfiguration(tenantId);

            const updatedConfig: CustomBrandingConfiguration = {
                ...currentConfig,
                ...updates,
                tenantId,
                updatedAt: new Date(),
                updatedBy
            };

            // Save to database (simulated)
            await this.saveBrandingConfiguration(updatedConfig);

            // Update cache
            this.brandingConfigurations.set(tenantId, updatedConfig);

            logger.info('Branding configuration updated', {
                tenantId,
                updatedBy,
                brandingEnabled: updatedConfig.brandingEnabled,
                category: 'reports'
            });

            return updatedConfig;

        } catch (error) {
            logger.error('Failed to update branding configuration', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                updatedBy,
                category: 'reports'
            });
            throw error;
        }
    }

    /**
     * Apply custom branding to report content
     */
    applyCustomBranding(
        reportContent: string,
        brandingConfig: CustomBrandingConfiguration
    ): string {
        if (!brandingConfig.brandingEnabled) {
            return reportContent;
        }

        let brandedContent = reportContent;

        // Apply custom organization name
        brandedContent = brandedContent.replace(
            /\[Client Organization Name\]/g,
            brandingConfig.organizationName
        );

        // Apply custom report titles
        if (brandingConfig.reportTitle) {
            Object.entries(brandingConfig.reportTitle).forEach(([reportType, title]) => {
                const placeholder = `[${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report Title]`;
                brandedContent = brandedContent.replace(new RegExp(placeholder, 'g'), title);
            });
        }

        // Apply executive message if provided
        if (brandingConfig.executiveMessage) {
            brandedContent = brandedContent.replace(
                /\[Executive Message\]/g,
                brandingConfig.executiveMessage
            );
        }

        // Apply custom footer text
        if (brandingConfig.customFooterText) {
            brandedContent = brandedContent.replace(
                /\[Custom Footer\]/g,
                brandingConfig.customFooterText
            );
        }

        // Apply confidentiality notice
        if (brandingConfig.confidentialityNotice) {
            brandedContent = brandedContent.replace(
                /\[Confidentiality Notice\]/g,
                brandingConfig.confidentialityNotice
            );
        }

        // Apply contact information
        if (brandingConfig.contactInformation) {
            const contact = brandingConfig.contactInformation;
            brandedContent = brandedContent.replace(/\[Company Name\]/g, contact.companyName);
            if (contact.email) {
                brandedContent = brandedContent.replace(/\[Contact Email\]/g, contact.email);
            }
            if (contact.phone) {
                brandedContent = brandedContent.replace(/\[Contact Phone\]/g, contact.phone);
            }
            if (contact.website) {
                brandedContent = brandedContent.replace(/\[Company Website\]/g, contact.website);
            }
        }

        return brandedContent;
    }

    /**
     * Generate CSS styles for custom branding
     */
    generateBrandingCSS(brandingConfig: CustomBrandingConfiguration): string {
        if (!brandingConfig.brandingEnabled) {
            return '';
        }

        const { colorScheme, typography, layout } = brandingConfig;

        return `
            :root {
                --brand-primary: ${colorScheme.primary};
                --brand-secondary: ${colorScheme.secondary};
                --brand-accent: ${colorScheme.accent};
                --brand-background: ${colorScheme.background};
                --brand-text: ${colorScheme.text};
                --brand-success: ${colorScheme.success};
                --brand-warning: ${colorScheme.warning};
                --brand-error: ${colorScheme.error};
                
                --brand-font-primary: ${typography.primaryFont};
                --brand-font-secondary: ${typography.secondaryFont};
                --brand-font-heading: ${typography.headingFont};
                
                --brand-font-size-small: ${typography.fontSize.small};
                --brand-font-size-medium: ${typography.fontSize.medium};
                --brand-font-size-large: ${typography.fontSize.large};
                --brand-font-size-xlarge: ${typography.fontSize.xlarge};
                
                --brand-header-height: ${layout.headerHeight}px;
                --brand-footer-height: ${layout.footerHeight}px;
                --brand-margin-top: ${layout.marginTop}px;
                --brand-margin-bottom: ${layout.marginBottom}px;
                --brand-margin-left: ${layout.marginLeft}px;
                --brand-margin-right: ${layout.marginRight}px;
                --brand-slide-spacing: ${layout.slideSpacing}px;
            }
            
            .report-container {
                font-family: var(--brand-font-primary);
                color: var(--brand-text);
                background-color: var(--brand-background);
            }
            
            .report-header {
                height: var(--brand-header-height);
                background-color: var(--brand-primary);
                color: white;
            }
            
            .report-footer {
                height: var(--brand-footer-height);
                background-color: var(--brand-secondary);
                color: white;
            }
            
            .slide-title {
                font-family: var(--brand-font-heading);
                font-size: var(--brand-font-size-xlarge);
                color: var(--brand-primary);
            }
            
            .slide-content {
                font-family: var(--brand-font-primary);
                font-size: var(--brand-font-size-medium);
                margin: var(--brand-slide-spacing) 0;
            }
            
            .brand-accent {
                color: var(--brand-accent);
            }
            
            .brand-success {
                color: var(--brand-success);
            }
            
            .brand-warning {
                color: var(--brand-warning);
            }
            
            .brand-error {
                color: var(--brand-error);
            }
        `;
    }

    /**
     * Get available branding templates
     */
    getBrandingTemplates(): BrandingTemplate[] {
        return Array.from(this.brandingTemplates.values());
    }

    /**
     * Apply branding template to tenant configuration
     */
    async applyBrandingTemplate(
        tenantId: string,
        templateId: string,
        organizationName: string,
        appliedBy: string
    ): Promise<CustomBrandingConfiguration> {
        const template = this.brandingTemplates.get(templateId);
        if (!template) {
            throw new Error(`Branding template not found: ${templateId}`);
        }

        const brandingConfig: CustomBrandingConfiguration = {
            tenantId,
            organizationName,
            brandingEnabled: true,
            colorScheme: { ...template.colorScheme },
            logo: {
                logoPosition: 'top-left',
                showAvianLogo: true,
                avianLogoPosition: 'footer'
            },
            typography: { ...template.typography },
            layout: { ...template.layout },
            ...template.defaultSettings,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: appliedBy,
            updatedBy: appliedBy
        };

        return await this.updateBrandingConfiguration(tenantId, brandingConfig, appliedBy);
    }

    /**
     * Validate branding configuration
     */
    validateBrandingConfiguration(config: Partial<CustomBrandingConfiguration>): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate required fields
        if (!config.organizationName || config.organizationName.trim().length === 0) {
            errors.push('Organization name is required');
        }

        // Validate color scheme
        if (config.colorScheme) {
            const colorFields = ['primary', 'secondary', 'accent', 'background', 'text'];
            colorFields.forEach(field => {
                const color = (config.colorScheme as any)?.[field];
                if (color && !this.isValidColor(color)) {
                    errors.push(`Invalid color format for ${field}: ${color}`);
                }
            });
        }

        // Validate logo configuration
        if (config.logo?.logoUrl && !this.isValidUrl(config.logo.logoUrl)) {
            errors.push('Invalid logo URL format');
        }

        // Validate typography
        if (config.typography) {
            const fontFields = ['primaryFont', 'secondaryFont', 'headingFont'];
            fontFields.forEach(field => {
                const font = (config.typography as any)?.[field];
                if (font && typeof font !== 'string') {
                    errors.push(`Invalid font specification for ${field}`);
                }
            });
        }

        // Validate layout dimensions
        if (config.layout) {
            const dimensionFields = ['headerHeight', 'footerHeight', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight'];
            dimensionFields.forEach(field => {
                const value = (config.layout as any)?.[field];
                if (value !== undefined && (typeof value !== 'number' || value < 0)) {
                    errors.push(`Invalid layout dimension for ${field}: must be a positive number`);
                }
            });
        }

        // Warnings for best practices
        if (config.colorScheme?.primary === config.colorScheme?.background) {
            warnings.push('Primary color and background color are the same - this may cause visibility issues');
        }

        if (config.organizationName && config.organizationName.length > 50) {
            warnings.push('Organization name is very long - consider shortening for better display');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Load branding configuration from database (simulated)
     */
    private async loadBrandingConfiguration(tenantId: string): Promise<CustomBrandingConfiguration> {
        // This would be an actual database call in production
        // For now, return default configuration
        return this.getDefaultBrandingConfiguration(tenantId);
    }

    /**
     * Save branding configuration to database (simulated)
     */
    private async saveBrandingConfiguration(config: CustomBrandingConfiguration): Promise<void> {
        // This would be an actual database save in production
        logger.info('Branding configuration saved', {
            tenantId: config.tenantId,
            organizationName: config.organizationName,
            category: 'reports'
        });
    }

    /**
     * Get default AVIAN branding configuration
     */
    private getDefaultBrandingConfiguration(tenantId: string): CustomBrandingConfiguration {
        return {
            tenantId,
            organizationName: '[Client Organization Name]',
            brandingEnabled: false,
            colorScheme: {
                primary: '#1e40af',
                secondary: '#374151',
                accent: '#f59e0b',
                background: '#ffffff',
                text: '#111827',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444'
            },
            logo: {
                logoPosition: 'top-left',
                showAvianLogo: true,
                avianLogoPosition: 'footer'
            },
            typography: {
                primaryFont: 'Inter, system-ui, sans-serif',
                secondaryFont: 'Inter, system-ui, sans-serif',
                headingFont: 'Inter, system-ui, sans-serif',
                fontSize: {
                    small: '0.875rem',
                    medium: '1rem',
                    large: '1.25rem',
                    xlarge: '1.875rem'
                }
            },
            layout: {
                headerHeight: 80,
                footerHeight: 60,
                marginTop: 40,
                marginBottom: 40,
                marginLeft: 40,
                marginRight: 40,
                slideSpacing: 24
            },
            confidentialityNotice: 'Confidential & Proprietary - AVIAN Cybersecurity Platform',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'system',
            updatedBy: 'system'
        };
    }

    /**
     * Initialize branding templates for different industries
     */
    private initializeBrandingTemplates(): Map<string, BrandingTemplate> {
        const templates = new Map<string, BrandingTemplate>();

        // Healthcare template
        templates.set('healthcare', {
            id: 'healthcare',
            name: 'Healthcare Professional',
            description: 'Clean, trustworthy design suitable for healthcare organizations',
            industry: 'healthcare',
            colorScheme: {
                primary: '#0369a1',
                secondary: '#1e40af',
                accent: '#059669',
                background: '#ffffff',
                text: '#111827',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444'
            },
            typography: {
                primaryFont: 'Inter, system-ui, sans-serif',
                secondaryFont: 'Inter, system-ui, sans-serif',
                headingFont: 'Inter, system-ui, sans-serif',
                fontSize: {
                    small: '0.875rem',
                    medium: '1rem',
                    large: '1.25rem',
                    xlarge: '1.875rem'
                }
            },
            layout: {
                headerHeight: 90,
                footerHeight: 70,
                marginTop: 50,
                marginBottom: 50,
                marginLeft: 50,
                marginRight: 50,
                slideSpacing: 30
            },
            defaultSettings: {
                confidentialityNotice: 'Confidential Healthcare Information - HIPAA Protected'
            }
        });

        // Financial template
        templates.set('financial', {
            id: 'financial',
            name: 'Financial Services',
            description: 'Professional, secure design for financial institutions',
            industry: 'financial',
            colorScheme: {
                primary: '#1e3a8a',
                secondary: '#374151',
                accent: '#dc2626',
                background: '#ffffff',
                text: '#111827',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444'
            },
            typography: {
                primaryFont: 'Inter, system-ui, sans-serif',
                secondaryFont: 'Inter, system-ui, sans-serif',
                headingFont: 'Inter, system-ui, sans-serif',
                fontSize: {
                    small: '0.875rem',
                    medium: '1rem',
                    large: '1.25rem',
                    xlarge: '1.875rem'
                }
            },
            layout: {
                headerHeight: 85,
                footerHeight: 65,
                marginTop: 45,
                marginBottom: 45,
                marginLeft: 45,
                marginRight: 45,
                slideSpacing: 28
            },
            defaultSettings: {
                confidentialityNotice: 'Confidential Financial Information - Regulatory Protected'
            }
        });

        // Technology template
        templates.set('technology', {
            id: 'technology',
            name: 'Technology Innovation',
            description: 'Modern, innovative design for technology companies',
            industry: 'technology',
            colorScheme: {
                primary: '#7c3aed',
                secondary: '#4338ca',
                accent: '#06b6d4',
                background: '#ffffff',
                text: '#111827',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444'
            },
            typography: {
                primaryFont: 'Inter, system-ui, sans-serif',
                secondaryFont: 'Inter, system-ui, sans-serif',
                headingFont: 'Inter, system-ui, sans-serif',
                fontSize: {
                    small: '0.875rem',
                    medium: '1rem',
                    large: '1.25rem',
                    xlarge: '1.875rem'
                }
            },
            layout: {
                headerHeight: 80,
                footerHeight: 60,
                marginTop: 40,
                marginBottom: 40,
                marginLeft: 40,
                marginRight: 40,
                slideSpacing: 24
            },
            defaultSettings: {
                confidentialityNotice: 'Confidential Technology Information - Proprietary & Protected'
            }
        });

        return templates;
    }

    /**
     * Validate color format (hex, rgb, rgba, hsl, hsla)
     */
    private isValidColor(color: string): boolean {
        const colorRegex = /^(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)|hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\))$/;
        return colorRegex.test(color);
    }

    /**
     * Validate URL format
     */
    private isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Factory function to create CustomBrandingService instance
 */
export function createCustomBrandingService(): CustomBrandingService {
    return new CustomBrandingService();
}