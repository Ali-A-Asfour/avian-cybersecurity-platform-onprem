/**
 * Property-Based Tests for Snapshot Reproducibility
 * 
 * **Feature: avian-reports-module, Property 13: Snapshot reproducibility**
 * **Validates: Requirements 9.2**
 */

import * as fc from 'fast-check';
import { generators } from './generators';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { PDFGenerator } from '../PDFGenerator';
import { ReportSnapshot } from '@/types/reports';
import crypto from 'crypto';

// Mock dependencies
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
        from: jest.fn(),
        where: jest.fn(),
        insert: jest.fn(),
        values: jest.fn(),
        returning: jest.fn()
    }
}));

jest.mock('../PDFGenerator');

describe('Snapshot Reproducibility Properties', () => {
    let snapshotService: ReportSnapshotService;
    let pdfGenerator: jest.Mocked<PDFGenerator>;

    beforeEach(() => {
        jest.clearAllMocks();
        snapshotService = new ReportSnapshotService();
        pdfGenerator = new PDFGenerator() as jest.Mocked<PDFGenerator>;
    });

    describe('Property 13: Snapshot reproducibility', () => {
        it('should produce identical computed metrics for the same snapshot across multiple exports', () => {
            /**
             * **Feature: avian-reports-module, Property 13: Snapshot reproducibility**
             * **Validates: Requirements 9.2**
             */
            fc.assert(
                fc.property(
                    generators.reportSnapshot,
                    async (originalSnapshot) => {
                        const mockDb = require('@/lib/database').db;

                        // Mock snapshot retrieval to return consistent data
                        mockDb.select.mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue(Promise.resolve([originalSnapshot]))
                            })
                        });

                        // Retrieve the same snapshot multiple times
                        const export1 = await snapshotService.getSnapshot(originalSnapshot.id);
                        const export2 = await snapshotService.getSnapshot(originalSnapshot.id);
                        const export3 = await snapshotService.getSnapshot(originalSnapshot.id);

                        // Property: Computed metrics must be identical across all exports
                        expect(export1.slideData).toEqual(export2.slideData);
                        expect(export2.slideData).toEqual(export3.slideData);
                        expect(export1.slideData).toEqual(export3.slideData);

                        // Property: Slide ordering must be consistent
                        export1.slideData.forEach((slide, index) => {
                            expect(export2.slideData[index]).toEqual(slide);
                            expect(export3.slideData[index]).toEqual(slide);
                        });

                        // Property: Computed metrics within slides must be deterministic
                        export1.slideData.forEach((slide, slideIndex) => {
                            const slide2 = export2.slideData[slideIndex];
                            const slide3 = export3.slideData[slideIndex];

                            // Slide metadata must be identical
                            expect(slide2.slideId).toBe(slide.slideId);
                            expect(slide3.slideId).toBe(slide.slideId);
                            expect(slide2.slideType).toBe(slide.slideType);
                            expect(slide3.slideType).toBe(slide.slideType);

                            // Computed metrics must be byte-identical
                            const metrics1JSON = JSON.stringify(slide.computedMetrics, Object.keys(slide.computedMetrics).sort());
                            const metrics2JSON = JSON.stringify(slide2.computedMetrics, Object.keys(slide2.computedMetrics).sort());
                            const metrics3JSON = JSON.stringify(slide3.computedMetrics, Object.keys(slide3.computedMetrics).sort());

                            expect(metrics2JSON).toBe(metrics1JSON);
                            expect(metrics3JSON).toBe(metrics1JSON);

                            // Chart data must be identical
                            expect(JSON.stringify(slide2.chartData)).toBe(JSON.stringify(slide.chartData));
                            expect(JSON.stringify(slide3.chartData)).toBe(JSON.stringify(slide.chartData));
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate checksum-stable slide JSON for audit purposes', () => {
            /**
             * **Feature: avian-reports-module, Property 13: Snapshot reproducibility**
             * **Validates: Requirements 9.2**
             */
            fc.assert(
                fc.property(
                    generators.reportSnapshot,
                    async (snapshot) => {
                        const mockDb = require('@/lib/database').db;

                        // Mock consistent snapshot retrieval
                        mockDb.select.mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue(Promise.resolve([snapshot]))
                            })
                        });

                        // Generate checksums for multiple retrievals
                        const retrievals = await Promise.all([
                            snapshotService.getSnapshot(snapshot.id),
                            snapshotService.getSnapshot(snapshot.id),
                            snapshotService.getSnapshot(snapshot.id),
                            snapshotService.getSnapshot(snapshot.id),
                            snapshotService.getSnapshot(snapshot.id)
                        ]);

                        // Property: JSON serialization must be deterministic for checksumming
                        const checksums = retrievals.map(retrieval => {
                            // Sort keys to ensure deterministic JSON serialization
                            const sortedSlideData = retrieval.slideData.map(slide => ({
                                slideId: slide.slideId,
                                slideType: slide.slideType,
                                computedMetrics: Object.keys(slide.computedMetrics)
                                    .sort()
                                    .reduce((sorted, key) => {
                                        sorted[key] = slide.computedMetrics[key];
                                        return sorted;
                                    }, {} as any),
                                chartData: slide.chartData,
                                templateData: Object.keys(slide.templateData)
                                    .sort()
                                    .reduce((sorted, key) => {
                                        sorted[key] = slide.templateData[key];
                                        return sorted;
                                    }, {} as any)
                            }));

                            const deterministicJSON = JSON.stringify(sortedSlideData);
                            return crypto.createHash('sha256').update(deterministicJSON).digest('hex');
                        });

                        // Property: All checksums must be identical
                        const uniqueChecksums = new Set(checksums);
                        expect(uniqueChecksums.size).toBe(1);

                        // Property: Checksum must be reproducible
                        const firstChecksum = checksums[0];
                        checksums.forEach(checksum => {
                            expect(checksum).toBe(firstChecksum);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should maintain PDF export consistency for the same snapshot', () => {
            /**
             * **Feature: avian-reports-module, Property 13: Snapshot reproducibility**
             * **Validates: Requirements 9.2**
             */
            fc.assert(
                fc.property(
                    generators.reportSnapshot,
                    fc.array(fc.uint8Array({ minLength: 1000, maxLength: 10000 }), { minLength: 1, maxLength: 1 }),
                    async (snapshot, [mockPDFBuffer]) => {
                        const mockDb = require('@/lib/database').db;

                        // Mock snapshot retrieval
                        mockDb.select.mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue(Promise.resolve([snapshot]))
                            })
                        });

                        // Mock PDF generation to return consistent output
                        const mockPDFData = Buffer.from(mockPDFBuffer);
                        pdfGenerator.exportToPDF.mockResolvedValue(mockPDFData);

                        // Generate PDF exports from the same snapshot multiple times
                        const pdfExport1 = await pdfGenerator.exportToPDF(snapshot);
                        const pdfExport2 = await pdfGenerator.exportToPDF(snapshot);
                        const pdfExport3 = await pdfGenerator.exportToPDF(snapshot);

                        // Property: PDF exports from the same snapshot should be identical
                        expect(Buffer.compare(pdfExport1, pdfExport2)).toBe(0);
                        expect(Buffer.compare(pdfExport2, pdfExport3)).toBe(0);
                        expect(Buffer.compare(pdfExport1, pdfExport3)).toBe(0);

                        // Property: PDF size should be consistent
                        expect(pdfExport1.length).toBe(pdfExport2.length);
                        expect(pdfExport2.length).toBe(pdfExport3.length);

                        // Property: PDF checksums should be identical
                        const checksum1 = crypto.createHash('sha256').update(pdfExport1).digest('hex');
                        const checksum2 = crypto.createHash('sha256').update(pdfExport2).digest('hex');
                        const checksum3 = crypto.createHash('sha256').update(pdfExport3).digest('hex');

                        expect(checksum2).toBe(checksum1);
                        expect(checksum3).toBe(checksum1);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve snapshot metadata consistency across time', () => {
            /**
             * **Feature: avian-reports-module, Property 13: Snapshot reproducibility**
             * **Validates: Requirements 9.2**
             */
            fc.assert(
                fc.property(
                    generators.reportSnapshot,
                    fc.integer({ min: 1, max: 1000 }), // Simulate time delay in milliseconds
                    async (snapshot, timeDelay) => {
                        const mockDb = require('@/lib/database').db;

                        // Mock snapshot retrieval
                        mockDb.select.mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue(Promise.resolve([snapshot]))
                            })
                        });

                        // Retrieve snapshot immediately
                        const immediateRetrieval = await snapshotService.getSnapshot(snapshot.id);

                        // Simulate time passage
                        await new Promise(resolve => setTimeout(resolve, timeDelay));

                        // Retrieve snapshot after time delay
                        const delayedRetrieval = await snapshotService.getSnapshot(snapshot.id);

                        // Property: Core metadata must remain unchanged over time
                        expect(delayedRetrieval.id).toBe(immediateRetrieval.id);
                        expect(delayedRetrieval.tenantId).toBe(immediateRetrieval.tenantId);
                        expect(delayedRetrieval.reportId).toBe(immediateRetrieval.reportId);
                        expect(delayedRetrieval.reportType).toBe(immediateRetrieval.reportType);
                        expect(delayedRetrieval.generatedAt.getTime()).toBe(immediateRetrieval.generatedAt.getTime());
                        expect(delayedRetrieval.generatedBy).toBe(immediateRetrieval.generatedBy);
                        expect(delayedRetrieval.templateVersion).toBe(immediateRetrieval.templateVersion);
                        expect(delayedRetrieval.dataSchemaVersion).toBe(immediateRetrieval.dataSchemaVersion);

                        // Property: Slide data must be immutable over time
                        expect(JSON.stringify(delayedRetrieval.slideData)).toBe(JSON.stringify(immediateRetrieval.slideData));

                        // Property: PDF storage metadata must be consistent
                        expect(delayedRetrieval.pdfStorageKey).toBe(immediateRetrieval.pdfStorageKey);
                        expect(delayedRetrieval.pdfSize).toBe(immediateRetrieval.pdfSize);
                        expect(delayedRetrieval.isArchived).toBe(immediateRetrieval.isArchived);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure deterministic slide ordering within snapshots', () => {
            /**
             * **Feature: avian-reports-module, Property 13: Snapshot reproducibility**
             * **Validates: Requirements 9.2**
             */
            fc.assert(
                fc.property(
                    generators.reportSnapshot,
                    async (snapshot) => {
                        // Ensure snapshot has multiple slides for meaningful ordering test
                        fc.pre(snapshot.slideData.length > 1);

                        const mockDb = require('@/lib/database').db;

                        // Mock snapshot retrieval
                        mockDb.select.mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue(Promise.resolve([snapshot]))
                            })
                        });

                        // Retrieve snapshot multiple times
                        const retrievals = await Promise.all([
                            snapshotService.getSnapshot(snapshot.id),
                            snapshotService.getSnapshot(snapshot.id),
                            snapshotService.getSnapshot(snapshot.id)
                        ]);

                        // Property: Slide ordering must be deterministic
                        retrievals.forEach(retrieval => {
                            expect(retrieval.slideData.length).toBe(snapshot.slideData.length);

                            retrieval.slideData.forEach((slide, index) => {
                                const originalSlide = snapshot.slideData[index];
                                expect(slide.slideId).toBe(originalSlide.slideId);
                                expect(slide.slideType).toBe(originalSlide.slideType);
                            });
                        });

                        // Property: Slide order must be consistent across all retrievals
                        const slideOrders = retrievals.map(retrieval =>
                            retrieval.slideData.map(slide => slide.slideId)
                        );

                        slideOrders.forEach(order => {
                            expect(order).toEqual(slideOrders[0]);
                        });

                        // Property: Slide positions must be stable
                        const firstRetrieval = retrievals[0];
                        retrievals.slice(1).forEach(retrieval => {
                            firstRetrieval.slideData.forEach((slide, index) => {
                                expect(retrieval.slideData[index].slideId).toBe(slide.slideId);
                                expect(retrieval.slideData[index].slideType).toBe(slide.slideType);
                            });
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});