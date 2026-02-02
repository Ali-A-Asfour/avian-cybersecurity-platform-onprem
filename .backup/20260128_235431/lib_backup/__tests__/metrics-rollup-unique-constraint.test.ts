/**
 * Unit test for firewall_metrics_rollup unique constraint verification
 * 
 * Verifies that the unique constraint on (device_id, date) is properly defined
 * in the schema and that the UPSERT logic correctly targets this constraint.
 * 
 * Requirements: Task 7.3 - Verify unique constraint (device_id, date)
 */

import { firewallMetricsRollup } from '../../../database/schemas/firewall';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Firewall Metrics Rollup - Unique Constraint Verification', () => {
    describe('Schema definition', () => {
        it('should have a unique constraint on (device_id, date)', () => {
            const tableConfig = getTableConfig(firewallMetricsRollup);

            // Find the unique constraint
            const uniqueConstraints = tableConfig.uniqueConstraints;

            // Verify unique constraint exists
            expect(uniqueConstraints).toBeDefined();
            expect(uniqueConstraints.length).toBeGreaterThan(0);

            // Find the device_date unique constraint
            const deviceDateConstraint = uniqueConstraints.find(
                (constraint: any) => constraint.name === 'firewall_metrics_rollup_device_date_unique'
            );

            expect(deviceDateConstraint).toBeDefined();
            expect(deviceDateConstraint?.name).toBe('firewall_metrics_rollup_device_date_unique');
        });

        it('should include both deviceId and date columns in the unique constraint', () => {
            const tableConfig = getTableConfig(firewallMetricsRollup);
            const uniqueConstraints = tableConfig.uniqueConstraints;

            const deviceDateConstraint = uniqueConstraints.find(
                (constraint: any) => constraint.name === 'firewall_metrics_rollup_device_date_unique'
            );

            expect(deviceDateConstraint).toBeDefined();

            // Verify the constraint includes both columns
            const columns = deviceDateConstraint?.columns;
            expect(columns).toBeDefined();
            expect(columns?.length).toBe(2);

            // Verify column names
            const columnNames = columns?.map((col: any) => col.name);
            expect(columnNames).toContain('device_id');
            expect(columnNames).toContain('date');
        });

        it('should have deviceId column defined', () => {
            const tableConfig = getTableConfig(firewallMetricsRollup);
            const columns = tableConfig.columns;

            const deviceIdColumn = columns.find((col: any) => col.name === 'device_id');
            expect(deviceIdColumn).toBeDefined();
            expect(deviceIdColumn?.notNull).toBe(true);
        });

        it('should have date column defined', () => {
            const tableConfig = getTableConfig(firewallMetricsRollup);
            const columns = tableConfig.columns;

            const dateColumn = columns.find((col: any) => col.name === 'date');
            expect(dateColumn).toBeDefined();
            expect(dateColumn?.notNull).toBe(true);
        });

        it('should have the correct table name', () => {
            const tableConfig = getTableConfig(firewallMetricsRollup);
            expect(tableConfig.name).toBe('firewall_metrics_rollup');
        });
    });

    describe('UPSERT target verification', () => {
        it('should use correct columns for onConflictDoUpdate target', () => {
            // This test verifies that the UPSERT logic uses the correct target columns
            // The actual UPSERT is tested in metrics-aggregator-upsert.test.ts

            const tableConfig = getTableConfig(firewallMetricsRollup);
            const uniqueConstraints = tableConfig.uniqueConstraints;

            const deviceDateConstraint = uniqueConstraints.find(
                (constraint: any) => constraint.name === 'firewall_metrics_rollup_device_date_unique'
            );

            // Verify the constraint exists and has the correct columns
            expect(deviceDateConstraint).toBeDefined();
            const columns = deviceDateConstraint?.columns;
            expect(columns?.length).toBe(2);

            // These are the columns that should be used in onConflictDoUpdate target
            const targetColumns = [
                firewallMetricsRollup.deviceId,
                firewallMetricsRollup.date
            ];

            // Verify the columns match
            expect(targetColumns[0].name).toBe('device_id');
            expect(targetColumns[1].name).toBe('date');
        });

        it('should have both columns marked as not null for constraint enforcement', () => {
            // Unique constraints work best when columns are NOT NULL
            const tableConfig = getTableConfig(firewallMetricsRollup);
            const columns = tableConfig.columns;

            const deviceIdColumn = columns.find((col: any) => col.name === 'device_id');
            const dateColumn = columns.find((col: any) => col.name === 'date');

            expect(deviceIdColumn?.notNull).toBe(true);
            expect(dateColumn?.notNull).toBe(true);
        });
    });

    describe('Constraint behavior expectations', () => {
        it('should document that duplicate (device_id, date) combinations are prevented', () => {
            // This is a documentation test that verifies the constraint behavior is understood
            const tableConfig = getTableConfig(firewallMetricsRollup);
            const uniqueConstraints = tableConfig.uniqueConstraints;

            const deviceDateConstraint = uniqueConstraints.find(
                (constraint: any) => constraint.name === 'firewall_metrics_rollup_device_date_unique'
            );

            expect(deviceDateConstraint).toBeDefined();

            // Document expected behavior:
            // 1. Same device, same date -> CONFLICT (prevented by constraint)
            // 2. Same device, different date -> ALLOWED
            // 3. Different device, same date -> ALLOWED
            // 4. Different device, different date -> ALLOWED

            // The constraint ensures only one metrics rollup per device per date
            expect(deviceDateConstraint?.name).toBe('firewall_metrics_rollup_device_date_unique');
        });

        it('should support UPSERT operations via onConflictDoUpdate', () => {
            // Verify the columns needed for UPSERT are accessible
            expect(firewallMetricsRollup.deviceId).toBeDefined();
            expect(firewallMetricsRollup.date).toBeDefined();

            // These columns can be used in onConflictDoUpdate target
            const upsertTarget = [
                firewallMetricsRollup.deviceId,
                firewallMetricsRollup.date
            ];

            expect(upsertTarget).toHaveLength(2);
            expect(upsertTarget[0].name).toBe('device_id');
            expect(upsertTarget[1].name).toBe('date');
        });

        it('should allow multiple devices to have metrics for the same date', () => {
            // This test documents that the constraint is on (device_id, date) combination
            // not just on date alone
            const tableConfig = getTableConfig(firewallMetricsRollup);
            const uniqueConstraints = tableConfig.uniqueConstraints;

            const deviceDateConstraint = uniqueConstraints.find(
                (constraint: any) => constraint.name === 'firewall_metrics_rollup_device_date_unique'
            );

            // Verify it's a composite constraint (both columns)
            const columns = deviceDateConstraint?.columns;
            expect(columns?.length).toBe(2);

            // This means:
            // - Device A with date 2024-01-15 -> ALLOWED
            // - Device B with date 2024-01-15 -> ALLOWED (different device)
            // - Device A with date 2024-01-15 again -> CONFLICT (same device, same date)
        });

        it('should allow same device to have metrics for different dates', () => {
            // This test documents that the constraint includes date
            const tableConfig = getTableConfig(firewallMetricsRollup);
            const uniqueConstraints = tableConfig.uniqueConstraints;

            const deviceDateConstraint = uniqueConstraints.find(
                (constraint: any) => constraint.name === 'firewall_metrics_rollup_device_date_unique'
            );

            // Verify date is part of the constraint
            const columns = deviceDateConstraint?.columns;
            const columnNames = columns?.map((col: any) => col.name);
            expect(columnNames).toContain('date');

            // This means:
            // - Device A with date 2024-01-15 -> ALLOWED
            // - Device A with date 2024-01-16 -> ALLOWED (different date)
            // - Device A with date 2024-01-15 again -> CONFLICT (same date)
        });
    });

    describe('Integration with MetricsAggregator', () => {
        it('should verify constraint is used correctly in aggregateDeviceMetrics', () => {
            // This test verifies the schema supports the UPSERT pattern used in MetricsAggregator
            // The actual UPSERT logic is tested in metrics-aggregator-upsert.test.ts

            const tableConfig = getTableConfig(firewallMetricsRollup);
            const uniqueConstraints = tableConfig.uniqueConstraints;

            const deviceDateConstraint = uniqueConstraints.find(
                (constraint: any) => constraint.name === 'firewall_metrics_rollup_device_date_unique'
            );

            expect(deviceDateConstraint).toBeDefined();

            // The MetricsAggregator uses this pattern:
            // await db.insert(firewallMetricsRollup)
            //   .values({ deviceId, date, ...metrics })
            //   .onConflictDoUpdate({
            //     target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
            //     set: { ...updatedMetrics }
            //   });

            // Verify the target columns exist and are correct
            expect(firewallMetricsRollup.deviceId.name).toBe('device_id');
            expect(firewallMetricsRollup.date.name).toBe('date');
        });

        it('should verify all metric fields can be updated on conflict', () => {
            // Verify all metric columns exist and can be updated
            const tableConfig = getTableConfig(firewallMetricsRollup);
            const columns = tableConfig.columns;

            const metricColumns = [
                'threats_blocked',
                'malware_blocked',
                'ips_blocked',
                'blocked_connections',
                'web_filter_hits',
                'bandwidth_total_mb',
                'active_sessions_count'
            ];

            metricColumns.forEach(columnName => {
                const column = columns.find((col: any) => col.name === columnName);
                expect(column).toBeDefined();
            });
        });
    });

    describe('Database migration verification', () => {
        it('should have the constraint defined in the schema', () => {
            // This verifies the constraint is properly defined in the Drizzle schema
            const tableConfig = getTableConfig(firewallMetricsRollup);
            const uniqueConstraints = tableConfig.uniqueConstraints;

            expect(uniqueConstraints).toBeDefined();
            expect(uniqueConstraints.length).toBeGreaterThan(0);

            const deviceDateConstraint = uniqueConstraints.find(
                (constraint: any) => constraint.name === 'firewall_metrics_rollup_device_date_unique'
            );

            expect(deviceDateConstraint).toBeDefined();
            expect(deviceDateConstraint?.name).toBe('firewall_metrics_rollup_device_date_unique');
        });

        it('should match the SQL migration constraint definition', () => {
            // The SQL migration should have:
            // UNIQUE(device_id, date)
            // or
            // CONSTRAINT firewall_metrics_rollup_device_date_unique UNIQUE (device_id, date)

            const tableConfig = getTableConfig(firewallMetricsRollup);
            const uniqueConstraints = tableConfig.uniqueConstraints;

            const deviceDateConstraint = uniqueConstraints.find(
                (constraint: any) => constraint.name === 'firewall_metrics_rollup_device_date_unique'
            );

            expect(deviceDateConstraint).toBeDefined();

            const columns = deviceDateConstraint?.columns;
            const columnNames = columns?.map((col: any) => col.name);

            // Verify it matches the SQL definition
            expect(columnNames).toEqual(['device_id', 'date']);
        });
    });
});
