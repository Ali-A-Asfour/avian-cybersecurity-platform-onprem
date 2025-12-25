/**
 * Help Desk Integration Test Runner
 * 
 * Task 15: Final integration testing and polish
 * 
 * Comprehensive test runner that executes all help desk integration tests
 * and provides detailed reporting on system readiness.
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

interface TestResult {
    testSuite: string;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    errors: string[];
}

interface IntegrationTestReport {
    timestamp: string;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
    totalDuration: number;
    testResults: TestResult[];
    systemReadiness: {
        ticketWorkflows: boolean;
        tenantIsolation: boolean;
        emailNotifications: boolean;
        concurrentOperations: boolean;
        errorRecovery: boolean;
        performance: boolean;
        knowledgeBase: boolean;
    };
    recommendations: string[];
}

class HelpDeskIntegrationTestRunner {
    private testSuites = [
        {
            name: 'Final Integration Tests',
            path: 'src/app/api/help-desk/__tests__/final-integration.test.ts',
            description: 'Comprehensive end-to-end integration tests'
        },
        {
            name: 'UI Integration Tests',
            path: 'src/components/help-desk/__tests__/help-desk-ui-integration.test.tsx',
            description: 'User interface integration tests'
        },
        {
            name: 'Queue Management Integration',
            path: 'src/services/help-desk/__tests__/QueueManagementService.integration.test.ts',
            description: 'Queue management system integration tests'
        },
        {
            name: 'API Integration Tests',
            path: 'src/app/api/tickets/__tests__/help-desk-integration.test.ts',
            description: 'API endpoint integration tests'
        }
    ];

    async runAllTests(): Promise<IntegrationTestReport> {
        console.log('🚀 Starting Help Desk Integration Test Suite...\n');

        const report: IntegrationTestReport = {
            timestamp: new Date().toISOString(),
            totalTests: 0,
            totalPassed: 0,
            totalFailed: 0,
            totalSkipped: 0,
            totalDuration: 0,
            testResults: [],
            systemReadiness: {
                ticketWorkflows: false,
                tenantIsolation: false,
                emailNotifications: false,
                concurrentOperations: false,
                errorRecovery: false,
                performance: false,
                knowledgeBase: false,
            },
            recommendations: []
        };

        for (const testSuite of this.testSuites) {
            console.log(`📋 Running ${testSuite.name}...`);
            console.log(`   ${testSuite.description}`);

            try {
                const result = await this.runTestSuite(testSuite.path);
                report.testResults.push(result);

                report.totalTests += result.passed + result.failed + result.skipped;
                report.totalPassed += result.passed;
                report.totalFailed += result.failed;
                report.totalSkipped += result.skipped;
                report.totalDuration += result.duration;

                console.log(`   ✅ Passed: ${result.passed}, ❌ Failed: ${result.failed}, ⏭️ Skipped: ${result.skipped}`);
                console.log(`   ⏱️ Duration: ${result.duration}ms\n`);

            } catch (error) {
                console.error(`   💥 Test suite failed to run: ${error}\n`);
                report.testResults.push({
                    testSuite: testSuite.name,
                    passed: 0,
                    failed: 1,
                    skipped: 0,
                    duration: 0,
                    errors: [error instanceof Error ? error.message : String(error)]
                });
                report.totalFailed += 1;
            }
        }

        // Analyze system readiness
        this.analyzeSystemReadiness(report);

        // Generate recommendations
        this.generateRecommendations(report);

        // Save detailed report
        this.saveReport(report);

        // Print summary
        this.printSummary(report);

        return report;
    }

    private async runTestSuite(testPath: string): Promise<TestResult> {
        const startTime = Date.now();

        try {
            // Run Jest for specific test file
            const output = execSync(
                `npx jest ${testPath} --verbose --json --testTimeout=30000`,
                {
                    encoding: 'utf8',
                    stdio: 'pipe'
                }
            );

            const duration = Date.now() - startTime;
            const result = JSON.parse(output);

            return {
                testSuite: testPath,
                passed: result.numPassedTests || 0,
                failed: result.numFailedTests || 0,
                skipped: result.numPendingTests || 0,
                duration,
                errors: result.testResults?.[0]?.message ? [result.testResults[0].message] : []
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            // Try to parse Jest output even on failure
            try {
                const errorOutput = error instanceof Error && 'stdout' in error ?
                    (error as any).stdout : String(error);
                const result = JSON.parse(errorOutput);

                return {
                    testSuite: testPath,
                    passed: result.numPassedTests || 0,
                    failed: result.numFailedTests || 0,
                    skipped: result.numPendingTests || 0,
                    duration,
                    errors: result.testResults?.[0]?.message ? [result.testResults[0].message] : [String(error)]
                };
            } catch {
                return {
                    testSuite: testPath,
                    passed: 0,
                    failed: 1,
                    skipped: 0,
                    duration,
                    errors: [error instanceof Error ? error.message : String(error)]
                };
            }
        }
    }

    private analyzeSystemReadiness(report: IntegrationTestReport): void {
        const results = report.testResults;

        // Analyze each system component based on test results
        report.systemReadiness.ticketWorkflows = this.hasPassingTests(results, [
            'Complete End-to-End Ticket Workflows',
            'complete full ticket lifecycle',
            'automatic ticket reopening',
            'manual closure requirement'
        ]);

        report.systemReadiness.tenantIsolation = this.hasPassingTests(results, [
            'Comprehensive Tenant Isolation Verification',
            'enforce complete tenant isolation',
            'prevent cross-tenant'
        ]);

        report.systemReadiness.emailNotifications = this.hasPassingTests(results, [
            'Email Notification System Validation',
            'send correct notifications',
            'notification service failures'
        ]);

        report.systemReadiness.concurrentOperations = this.hasPassingTests(results, [
            'Concurrent User Scenarios',
            'concurrent ticket assignments',
            'queue ordering with multiple tickets',
            'high-volume ticket creation'
        ]);

        report.systemReadiness.errorRecovery = this.hasPassingTests(results, [
            'System Resilience and Error Recovery',
            'database connection issues',
            'partial system failures',
            'data consistency'
        ]);

        report.systemReadiness.performance = this.hasPassingTests(results, [
            'Performance and Load Testing',
            'queue operations efficiently',
            'large comment threads'
        ]);

        report.systemReadiness.knowledgeBase = this.hasPassingTests(results, [
            'Knowledge Base Integration',
            'create and search knowledge articles'
        ]);
    }

    private hasPassingTests(results: TestResult[], keywords: string[]): boolean {
        return results.some(result =>
            result.passed > 0 &&
            keywords.some(keyword =>
                result.testSuite.toLowerCase().includes(keyword.toLowerCase()) ||
                result.errors.some(error => error.toLowerCase().includes(keyword.toLowerCase()))
            )
        );
    }

    private generateRecommendations(report: IntegrationTestReport): void {
        const readiness = report.systemReadiness;

        if (!readiness.ticketWorkflows) {
            report.recommendations.push(
                '🎫 Ticket Workflows: Review end-to-end ticket lifecycle tests. Ensure creation, assignment, resolution, and closure work correctly.'
            );
        }

        if (!readiness.tenantIsolation) {
            report.recommendations.push(
                '🏢 Tenant Isolation: Critical security issue. Verify tenant boundary enforcement in all operations.'
            );
        }

        if (!readiness.emailNotifications) {
            report.recommendations.push(
                '📧 Email Notifications: Check notification service integration and error handling.'
            );
        }

        if (!readiness.concurrentOperations) {
            report.recommendations.push(
                '⚡ Concurrent Operations: Review race condition handling and queue management under load.'
            );
        }

        if (!readiness.errorRecovery) {
            report.recommendations.push(
                '🛡️ Error Recovery: Improve system resilience and error handling mechanisms.'
            );
        }

        if (!readiness.performance) {
            report.recommendations.push(
                '🚀 Performance: Optimize database queries and system performance under load.'
            );
        }

        if (!readiness.knowledgeBase) {
            report.recommendations.push(
                '📚 Knowledge Base: Verify knowledge article creation and search functionality.'
            );
        }

        if (report.totalFailed === 0) {
            report.recommendations.push(
                '🎉 All tests passing! System is ready for production deployment.'
            );
        } else if (report.totalFailed < report.totalTests * 0.1) {
            report.recommendations.push(
                '✅ System is mostly ready. Address failing tests before production deployment.'
            );
        } else {
            report.recommendations.push(
                '⚠️ System needs significant work before production deployment. Address all failing tests.'
            );
        }
    }

    private saveReport(report: IntegrationTestReport): void {
        const reportPath = 'help-desk-integration-test-report.json';
        writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);
    }

    private printSummary(report: IntegrationTestReport): void {
        console.log('\n' + '='.repeat(80));
        console.log('📊 HELP DESK INTEGRATION TEST SUMMARY');
        console.log('='.repeat(80));

        console.log(`\n📅 Test Run: ${report.timestamp}`);
        console.log(`⏱️ Total Duration: ${report.totalDuration}ms`);
        console.log(`📋 Total Tests: ${report.totalTests}`);
        console.log(`✅ Passed: ${report.totalPassed}`);
        console.log(`❌ Failed: ${report.totalFailed}`);
        console.log(`⏭️ Skipped: ${report.totalSkipped}`);

        const successRate = report.totalTests > 0 ?
            ((report.totalPassed / report.totalTests) * 100).toFixed(1) : '0.0';
        console.log(`📈 Success Rate: ${successRate}%`);

        console.log('\n🏗️ SYSTEM READINESS:');
        const readiness = report.systemReadiness;
        console.log(`   🎫 Ticket Workflows: ${readiness.ticketWorkflows ? '✅' : '❌'}`);
        console.log(`   🏢 Tenant Isolation: ${readiness.tenantIsolation ? '✅' : '❌'}`);
        console.log(`   📧 Email Notifications: ${readiness.emailNotifications ? '✅' : '❌'}`);
        console.log(`   ⚡ Concurrent Operations: ${readiness.concurrentOperations ? '✅' : '❌'}`);
        console.log(`   🛡️ Error Recovery: ${readiness.errorRecovery ? '✅' : '❌'}`);
        console.log(`   🚀 Performance: ${readiness.performance ? '✅' : '❌'}`);
        console.log(`   📚 Knowledge Base: ${readiness.knowledgeBase ? '✅' : '❌'}`);

        if (report.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS:');
            report.recommendations.forEach(rec => console.log(`   ${rec}`));
        }

        console.log('\n' + '='.repeat(80));

        if (report.totalFailed === 0) {
            console.log('🎉 ALL TESTS PASSED! Help Desk system is ready for production.');
        } else {
            console.log(`⚠️ ${report.totalFailed} test(s) failed. Review and fix before deployment.`);
        }

        console.log('='.repeat(80) + '\n');
    }
}

// Export for use in other scripts
export { HelpDeskIntegrationTestRunner };

// Run if called directly
if (require.main === module) {
    const runner = new HelpDeskIntegrationTestRunner();
    runner.runAllTests().catch(console.error);
}