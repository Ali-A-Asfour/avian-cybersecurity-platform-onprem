'use client';

import { useState } from 'react';
import { DemoStateManager } from '@/lib/demo-state';
import { api } from '@/lib/api-client';

/**
 * Debug component to test escalation workflow
 */
export function EscalationTest() {
    const [logs, setLogs] = useState<string[]>([]);
    const [alertStates, setAlertStates] = useState<any>(null);
    const [incidentStates, setIncidentStates] = useState<any>(null);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const refreshStates = () => {
        const states = DemoStateManager.getAllStates();
        setAlertStates(Array.from(states.alerts.entries()));
        setIncidentStates(Array.from(states.incidents.entries()));
        addLog('States refreshed');
    };

    const testInvestigate = async () => {
        try {
            addLog('Testing investigate API...');
            const response = await api.post('/api/alerts-incidents/demo/alerts/alert-001/investigate', {});
            const result = await response.json();
            addLog(`Investigate result: ${JSON.stringify(result)}`);
            refreshStates();
        } catch (error) {
            addLog(`Investigate error: ${error}`);
        }
    };

    const testEscalate = async () => {
        try {
            addLog('Testing escalate API...');
            const response = await api.post('/api/alerts-incidents/demo/alerts/alert-001/escalate', {
                incidentTitle: 'Debug Test Incident',
                incidentDescription: 'Testing escalation from debug component'
            });
            const result = await response.json();
            addLog(`Escalate result: ${JSON.stringify(result)}`);
            refreshStates();
        } catch (error) {
            addLog(`Escalate error: ${error}`);
        }
    };

    const testMyAlerts = async () => {
        try {
            addLog('Testing My Alerts API...');
            const response = await api.get('/api/alerts-incidents/demo/alerts?queue=my');
            const result = await response.json();
            addLog(`My Alerts count: ${result.data?.alerts?.length || 0}`);
            addLog(`My Alerts: ${JSON.stringify(result.data?.alerts?.map((a: any) => a.id) || [])}`);
        } catch (error) {
            addLog(`My Alerts error: ${error}`);
        }
    };

    const testMyIncidents = async () => {
        try {
            addLog('Testing My Incidents API...');
            const response = await api.get('/api/alerts-incidents/demo/incidents?queue=my');
            const result = await response.json();
            addLog(`My Incidents count: ${result.data?.incidents?.length || 0}`);
            addLog(`My Incidents: ${JSON.stringify(result.data?.incidents?.map((i: any) => i.id) || [])}`);
        } catch (error) {
            addLog(`My Incidents error: ${error}`);
        }
    };

    const resetState = () => {
        DemoStateManager.reset();
        addLog('Demo state reset');
        refreshStates();
    };

    return (
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg max-w-4xl mx-auto">
            <h2 className="text-xl font-bold mb-4">Escalation Workflow Debug</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <h3 className="font-semibold mb-2">Test Actions</h3>
                    <div className="space-y-2">
                        <button
                            onClick={testInvestigate}
                            className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            1. Investigate Alert-001
                        </button>
                        <button
                            onClick={testEscalate}
                            className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                            2. Escalate Alert-001
                        </button>
                        <button
                            onClick={testMyAlerts}
                            className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                            3. Check My Alerts
                        </button>
                        <button
                            onClick={testMyIncidents}
                            className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                            4. Check My Incidents
                        </button>
                        <button
                            onClick={refreshStates}
                            className="w-full px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                            Refresh States
                        </button>
                        <button
                            onClick={resetState}
                            className="w-full px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                        >
                            Reset State
                        </button>
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold mb-2">Current States</h3>
                    <div className="text-sm space-y-2">
                        <div>
                            <strong>Alert States:</strong>
                            <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 overflow-auto max-h-32">
                                {JSON.stringify(alertStates, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <strong>Incident States:</strong>
                            <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 overflow-auto max-h-32">
                                {JSON.stringify(incidentStates, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="font-semibold mb-2">Logs</h3>
                <div className="bg-gray-900 dark:bg-gray-800 text-gray-100 dark:text-gray-200 p-4 rounded font-mono text-sm max-h-64 overflow-y-auto border border-gray-700">
                    {logs.map((log, index) => (
                        <div key={index} className="py-1 border-b border-gray-700 last:border-b-0">{log}</div>
                    ))}
                    {logs.length === 0 && <div className="text-gray-400">No logs yet. Click buttons above to test.</div>}
                </div>
            </div>
        </div>
    );
}