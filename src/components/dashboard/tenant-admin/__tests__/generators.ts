import fc from 'fast-check';
import { ActivityItem } from '@/types/dashboard';

/**
 * Comprehensive test data generators for dashboard property-based tests
 * 
 * These generators create realistic test data that matches the actual
 * data structures used in the dashboard components.
 */

// Basic data type generators
export const positiveIntegerGenerator = fc.nat(999999);
export const percentageGenerator = fc.integer({ min: 0, max: 100 });
export const timestampGenerator = fc.integer({ min: 0, max: Date.now() }).map(t => new Date(t).toISOString());
export const dateStringGenerator = fc.date({ min: new Date('2020-01-01'), max: new Date() })
    .map(d => d.toISOString().split('T')[0]);

// String generators with realistic constraints
export const serviceNameGenerator = fc.constantFrom('microsoft', 'sonicwall', 'defender');
export const statusGenerator = fc.constantFrom('healthy', 'warning', 'error');
export const activityTypeGenerator = fc.constantFrom('alert', 'compliance', 'device', 'ticket', 'integration');
export const trendGenerator = fc.constantFrom('up', 'down', 'stable');

// KPI data generators
export const kpiDataGenerator = fc.record({
    criticalAlerts: positiveIntegerGenerator,
    securityTicketsOpen: positiveIntegerGenerator,
    helpdeskTicketsOpen: positiveIntegerGenerator,
    complianceScore: percentageGenerator
});

// Alerts trend data generator
export const alertsTrendDataGenerator = fc.array(
    fc.record({
        date: dateStringGenerator,
        alertCount: positiveIntegerGenerator
    }),
    { minLength: 1, maxLength: 30 } // 1 to 30 days of data
).map(data => {
    // Remove duplicates by date and sort chronologically
    const uniqueData = data.reduce((acc, item) => {
        if (!acc.find(existing => existing.date === item.date)) {
            acc.push(item);
        }
        return acc;
    }, [] as typeof data);

    return uniqueData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
});

// Device coverage data generator
export const deviceCoverageDataGenerator = fc.record({
    protected: positiveIntegerGenerator,
    missingAgent: positiveIntegerGenerator,
    withAlerts: positiveIntegerGenerator
}).map(data => ({
    ...data,
    total: data.protected + data.missingAgent + data.withAlerts
}));

// Ticket breakdown data generator
export const ticketBreakdownDataGenerator = fc.record({
    securityTickets: fc.record({
        created: positiveIntegerGenerator,
        resolved: positiveIntegerGenerator
    }),
    helpdeskTickets: fc.record({
        created: positiveIntegerGenerator,
        resolved: positiveIntegerGenerator
    })
});

// Integration health data generator
export const integrationHealthDataGenerator = fc.array(
    fc.record({
        serviceName: serviceNameGenerator,
        status: statusGenerator,
        lastSync: timestampGenerator
    }),
    { minLength: 1, maxLength: 10 }
);

// Activity item generator
export const activityItemGenerator = fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }).map(s => `activity-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`),
    timestamp: timestampGenerator,
    description: fc.string({ minLength: 10, maxLength: 100 }).map(s => `Activity: ${s.replace(/[^a-zA-Z0-9 ]/g, 'x')}`),
    type: activityTypeGenerator,
    icon: fc.string({ minLength: 1, maxLength: 5 }).map(s => `icon-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`)
});

// Recent activity data generator (ensures chronological order)
export const recentActivityDataGenerator = fc.array(
    activityItemGenerator,
    { minLength: 0, maxLength: 20 }
).map(activities =>
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
);

// Complete dashboard data generator
export const dashboardDataGenerator = fc.record({
    kpis: kpiDataGenerator,
    alertsTrend: alertsTrendDataGenerator,
    deviceCoverage: deviceCoverageDataGenerator,
    ticketBreakdown: ticketBreakdownDataGenerator,
    integrations: integrationHealthDataGenerator,
    recentActivity: recentActivityDataGenerator,
    lastUpdated: timestampGenerator
});

// Loading state generator
export const loadingStateGenerator = fc.record({
    kpis: fc.boolean(),
    alertsTrend: fc.boolean(),
    deviceCoverage: fc.boolean(),
    ticketBreakdown: fc.boolean(),
    integrations: fc.boolean(),
    recentActivity: fc.boolean()
});

// Error generator
export const errorGenerator = fc.record({
    component: fc.string({ minLength: 5, maxLength: 20 }),
    message: fc.string({ minLength: 10, maxLength: 100 }),
    timestamp: timestampGenerator,
    retryable: fc.boolean()
});

// Navigation parameter generators
export const kpiCardTypeGenerator = fc.constantFrom('criticalAlerts', 'securityTicketsOpen', 'helpdeskTicketsOpen', 'complianceScore');
export const deviceSegmentGenerator = fc.constantFrom('protected', 'missing-agent', 'with-alerts');
export const ticketTypeGenerator = fc.constantFrom('security', 'helpdesk');

// Chart interaction generators
export const chartClickDataGenerator = fc.record({
    activeLabel: dateStringGenerator,
    activePayload: fc.array(fc.record({
        value: positiveIntegerGenerator,
        payload: fc.record({
            date: dateStringGenerator,
            alertCount: positiveIntegerGenerator
        })
    }))
});

// Responsive design generators
export const viewportSizeGenerator = fc.record({
    width: fc.integer({ min: 1280, max: 2560 }), // Desktop and larger
    height: fc.integer({ min: 720, max: 1440 })
});

// Auto-refresh configuration generator
export const autoRefreshConfigGenerator = fc.record({
    interval: fc.integer({ min: 1000, max: 300000 }), // 1 second to 5 minutes
    enabled: fc.boolean(),
    pauseOnModal: fc.boolean()
});

// Accessibility generators
export const keyboardEventGenerator = fc.record({
    key: fc.constantFrom('Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape'),
    shiftKey: fc.boolean(),
    ctrlKey: fc.boolean(),
    altKey: fc.boolean()
});

// Performance test generators
export const largeDatasetGenerator = fc.record({
    alertsTrend: fc.array(
        fc.record({
            date: dateStringGenerator,
            alertCount: fc.integer({ min: 0, max: 10000 })
        }),
        { minLength: 100, maxLength: 365 } // Up to 1 year of daily data
    ),
    recentActivity: fc.array(
        activityItemGenerator,
        { minLength: 50, maxLength: 1000 }
    )
});

// Edge case generators
export const edgeCaseDataGenerator = fc.record({
    emptyData: fc.record({
        kpis: fc.record({
            criticalAlerts: fc.constantFrom(0),
            securityTicketsOpen: fc.constantFrom(0),
            helpdeskTicketsOpen: fc.constantFrom(0),
            complianceScore: fc.constantFrom(0)
        }),
        alertsTrend: fc.constantFrom([]),
        deviceCoverage: fc.record({
            protected: fc.constantFrom(0),
            missingAgent: fc.constantFrom(0),
            withAlerts: fc.constantFrom(0),
            total: fc.constantFrom(0)
        }),
        recentActivity: fc.constantFrom([])
    }),
    maxValues: fc.record({
        kpis: fc.record({
            criticalAlerts: fc.constantFrom(999999),
            securityTicketsOpen: fc.constantFrom(999999),
            helpdeskTicketsOpen: fc.constantFrom(999999),
            complianceScore: fc.constantFrom(100)
        }),
        deviceCoverage: fc.record({
            protected: fc.constantFrom(999999),
            missingAgent: fc.constantFrom(999999),
            withAlerts: fc.constantFrom(999999),
            total: fc.constantFrom(2999997) // Sum of the above
        })
    })
});

// Helper function to create unique test containers
export const createTestContainer = () => {
    const container = document.createElement('div');
    container.id = `test-container-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    document.body.appendChild(container);
    return container;
};

// Helper function to cleanup test containers
export const cleanupTestContainer = (container: HTMLElement) => {
    if (container.parentNode) {
        container.parentNode.removeChild(container);
    }
};