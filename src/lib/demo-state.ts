/**
 * Simple in-memory state management for demo mode
 * 
 * This allows the demo to simulate real state changes like:
 * - Moving alerts from "All Alerts" to "My Alerts" when investigated
 * - Tracking which alerts are assigned to which users
 */

interface DemoAlertState {
    id: string;
    status: 'open' | 'assigned' | 'investigating' | 'resolved' | 'escalated';
    assignedTo: string | null;
    assignedAt: string | null;
    escalatedAt: string | null;
    incidentId: string | null;
}

interface DemoIncidentState {
    id: string;
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
    ownerId: string;
    createdAt: string;
    escalatedFromAlertId: string;
}

// Use globalThis to persist state across hot reloads in development
declare global {
    var __demoAlertStates: Map<string, DemoAlertState> | undefined;
    var __demoIncidentStates: Map<string, DemoIncidentState> | undefined;
    var __demoIncidentCounter: number | undefined;
}

// In-memory stores for demo state - persistent across hot reloads
const demoAlertStates = globalThis.__demoAlertStates ?? new Map<string, DemoAlertState>();
if (!globalThis.__demoAlertStates) {
    globalThis.__demoAlertStates = demoAlertStates;
}

const demoIncidentStates = globalThis.__demoIncidentStates ?? new Map<string, DemoIncidentState>();
if (!globalThis.__demoIncidentStates) {
    globalThis.__demoIncidentStates = demoIncidentStates;
}

// Counter for generating incident IDs
let demoIncidentCounter = globalThis.__demoIncidentCounter ?? 1000;
if (!globalThis.__demoIncidentCounter) {
    globalThis.__demoIncidentCounter = demoIncidentCounter;
}

export class DemoStateManager {
    /**
     * Assign an alert to a user (investigate action)
     */
    static assignAlert(alertId: string, userId: string): void {
        demoAlertStates.set(alertId, {
            id: alertId,
            status: 'assigned',
            assignedTo: userId,
            assignedAt: new Date().toISOString(),
            escalatedAt: null,
            incidentId: null
        });
        console.log(`Demo: Assigned alert ${alertId} to ${userId}. Total assigned: ${demoAlertStates.size}`);
    }

    /**
     * Escalate an alert to a security incident
     */
    static escalateAlert(alertId: string, userId: string, incidentTitle?: string, incidentDescription?: string): string {
        // Generate new incident ID
        const incidentId = `incident-demo-${++demoIncidentCounter}`;
        globalThis.__demoIncidentCounter = demoIncidentCounter;

        // Get alert state to determine severity and details
        const alertState = demoAlertStates.get(alertId);

        // Create incident state
        const incident: DemoIncidentState = {
            id: incidentId,
            title: incidentTitle || `Security Incident from Alert ${alertId}`,
            description: incidentDescription || `Escalated from alert ${alertId} for further investigation`,
            severity: 'high', // Default severity for escalated alerts
            status: 'open',
            ownerId: userId,
            createdAt: new Date().toISOString(),
            escalatedFromAlertId: alertId
        };

        demoIncidentStates.set(incidentId, incident);

        // Update alert state to escalated
        demoAlertStates.set(alertId, {
            id: alertId,
            status: 'escalated',
            assignedTo: alertState?.assignedTo || userId,
            assignedAt: alertState?.assignedAt || new Date().toISOString(),
            escalatedAt: new Date().toISOString(),
            incidentId: incidentId
        });

        console.log(`Demo: Escalated alert ${alertId} to incident ${incidentId}. Total incidents: ${demoIncidentStates.size}`);
        return incidentId;
    }

    /**
     * Get the current state of an alert
     */
    static getAlertState(alertId: string): DemoAlertState | null {
        return demoAlertStates.get(alertId) || null;
    }

    /**
     * Check if an alert is assigned to a specific user
     */
    static isAlertAssignedTo(alertId: string, userId: string): boolean {
        const state = demoAlertStates.get(alertId);
        return state?.assignedTo === userId && state?.status === 'assigned';
    }

    /**
     * Get all alerts assigned to a user
     */
    static getAlertsAssignedTo(userId: string): string[] {
        const assignedAlerts: string[] = [];
        for (const [alertId, state] of demoAlertStates.entries()) {
            if (state.assignedTo === userId && state.status === 'assigned') {
                assignedAlerts.push(alertId);
            }
        }
        console.log(`Demo: Found ${assignedAlerts.length} alerts assigned to ${userId}:`, assignedAlerts);
        return assignedAlerts;
    }

    /**
     * Check if an alert should be hidden from "All Alerts" (because it's assigned or escalated)
     */
    static isAlertAssigned(alertId: string): boolean {
        const state = demoAlertStates.get(alertId);
        return state?.status === 'assigned' || state?.status === 'escalated' || false;
    }

    /**
     * Get all incidents owned by a user
     */
    static getIncidentsOwnedBy(userId: string): DemoIncidentState[] {
        const ownedIncidents: DemoIncidentState[] = [];
        for (const [incidentId, state] of demoIncidentStates.entries()) {
            if (state.ownerId === userId) {
                ownedIncidents.push(state);
            }
        }
        console.log(`Demo: Found ${ownedIncidents.length} incidents owned by ${userId}`);
        return ownedIncidents;
    }

    /**
     * Get all incidents (for All Security Incidents tab)
     */
    static getAllIncidents(): DemoIncidentState[] {
        return Array.from(demoIncidentStates.values());
    }

    /**
     * Get incident by ID
     */
    static getIncident(incidentId: string): DemoIncidentState | null {
        return demoIncidentStates.get(incidentId) || null;
    }

    /**
     * Reset demo state (useful for testing)
     */
    static reset(): void {
        demoAlertStates.clear();
        demoIncidentStates.clear();
        demoIncidentCounter = 1000;
        globalThis.__demoIncidentCounter = demoIncidentCounter;
        console.log('Demo: Reset all alert and incident states');
    }

    /**
     * Debug: Get all current states
     */
    static getAllStates(): { alerts: Map<string, DemoAlertState>, incidents: Map<string, DemoIncidentState> } {
        return {
            alerts: new Map(demoAlertStates),
            incidents: new Map(demoIncidentStates)
        };
    }
}