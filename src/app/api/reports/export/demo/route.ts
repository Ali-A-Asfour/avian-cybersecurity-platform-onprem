import { NextRequest, NextResponse } from 'next/server';
import { PDFGenerator } from '@/services/reports/PDFGenerator';
import { ReportSnapshotService } from '@/services/reports/ReportSnapshotService';

/**
 * Demo PDF Export API Endpoint
 * 
 * Generates a proper PDF from the demo report data using the actual PDFGenerator service.
 * This demonstrates the real PDF export functionality with presentation content.
 */
export async function POST(request: NextRequest) {
    let body: any;
    try {
        body = await request.json();
        const { reportId, reportType } = body;

        // Simulate PDF generation delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the demo report data first
        const demoResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/reports/demo?type=${reportType || 'weekly'}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!demoResponse.ok) {
            throw new Error('Failed to fetch demo report data');
        }

        const demoData = await demoResponse.json();
        const report = demoData.data;

        // Create a mock snapshot from the demo report data
        const mockSnapshot = {
            id: reportId || report.id,
            tenantId: 'demo-tenant',
            reportId: report.id,
            reportType: report.reportType,
            dateRange: {
                startDate: new Date(report.dateRange.startDate),
                endDate: new Date(report.dateRange.endDate),
                timezone: report.dateRange.timezone || 'America/Toronto',
                weekStart: report.dateRange.weekStart || 'monday'
            },
            generatedAt: new Date(report.generatedAt),
            generatedBy: 'demo-user',
            slideData: report.slides.map((slide: any, index: number) => ({
                slideId: slide.id || `slide-${index}`,
                slideType: slide.layout?.type || 'summary',
                title: slide.title,
                summary: slide.content?.summary || '',
                keyPoints: slide.content?.keyPoints || [],
                computedMetrics: slide.content?.metrics || {},
                chartData: slide.charts || [],
                templateData: slide.content || {}
            })),
            templateVersion: report.templateVersion || '2.0.0',
            dataSchemaVersion: report.dataSchemaVersion || '2.0.0',
            isArchived: false
        };

        // Use the actual PDFGenerator service to create a proper PDF
        const pdfGenerator = new PDFGenerator();

        try {
            const pdfBuffer = await pdfGenerator.exportToPDF(mockSnapshot, {
                format: 'A4',
                orientation: 'landscape',
                printBackground: true,
                displayHeaderFooter: true
            });

            // Validate the PDF
            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);
            if (!validation.isValid) {
                console.warn('PDF validation warnings:', validation.warnings);
                if (validation.errors.length > 0) {
                    throw new Error(`PDF validation failed: ${validation.errors.join(', ')}`);
                }
            }

            return new NextResponse(new Uint8Array(pdfBuffer), {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="avian-security-report-${reportType || 'weekly'}-${new Date().toISOString().split('T')[0]}.pdf"`,
                    'Content-Length': pdfBuffer.length.toString(),
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

        } finally {
            // Clean up browser resources
            await pdfGenerator.closeBrowser();
        }

    } catch (error) {
        console.error('Failed to export demo PDF:', error);

        // Fallback to simple PDF if the full generation fails
        const fallbackPdf = generateFallbackPDF(body.reportType || 'weekly');

        return new NextResponse(new Uint8Array(fallbackPdf), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="avian-security-report-${body.reportType || 'weekly'}-fallback.pdf"`,
                'Cache-Control': 'no-cache'
            }
        });
    }
}

function generateFallbackPDF(reportType: string): Buffer {
    // Fallback PDF with better content when the full PDF generation fails
    const pdfHeader = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 842 595]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
/F2 6 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 800
>>
stream
BT
/F1 20 Tf
50 550 Td
(AVIAN Security Report - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}) Tj
0 -40 Td
/F2 12 Tf
(Generated: ${new Date().toLocaleDateString()}) Tj
0 -60 Td
/F1 16 Tf
(Executive Summary) Tj
0 -30 Td
/F2 10 Tf
(This ${reportType} security report provides a comprehensive overview of your) Tj
0 -15 Td
(organization's cybersecurity posture and recent security activities.) Tj
0 -40 Td
/F1 14 Tf
(Key Metrics:) Tj
0 -25 Td
/F2 10 Tf
(• Security Events Processed: 47) Tj
0 -15 Td
(• Updates Applied: 156) Tj
0 -15 Td
(• Vulnerabilities Addressed: 23) Tj
0 -15 Td
(• System Uptime: 99.8%) Tj
0 -40 Td
/F1 14 Tf
(Security Posture:) Tj
0 -25 Td
/F2 10 Tf
(Your security infrastructure continues to perform effectively,) Tj
0 -15 Td
(with all critical systems operating within normal parameters.) Tj
0 -40 Td
/F1 12 Tf
(Note: This is a fallback PDF. For the full interactive presentation,) Tj
0 -15 Td
(please ensure all system dependencies are properly configured.) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica-Bold
>>
endobj

6 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000348 00000 n 
0000001200 00000 n 
0000001260 00000 n 
trailer
<<
/Size 7
/Root 1 0 R
>>
startxref
1315
%%EOF`;

    return Buffer.from(pdfHeader, 'utf-8');
}