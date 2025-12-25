/**
 * Template Engine Service
 * 
 * Applies AVIAN branding and slide-based formatting to report data.
 * Handles slide rendering, branding, and chart formatting.
 */

import {
    Slide,
    Chart,
    ChartData,
    SlideLayout,
    SlideContent,
    Callout
} from '@/types/reports';

export interface SlideData {
    [key: string]: any;
}

export interface SlideTemplate {
    type: 'executive-overview' | 'data-visualization' | 'trend-analysis' | 'summary';
    layout: SlideLayout;
    styling: SlideStyling;
}

export interface SlideStyling {
    theme: 'dark';
    branding: 'avian';
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
        textSecondary: string;
    };
    fonts: {
        heading: string;
        body: string;
        monospace: string;
    };
    spacing: {
        small: string;
        medium: string;
        large: string;
    };
}

export interface RenderedSlide {
    html: string;
    css: string;
    metadata: {
        slideId: string;
        slideType: string;
        templateVersion: string;
        renderTimestamp: Date;
    };
}

export interface BrandedContent {
    content: string;
    branding: {
        logo: string;
        colors: SlideStyling['colors'];
        fonts: SlideStyling['fonts'];
    };
}

export interface FormattedChart {
    chartHtml: string;
    chartCss: string;
    chartData: ChartData;
}

/**
 * Base slide template class that all specific slide templates extend
 */
export abstract class BaseSlideTemplate {
    protected styling: SlideStyling;

    constructor() {
        this.styling = this.getAvianStyling();
    }

    /**
     * Get AVIAN dark theme styling configuration
     */
    protected getAvianStyling(): SlideStyling {
        return {
            theme: 'dark',
            branding: 'avian',
            colors: {
                primary: '#00D4FF',      // AVIAN cyan
                secondary: '#1A1A1A',    // Dark gray
                accent: '#FF6B35',       // Orange accent
                background: '#0A0A0A',   // Very dark background
                text: '#FFFFFF',         // White text
                textSecondary: '#B0B0B0' // Light gray text
            },
            fonts: {
                heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
                body: '"Inter", "Helvetica Neue", Arial, sans-serif',
                monospace: '"JetBrains Mono", "Fira Code", monospace'
            },
            spacing: {
                small: '0.5rem',
                medium: '1rem',
                large: '2rem'
            }
        };
    }

    /**
     * Generate base CSS for all slides
     */
    protected getBaseCss(): string {
        return `
            .slide {
                width: 100%;
                height: 100vh;
                background: ${this.styling.colors.background};
                color: ${this.styling.colors.text};
                font-family: ${this.styling.fonts.body};
                padding: ${this.styling.spacing.large};
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                position: relative;
                overflow: hidden;
            }

            .slide-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: ${this.styling.spacing.large};
                border-bottom: 2px solid ${this.styling.colors.primary};
                padding-bottom: ${this.styling.spacing.medium};
            }

            .slide-title {
                font-family: ${this.styling.fonts.heading};
                font-size: 2.5rem;
                font-weight: 700;
                color: ${this.styling.colors.text};
                margin: 0;
            }

            .slide-subtitle {
                font-size: 1.2rem;
                color: ${this.styling.colors.textSecondary};
                margin: ${this.styling.spacing.small} 0 0 0;
            }

            .avian-logo {
                width: 120px;
                height: auto;
                filter: brightness(0) invert(1);
            }

            .slide-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: ${this.styling.spacing.medium};
            }

            .callout {
                padding: ${this.styling.spacing.medium};
                border-radius: 8px;
                margin: ${this.styling.spacing.small} 0;
                border-left: 4px solid;
            }

            .callout.info {
                background: rgba(0, 212, 255, 0.1);
                border-color: ${this.styling.colors.primary};
            }

            .callout.warning {
                background: rgba(255, 107, 53, 0.1);
                border-color: ${this.styling.colors.accent};
            }

            .callout.success {
                background: rgba(34, 197, 94, 0.1);
                border-color: #22c55e;
            }

            .callout.highlight {
                background: rgba(255, 255, 255, 0.05);
                border-color: ${this.styling.colors.textSecondary};
            }

            .key-points {
                list-style: none;
                padding: 0;
                margin: ${this.styling.spacing.medium} 0;
            }

            .key-points li {
                padding: ${this.styling.spacing.small} 0;
                padding-left: ${this.styling.spacing.large};
                position: relative;
            }

            .key-points li::before {
                content: "▶";
                color: ${this.styling.colors.primary};
                position: absolute;
                left: 0;
                top: ${this.styling.spacing.small};
            }

            .slide-footer {
                margin-top: auto;
                padding-top: ${this.styling.spacing.medium};
                border-top: 1px solid ${this.styling.colors.secondary};
                font-size: 0.9rem;
                color: ${this.styling.colors.textSecondary};
                text-align: center;
            }
        `;
    }

    /**
     * Abstract method to render slide content - must be implemented by subclasses
     */
    abstract renderContent(slideData: SlideData): string;

    /**
     * Abstract method to get slide-specific CSS - must be implemented by subclasses
     */
    abstract getSlideSpecificCss(): string;

    /**
     * Render the complete slide HTML
     */
    render(slideData: SlideData): RenderedSlide {
        const content = this.renderContent(slideData);
        const css = this.getBaseCss() + this.getSlideSpecificCss();

        const html = `
            <div class="slide">
                <div class="slide-header">
                    <div>
                        <h1 class="slide-title">${slideData.title || 'AVIAN Security Report'}</h1>
                        ${slideData.subtitle ? `<p class="slide-subtitle">${slideData.subtitle}</p>` : ''}
                    </div>
                    <div class="avian-logo">
                        <svg width="120" height="40" viewBox="0 0 120 40" fill="currentColor">
                            <text x="10" y="25" font-family="${this.styling.fonts.heading}" font-size="18" font-weight="bold">AVIAN</text>
                        </svg>
                    </div>
                </div>
                <div class="slide-content">
                    ${content}
                </div>
                <div class="slide-footer">
                    Generated on ${new Date().toLocaleDateString()} | AVIAN Cybersecurity Platform
                </div>
            </div>
        `;

        return {
            html,
            css,
            metadata: {
                slideId: slideData.slideId || 'unknown',
                slideType: slideData.slideType || 'unknown',
                templateVersion: '1.0.0',
                renderTimestamp: new Date()
            }
        };
    }
}

/**
 * Executive Overview slide template
 */
export class ExecutiveOverviewTemplate extends BaseSlideTemplate {
    renderContent(slideData: SlideData): string {
        const { summary, keyMetrics = [], reportingPeriod } = slideData;

        return `
            <div class="executive-overview">
                <div class="reporting-period">
                    <h2>Reporting Period: ${reportingPeriod}</h2>
                </div>
                
                <div class="summary-section">
                    <h3>Executive Summary</h3>
                    <p class="summary-text">${summary}</p>
                </div>

                <div class="key-metrics-grid">
                    ${keyMetrics.map((metric: any) => `
                        <div class="metric-card">
                            <div class="metric-value">${metric.value}</div>
                            <div class="metric-label">${metric.label}</div>
                            ${metric.trend ? `
                                <div class="metric-trend ${metric.trend}">
                                    ${metric.trendPercentage ? `${metric.trendPercentage}%` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    getSlideSpecificCss(): string {
        return `
            .executive-overview {
                display: flex;
                flex-direction: column;
                gap: ${this.styling.spacing.large};
            }

            .reporting-period h2 {
                color: ${this.styling.colors.primary};
                font-size: 1.5rem;
                margin: 0;
            }

            .summary-section h3 {
                color: ${this.styling.colors.text};
                font-size: 1.3rem;
                margin-bottom: ${this.styling.spacing.medium};
            }

            .summary-text {
                font-size: 1.1rem;
                line-height: 1.6;
                color: ${this.styling.colors.textSecondary};
            }

            .key-metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: ${this.styling.spacing.medium};
            }

            .metric-card {
                background: ${this.styling.colors.secondary};
                padding: ${this.styling.spacing.medium};
                border-radius: 8px;
                border: 1px solid ${this.styling.colors.primary};
                text-align: center;
            }

            .metric-value {
                font-size: 2rem;
                font-weight: bold;
                color: ${this.styling.colors.primary};
                margin-bottom: ${this.styling.spacing.small};
            }

            .metric-label {
                font-size: 0.9rem;
                color: ${this.styling.colors.textSecondary};
                margin-bottom: ${this.styling.spacing.small};
            }

            .metric-trend {
                font-size: 0.8rem;
                font-weight: bold;
            }

            .metric-trend.up {
                color: #22c55e;
            }

            .metric-trend.down {
                color: ${this.styling.colors.accent};
            }

            .metric-trend.stable {
                color: ${this.styling.colors.textSecondary};
            }
        `;
    }
}

/**
 * Data Visualization slide template
 */
export class DataVisualizationTemplate extends BaseSlideTemplate {
    renderContent(slideData: SlideData): string {
        const { summary, charts = [], keyPoints = [] } = slideData;

        return `
            <div class="data-visualization">
                ${summary ? `
                    <div class="summary-section">
                        <p class="summary-text">${summary}</p>
                    </div>
                ` : ''}
                
                <div class="charts-container">
                    ${charts.map((chart: any, index: number) => `
                        <div class="chart-wrapper" id="chart-${index}">
                            <h4 class="chart-title">${chart.title}</h4>
                            <div class="chart-placeholder">
                                Chart: ${chart.type} - ${chart.title}
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${keyPoints.length > 0 ? `
                    <ul class="key-points">
                        ${keyPoints.map((point: string) => `<li>${point}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }

    getSlideSpecificCss(): string {
        return `
            .data-visualization {
                display: flex;
                flex-direction: column;
                gap: ${this.styling.spacing.medium};
            }

            .charts-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: ${this.styling.spacing.medium};
                flex: 1;
            }

            .chart-wrapper {
                background: ${this.styling.colors.secondary};
                padding: ${this.styling.spacing.medium};
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .chart-title {
                color: ${this.styling.colors.text};
                font-size: 1.1rem;
                margin: 0 0 ${this.styling.spacing.medium} 0;
                text-align: center;
            }

            .chart-placeholder {
                height: 200px;
                background: rgba(0, 212, 255, 0.1);
                border: 2px dashed ${this.styling.colors.primary};
                display: flex;
                align-items: center;
                justify-content: center;
                color: ${this.styling.colors.primary};
                font-weight: bold;
                border-radius: 4px;
            }
        `;
    }
}

/**
 * Trend Analysis slide template for monthly reports
 */
export class TrendAnalysisTemplate extends BaseSlideTemplate {
    renderContent(slideData: SlideData): string {
        const {
            weekOverWeekTrends = [],
            recurringAlertTypes = [],
            vulnerabilityAging = {},
            summary
        } = slideData;

        return `
            <div class="trend-analysis">
                ${summary ? `
                    <div class="summary-section">
                        <p class="summary-text">${summary}</p>
                    </div>
                ` : ''}
                
                <div class="trends-grid">
                    <div class="trend-section">
                        <h3>Week-over-Week Trends</h3>
                        <div class="trend-items">
                            ${weekOverWeekTrends.map((trend: any) => `
                                <div class="trend-item">
                                    <div class="trend-metric">${trend.metric}</div>
                                    <div class="trend-change ${trend.trend}">
                                        <span class="trend-arrow">${trend.trend === 'up' ? '↗' : trend.trend === 'down' ? '↘' : '→'}</span>
                                        <span class="trend-percentage">${Math.abs(trend.changePercentage)}%</span>
                                    </div>
                                    <div class="trend-values">
                                        <span class="previous">${trend.previousPeriod}</span>
                                        <span class="arrow">→</span>
                                        <span class="current">${trend.currentPeriod}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="recurring-alerts-section">
                        <h3>Top Recurring Alert Types</h3>
                        <div class="recurring-alerts">
                            ${recurringAlertTypes.map((alert: any) => `
                                <div class="alert-type-card">
                                    <div class="alert-type-header">
                                        <span class="alert-type">${alert.alertType}</span>
                                        <span class="alert-frequency">${alert.frequency} occurrences</span>
                                    </div>
                                    <div class="alert-severity severity-${alert.averageSeverity}">${alert.averageSeverity}</div>
                                    <div class="top-devices">
                                        Top devices: ${alert.topDevices.slice(0, 3).join(', ')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                ${vulnerabilityAging.openVulnerabilities ? `
                    <div class="vulnerability-aging">
                        <h3>Vulnerability Aging Analysis</h3>
                        <div class="aging-breakdown">
                            <div class="aging-item">
                                <div class="aging-label">< 30 days</div>
                                <div class="aging-count">${vulnerabilityAging.openVulnerabilities.lessThan30Days}</div>
                            </div>
                            <div class="aging-item">
                                <div class="aging-label">30-90 days</div>
                                <div class="aging-count">${vulnerabilityAging.openVulnerabilities.thirtyTo90Days}</div>
                            </div>
                            <div class="aging-item">
                                <div class="aging-label">> 90 days</div>
                                <div class="aging-count">${vulnerabilityAging.openVulnerabilities.moreThan90Days}</div>
                            </div>
                            <div class="aging-item highlight">
                                <div class="aging-label">Mitigated This Period</div>
                                <div class="aging-count">${vulnerabilityAging.mitigatedThisPeriod}</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    getSlideSpecificCss(): string {
        return `
            .trend-analysis {
                display: flex;
                flex-direction: column;
                gap: ${this.styling.spacing.large};
            }

            .trends-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: ${this.styling.spacing.large};
            }

            .trend-section h3, .recurring-alerts-section h3 {
                color: ${this.styling.colors.primary};
                font-size: 1.3rem;
                margin-bottom: ${this.styling.spacing.medium};
                border-bottom: 2px solid ${this.styling.colors.primary};
                padding-bottom: ${this.styling.spacing.small};
            }

            .trend-items {
                display: flex;
                flex-direction: column;
                gap: ${this.styling.spacing.medium};
            }

            .trend-item {
                background: ${this.styling.colors.secondary};
                padding: ${this.styling.spacing.medium};
                border-radius: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .trend-metric {
                font-weight: 600;
                color: ${this.styling.colors.text};
            }

            .trend-change {
                display: flex;
                align-items: center;
                gap: ${this.styling.spacing.small};
                font-weight: bold;
            }

            .trend-change.up {
                color: #22c55e;
            }

            .trend-change.down {
                color: ${this.styling.colors.accent};
            }

            .trend-change.stable {
                color: ${this.styling.colors.textSecondary};
            }

            .trend-values {
                display: flex;
                align-items: center;
                gap: ${this.styling.spacing.small};
                font-size: 0.9rem;
                color: ${this.styling.colors.textSecondary};
            }

            .trend-values .current {
                color: ${this.styling.colors.text};
                font-weight: bold;
            }

            .recurring-alerts {
                display: flex;
                flex-direction: column;
                gap: ${this.styling.spacing.medium};
            }

            .alert-type-card {
                background: ${this.styling.colors.secondary};
                padding: ${this.styling.spacing.medium};
                border-radius: 8px;
                border-left: 4px solid ${this.styling.colors.accent};
            }

            .alert-type-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: ${this.styling.spacing.small};
            }

            .alert-type {
                font-weight: 600;
                color: ${this.styling.colors.text};
                text-transform: capitalize;
            }

            .alert-frequency {
                color: ${this.styling.colors.primary};
                font-weight: bold;
            }

            .alert-severity {
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                font-weight: bold;
                text-transform: uppercase;
                margin-bottom: ${this.styling.spacing.small};
                display: inline-block;
            }

            .alert-severity.severity-critical {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
            }

            .alert-severity.severity-high {
                background: rgba(255, 107, 53, 0.2);
                color: ${this.styling.colors.accent};
            }

            .alert-severity.severity-medium {
                background: rgba(251, 191, 36, 0.2);
                color: #fbbf24;
            }

            .alert-severity.severity-low {
                background: rgba(34, 197, 94, 0.2);
                color: #22c55e;
            }

            .top-devices {
                font-size: 0.8rem;
                color: ${this.styling.colors.textSecondary};
            }

            .vulnerability-aging h3 {
                color: ${this.styling.colors.primary};
                font-size: 1.3rem;
                margin-bottom: ${this.styling.spacing.medium};
            }

            .aging-breakdown {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: ${this.styling.spacing.medium};
            }

            .aging-item {
                background: ${this.styling.colors.secondary};
                padding: ${this.styling.spacing.medium};
                border-radius: 8px;
                text-align: center;
            }

            .aging-item.highlight {
                border: 2px solid ${this.styling.colors.primary};
                background: rgba(0, 212, 255, 0.1);
            }

            .aging-label {
                font-size: 0.9rem;
                color: ${this.styling.colors.textSecondary};
                margin-bottom: ${this.styling.spacing.small};
            }

            .aging-count {
                font-size: 1.5rem;
                font-weight: bold;
                color: ${this.styling.colors.text};
            }

            .aging-item.highlight .aging-count {
                color: ${this.styling.colors.primary};
            }
        `;
    }
}

/**
 * Summary slide template for general purpose summaries
 */
export class SummaryTemplate extends BaseSlideTemplate {
    renderContent(slideData: SlideData): string {
        const {
            summary,
            keyPoints = [],
            callouts = [],
            metrics = [],
            highlights = []
        } = slideData;

        return `
            <div class="summary-slide">
                ${summary ? `
                    <div class="main-summary">
                        <p class="summary-text">${summary}</p>
                    </div>
                ` : ''}

                ${highlights.length > 0 ? `
                    <div class="highlights-section">
                        <h3>Key Highlights</h3>
                        <div class="highlights-grid">
                            ${highlights.map((highlight: any) => `
                                <div class="highlight-card">
                                    <div class="highlight-icon">${highlight.icon || '🔹'}</div>
                                    <div class="highlight-content">
                                        <div class="highlight-title">${highlight.title}</div>
                                        <div class="highlight-description">${highlight.description}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${metrics.length > 0 ? `
                    <div class="metrics-section">
                        <h3>Key Metrics</h3>
                        <div class="metrics-grid">
                            ${metrics.map((metric: any) => `
                                <div class="metric-summary-card">
                                    <div class="metric-value">${metric.value}</div>
                                    <div class="metric-label">${metric.label}</div>
                                    ${metric.change ? `
                                        <div class="metric-change ${metric.change > 0 ? 'positive' : 'negative'}">
                                            ${metric.change > 0 ? '+' : ''}${metric.change}%
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${callouts.length > 0 ? `
                    <div class="callouts-section">
                        ${callouts.map((callout: any) => `
                            <div class="callout ${callout.type}">
                                ${callout.icon ? `<span class="callout-icon">${callout.icon}</span>` : ''}
                                <span class="callout-text">${callout.text}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${keyPoints.length > 0 ? `
                    <ul class="key-points">
                        ${keyPoints.map((point: string) => `<li>${point}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }

    getSlideSpecificCss(): string {
        return `
            .summary-slide {
                display: flex;
                flex-direction: column;
                gap: ${this.styling.spacing.large};
            }

            .main-summary .summary-text {
                font-size: 1.2rem;
                line-height: 1.6;
                color: ${this.styling.colors.text};
                text-align: center;
                padding: ${this.styling.spacing.large};
                background: rgba(0, 212, 255, 0.05);
                border-radius: 8px;
                border: 1px solid rgba(0, 212, 255, 0.2);
            }

            .highlights-section h3, .metrics-section h3 {
                color: ${this.styling.colors.primary};
                font-size: 1.3rem;
                margin-bottom: ${this.styling.spacing.medium};
                text-align: center;
            }

            .highlights-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: ${this.styling.spacing.medium};
            }

            .highlight-card {
                background: ${this.styling.colors.secondary};
                padding: ${this.styling.spacing.medium};
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: ${this.styling.spacing.medium};
                border-left: 4px solid ${this.styling.colors.primary};
            }

            .highlight-icon {
                font-size: 1.5rem;
                width: 40px;
                text-align: center;
            }

            .highlight-title {
                font-weight: 600;
                color: ${this.styling.colors.text};
                margin-bottom: ${this.styling.spacing.small};
            }

            .highlight-description {
                font-size: 0.9rem;
                color: ${this.styling.colors.textSecondary};
                line-height: 1.4;
            }

            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: ${this.styling.spacing.medium};
            }

            .metric-summary-card {
                background: ${this.styling.colors.secondary};
                padding: ${this.styling.spacing.medium};
                border-radius: 8px;
                text-align: center;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .metric-summary-card .metric-value {
                font-size: 2rem;
                font-weight: bold;
                color: ${this.styling.colors.primary};
                margin-bottom: ${this.styling.spacing.small};
            }

            .metric-summary-card .metric-label {
                font-size: 0.9rem;
                color: ${this.styling.colors.textSecondary};
                margin-bottom: ${this.styling.spacing.small};
            }

            .metric-change {
                font-size: 0.8rem;
                font-weight: bold;
            }

            .metric-change.positive {
                color: #22c55e;
            }

            .metric-change.negative {
                color: ${this.styling.colors.accent};
            }

            .callouts-section {
                display: flex;
                flex-direction: column;
                gap: ${this.styling.spacing.medium};
            }

            .callout {
                display: flex;
                align-items: center;
                gap: ${this.styling.spacing.medium};
                padding: ${this.styling.spacing.medium};
                border-radius: 8px;
                border-left: 4px solid;
            }

            .callout-icon {
                font-size: 1.2rem;
                width: 24px;
                text-align: center;
            }

            .callout-text {
                flex: 1;
                line-height: 1.4;
            }
        `;
    }
}

/**
 * Main Template Engine class
 */
export class TemplateEngine {
    private templates: Map<string, BaseSlideTemplate>;

    constructor() {
        this.templates = new Map();
        this.initializeTemplates();
    }

    /**
     * Initialize available slide templates
     */
    private initializeTemplates(): void {
        this.templates.set('executive-overview', new ExecutiveOverviewTemplate());
        this.templates.set('data-visualization', new DataVisualizationTemplate());
        this.templates.set('trend-analysis', new TrendAnalysisTemplate());
        this.templates.set('summary', new SummaryTemplate());
    }

    /**
     * Renders a slide using the specified template and data
     * Applies comprehensive terminology standardization per Requirements 2.2, 3.1, and 7.5
     */
    async renderSlide(
        slideData: SlideData,
        template: SlideTemplate
    ): Promise<RenderedSlide> {
        const slideTemplate = this.templates.get(template.type);

        if (!slideTemplate) {
            throw new Error(`Unknown slide template type: ${template.type}`);
        }

        // Apply comprehensive terminology standardization before rendering
        const standardizedData = this.enforceTemplateTerminology(slideData);

        return slideTemplate.render(standardizedData);
    }

    /**
     * Applies AVIAN branding to report content
     */
    async applyBranding(content: any): Promise<BrandedContent> {
        const styling = this.getAvianStyling();

        return {
            content: this.standardizeTerminology(content),
            branding: {
                logo: this.getAvianLogo(),
                colors: styling.colors,
                fonts: styling.fonts
            }
        };
    }

    /**
     * Get AVIAN styling configuration (public method)
     */
    private getAvianStyling(): SlideStyling {
        return {
            theme: 'dark',
            branding: 'avian',
            colors: {
                primary: '#00D4FF',      // AVIAN cyan
                secondary: '#1A1A1A',    // Dark gray
                accent: '#FF6B35',       // Orange accent
                background: '#0A0A0A',   // Very dark background
                text: '#FFFFFF',         // White text
                textSecondary: '#B0B0B0' // Light gray text
            },
            fonts: {
                heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
                body: '"Inter", "Helvetica Neue", Arial, sans-serif',
                monospace: '"JetBrains Mono", "Fira Code", monospace'
            },
            spacing: {
                small: '0.5rem',
                medium: '1rem',
                large: '2rem'
            }
        };
    }

    /**
     * Get AVIAN logo SVG
     */
    private getAvianLogo(): string {
        return `
            <svg width="120" height="40" viewBox="0 0 120 40" fill="currentColor">
                <text x="10" y="25" font-family="Inter, sans-serif" font-size="18" font-weight="bold">AVIAN</text>
            </svg>
        `;
    }

    /**
     * Standardize terminology across all content
     */
    private standardizeTerminology(content: string): string {
        if (typeof content !== 'string') {
            content = JSON.stringify(content);
        }

        return this.applyTerminologyRules(content);
    }

    /**
     * Apply comprehensive terminology standardization rules
     * Implements Requirements 2.2, 3.1, and 7.5 for consistent terminology across all templates
     */
    public applyTerminologyRules(content: string): string {
        // Core terminology replacements as per requirements 2.2 and 3.1
        const terminologyRules = [
            // Alert terminology - Requirement 2.2: Position "Alerts Digested" prominently as value delivered
            { pattern: /Number of Alerts/gi, replacement: 'Alerts Digested' },
            { pattern: /Alert Count/gi, replacement: 'Alerts Digested' },
            { pattern: /Total Alerts/gi, replacement: 'Total Alerts Digested' },
            { pattern: /Alerts Processed/gi, replacement: 'Alerts Digested' },
            { pattern: /Alerts Handled/gi, replacement: 'Alerts Digested' },
            { pattern: /Alerts Managed/gi, replacement: 'Alerts Digested' },
            { pattern: /Alerts Reviewed/gi, replacement: 'Alerts Digested' },
            { pattern: /Alert Processing/gi, replacement: 'Alert Digestion' },
            { pattern: /Alert Management/gi, replacement: 'Alert Digestion' },

            // Update terminology - Requirement 3.1: Rename "OS Updates" to "Updates" in all report sections
            { pattern: /OS Updates/gi, replacement: 'Updates' },
            { pattern: /Operating System Updates/gi, replacement: 'Updates' },
            { pattern: /System Updates/gi, replacement: 'Updates' },
            { pattern: /Software Updates/gi, replacement: 'Updates' },
            { pattern: /Security Updates/gi, replacement: 'Updates' },
            { pattern: /Patch Updates/gi, replacement: 'Updates' },
            { pattern: /Update Installation/gi, replacement: 'Update Application' },
            { pattern: /Updates Installed/gi, replacement: 'Updates Applied' },

            // Executive-friendly language transformations - Requirement 7.5
            { pattern: /\bthreat\b/gi, replacement: 'security event' },
            { pattern: /\bthreats\b/gi, replacement: 'security events' },
            { pattern: /\bmalicious\b/gi, replacement: 'suspicious' },
            { pattern: /\battack\b/gi, replacement: 'security incident' },
            { pattern: /\battacks\b/gi, replacement: 'security incidents' },
            { pattern: /\bexploit\b/gi, replacement: 'security vulnerability' },
            { pattern: /\bexploits\b/gi, replacement: 'security vulnerabilities' },
            { pattern: /\bpayload\b/gi, replacement: 'suspicious content' },
            { pattern: /\bpayloads\b/gi, replacement: 'suspicious content' },
            { pattern: /\bmalware\b/gi, replacement: 'malicious software' },
            { pattern: /\bransomware\b/gi, replacement: 'encryption-based threat' },
            { pattern: /\bphishing\b/gi, replacement: 'deceptive communication' },

            // Technical to business language - Executive-friendly terminology
            { pattern: /\bfalse positive\b/gi, replacement: 'benign detection' },
            { pattern: /\bfalse positives\b/gi, replacement: 'benign detections' },
            { pattern: /\btrue positive\b/gi, replacement: 'confirmed security incident' },
            { pattern: /\btrue positives\b/gi, replacement: 'confirmed security incidents' },
            { pattern: /\bincident response\b/gi, replacement: 'security response' },
            { pattern: /\bincident handling\b/gi, replacement: 'security response' },

            // Vulnerability language - Business-friendly terms
            { pattern: /\bCVE\b/g, replacement: 'security vulnerability' },
            { pattern: /\bCVEs\b/g, replacement: 'security vulnerabilities' },
            { pattern: /\bvuln\b/gi, replacement: 'vulnerability' },
            { pattern: /\bvulns\b/gi, replacement: 'vulnerabilities' },
            { pattern: /\bzero-day\b/gi, replacement: 'newly discovered vulnerability' },
            { pattern: /\bpatch management\b/gi, replacement: 'security maintenance' },

            // Network and firewall terminology - Executive-friendly
            { pattern: /\bIPS\b/g, replacement: 'Intrusion Prevention' },
            { pattern: /\bIDS\b/g, replacement: 'Intrusion Detection' },
            { pattern: /\bDPI\b/g, replacement: 'Deep Packet Inspection' },
            { pattern: /\bGAV\b/g, replacement: 'Gateway Anti-Virus' },
            { pattern: /\bUTM\b/g, replacement: 'Unified Threat Management' },
            { pattern: /\bNGFW\b/g, replacement: 'Next-Generation Firewall' },
            { pattern: /\bSOC\b/g, replacement: 'Security Operations Center' },
            { pattern: /\bSIEM\b/g, replacement: 'Security Information Management' },

            // Compliance and audit language - Business-focused
            { pattern: /\bcompliance check\b/gi, replacement: 'security assessment' },
            { pattern: /\bcompliance checks\b/gi, replacement: 'security assessments' },
            { pattern: /\baudit log\b/gi, replacement: 'security log' },
            { pattern: /\baudit logs\b/gi, replacement: 'security logs' },
            { pattern: /\baudit trail\b/gi, replacement: 'security record' },
            { pattern: /\bforensic analysis\b/gi, replacement: 'security investigation' },

            // Time-based language improvements - Clear business terms
            { pattern: /\bMTTR\b/g, replacement: 'Average Resolution Time' },
            { pattern: /\bMTTD\b/g, replacement: 'Average Detection Time' },
            { pattern: /\bSLA\b/g, replacement: 'Service Level Agreement' },
            { pattern: /\bRTO\b/g, replacement: 'Recovery Time Objective' },
            { pattern: /\bRPO\b/g, replacement: 'Recovery Point Objective' },
            { pattern: /\bdowntime\b/gi, replacement: 'service interruption' },
            { pattern: /\buptime\b/gi, replacement: 'service availability' },

            // Risk and impact terminology - Executive communication
            { pattern: /\brisk assessment\b/gi, replacement: 'security evaluation' },
            { pattern: /\brisk mitigation\b/gi, replacement: 'risk reduction' },
            { pattern: /\bimpact analysis\b/gi, replacement: 'business impact evaluation' },
            { pattern: /\bthreat landscape\b/gi, replacement: 'security environment' },
            { pattern: /\battack surface\b/gi, replacement: 'security exposure' },

            // Positive framing for executive reports
            { pattern: /\bno incidents\b/gi, replacement: 'maintained security' },
            { pattern: /\bzero breaches\b/gi, replacement: 'maintained security integrity' },
            { pattern: /\bno vulnerabilities\b/gi, replacement: 'secure configuration' },
            { pattern: /\bblocked threats\b/gi, replacement: 'prevented security events' },
            { pattern: /\bmitigated risks\b/gi, replacement: 'reduced security exposure' }
        ];

        // Apply all terminology rules in order
        let processedContent = content;
        terminologyRules.forEach(rule => {
            processedContent = processedContent.replace(rule.pattern, rule.replacement);
        });

        return processedContent;
    }

    /**
     * Format text for executive-friendly presentation
     * Implements Requirement 7.5: Executive-friendly language designed for email delivery and PDF viewing
     */
    public formatExecutiveFriendly(text: string): string {
        // Apply terminology standardization first
        let formatted = this.applyTerminologyRules(text);

        // Executive formatting rules for business-focused communication
        const executiveRules = [
            // Convert technical percentages to business language
            { pattern: /(\d+)% reduction/gi, replacement: '$1% improvement' },
            { pattern: /(\d+)% increase in threats/gi, replacement: '$1% more security events detected' },
            { pattern: /(\d+)% decrease in/gi, replacement: '$1% reduction in' },
            { pattern: /(\d+)% improvement in/gi, replacement: '$1% enhancement in' },

            // Positive framing for executive communication
            { pattern: /no incidents/gi, replacement: 'maintained security' },
            { pattern: /zero breaches/gi, replacement: 'maintained security integrity' },
            { pattern: /blocked (\d+) threats/gi, replacement: 'successfully prevented $1 security events' },
            { pattern: /stopped (\d+) attacks/gi, replacement: 'successfully prevented $1 security incidents' },
            { pattern: /detected (\d+) threats/gi, replacement: 'identified $1 security events' },

            // Value-focused language emphasizing business benefits
            { pattern: /patched (\d+) vulnerabilities/gi, replacement: 'secured $1 potential risk areas' },
            { pattern: /updated (\d+) systems/gi, replacement: 'enhanced security on $1 systems' },
            { pattern: /monitored (\d+) devices/gi, replacement: 'provided security oversight for $1 devices' },
            { pattern: /scanned (\d+) systems/gi, replacement: 'assessed security on $1 systems' },
            { pattern: /protected (\d+) endpoints/gi, replacement: 'secured $1 business endpoints' },

            // Risk communication with business context
            { pattern: /high risk/gi, replacement: 'requires immediate attention' },
            { pattern: /medium risk/gi, replacement: 'scheduled for remediation' },
            { pattern: /low risk/gi, replacement: 'minimal impact' },
            { pattern: /critical risk/gi, replacement: 'urgent security priority' },
            { pattern: /severe risk/gi, replacement: 'high-priority security concern' },

            // Outcome-focused language
            { pattern: /resolved (\d+) incidents/gi, replacement: 'successfully addressed $1 security events' },
            { pattern: /closed (\d+) tickets/gi, replacement: 'completed $1 security tasks' },
            { pattern: /investigated (\d+) alerts/gi, replacement: 'analyzed $1 security notifications' },
            { pattern: /remediated (\d+) issues/gi, replacement: 'resolved $1 security concerns' },

            // Time-based improvements with business focus
            { pattern: /response time improved/gi, replacement: 'faster security response achieved' },
            { pattern: /detection time reduced/gi, replacement: 'quicker threat identification achieved' },
            { pattern: /resolution time decreased/gi, replacement: 'faster issue resolution achieved' },

            // Compliance and governance language
            { pattern: /compliance maintained/gi, replacement: 'regulatory requirements met' },
            { pattern: /audit passed/gi, replacement: 'security standards validated' },
            { pattern: /policy enforced/gi, replacement: 'security guidelines implemented' },

            // Performance and efficiency language
            { pattern: /system performance/gi, replacement: 'operational efficiency' },
            { pattern: /network performance/gi, replacement: 'connectivity performance' },
            { pattern: /security posture/gi, replacement: 'security readiness' },
            { pattern: /threat posture/gi, replacement: 'security environment' },

            // Investment and ROI language for executive reports
            { pattern: /security investment/gi, replacement: 'security enhancement' },
            { pattern: /cost reduction/gi, replacement: 'operational efficiency gain' },
            { pattern: /resource optimization/gi, replacement: 'improved resource utilization' },

            // Proactive vs reactive language
            { pattern: /proactive monitoring/gi, replacement: 'continuous security oversight' },
            { pattern: /reactive response/gi, replacement: 'incident-driven response' },
            { pattern: /preventive measures/gi, replacement: 'proactive security controls' },

            // Business continuity language
            { pattern: /business continuity/gi, replacement: 'operational resilience' },
            { pattern: /disaster recovery/gi, replacement: 'business recovery capability' },
            { pattern: /service availability/gi, replacement: 'operational uptime' }
        ];

        // Apply executive formatting rules
        executiveRules.forEach(rule => {
            formatted = formatted.replace(rule.pattern, rule.replacement);
        });

        return formatted;
    }

    /**
     * Ensure consistent terminology across all slide templates
     * Implements comprehensive standardization for Requirements 2.2, 3.1, and 7.5
     */
    public standardizeSlideContent(slideData: SlideData): SlideData {
        const standardized = { ...slideData };

        // Standardize all string properties recursively
        Object.keys(standardized).forEach(key => {
            const value = standardized[key];

            if (typeof value === 'string') {
                standardized[key] = this.formatExecutiveFriendly(value);
            } else if (Array.isArray(value)) {
                standardized[key] = value.map(item =>
                    typeof item === 'string' ? this.formatExecutiveFriendly(item) :
                        typeof item === 'object' && item !== null ? this.standardizeObjectContent(item) : item
                );
            } else if (value && typeof value === 'object') {
                standardized[key] = this.standardizeObjectContent(value);
            }
        });

        return standardized;
    }

    /**
     * Validate and enforce terminology consistency across all template types
     * Ensures Requirements 2.2 and 3.1 are consistently applied
     */
    public validateTerminologyConsistency(content: string): {
        isConsistent: boolean;
        violations: Array<{
            type: 'alert_terminology' | 'update_terminology' | 'executive_language';
            found: string;
            shouldBe: string;
            requirement: string;
        }>;
    } {
        const violations: Array<{
            type: 'alert_terminology' | 'update_terminology' | 'executive_language';
            found: string;
            shouldBe: string;
            requirement: string;
        }> = [];

        // Check for alert terminology violations (Requirement 2.2)
        const alertViolations = [
            { pattern: /Number of Alerts/gi, shouldBe: 'Alerts Digested' },
            { pattern: /Alert Count/gi, shouldBe: 'Alerts Digested' },
            { pattern: /Alerts Processed/gi, shouldBe: 'Alerts Digested' },
            { pattern: /Alerts Handled/gi, shouldBe: 'Alerts Digested' }
        ];

        alertViolations.forEach(violation => {
            const matches = content.match(violation.pattern);
            if (matches) {
                matches.forEach(match => {
                    violations.push({
                        type: 'alert_terminology',
                        found: match,
                        shouldBe: violation.shouldBe,
                        requirement: '2.2'
                    });
                });
            }
        });

        // Check for update terminology violations (Requirement 3.1)
        const updateViolations = [
            { pattern: /OS Updates/gi, shouldBe: 'Updates' },
            { pattern: /Operating System Updates/gi, shouldBe: 'Updates' },
            { pattern: /System Updates/gi, shouldBe: 'Updates' },
            { pattern: /Software Updates/gi, shouldBe: 'Updates' }
        ];

        updateViolations.forEach(violation => {
            const matches = content.match(violation.pattern);
            if (matches) {
                matches.forEach(match => {
                    violations.push({
                        type: 'update_terminology',
                        found: match,
                        shouldBe: violation.shouldBe,
                        requirement: '3.1'
                    });
                });
            }
        });

        // Check for executive language violations (Requirement 7.5)
        const executiveViolations = [
            { pattern: /\bthreat\b/gi, shouldBe: 'security event' },
            { pattern: /\bmalicious\b/gi, shouldBe: 'suspicious' },
            { pattern: /\battack\b/gi, shouldBe: 'security incident' },
            { pattern: /\bfalse positive\b/gi, shouldBe: 'benign detection' }
        ];

        executiveViolations.forEach(violation => {
            const matches = content.match(violation.pattern);
            if (matches) {
                matches.forEach(match => {
                    violations.push({
                        type: 'executive_language',
                        found: match,
                        shouldBe: violation.shouldBe,
                        requirement: '7.5'
                    });
                });
            }
        });

        return {
            isConsistent: violations.length === 0,
            violations
        };
    }

    /**
     * Apply template-wide terminology enforcement
     * Ensures all slide templates use consistent terminology
     */
    public enforceTemplateTerminology(slideData: SlideData): SlideData {
        // First apply standard terminology rules
        let standardized = this.standardizeSlideContent(slideData);

        // Then apply template-specific terminology enforcement
        standardized = this.applyTemplateSpecificTerminology(standardized);

        // Validate consistency and log any remaining issues
        const validation = this.validateTerminologyConsistency(JSON.stringify(standardized));
        if (!validation.isConsistent) {
            console.warn('Terminology consistency violations detected:', validation.violations);

            // Apply corrections for any remaining violations
            let correctedContent = JSON.stringify(standardized);
            validation.violations.forEach(violation => {
                correctedContent = correctedContent.replace(
                    new RegExp(violation.found.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                    violation.shouldBe
                );
            });

            try {
                standardized = JSON.parse(correctedContent);
            } catch (error) {
                console.error('Failed to parse corrected content, using original:', error);
            }
        }

        return standardized;
    }

    /**
     * Apply template-specific terminology rules based on slide type
     */
    private applyTemplateSpecificTerminology(slideData: SlideData): SlideData {
        const slideType = slideData.slideType;
        let processed = { ...slideData };

        switch (slideType) {
            case 'executive-overview':
                // Executive overview should emphasize value delivery
                processed = this.applyExecutiveOverviewTerminology(processed);
                break;
            case 'data-visualization':
                // Data visualization should use clear, descriptive labels
                processed = this.applyDataVisualizationTerminology(processed);
                break;
            case 'trend-analysis':
                // Trend analysis should use comparative language
                processed = this.applyTrendAnalysisTerminology(processed);
                break;
            case 'summary':
                // Summary slides should use outcome-focused language
                processed = this.applySummaryTerminology(processed);
                break;
        }

        return processed;
    }

    /**
     * Apply executive overview specific terminology
     */
    private applyExecutiveOverviewTerminology(slideData: SlideData): SlideData {
        const processed = { ...slideData };

        // Emphasize value delivery in executive overviews
        if (processed.summary && typeof processed.summary === 'string') {
            processed.summary = processed.summary
                .replace(/processed (\d+) alerts/gi, 'successfully digested $1 security alerts')
                .replace(/handled (\d+) incidents/gi, 'resolved $1 security events')
                .replace(/applied (\d+) updates/gi, 'deployed $1 security enhancements');
        }

        // Standardize key metrics labels
        if (processed.keyMetrics && Array.isArray(processed.keyMetrics)) {
            processed.keyMetrics = processed.keyMetrics.map((metric: any) => ({
                ...metric,
                label: this.formatExecutiveFriendly(metric.label || '')
            }));
        }

        return processed;
    }

    /**
     * Apply data visualization specific terminology
     */
    private applyDataVisualizationTerminology(slideData: SlideData): SlideData {
        const processed = { ...slideData };

        // Ensure chart titles use standardized terminology
        if (processed.charts && Array.isArray(processed.charts)) {
            processed.charts = processed.charts.map((chart: any) => ({
                ...chart,
                title: this.formatExecutiveFriendly(chart.title || '')
            }));
        }

        return processed;
    }

    /**
     * Apply trend analysis specific terminology
     */
    private applyTrendAnalysisTerminology(slideData: SlideData): SlideData {
        const processed = { ...slideData };

        // Standardize trend metrics
        if (processed.weekOverWeekTrends && Array.isArray(processed.weekOverWeekTrends)) {
            processed.weekOverWeekTrends = processed.weekOverWeekTrends.map((trend: any) => ({
                ...trend,
                metric: this.formatExecutiveFriendly(trend.metric || '')
            }));
        }

        return processed;
    }

    /**
     * Apply summary specific terminology
     */
    private applySummaryTerminology(slideData: SlideData): SlideData {
        const processed = { ...slideData };

        // Ensure highlights use positive, outcome-focused language
        if (processed.highlights && Array.isArray(processed.highlights)) {
            processed.highlights = processed.highlights.map((highlight: any) => ({
                ...highlight,
                title: this.formatExecutiveFriendly(highlight.title || ''),
                description: this.formatExecutiveFriendly(highlight.description || '')
            }));
        }

        return processed;
    }

    /**
     * Recursively standardize object content
     */
    private standardizeObjectContent(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item =>
                typeof item === 'string' ? this.formatExecutiveFriendly(item) :
                    typeof item === 'object' ? this.standardizeObjectContent(item) : item
            );
        }

        if (obj && typeof obj === 'object') {
            const standardized: any = {};
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                if (typeof value === 'string') {
                    standardized[key] = this.formatExecutiveFriendly(value);
                } else if (typeof value === 'object') {
                    standardized[key] = this.standardizeObjectContent(value);
                } else {
                    standardized[key] = value;
                }
            });
            return standardized;
        }

        return obj;
    }

    /**
     * Formats chart data for visual presentation
     */
    async formatCharts(chartData: ChartData[]): Promise<FormattedChart[]> {
        return chartData.map(data => this.formatSingleChart(data));
    }

    /**
     * Create enhanced chart data with metadata, icons, and callouts
     */
    createEnhancedChartData(
        labels: string[],
        datasets: any[],
        options: {
            type?: 'bar' | 'donut' | 'progress' | 'timeline';
            title?: string;
            icon?: string;
            callouts?: Array<{
                type: 'info' | 'warning' | 'success' | 'trend-up' | 'trend-down' | 'trend-stable' | 'highlight';
                text: string;
                icon?: string;
            }>;
            maxValue?: number;
            unit?: string;
        } = {}
    ): ChartData {
        return {
            labels,
            datasets,
            metadata: {
                type: options.type || 'bar',
                title: options.title,
                icon: options.icon,
                callouts: options.callouts || [],
                maxValue: options.maxValue,
                unit: options.unit
            }
        };
    }

    /**
     * Create weekly timeline chart data (Requirement 2.5)
     */
    createWeeklyTimelineChart(
        dailyAlertCounts: Array<{ dayOfWeek: string; count: number }>,
        title: string = 'Weekly Alert Timeline'
    ): ChartData {
        const daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const labels = daysOrder.map(day => day.charAt(0).toUpperCase() + day.slice(1, 3));
        const data = daysOrder.map(day => {
            const dayData = dailyAlertCounts.find(d => d.dayOfWeek.toLowerCase() === day);
            return dayData ? dayData.count : 0;
        });

        const totalAlerts = data.reduce((sum, count) => sum + count, 0);
        const peakDay = labels[data.indexOf(Math.max(...data))];

        return this.createEnhancedChartData(
            labels,
            [{ label: 'Alerts Digested', data }],
            {
                type: 'timeline',
                title,
                icon: '📅',
                callouts: [
                    {
                        type: 'info',
                        text: `Total alerts digested this week: ${totalAlerts}`,
                        icon: '📊'
                    },
                    {
                        type: totalAlerts > 0 ? 'highlight' : 'success',
                        text: totalAlerts > 0 ? `Peak activity on ${peakDay}` : 'No alerts this week - excellent security posture',
                        icon: totalAlerts > 0 ? '⚡' : '✅'
                    }
                ]
            }
        );
    }

    /**
     * Create progress chart for updates (Requirement 3.4)
     */
    createUpdatesProgressChart(
        updatesBySource: { windows: number; microsoftOffice: number; firewall: number; other: number },
        title: string = 'Updates Applied by Source'
    ): ChartData {
        const labels = ['Windows', 'Microsoft Office', 'Firewall', 'Other'];
        const data = [
            updatesBySource.windows,
            updatesBySource.microsoftOffice,
            updatesBySource.firewall,
            updatesBySource.other
        ];

        const totalUpdates = data.reduce((sum, count) => sum + count, 0);
        const maxUpdates = Math.max(...data);
        const topSource = labels[data.indexOf(maxUpdates)];

        return this.createEnhancedChartData(
            labels,
            [{ label: 'Updates Applied', data }],
            {
                type: 'progress',
                title,
                icon: '🔄',
                maxValue: Math.max(maxUpdates * 1.2, 100), // 20% padding or minimum 100
                unit: ' updates',
                callouts: [
                    {
                        type: 'success',
                        text: `${totalUpdates} total updates applied successfully`,
                        icon: '✅'
                    },
                    {
                        type: 'info',
                        text: `${topSource} had the most updates (${maxUpdates})`,
                        icon: '📈'
                    }
                ]
            }
        );
    }

    /**
     * Create vulnerability breakdown donut chart
     */
    createVulnerabilityBreakdownChart(
        severityBreakdown: { critical: number; high: number; medium: number },
        title: string = 'Vulnerability Breakdown by Severity'
    ): ChartData {
        const labels = ['Critical', 'High', 'Medium'];
        const data = [severityBreakdown.critical, severityBreakdown.high, severityBreakdown.medium];
        const total = data.reduce((sum, count) => sum + count, 0);

        const callouts = [];
        if (severityBreakdown.critical > 0) {
            callouts.push({
                type: 'warning' as const,
                text: `${severityBreakdown.critical} critical vulnerabilities require immediate attention`,
                icon: '🚨'
            });
        } else {
            callouts.push({
                type: 'success' as const,
                text: 'No critical vulnerabilities detected',
                icon: '✅'
            });
        }

        return this.createEnhancedChartData(
            labels,
            [{ label: 'Vulnerabilities', data }],
            {
                type: 'donut',
                title,
                icon: '🛡️',
                callouts
            }
        );
    }

    /**
     * Format a single chart for visual presentation
     */
    private formatSingleChart(chartData: ChartData): FormattedChart {
        const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const styling = this.getAvianStyling();

        // Generate chart HTML based on type
        const chartHtml = this.generateChartHtml(chartData, chartId, styling);
        const chartCss = this.generateChartCss(chartId, styling);

        return {
            chartHtml,
            chartCss,
            chartData
        };
    }

    /**
     * Generate HTML for different chart types with enhanced icon and callout support
     */
    private generateChartHtml(chartData: ChartData, chartId: string, styling: SlideStyling): string {
        const chartType = chartData.metadata?.type || 'bar';
        const chartTitle = chartData.metadata?.title || '';
        const chartIcon = chartData.metadata?.icon || this.getDefaultChartIcon(chartType);
        const chartCallouts = chartData.metadata?.callouts || [];

        const chartHtml = this.generateChartByType(chartData, chartId, styling, chartType);

        // Wrap chart with enhanced container including icons and callouts
        return `
            <div class="enhanced-chart-wrapper">
                ${chartTitle ? `
                    <div class="chart-header">
                        ${chartIcon ? `<span class="chart-icon">${chartIcon}</span>` : ''}
                        <h4 class="chart-title">${chartTitle}</h4>
                    </div>
                ` : ''}
                
                ${chartHtml}
                
                ${chartCallouts.length > 0 ? `
                    <div class="chart-callouts">
                        ${chartCallouts.map((callout: any) => `
                            <div class="callout ${callout.type || 'info'}">
                                ${callout.icon ? `<span class="callout-icon">${callout.icon}</span>` : ''}
                                <span class="callout-text">${callout.text}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Generate chart HTML by type
     */
    private generateChartByType(chartData: ChartData, chartId: string, styling: SlideStyling, chartType: string): string {
        switch (chartType) {
            case 'bar':
                return this.generateBarChart(chartData, chartId, styling);
            case 'donut':
                return this.generateDonutChart(chartData, chartId, styling);
            case 'progress':
                return this.generateProgressChart(chartData, chartId, styling);
            case 'timeline':
                return this.generateTimelineChart(chartData, chartId, styling);
            default:
                return this.generateBarChart(chartData, chartId, styling);
        }
    }

    /**
     * Get default icon for chart type
     */
    private getDefaultChartIcon(chartType: string): string {
        const iconMap: Record<string, string> = {
            'bar': '📊',
            'donut': '🍩',
            'progress': '📈',
            'timeline': '📅',
            'line': '📉'
        };
        return iconMap[chartType] || '📊';
    }

    /**
     * Generate bar chart HTML
     */
    private generateBarChart(chartData: ChartData, chartId: string, styling: SlideStyling): string {
        const maxValue = Math.max(...chartData.datasets.flatMap(d => d.data));
        const colors = [styling.colors.primary, styling.colors.accent, '#22c55e', '#8b5cf6', '#f59e0b'];

        return `
            <div class="chart-container bar-chart" id="${chartId}">
                <div class="chart-bars">
                    ${chartData.labels.map((label, index) => {
            const value = chartData.datasets[0]?.data[index] || 0;
            const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const color = colors[index % colors.length];

            return `
                            <div class="bar-group">
                                <div class="bar" style="height: ${height}%; background-color: ${color};">
                                    <div class="bar-value">${value}</div>
                                </div>
                                <div class="bar-label">${label}</div>
                            </div>
                        `;
        }).join('')}
                </div>
                ${chartData.datasets.length > 1 ? this.generateLegend(chartData, colors) : ''}
            </div>
        `;
    }

    /**
     * Generate donut chart HTML
     */
    private generateDonutChart(chartData: ChartData, chartId: string, styling: SlideStyling): string {
        const total = chartData.datasets[0]?.data.reduce((sum, val) => sum + val, 0) || 1;
        const colors = [styling.colors.primary, styling.colors.accent, '#22c55e', '#8b5cf6', '#f59e0b'];

        let cumulativePercentage = 0;
        const segments = chartData.labels.map((label, index) => {
            const value = chartData.datasets[0]?.data[index] || 0;
            const percentage = (value / total) * 100;
            const startAngle = cumulativePercentage * 3.6; // Convert to degrees
            const endAngle = (cumulativePercentage + percentage) * 3.6;
            cumulativePercentage += percentage;

            return {
                label,
                value,
                percentage: percentage.toFixed(1),
                color: colors[index % colors.length],
                startAngle,
                endAngle
            };
        });

        return `
            <div class="chart-container donut-chart" id="${chartId}">
                <div class="donut-wrapper">
                    <svg class="donut-svg" viewBox="0 0 200 200">
                        <circle cx="100" cy="100" r="80" fill="none" stroke="${styling.colors.secondary}" stroke-width="20"/>
                        ${segments.map(segment => {
            const largeArcFlag = parseFloat(segment.percentage) > 50 ? 1 : 0;
            const x1 = 100 + 80 * Math.cos((segment.startAngle - 90) * Math.PI / 180);
            const y1 = 100 + 80 * Math.sin((segment.startAngle - 90) * Math.PI / 180);
            const x2 = 100 + 80 * Math.cos((segment.endAngle - 90) * Math.PI / 180);
            const y2 = 100 + 80 * Math.sin((segment.endAngle - 90) * Math.PI / 180);

            return `
                                <path d="M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z" 
                                      fill="${segment.color}" opacity="0.8"/>
                            `;
        }).join('')}
                        <circle cx="100" cy="100" r="50" fill="${styling.colors.background}"/>
                        <text x="100" y="105" text-anchor="middle" fill="${styling.colors.text}" font-size="16" font-weight="bold">
                            ${total}
                        </text>
                    </svg>
                    <div class="donut-legend">
                        ${segments.map(segment => `
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: ${segment.color};"></div>
                                <span class="legend-label">${segment.label}</span>
                                <span class="legend-value">${segment.value} (${segment.percentage}%)</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate progress chart HTML
     */
    private generateProgressChart(chartData: ChartData, chartId: string, styling: SlideStyling): string {
        return `
            <div class="chart-container progress-chart" id="${chartId}">
                ${chartData.labels.map((label, index) => {
            const value = chartData.datasets[0]?.data[index] || 0;
            const maxValue = chartData.metadata?.maxValue || 100;
            const percentage = Math.min((value / maxValue) * 100, 100);
            const color = percentage > 80 ? '#22c55e' : percentage > 50 ? styling.colors.primary : styling.colors.accent;

            return `
                        <div class="progress-item">
                            <div class="progress-header">
                                <span class="progress-label">${label}</span>
                                <span class="progress-value">${value}${chartData.metadata?.unit || ''}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${percentage}%; background-color: ${color};"></div>
                            </div>
                            <div class="progress-percentage">${percentage.toFixed(1)}%</div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    /**
     * Generate timeline chart HTML
     */
    private generateTimelineChart(chartData: ChartData, chartId: string, styling: SlideStyling): string {
        const maxValue = Math.max(...chartData.datasets.flatMap(d => d.data));

        return `
            <div class="chart-container timeline-chart" id="${chartId}">
                <div class="timeline-grid">
                    <div class="timeline-y-axis">
                        ${Array.from({ length: 5 }, (_, i) => {
            const value = Math.round((maxValue * (4 - i)) / 4);
            return `<div class="y-axis-label">${value}</div>`;
        }).join('')}
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-bars">
                            ${chartData.labels.map((label, index) => {
            const value = chartData.datasets[0]?.data[index] || 0;
            const height = maxValue > 0 ? (value / maxValue) * 100 : 0;

            return `
                                    <div class="timeline-bar-group">
                                        <div class="timeline-bar" style="height: ${height}%; background-color: ${styling.colors.primary};">
                                            <div class="timeline-value">${value}</div>
                                        </div>
                                        <div class="timeline-label">${label}</div>
                                    </div>
                                `;
        }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate legend for multi-dataset charts
     */
    private generateLegend(chartData: ChartData, colors: string[]): string {
        return `
            <div class="chart-legend">
                ${chartData.datasets.map((dataset, index) => `
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: ${colors[index % colors.length]};"></div>
                        <span class="legend-label">${dataset.label}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Generate CSS for charts
     */
    private generateChartCss(chartId: string, styling: SlideStyling): string {
        return `
            #${chartId} {
                width: 100%;
                height: 300px;
                background: ${styling.colors.secondary};
                border-radius: 8px;
                padding: ${styling.spacing.medium};
                box-sizing: border-box;
            }

            /* Bar Chart Styles */
            .bar-chart .chart-bars {
                display: flex;
                align-items: end;
                justify-content: space-around;
                height: 80%;
                padding: ${styling.spacing.medium} 0;
            }

            .bar-chart .bar-group {
                display: flex;
                flex-direction: column;
                align-items: center;
                flex: 1;
                max-width: 80px;
            }

            .bar-chart .bar {
                width: 100%;
                min-height: 4px;
                border-radius: 4px 4px 0 0;
                position: relative;
                transition: all 0.3s ease;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 4px;
            }

            .bar-chart .bar:hover {
                opacity: 0.8;
                transform: translateY(-2px);
            }

            .bar-chart .bar-value {
                color: ${styling.colors.text};
                font-size: 0.8rem;
                font-weight: bold;
            }

            .bar-chart .bar-label {
                margin-top: ${styling.spacing.small};
                font-size: 0.8rem;
                color: ${styling.colors.textSecondary};
                text-align: center;
                word-wrap: break-word;
            }

            /* Donut Chart Styles */
            .donut-chart .donut-wrapper {
                display: flex;
                align-items: center;
                gap: ${styling.spacing.large};
                height: 100%;
            }

            .donut-chart .donut-svg {
                width: 200px;
                height: 200px;
            }

            .donut-chart .donut-legend {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: ${styling.spacing.small};
            }

            /* Progress Chart Styles */
            .progress-chart {
                display: flex;
                flex-direction: column;
                gap: ${styling.spacing.medium};
                padding: ${styling.spacing.medium};
            }

            .progress-chart .progress-item {
                display: flex;
                flex-direction: column;
                gap: ${styling.spacing.small};
            }

            .progress-chart .progress-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .progress-chart .progress-label {
                color: ${styling.colors.text};
                font-weight: 500;
            }

            .progress-chart .progress-value {
                color: ${styling.colors.primary};
                font-weight: bold;
            }

            .progress-chart .progress-bar {
                width: 100%;
                height: 20px;
                background: ${styling.colors.background};
                border-radius: 10px;
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .progress-chart .progress-fill {
                height: 100%;
                border-radius: 10px;
                transition: width 0.3s ease;
            }

            .progress-chart .progress-percentage {
                text-align: right;
                font-size: 0.8rem;
                color: ${styling.colors.textSecondary};
            }

            /* Timeline Chart Styles */
            .timeline-chart .timeline-grid {
                display: flex;
                height: 100%;
                gap: ${styling.spacing.medium};
            }

            .timeline-chart .timeline-y-axis {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                width: 40px;
                padding: ${styling.spacing.medium} 0;
            }

            .timeline-chart .y-axis-label {
                font-size: 0.8rem;
                color: ${styling.colors.textSecondary};
                text-align: right;
            }

            .timeline-chart .timeline-content {
                flex: 1;
                border-left: 1px solid ${styling.colors.textSecondary};
                padding-left: ${styling.spacing.medium};
            }

            .timeline-chart .timeline-bars {
                display: flex;
                align-items: end;
                justify-content: space-around;
                height: 80%;
                padding: ${styling.spacing.medium} 0;
            }

            .timeline-chart .timeline-bar-group {
                display: flex;
                flex-direction: column;
                align-items: center;
                flex: 1;
                max-width: 60px;
            }

            .timeline-chart .timeline-bar {
                width: 100%;
                min-height: 4px;
                border-radius: 4px 4px 0 0;
                position: relative;
                transition: all 0.3s ease;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 4px;
            }

            .timeline-chart .timeline-value {
                color: ${styling.colors.text};
                font-size: 0.7rem;
                font-weight: bold;
            }

            .timeline-chart .timeline-label {
                margin-top: ${styling.spacing.small};
                font-size: 0.7rem;
                color: ${styling.colors.textSecondary};
                text-align: center;
                transform: rotate(-45deg);
                white-space: nowrap;
            }

            /* Legend Styles */
            .chart-legend, .donut-legend {
                display: flex;
                flex-wrap: wrap;
                gap: ${styling.spacing.medium};
                margin-top: ${styling.spacing.medium};
            }

            .legend-item {
                display: flex;
                align-items: center;
                gap: ${styling.spacing.small};
            }

            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
            }

            .legend-label {
                color: ${styling.colors.text};
                font-size: 0.9rem;
            }

            .legend-value {
                color: ${styling.colors.textSecondary};
                font-size: 0.8rem;
                margin-left: ${styling.spacing.small};
            }

            /* Enhanced Chart Wrapper */
            .enhanced-chart-wrapper {
                background: ${styling.colors.secondary};
                border-radius: 8px;
                padding: ${styling.spacing.medium};
                margin: ${styling.spacing.medium} 0;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .chart-header {
                display: flex;
                align-items: center;
                margin-bottom: ${styling.spacing.medium};
                padding-bottom: ${styling.spacing.small};
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .chart-icon {
                font-size: 1.2rem;
                margin-right: ${styling.spacing.small};
                display: inline-flex;
                align-items: center;
            }

            .chart-title {
                color: ${styling.colors.text};
                font-size: 1.1rem;
                margin: 0;
                font-weight: 600;
            }

            .chart-callouts {
                margin-top: ${styling.spacing.medium};
                display: flex;
                flex-direction: column;
                gap: ${styling.spacing.small};
            }

            /* Icon and Callout Integration */
            .chart-container .icon {
                width: 16px;
                height: 16px;
                display: inline-block;
                margin-right: ${styling.spacing.small};
            }

            .chart-container .callout, .chart-callouts .callout {
                margin: ${styling.spacing.small} 0;
                padding: ${styling.spacing.small};
                border-radius: 4px;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: ${styling.spacing.small};
            }

            .callout-icon {
                font-size: 1rem;
                display: inline-flex;
                align-items: center;
            }

            .callout-text {
                flex: 1;
                line-height: 1.4;
            }

            .chart-container .callout.trend-up, .chart-callouts .callout.trend-up {
                background: rgba(34, 197, 94, 0.1);
                border-left: 3px solid #22c55e;
                color: #22c55e;
            }

            .chart-container .callout.trend-down, .chart-callouts .callout.trend-down {
                background: rgba(255, 107, 53, 0.1);
                border-left: 3px solid ${styling.colors.accent};
                color: ${styling.colors.accent};
            }

            .chart-container .callout.trend-stable, .chart-callouts .callout.trend-stable {
                background: rgba(255, 255, 255, 0.05);
                border-left: 3px solid ${styling.colors.textSecondary};
                color: ${styling.colors.textSecondary};
            }

            .chart-container .callout.info, .chart-callouts .callout.info {
                background: rgba(0, 212, 255, 0.1);
                border-left: 3px solid ${styling.colors.primary};
                color: ${styling.colors.primary};
            }

            .chart-container .callout.warning, .chart-callouts .callout.warning {
                background: rgba(251, 191, 36, 0.1);
                border-left: 3px solid #fbbf24;
                color: #fbbf24;
            }

            .chart-container .callout.success, .chart-callouts .callout.success {
                background: rgba(34, 197, 94, 0.1);
                border-left: 3px solid #22c55e;
                color: #22c55e;
            }

            .chart-container .callout.highlight, .chart-callouts .callout.highlight {
                background: rgba(255, 255, 255, 0.05);
                border-left: 3px solid ${styling.colors.textSecondary};
                color: ${styling.colors.textSecondary};
            }
        `;
    }
}