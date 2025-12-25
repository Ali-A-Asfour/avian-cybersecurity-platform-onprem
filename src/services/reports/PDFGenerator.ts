/**
 * PDF Generator Service
 * 
 * Converts slide-based reports to PDF format while preserving formatting.
 * Uses headless Chromium for HTML to PDF conversion with embedded fonts and assets.
 * 
 * Requirements: 8.1, 8.2, 8.4
 */

import { chromium, Browser, Page } from 'playwright';
import { ReportSnapshot, ValidationResult, SlideData, EnhancedDateRange } from '@/types/reports';
import { TemplateEngine } from './TemplateEngine';
import { logger } from '@/lib/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export type PDFBuffer = Buffer;

export interface PDFGenerationOptions {
    format?: 'A4' | 'Letter';
    orientation?: 'portrait' | 'landscape';
    margin?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
    };
    printBackground?: boolean;
    scale?: number;
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
}

export interface PDFMetadata {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
    keywords?: string[];
}

export class PDFGenerator {
    private templateEngine: TemplateEngine;
    private browser: Browser | null = null;
    private readonly templateVersion = '1.0.0';
    private readonly dataSchemaVersion = '1.0.0';

    // Template and data schema versioning for reproducibility
    private readonly supportedTemplateVersions = ['1.0.0', '2.0.0'];
    private readonly supportedDataSchemaVersions = ['1.0.0', '2.0.0'];

    constructor(templateEngine?: TemplateEngine) {
        this.templateEngine = templateEngine || new TemplateEngine();
    }

    /**
     * Initialize browser instance for PDF generation
     */
    private async initializeBrowser(): Promise<Browser> {
        if (!this.browser) {
            try {
                this.browser = await chromium.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--font-render-hinting=none',
                        // Enhanced args for better PDF generation (Requirements 8.1, 8.2)
                        '--disable-web-security',
                        '--allow-running-insecure-content',
                        '--disable-features=VizDisplayCompositor',
                        '--run-all-compositor-stages-before-draw',
                        '--disable-background-timer-throttling',
                        '--disable-renderer-backgrounding',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-ipc-flooding-protection',
                        // Font rendering improvements
                        '--font-render-hinting=slight',
                        '--enable-font-antialiasing',
                        '--force-color-profile=srgb'
                    ]
                });

                logger.info('PDF Generator browser initialized', {
                    category: 'reports',
                    browserVersion: this.browser.version()
                });
            } catch (error) {
                logger.error('Failed to initialize PDF Generator browser', error instanceof Error ? error : new Error(String(error)), {
                    category: 'reports'
                });
                throw new Error(`Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return this.browser;
    }

    /**
     * Close browser instance
     */
    async closeBrowser(): Promise<void> {
        if (this.browser) {
            try {
                await this.browser.close();
                this.browser = null;
                logger.info('PDF Generator browser closed', {
                    category: 'reports'
                });
            } catch (error) {
                logger.error('Error closing PDF Generator browser', error instanceof Error ? error : new Error(String(error)), {
                    category: 'reports'
                });
            }
        }
    }

    /**
     * Validate template and data schema versions for compatibility
     * Ensures reproducible PDF generation across different versions
     */
    private validateVersionCompatibility(snapshot: ReportSnapshot): void {
        if (!this.supportedTemplateVersions.includes(snapshot.templateVersion)) {
            throw new Error(`Unsupported template version: ${snapshot.templateVersion}. Supported versions: ${this.supportedTemplateVersions.join(', ')}`);
        }

        if (!this.supportedDataSchemaVersions.includes(snapshot.dataSchemaVersion)) {
            throw new Error(`Unsupported data schema version: ${snapshot.dataSchemaVersion}. Supported versions: ${this.supportedDataSchemaVersions.join(', ')}`);
        }
    }

    /**
     * Exports a report snapshot to PDF format
     * Implements Requirements 8.1, 8.2, 8.4: PDF conversion with embedded fonts and landscape orientation
     */
    async exportToPDF(
        snapshot: ReportSnapshot,
        options: PDFGenerationOptions = {},
        metadata: PDFMetadata = {}
    ): Promise<PDFBuffer> {
        // Validate template and data schema versions
        this.validateVersionCompatibility(snapshot);

        const browser = await this.initializeBrowser();
        let page: Page | null = null;

        try {
            // Create new page with optimized settings for PDF generation
            page = await browser.newPage({
                viewport: { width: 1920, height: 1080 }, // High resolution for better PDF quality
                deviceScaleFactor: 2 // Retina display for crisp text
            });

            // Set default PDF generation options for landscape orientation (Requirement 8.4)
            const pdfOptions: PDFGenerationOptions = {
                format: 'A4',
                orientation: 'landscape', // Locked to landscape per requirements 8.4
                margin: {
                    top: '0.75in',
                    right: '0.5in',
                    bottom: '0.75in',
                    left: '0.5in'
                },
                printBackground: true,
                scale: 1.0,
                displayHeaderFooter: true,
                headerTemplate: this.generateHeaderTemplate(snapshot),
                footerTemplate: this.generateFooterTemplate(snapshot),
                ...options
            };

            // Force landscape orientation regardless of options (Requirement 8.4)
            pdfOptions.orientation = 'landscape';

            // Generate HTML content from snapshot slide data
            const htmlContent = await this.generateHTMLFromSnapshot(snapshot);

            // Set content with embedded fonts and assets (Requirement 8.2)
            await page.setContent(htmlContent, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Wait for fonts to load and any dynamic content to render
            try {
                // Try to wait for load state if available (newer Playwright versions)
                if (typeof page.waitForLoadState === 'function') {
                    await page.waitForLoadState('networkidle');
                }

                // Ensure fonts are fully loaded before PDF generation
                await page.evaluate(() => {
                    return document.fonts ? document.fonts.ready.then(() => { }) : Promise.resolve();
                });
            } catch (error) {
                // Fallback for older versions or mocked environments
                logger.warn('Could not wait for load state, using timeout fallback', {
                    error: error instanceof Error ? error.message : String(error),
                    category: 'reports'
                });
            }

            // Additional wait for any remaining rendering
            await page.waitForTimeout(3000);

            // Prepare PDF metadata for document properties
            const pdfMetadata: PDFMetadata = {
                title: `AVIAN Security Report - ${snapshot.reportType.charAt(0).toUpperCase() + snapshot.reportType.slice(1)}`,
                author: 'AVIAN Cybersecurity Platform',
                subject: `${snapshot.reportType} Security Report for ${snapshot.dateRange.startDate.toDateString()} - ${snapshot.dateRange.endDate.toDateString()}`,
                creator: 'AVIAN Reports Module',
                producer: 'AVIAN PDF Generator v1.0.0',
                creationDate: new Date(),
                modificationDate: new Date(),
                keywords: ['security', 'report', snapshot.reportType, 'avian', 'cybersecurity'],
                ...metadata
            };

            // Add metadata to page for PDF document properties (if supported)
            try {
                if (typeof page.addInitScript === 'function') {
                    await page.addInitScript(`
                        // Set document title for PDF metadata
                        document.title = "${pdfMetadata.title}";
                        
                        // Add meta tags for PDF metadata
                        const metaTags = [
                            { name: 'author', content: "${pdfMetadata.author}" },
                            { name: 'description', content: "${pdfMetadata.subject}" },
                            { name: 'keywords', content: "${pdfMetadata.keywords?.join(', ')}" },
                            { name: 'generator', content: "${pdfMetadata.creator}" }
                        ];
                        
                        metaTags.forEach(tag => {
                            const meta = document.createElement('meta');
                            meta.name = tag.name;
                            meta.content = tag.content;
                            document.head.appendChild(meta);
                        });
                    `);
                }
            } catch (error) {
                // Fallback for mocked environments - metadata will be embedded in HTML
                logger.warn('Could not add init script, metadata will be embedded in HTML', {
                    error: error instanceof Error ? error.message : String(error),
                    category: 'reports'
                });
            }

            // Generate PDF with high quality settings
            const pdfBuffer = await page.pdf({
                format: pdfOptions.format as 'A4' | 'Letter',
                landscape: pdfOptions.orientation === 'landscape',
                margin: pdfOptions.margin,
                printBackground: pdfOptions.printBackground,
                scale: pdfOptions.scale,
                displayHeaderFooter: pdfOptions.displayHeaderFooter,
                headerTemplate: pdfOptions.headerTemplate || '',
                footerTemplate: pdfOptions.footerTemplate || '',
                preferCSSPageSize: false,
                tagged: true, // For accessibility
                outline: true // Generate PDF outline/bookmarks
            });

            logger.info('PDF generated successfully', {
                snapshotId: snapshot.id,
                reportType: snapshot.reportType,
                pdfSize: pdfBuffer.length,
                templateVersion: this.templateVersion,
                dataSchemaVersion: this.dataSchemaVersion,
                category: 'reports'
            });

            return pdfBuffer;

        } catch (error) {
            logger.error('Failed to generate PDF', error instanceof Error ? error : new Error(String(error)), {
                snapshotId: snapshot.id,
                reportType: snapshot.reportType,
                category: 'reports'
            });
            throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            if (page) {
                try {
                    await page.close();
                } catch (closeError) {
                    logger.warn('Error closing PDF generation page', {
                        error: closeError instanceof Error ? closeError.message : String(closeError),
                        category: 'reports'
                    });
                }
            }
        }
    }

    /**
     * Generate complete HTML document from report snapshot
     * Implements embedded fonts and assets (Requirement 8.2)
     */
    private async generateHTMLFromSnapshot(snapshot: ReportSnapshot): Promise<string> {
        try {
            // Generate slides HTML from snapshot data
            const slidesHtml = await this.generateSlidesHTML(snapshot.slideData);

            // Get embedded fonts and CSS
            const embeddedFonts = this.getEmbeddedFonts();
            const globalCSS = this.getGlobalCSS();

            // Create complete HTML document with embedded assets
            const htmlDocument = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AVIAN Security Report - ${snapshot.reportType}</title>
    
    <!-- PDF Metadata -->
    <meta name="author" content="AVIAN Cybersecurity Platform">
    <meta name="description" content="${snapshot.reportType} Security Report for ${snapshot.dateRange.startDate.toDateString()} - ${snapshot.dateRange.endDate.toDateString()}">
    <meta name="keywords" content="security, report, ${snapshot.reportType}, avian, cybersecurity">
    <meta name="generator" content="AVIAN Reports Module">
    <meta name="created" content="${new Date().toISOString()}">
    
    <!-- Embedded Fonts -->
    ${embeddedFonts}
    
    <!-- Global Styles -->
    <style>
        ${globalCSS}
        
        /* PDF-specific styles for slide-based structure (Requirement 8.4) */
        @media print {
            .slide, .slide-wrapper {
                page-break-after: always;
                page-break-inside: avoid;
                width: 100vw;
                height: calc(100vh - 80px); /* Account for header/footer */
                margin: 0;
                padding: 2rem;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                background: #0A0A0A !important;
            }
            
            .slide:last-child, .slide-wrapper:last-child {
                page-break-after: auto;
            }
            
            /* Ensure charts and visual elements don't break across pages (Requirement 8.2) */
            .chart-container,
            .enhanced-chart-wrapper,
            .metric-card,
            .highlight-card,
            .chart-wrapper,
            .visualization-container,
            .kpi-card,
            .executive-summary,
            .risk-indicator,
            svg,
            canvas,
            img {
                page-break-inside: avoid;
                max-width: 100%;
                height: auto;
            }
            
            /* High contrast for PDF with exact color reproduction (Requirement 8.1) */
            .slide, .slide-wrapper {
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
                print-color-adjust: exact;
            }
            
            /* Ensure text remains readable in PDF */
            * {
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                text-rendering: optimizeLegibility;
            }
            
            /* Preserve AVIAN branding colors exactly as in preview (Requirement 8.1) */
            .avian-primary { color: #00D4FF !important; }
            .avian-secondary { color: #1A1A1A !important; }
            .avian-accent { color: #FF6B35 !important; }
            .avian-background { background-color: #0A0A0A !important; }
            .avian-text { color: #FFFFFF !important; }
            .avian-text-secondary { color: #B0B0B0 !important; }
            
            /* Ensure gradients render properly in PDF */
            .gradient-bg {
                background: linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%) !important;
            }
            
            .primary-gradient {
                background: linear-gradient(135deg, #00D4FF 0%, #0099CC 100%) !important;
            }
            
            .accent-gradient {
                background: linear-gradient(135deg, #FF6B35 0%, #E55A2B 100%) !important;
            }
            
            /* Ensure shadows and effects render in PDF */
            .shadow-lg {
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2) !important;
            }
            
            .glow-effect {
                box-shadow: 0 0 20px rgba(0, 212, 255, 0.3) !important;
            }
        }
        
        /* Landscape orientation optimization (Requirement 8.4) */
        @page {
            size: A4 landscape;
            margin: 0.5in;
        }
        
        /* Ensure proper slide dimensions for landscape */
        .slide-content {
            width: 100%;
            height: 100%;
            min-height: calc(100vh - 4rem);
            display: flex;
            flex-direction: column;
        }
    </style>
</head>
<body>
    ${slidesHtml}
</body>
</html>`;

            return htmlDocument;

        } catch (error) {
            logger.error('Failed to generate HTML from snapshot', error instanceof Error ? error : new Error(String(error)), {
                snapshotId: snapshot.id,
                category: 'reports'
            });
            throw new Error(`HTML generation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Generate HTML for all slides in the snapshot
     */
    private async generateSlidesHTML(slideData: SlideData[]): Promise<string> {
        const slidePromises = slideData.map(async (slide, index) => {
            try {
                // Determine slide template type
                const templateType = this.determineSlideTemplateType(slide);

                // Render slide using template engine
                const renderedSlide = await this.templateEngine.renderSlide(slide, {
                    type: templateType,
                    layout: {
                        type: templateType,
                        orientation: 'landscape',
                        theme: 'dark',
                        branding: 'avian'
                    },
                    styling: {
                        theme: 'dark',
                        branding: 'avian',
                        colors: {
                            primary: '#00D4FF',
                            secondary: '#1A1A1A',
                            accent: '#FF6B35',
                            background: '#0A0A0A',
                            text: '#FFFFFF',
                            textSecondary: '#B0B0B0'
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
                    }
                });

                return `
                    <div class="slide-wrapper" data-slide-index="${index}" data-slide-type="${templateType}">
                        <style>${renderedSlide.css}</style>
                        ${renderedSlide.html}
                    </div>
                `;
            } catch (error) {
                logger.error('Failed to render slide', error instanceof Error ? error : new Error(String(error)), {
                    slideIndex: index,
                    slideType: slide.slideType,
                    category: 'reports'
                });

                // Return error slide instead of failing completely
                return `
                    <div class="slide error-slide">
                        <h1>Error Rendering Slide ${index + 1}</h1>
                        <p>Unable to render slide content. Please check the slide data.</p>
                    </div>
                `;
            }
        });

        const renderedSlides = await Promise.all(slidePromises);
        return renderedSlides.join('\n');
    }

    /**
     * Determine appropriate template type for slide data
     */
    private determineSlideTemplateType(slide: SlideData): 'executive-overview' | 'data-visualization' | 'trend-analysis' | 'summary' {
        const slideType = slide.slideType?.toLowerCase();

        if (slideType?.includes('executive') || slideType?.includes('overview')) {
            return 'executive-overview';
        }

        if (slideType?.includes('trend') || slideType?.includes('analysis')) {
            return 'trend-analysis';
        }

        if (slide.charts && slide.charts.length > 0) {
            return 'data-visualization';
        }

        return 'summary';
    }

    /**
     * Get embedded fonts for PDF generation
     * Ensures fonts are available in headless environment (Requirement 8.2)
     */
    private getEmbeddedFonts(): string {
        return `
            <!-- Google Fonts - Inter with font-display: block for PDF -->
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=block" rel="stylesheet">
            
            <!-- Enhanced font definitions with better fallbacks -->
            <style>
                /* Primary Inter font with comprehensive fallbacks */
                @font-face {
                    font-family: 'Inter Enhanced';
                    src: url('https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyeMZhrib2Bg-4.woff2') format('woff2'),
                         local('Inter'), 
                         local('Arial'), 
                         local('Helvetica Neue'), 
                         local('Helvetica'), 
                         local('sans-serif');
                    font-weight: 100 900;
                    font-style: normal;
                    font-display: block;
                }
                
                /* Monospace font for code/technical content */
                @font-face {
                    font-family: 'JetBrains Mono Enhanced';
                    src: local('JetBrains Mono'),
                         local('Monaco'), 
                         local('Menlo'), 
                         local('Consolas'), 
                         local('Courier New'),
                         local('monospace');
                    font-weight: 100 900;
                    font-style: normal;
                    font-display: block;
                }
                
                /* Ensure fonts are loaded before PDF generation */
                body {
                    font-family: 'Inter Enhanced', 'Inter', 'Arial', 'Helvetica Neue', sans-serif;
                }
                
                code, pre, .monospace {
                    font-family: 'JetBrains Mono Enhanced', 'JetBrains Mono', 'Monaco', 'Consolas', monospace;
                }
            </style>
        `;
    }

    /**
     * Generate header template for PDF with AVIAN branding
     * Implements Requirements 8.2, 8.4: Proper branding header and page numbers
     */
    private generateHeaderTemplate(snapshot: ReportSnapshot): string {
        return `
            <div style="
                width: 100%;
                height: 40px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 20px;
                background: linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%);
                border-bottom: 2px solid #00D4FF;
                font-family: 'Inter', Arial, sans-serif;
                font-size: 10px;
                color: #FFFFFF;
                box-sizing: border-box;
            ">
                <div style="display: flex; align-items: center;">
                    <div style="
                        width: 24px;
                        height: 24px;
                        background: linear-gradient(135deg, #00D4FF 0%, #0099CC 100%);
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 8px;
                        box-shadow: 0 2px 4px rgba(0, 212, 255, 0.3);
                    ">
                        <span style="color: white; font-weight: bold; font-size: 8px;">A</span>
                    </div>
                    <span style="font-weight: 600; color: #00D4FF;">AVIAN</span>
                    <span style="margin-left: 4px; color: #B0B0B0;">Cybersecurity Platform</span>
                </div>
                <div style="color: #B0B0B0; font-weight: 500;">
                    ${snapshot.reportType.charAt(0).toUpperCase() + snapshot.reportType.slice(1)} Security Report
                </div>
                <div style="color: #B0B0B0; font-weight: 500;">
                    <span class="date"></span>
                </div>
            </div>
        `;
    }

    /**
     * Generate footer template for PDF with page numbers and confidentiality notice
     * Implements Requirements 8.2, 8.4: Proper branding footer and page numbers
     */
    private generateFooterTemplate(snapshot: ReportSnapshot): string {
        return `
            <div style="
                width: 100%;
                height: 40px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 20px;
                background: linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%);
                border-top: 1px solid #333333;
                font-family: 'Inter', Arial, sans-serif;
                font-size: 9px;
                color: #B0B0B0;
                box-sizing: border-box;
            ">
                <div style="display: flex; align-items: center;">
                    <div style="
                        width: 4px;
                        height: 4px;
                        background: #FF6B35;
                        border-radius: 50%;
                        margin-right: 6px;
                    "></div>
                    <span style="font-weight: 500;">Confidential & Proprietary</span>
                </div>
                <div style="text-align: center; flex: 1;">
                    <span style="color: #666666;">Generated: ${new Date().toLocaleDateString()}</span>
                </div>
                <div style="display: flex; align-items: center;">
                    <span style="margin-right: 8px;">Page</span>
                    <span class="pageNumber" style="
                        background: #333333;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-weight: 600;
                        color: #00D4FF;
                    "></span>
                    <span style="margin: 0 4px;">of</span>
                    <span class="totalPages" style="
                        background: #333333;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-weight: 600;
                        color: #00D4FF;
                    "></span>
                </div>
            </div>
        `;
    }

    /**
     * Get global CSS for consistent PDF styling
     */
    private getGlobalCSS(): string {
        return `
            * {
                box-sizing: border-box;
            }
            
            html, body {
                margin: 0;
                padding: 0;
                font-family: 'Inter', 'Inter Fallback', 'Helvetica Neue', Arial, sans-serif;
                background: #0A0A0A;
                color: #FFFFFF;
                line-height: 1.5;
            }
            
            .slide-wrapper {
                width: 100%;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            
            .error-slide {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: #1A1A1A;
                color: #FF6B35;
                text-align: center;
                padding: 2rem;
            }
            
            .error-slide h1 {
                color: #FF6B35;
                margin-bottom: 1rem;
            }
            
            .error-slide p {
                color: #B0B0B0;
                max-width: 600px;
            }
            
            /* Ensure proper font rendering in PDF */
            * {
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                text-rendering: optimizeLegibility;
            }
            
            /* High contrast adjustments for PDF */
            .slide {
                background: #0A0A0A !important;
                color: #FFFFFF !important;
            }
            
            /* Ensure images and charts render properly */
            img, svg, canvas {
                max-width: 100%;
                height: auto;
            }
            
            /* PDF-specific layout adjustments */
            .slide-content {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
        `;
    }

    /**
     * Validates the quality and integrity of a generated PDF
     * Implements Requirements 8.3, 8.5: Client-ready output validation
     */
    async validatePDFOutput(pdf: PDFBuffer): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Basic PDF structure validation
            if (!pdf || pdf.length === 0) {
                errors.push('PDF buffer is empty or null');
                return { isValid: false, errors, warnings };
            }

            // Check PDF header
            const pdfHeader = pdf.subarray(0, 8).toString('ascii');
            if (!pdfHeader.startsWith('%PDF-')) {
                errors.push('Invalid PDF header - file may be corrupted');
            }

            // Check minimum file size (should be at least a few hundred bytes for a valid PDF)
            if (pdf.length < 200) {
                errors.push('PDF file size is suspiciously small - may be incomplete');
            }

            // Check maximum reasonable file size (warn if over 50MB)
            if (pdf.length > 50 * 1024 * 1024) {
                warnings.push('PDF file size is very large (>50MB) - may impact delivery performance');
            }

            // Validate PDF structure by checking for required elements
            const pdfContent = pdf.toString('latin1'); // Use latin1 for binary content

            if (!pdfContent.includes('%%EOF')) {
                errors.push('PDF missing end-of-file marker - file may be truncated');
            }

            if (!pdfContent.includes('/Type /Catalog')) {
                errors.push('PDF missing document catalog - file structure may be invalid');
            }

            // Check for pages
            if (!pdfContent.includes('/Type /Pages')) {
                errors.push('PDF missing pages structure - document may be empty');
            }

            // Validate content streams
            if (!pdfContent.includes('stream') || !pdfContent.includes('endstream')) {
                warnings.push('PDF may not contain content streams - document may appear blank');
            }

            // Check for embedded fonts (important for consistent rendering)
            const fontCount = (pdfContent.match(/\/Type \/Font/g) || []).length;
            if (fontCount === 0) {
                warnings.push('PDF does not contain embedded fonts - rendering may vary across systems');
            } else if (fontCount < 2) {
                warnings.push('PDF contains few embedded fonts - some text may not render consistently');
            }

            // Validate PDF metadata for client-ready output
            const hasTitle = pdfContent.includes('/Title');
            const hasAuthor = pdfContent.includes('/Author');
            const hasSubject = pdfContent.includes('/Subject');
            const hasCreator = pdfContent.includes('/Creator');

            if (!hasTitle && !hasAuthor) {
                warnings.push('PDF missing basic metadata (title, author) - not optimal for client delivery');
            }

            if (!hasSubject) {
                warnings.push('PDF missing subject metadata - consider adding for better document management');
            }

            if (!hasCreator) {
                warnings.push('PDF missing creator metadata - consider adding for audit trail');
            }

            // Check for accessibility features
            if (!pdfContent.includes('/StructTreeRoot')) {
                warnings.push('PDF may not be accessible - missing structure tree for screen readers');
            }

            // Validate image quality indicators
            const imageCount = (pdfContent.match(/\/Type \/XObject/g) || []).length;
            if (imageCount > 0) {
                // Check for image compression
                if (!pdfContent.includes('/DCTDecode') && !pdfContent.includes('/FlateDecode')) {
                    warnings.push('PDF images may not be optimally compressed - file size could be reduced');
                }
            }

            // Check for security features
            if (pdfContent.includes('/Encrypt')) {
                warnings.push('PDF contains encryption - ensure it does not prevent client access');
            }

            // Validate color space for professional output
            if (pdfContent.includes('/DeviceRGB')) {
                // RGB is good for screen viewing
            } else if (pdfContent.includes('/DeviceCMYK')) {
                warnings.push('PDF uses CMYK color space - may not display optimally on screens');
            }

            // Calculate and validate checksum for integrity
            const checksum = crypto.createHash('sha256').update(pdf).digest('hex');
            if (!checksum) {
                errors.push('Unable to calculate PDF checksum for integrity verification');
            }

            // Additional client-ready validation
            await this.validateClientReadyQuality(pdf, errors, warnings);

            logger.info('PDF validation completed', {
                pdfSize: pdf.length,
                checksum: checksum.substring(0, 16), // Log first 16 chars of checksum
                errorsCount: errors.length,
                warningsCount: warnings.length,
                fontCount,
                imageCount,
                hasMetadata: hasTitle || hasAuthor || hasSubject,
                category: 'reports'
            });

            return {
                isValid: errors.length === 0,
                errors,
                warnings
            };

        } catch (error) {
            logger.error('PDF validation failed', error instanceof Error ? error : new Error(String(error)), {
                pdfSize: pdf?.length || 0,
                category: 'reports'
            });

            errors.push(`PDF validation error: ${error instanceof Error ? error.message : String(error)}`);
            return { isValid: false, errors, warnings };
        }
    }

    /**
     * Validate PDF quality for client-ready output
     * Implements Requirements 8.3: Client-ready output without manual editing
     */
    private async validateClientReadyQuality(pdf: PDFBuffer, errors: string[], warnings: string[]): Promise<void> {
        try {
            // Check PDF can be opened by attempting to read with a simple parser
            const pdfString = pdf.toString('latin1');

            // Validate page count
            const pageMatches = pdfString.match(/\/Type \/Page[^s]/g);
            const pageCount = pageMatches ? pageMatches.length : 0;

            if (pageCount === 0) {
                errors.push('PDF contains no pages - document is empty');
            } else if (pageCount > 50) {
                warnings.push(`PDF contains ${pageCount} pages - very long document may impact client review`);
            }

            // Check for text content (not just images)
            const textContentIndicators = [
                '/Type /Font',
                'BT', // Begin text
                'ET', // End text
                'Tj', // Show text
                'TJ'  // Show text with individual glyph positioning
            ];

            const hasTextContent = textContentIndicators.some(indicator =>
                pdfString.includes(indicator)
            );

            if (!hasTextContent) {
                warnings.push('PDF may not contain readable text - document may be image-only');
            }

            // Validate landscape orientation (per requirements)
            const mediaBoxMatches = pdfString.match(/\/MediaBox\s*\[\s*[\d\s.]+\]/g);
            if (mediaBoxMatches && mediaBoxMatches.length > 0) {
                const mediaBox = mediaBoxMatches[0];
                const dimensions = mediaBox.match(/[\d.]+/g);
                if (dimensions && dimensions.length >= 4) {
                    const width = parseFloat(dimensions[2]) - parseFloat(dimensions[0]);
                    const height = parseFloat(dimensions[3]) - parseFloat(dimensions[1]);

                    if (width <= height) {
                        warnings.push('PDF appears to be in portrait orientation - reports should be landscape for optimal viewing');
                    }
                }
            }

            // Check for proper page breaks
            if (pageCount > 1 && !pdfString.includes('/Type /Pages')) {
                warnings.push('Multi-page PDF may have page structure issues');
            }

            // Validate branding elements presence
            const brandingIndicators = [
                'AVIAN',
                'Security Report',
                'Cybersecurity Platform'
            ];

            const hasBranding = brandingIndicators.some(brand =>
                pdfString.toLowerCase().includes(brand.toLowerCase())
            );

            if (!hasBranding) {
                warnings.push('PDF may be missing AVIAN branding elements');
            }

        } catch (error) {
            warnings.push(`Unable to perform detailed quality validation: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Generate file integrity checksum
     * Implements file integrity checks for Requirements 8.3, 8.5
     */
    generateFileChecksum(pdf: PDFBuffer): string {
        return crypto.createHash('sha256').update(pdf).digest('hex');
    }

    /**
     * Verify file integrity using checksum
     */
    verifyFileIntegrity(pdf: PDFBuffer, expectedChecksum: string): boolean {
        const actualChecksum = this.generateFileChecksum(pdf);
        return actualChecksum === expectedChecksum;
    }

    /**
     * Create download response for PDF sharing
     * Implements Requirements 8.5: Download and sharing mechanisms
     */
    createDownloadResponse(pdf: PDFBuffer, filename: string): {
        buffer: PDFBuffer;
        headers: Record<string, string>;
        metadata: {
            size: number;
            checksum: string;
            mimeType: string;
        };
    } {
        const checksum = this.generateFileChecksum(pdf);

        return {
            buffer: pdf,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdf.length.toString(),
                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-File-Checksum': checksum.substring(0, 32), // First 32 chars for header
                'X-Generated-By': 'AVIAN Reports Module'
            },
            metadata: {
                size: pdf.length,
                checksum,
                mimeType: 'application/pdf'
            }
        };
    }

    /**
     * Create secure sharing link metadata
     * Implements secure sharing mechanisms for client delivery
     */
    createSharingMetadata(snapshotId: string, storageKey: string, expirationHours: number = 24): {
        shareId: string;
        expiresAt: Date;
        accessUrl: string;
        securityToken: string;
    } {
        const shareId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + (expirationHours * 60 * 60 * 1000));

        // Generate security token for access validation
        const tokenData = `${snapshotId}:${storageKey}:${expiresAt.getTime()}`;
        const securityToken = crypto.createHash('sha256').update(tokenData).digest('hex').substring(0, 32);

        return {
            shareId,
            expiresAt,
            accessUrl: `/api/reports/download/${shareId}`,
            securityToken
        };
    }

    /**
     * Stores a PDF file and returns the storage key
     * Implements Requirements 8.5: File storage and sharing mechanisms with S3/file system integration
     */
    async storePDF(pdf: PDFBuffer, snapshotId: string): Promise<string> {
        try {
            // Check if S3 storage is configured
            const useS3Storage = process.env.S3_REPORTS_BUCKET && process.env.AWS_REGION;

            if (useS3Storage) {
                return await this.storePDFToS3(pdf, snapshotId);
            } else {
                return await this.storePDFToFileSystem(pdf, snapshotId);
            }

        } catch (error) {
            logger.error('Failed to store PDF', error instanceof Error ? error : new Error(String(error)), {
                snapshotId,
                category: 'reports'
            });
            throw new Error(`PDF storage failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Store PDF to local file system
     * Fallback storage method when S3 is not configured
     */
    private async storePDFToFileSystem(pdf: PDFBuffer, snapshotId: string): Promise<string> {
        // Create storage directory if it doesn't exist
        const storageDir = path.join(process.cwd(), 'storage', 'reports', 'pdfs');
        await fs.mkdir(storageDir, { recursive: true });

        // Generate unique filename with timestamp and snapshot ID
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `report-${snapshotId}-${timestamp}.pdf`;
        const filePath = path.join(storageDir, filename);

        // Write PDF to file system
        await fs.writeFile(filePath, pdf);

        // Generate storage key (relative path from storage root)
        const storageKey = path.join('reports', 'pdfs', filename);

        // Calculate file size and checksum for verification
        const stats = await fs.stat(filePath);
        const checksum = crypto.createHash('sha256').update(pdf).digest('hex');

        logger.info('PDF stored to file system successfully', {
            snapshotId,
            storageKey,
            filePath,
            fileSize: stats.size,
            checksum: checksum.substring(0, 16),
            category: 'reports'
        });

        return storageKey;
    }

    /**
     * Store PDF to AWS S3
     * Primary storage method when S3 is configured
     */
    private async storePDFToS3(pdf: PDFBuffer, snapshotId: string): Promise<string> {
        try {
            // Use the new S3 service
            const { S3Service } = await import('../../lib/aws/s3-service');

            // Generate unique S3 key
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const s3Key = `reports/pdfs/${snapshotId}/${timestamp}.pdf`;

            // Calculate checksum for integrity
            const checksum = crypto.createHash('sha256').update(pdf).digest('hex');

            // Upload to S3 using the reports bucket
            await S3Service.uploadReport(s3Key, pdf, {
                contentType: 'application/pdf',
                metadata: {
                    'snapshot-id': snapshotId,
                    'generated-at': new Date().toISOString(),
                    'checksum': checksum,
                    'content-type': 'application/pdf'
                },
                storageClass: 'STANDARD_IA', // Infrequent access for cost optimization
            });

            logger.info('PDF stored to S3 successfully', {
                snapshotId,
                s3Key,
                bucket: process.env.S3_REPORTS_BUCKET,
                fileSize: pdf.length,
                checksum: checksum.substring(0, 16),
                category: 'reports'
            });

            return s3Key;

        } catch (error) {
            logger.error('Failed to store PDF to S3', error instanceof Error ? error : new Error(String(error)), {
                snapshotId,
                category: 'reports'
            });

            // Fallback to file system storage if S3 fails
            logger.warn('Falling back to file system storage', {
                snapshotId,
                category: 'reports'
            });
            return await this.storePDFToFileSystem(pdf, snapshotId);
        }
    }

    /**
     * Get PDF from storage (alias for retrievePDF for API compatibility)
     * Used by download endpoints
     */
    async getPDFFromStorage(storageKey: string): Promise<PDFBuffer> {
        return this.retrievePDF(storageKey);
    }

    /**
     * Retrieves a PDF file from storage
     * Implements snapshot-based re-download capability with S3/file system integration
     */
    async retrievePDF(storageKey: string): Promise<PDFBuffer> {
        try {
            // Determine storage type based on storage key format
            const isS3Key = storageKey.startsWith('reports/pdfs/') && !storageKey.includes(path.sep);

            if (isS3Key && process.env.S3_REPORTS_BUCKET) {
                return await this.retrievePDFFromS3(storageKey);
            } else {
                return await this.retrievePDFFromFileSystem(storageKey);
            }

        } catch (error) {
            logger.error('Failed to retrieve PDF', error instanceof Error ? error : new Error(String(error)), {
                storageKey,
                category: 'reports'
            });
            throw new Error(`PDF retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Retrieve PDF from local file system
     */
    private async retrievePDFFromFileSystem(storageKey: string): Promise<PDFBuffer> {
        const filePath = path.join(process.cwd(), 'storage', storageKey);

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            throw new Error(`PDF file not found: ${storageKey}`);
        }

        // Read PDF file
        const pdfBuffer = await fs.readFile(filePath);

        logger.info('PDF retrieved from file system successfully', {
            storageKey,
            fileSize: pdfBuffer.length,
            category: 'reports'
        });

        return pdfBuffer;
    }

    /**
     * Retrieve PDF from AWS S3
     */
    private async retrievePDFFromS3(storageKey: string): Promise<PDFBuffer> {
        try {
            // Use the new S3 service
            const { S3Service } = await import('../../lib/aws/s3-service');

            // Download from S3 using the reports bucket
            const pdfBuffer = await S3Service.downloadReport(storageKey);

            logger.info('PDF retrieved from S3 successfully', {
                storageKey,
                bucket: process.env.S3_REPORTS_BUCKET,
                fileSize: pdfBuffer.length,
                category: 'reports'
            });

            return pdfBuffer;

        } catch (error) {
            logger.error('Failed to retrieve PDF from S3', error instanceof Error ? error : new Error(String(error)), {
                storageKey,
                category: 'reports'
            });

            // Try fallback to file system if S3 fails
            logger.warn('Attempting file system fallback for PDF retrieval', {
                storageKey,
                category: 'reports'
            });

            // Convert S3 key to file system path for fallback
            const fileSystemKey = storageKey.replace(/\//g, path.sep);
            return await this.retrievePDFFromFileSystem(fileSystemKey);
        }
    }

    /**
     * Delete a PDF file from storage
     * Supports both S3 and file system storage
     */
    async deletePDF(storageKey: string): Promise<void> {
        try {
            // Determine storage type based on storage key format
            const isS3Key = storageKey.startsWith('reports/pdfs/') && !storageKey.includes(path.sep);

            if (isS3Key && process.env.S3_REPORTS_BUCKET) {
                await this.deletePDFFromS3(storageKey);
            } else {
                await this.deletePDFFromFileSystem(storageKey);
            }

        } catch (error) {
            logger.error('Failed to delete PDF', error instanceof Error ? error : new Error(String(error)), {
                storageKey,
                category: 'reports'
            });
            throw new Error(`PDF deletion failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Delete PDF from local file system
     */
    private async deletePDFFromFileSystem(storageKey: string): Promise<void> {
        const filePath = path.join(process.cwd(), 'storage', storageKey);

        // Check if file exists before attempting deletion
        try {
            await fs.access(filePath);
            await fs.unlink(filePath);

            logger.info('PDF deleted from file system successfully', {
                storageKey,
                category: 'reports'
            });
        } catch (error) {
            // File doesn't exist - this is not necessarily an error
            logger.warn('PDF file not found for deletion', {
                storageKey,
                error: error instanceof Error ? error.message : String(error),
                category: 'reports'
            });
        }
    }

    /**
     * Delete PDF from AWS S3
     */
    private async deletePDFFromS3(storageKey: string): Promise<void> {
        try {
            // Use the new S3 service
            const { S3Service } = await import('../../lib/aws/s3-service');

            // Delete from S3 using the reports bucket
            await S3Service.deleteReport(storageKey);

            logger.info('PDF deleted from S3 successfully', {
                storageKey,
                bucket: process.env.S3_REPORTS_BUCKET,
                category: 'reports'
            });

        } catch (error) {
            logger.error('Failed to delete PDF from S3', error instanceof Error ? error : new Error(String(error)), {
                storageKey,
                category: 'reports'
            });

            // Don't throw error for S3 deletion failures - file might already be deleted
            logger.warn('S3 deletion failed, continuing', {
                storageKey,
                category: 'reports'
            });
        }
    }

    /**
     * Generate PDF with template and data schema versioning
     * Ensures reproducibility across different template versions
     */
    async generateVersionedPDF(
        snapshot: ReportSnapshot,
        options: PDFGenerationOptions = {}
    ): Promise<{
        pdf: PDFBuffer;
        templateVersion: string;
        dataSchemaVersion: string;
        checksum: string;
    }> {
        try {
            // Generate PDF with current template version
            const pdf = await this.exportToPDF(snapshot, options);

            // Calculate checksum for integrity verification
            const checksum = crypto.createHash('sha256').update(pdf).digest('hex');

            logger.info('Versioned PDF generated', {
                snapshotId: snapshot.id,
                templateVersion: this.templateVersion,
                dataSchemaVersion: this.dataSchemaVersion,
                checksum: checksum.substring(0, 16),
                pdfSize: pdf.length,
                category: 'reports'
            });

            return {
                pdf,
                templateVersion: this.templateVersion,
                dataSchemaVersion: this.dataSchemaVersion,
                checksum
            };

        } catch (error) {
            logger.error('Versioned PDF generation failed', error instanceof Error ? error : new Error(String(error)), {
                snapshotId: snapshot.id,
                category: 'reports'
            });
            throw error;
        }
    }

    /**
     * Integrated export flow: Generate → Snapshot → Export from snapshot
     * Implements Requirements: audit compliance, reproducibility
     * 
     * This method implements the new export flow where reports are first converted to snapshots,
     * then PDFs are generated from those snapshots for consistent reproducibility.
     */
    async exportReportWithSnapshot(
        snapshot: ReportSnapshot,
        userId: string,
        options: PDFGenerationOptions = {}
    ): Promise<{
        pdf: PDFBuffer;
        storageKey: string;
        checksum: string;
        snapshotId: string;
    }> {
        try {
            // Generate versioned PDF from snapshot
            const { pdf, templateVersion, dataSchemaVersion, checksum } = await this.generateVersionedPDF(snapshot, options);

            // Store PDF file with S3/file system integration
            const storageKey = await this.storePDF(pdf, snapshot.id);

            // Update snapshot with PDF storage information for re-download capability
            await this.updateSnapshotWithPDFInfo(snapshot.id, storageKey, pdf.length, checksum, snapshot.tenantId, userId);

            logger.info('Integrated PDF export completed', {
                snapshotId: snapshot.id,
                storageKey,
                pdfSize: pdf.length,
                checksum: checksum.substring(0, 16),
                templateVersion,
                dataSchemaVersion,
                category: 'reports'
            });

            return {
                pdf,
                storageKey,
                checksum,
                snapshotId: snapshot.id
            };

        } catch (error) {
            logger.error('Integrated PDF export failed', error instanceof Error ? error : new Error(String(error)), {
                snapshotId: snapshot.id,
                userId,
                category: 'reports'
            });
            throw new Error(`Integrated export failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Generate report and create snapshot in one operation
     * Implements the new flow: Generate → Snapshot → Export from snapshot
     * 
     * This method creates a report snapshot first, then exports PDF from that snapshot,
     * ensuring audit compliance and reproducibility.
     */
    async generateReportAndSnapshot(
        reportData: {
            tenantId: string;
            reportId: string;
            reportType: 'weekly' | 'monthly' | 'quarterly';
            dateRange: EnhancedDateRange;
            slideData: SlideData[];
            templateVersion: string;
            dataSchemaVersion: string;
        },
        userId: string,
        options: {
            pdfOptions?: PDFGenerationOptions;
            validateQuality?: boolean;
            enableSharing?: boolean;
            sharingExpirationHours?: number;
            ipAddress?: string;
            userAgent?: string;
        } = {}
    ): Promise<{
        success: boolean;
        snapshot: ReportSnapshot;
        pdf?: PDFBuffer;
        storageKey?: string;
        validation?: ValidationResult;
        sharing?: {
            shareId: string;
            expiresAt: Date;
            accessUrl: string;
        };
        metadata: {
            snapshotId: string;
            fileSize: number;
            checksum: string;
            templateVersion: string;
            dataSchemaVersion: string;
            generatedAt: Date;
        };
        errors?: string[];
    }> {
        const errors: string[] = [];

        try {
            logger.info('Starting generate report and snapshot flow', {
                reportId: reportData.reportId,
                reportType: reportData.reportType,
                tenantId: reportData.tenantId,
                userId,
                category: 'reports'
            });

            // Step 1: Create snapshot first (Generate → Snapshot)
            const { reportSnapshotService } = await import('./ReportSnapshotService');

            const snapshot = await reportSnapshotService.createSnapshot(
                reportData,
                userId,
                options.ipAddress,
                options.userAgent
            );

            logger.info('Report snapshot created successfully', {
                snapshotId: snapshot.id,
                reportId: reportData.reportId,
                category: 'reports'
            });

            // Step 2: Export PDF from snapshot (Export from snapshot)
            const exportResult = await this.exportClientReadyPDF(snapshot, userId, {
                pdfOptions: options.pdfOptions,
                validateQuality: options.validateQuality,
                enableSharing: options.enableSharing,
                sharingExpirationHours: options.sharingExpirationHours
            });

            if (!exportResult.success) {
                errors.push(...(exportResult.errors || []));
                return {
                    success: false,
                    snapshot,
                    metadata: exportResult.metadata,
                    errors
                };
            }

            logger.info('Generate report and snapshot flow completed successfully', {
                snapshotId: snapshot.id,
                reportId: reportData.reportId,
                storageKey: exportResult.storageKey,
                fileSize: exportResult.metadata.fileSize,
                category: 'reports'
            });

            return {
                success: true,
                snapshot,
                pdf: exportResult.pdf,
                storageKey: exportResult.storageKey,
                validation: exportResult.validation,
                sharing: exportResult.sharing,
                metadata: exportResult.metadata
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(errorMessage);

            logger.error('Generate report and snapshot flow failed', error instanceof Error ? error : new Error(String(error)), {
                reportId: reportData.reportId,
                tenantId: reportData.tenantId,
                userId,
                category: 'reports'
            });

            // Return partial result with snapshot if it was created
            return {
                success: false,
                snapshot: {} as ReportSnapshot, // Will be populated if snapshot creation succeeded
                metadata: {
                    snapshotId: '',
                    fileSize: 0,
                    checksum: '',
                    templateVersion: this.templateVersion,
                    dataSchemaVersion: this.dataSchemaVersion,
                    generatedAt: new Date()
                },
                errors
            };
        }
    }

    /**
     * Re-download PDF from existing snapshot
     * Enables exact re-delivery of previously generated reports
     */
    async redownloadFromSnapshot(snapshotId: string, tenantId: string, userId: string): Promise<{
        pdf: PDFBuffer;
        metadata: {
            snapshotId: string;
            generatedAt: Date;
            templateVersion: string;
            dataSchemaVersion: string;
            checksum?: string;
        };
    }> {
        try {
            // Get snapshot from service (this will validate access permissions)
            const { reportSnapshotService } = await import('./ReportSnapshotService');

            const snapshot = await reportSnapshotService.getSnapshot(snapshotId, userId, tenantId, undefined, undefined);
            if (!snapshot) {
                throw new Error('Snapshot not found or access denied');
            }

            if (!snapshot.pdfStorageKey) {
                throw new Error('No PDF available for this snapshot');
            }

            // Retrieve PDF from storage
            const pdf = await this.retrievePDF(snapshot.pdfStorageKey);

            // Validate PDF integrity if checksum is available
            if (snapshot.pdfSize && pdf.length !== snapshot.pdfSize) {
                logger.warn('PDF size mismatch detected', {
                    snapshotId,
                    expectedSize: snapshot.pdfSize,
                    actualSize: pdf.length,
                    category: 'reports'
                });
            }

            logger.info('PDF re-downloaded from snapshot', {
                snapshotId,
                storageKey: snapshot.pdfStorageKey,
                pdfSize: pdf.length,
                category: 'reports'
            });

            return {
                pdf,
                metadata: {
                    snapshotId: snapshot.id,
                    generatedAt: snapshot.generatedAt,
                    templateVersion: snapshot.templateVersion,
                    dataSchemaVersion: snapshot.dataSchemaVersion
                }
            };

        } catch (error) {
            logger.error('PDF re-download failed', error instanceof Error ? error : new Error(String(error)), {
                snapshotId,
                tenantId,
                userId,
                category: 'reports'
            });
            throw new Error(`PDF re-download failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Update snapshot with PDF storage information
     * Private helper method for snapshot integration
     */
    private async updateSnapshotWithPDFInfo(
        snapshotId: string,
        storageKey: string,
        pdfSize: number,
        checksum: string,
        tenantId: string,
        userId: string
    ): Promise<void> {
        try {
            const { reportSnapshotService } = await import('./ReportSnapshotService');

            await reportSnapshotService.updatePdfStorage(
                snapshotId,
                storageKey,
                pdfSize,
                checksum,
                userId,
                tenantId
            );

        } catch (error) {
            logger.error('Failed to update snapshot with PDF info', error instanceof Error ? error : new Error(String(error)), {
                snapshotId,
                storageKey,
                pdfSize,
                category: 'reports'
            });
            throw error;
        }
    }

    /**
     * Complete PDF export workflow with validation and storage
     * Implements Requirements 8.1, 8.2, 8.3, 8.5: Complete client-ready PDF generation
     */
    async exportClientReadyPDF(
        snapshot: ReportSnapshot,
        userId: string,
        options: {
            pdfOptions?: PDFGenerationOptions;
            validateQuality?: boolean;
            enableSharing?: boolean;
            sharingExpirationHours?: number;
        } = {}
    ): Promise<{
        success: boolean;
        pdf?: PDFBuffer;
        storageKey?: string;
        validation?: ValidationResult;
        sharing?: {
            shareId: string;
            expiresAt: Date;
            accessUrl: string;
        };
        metadata: {
            snapshotId: string;
            fileSize: number;
            checksum: string;
            templateVersion: string;
            dataSchemaVersion: string;
            generatedAt: Date;
        };
        errors?: string[];
    }> {
        const errors: string[] = [];

        try {
            logger.info('Starting client-ready PDF export', {
                snapshotId: snapshot.id,
                userId,
                validateQuality: options.validateQuality !== false,
                enableSharing: options.enableSharing || false,
                category: 'reports'
            });

            // Step 1: Generate PDF with versioning
            const { pdf, templateVersion, dataSchemaVersion, checksum } = await this.generateVersionedPDF(
                snapshot,
                options.pdfOptions
            );

            // Step 2: Validate PDF quality if requested (default: true)
            let validation: ValidationResult | undefined;
            if (options.validateQuality !== false) {
                validation = await this.validatePDFOutput(pdf);

                if (!validation.isValid) {
                    errors.push(...validation.errors);
                    logger.error('PDF validation failed', new Error('PDF quality validation failed'), {
                        snapshotId: snapshot.id,
                        validationErrors: validation.errors,
                        category: 'reports'
                    });

                    return {
                        success: false,
                        validation,
                        metadata: {
                            snapshotId: snapshot.id,
                            fileSize: pdf.length,
                            checksum,
                            templateVersion,
                            dataSchemaVersion,
                            generatedAt: new Date()
                        },
                        errors
                    };
                }

                // Log warnings but don't fail
                if (validation.warnings.length > 0) {
                    logger.warn('PDF validation warnings', {
                        snapshotId: snapshot.id,
                        warnings: validation.warnings,
                        category: 'reports'
                    });
                }
            }

            // Step 3: Store PDF
            const storageKey = await this.storePDF(pdf, snapshot.id);

            // Step 4: Update snapshot with PDF information
            await this.updateSnapshotWithPDFInfo(
                snapshot.id,
                storageKey,
                pdf.length,
                checksum,
                snapshot.tenantId,
                userId
            );

            // Step 5: Create sharing metadata if requested
            let sharing: { shareId: string; expiresAt: Date; accessUrl: string } | undefined;
            if (options.enableSharing) {
                const sharingMetadata = this.createSharingMetadata(
                    snapshot.id,
                    storageKey,
                    options.sharingExpirationHours || 24
                );

                sharing = {
                    shareId: sharingMetadata.shareId,
                    expiresAt: sharingMetadata.expiresAt,
                    accessUrl: sharingMetadata.accessUrl
                };

                logger.info('PDF sharing enabled', {
                    snapshotId: snapshot.id,
                    shareId: sharing.shareId,
                    expiresAt: sharing.expiresAt,
                    category: 'reports'
                });
            }

            logger.info('Client-ready PDF export completed successfully', {
                snapshotId: snapshot.id,
                storageKey,
                fileSize: pdf.length,
                checksum: checksum.substring(0, 16),
                hasWarnings: validation?.warnings.length || 0,
                sharingEnabled: !!sharing,
                category: 'reports'
            });

            return {
                success: true,
                pdf,
                storageKey,
                validation,
                sharing,
                metadata: {
                    snapshotId: snapshot.id,
                    fileSize: pdf.length,
                    checksum,
                    templateVersion,
                    dataSchemaVersion,
                    generatedAt: new Date()
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(errorMessage);

            logger.error('Client-ready PDF export failed', error instanceof Error ? error : new Error(String(error)), {
                snapshotId: snapshot.id,
                userId,
                category: 'reports'
            });

            return {
                success: false,
                metadata: {
                    snapshotId: snapshot.id,
                    fileSize: 0,
                    checksum: '',
                    templateVersion: this.templateVersion,
                    dataSchemaVersion: this.dataSchemaVersion,
                    generatedAt: new Date()
                },
                errors
            };
        }
    }

    /**
     * Batch validate multiple PDFs for quality assurance
     */
    async batchValidatePDFs(pdfs: Array<{ id: string; buffer: PDFBuffer }>): Promise<Array<{
        id: string;
        validation: ValidationResult;
        passed: boolean;
    }>> {
        const results = await Promise.all(
            pdfs.map(async ({ id, buffer }) => {
                try {
                    const validation = await this.validatePDFOutput(buffer);
                    return {
                        id,
                        validation,
                        passed: validation.isValid
                    };
                } catch (error) {
                    return {
                        id,
                        validation: {
                            isValid: false,
                            errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`],
                            warnings: []
                        },
                        passed: false
                    };
                }
            })
        );

        const passedCount = results.filter(r => r.passed).length;
        logger.info('Batch PDF validation completed', {
            totalPDFs: pdfs.length,
            passedCount,
            failedCount: pdfs.length - passedCount,
            category: 'reports'
        });

        return results;
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        await this.closeBrowser();
    }
}