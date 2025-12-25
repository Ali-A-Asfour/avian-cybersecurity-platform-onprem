/**
 * Badge demonstration component for testing solid backgrounds and white text
 * This component shows badges in various contexts to verify readability
 * Requirements: 4.2, 4.3, 4.5 - Demonstrate solid backgrounds and white text
 */

import React from 'react';
import { SeverityBadge } from '../SeverityBadge';
import { StatusBadge } from '../StatusBadge';

export function BadgeDemo() {
    return (
        <div className="p-8 space-y-8 bg-gray-900 text-white">
            <h1 className="text-2xl font-bold">Badge System Demonstration</h1>

            {/* Severity Badges */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Severity Badges (Solid Backgrounds)</h2>
                <div className="flex flex-wrap gap-2">
                    <SeverityBadge severity="critical" />
                    <SeverityBadge severity="high" />
                    <SeverityBadge severity="medium" />
                    <SeverityBadge severity="low" />
                    <SeverityBadge severity="info" />
                </div>
            </section>

            {/* Status Badges */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Status Badges (Solid Backgrounds)</h2>
                <div className="flex flex-wrap gap-2">
                    <StatusBadge status="new" />
                    <StatusBadge status="open" />
                    <StatusBadge status="investigating" />
                    <StatusBadge status="in_progress" />
                    <StatusBadge status="awaiting_response" />
                    <StatusBadge status="escalated" />
                    <StatusBadge status="resolved" />
                    <StatusBadge status="closed" />
                    <StatusBadge status="canceled" />
                </div>
            </section>

            {/* Table Context */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Badges in Table Context</h2>
                <table className="w-full border border-gray-700">
                    <thead>
                        <tr className="bg-gray-800">
                            <th className="p-2 text-left">Alert</th>
                            <th className="p-2 text-left">Severity</th>
                            <th className="p-2 text-left">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-t border-gray-700">
                            <td className="p-2">Security Breach Detected</td>
                            <td className="p-2"><SeverityBadge severity="critical" size="sm" /></td>
                            <td className="p-2"><StatusBadge status="investigating" size="sm" /></td>
                        </tr>
                        <tr className="border-t border-gray-700">
                            <td className="p-2">Suspicious Login Activity</td>
                            <td className="p-2"><SeverityBadge severity="high" size="sm" /></td>
                            <td className="p-2"><StatusBadge status="new" size="sm" /></td>
                        </tr>
                        <tr className="border-t border-gray-700">
                            <td className="p-2">System Update Available</td>
                            <td className="p-2"><SeverityBadge severity="low" size="sm" /></td>
                            <td className="p-2"><StatusBadge status="resolved" size="sm" /></td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* Dense List Context */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Badges in Dense List Context</h2>
                <ul className="space-y-1">
                    <li className="flex items-center justify-between p-2 bg-gray-800 rounded">
                        <span>Malware Detection Alert</span>
                        <div className="flex space-x-2">
                            <SeverityBadge severity="critical" size="sm" />
                            <StatusBadge status="escalated" size="sm" />
                        </div>
                    </li>
                    <li className="flex items-center justify-between p-2 bg-gray-800 rounded">
                        <span>Network Intrusion Attempt</span>
                        <div className="flex space-x-2">
                            <SeverityBadge severity="high" size="sm" />
                            <StatusBadge status="investigating" size="sm" />
                        </div>
                    </li>
                    <li className="flex items-center justify-between p-2 bg-gray-800 rounded">
                        <span>Failed Login Attempts</span>
                        <div className="flex space-x-2">
                            <SeverityBadge severity="medium" size="sm" />
                            <StatusBadge status="resolved" size="sm" />
                        </div>
                    </li>
                </ul>
            </section>

            {/* Visual Hierarchy Demonstration */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Visual Hierarchy (Severity vs Status)</h2>
                <div className="space-y-2">
                    <div className="flex items-center space-x-4">
                        <span className="w-32">Critical Alert:</span>
                        <SeverityBadge severity="critical" />
                        <StatusBadge status="new" />
                        <span className="text-sm text-gray-400">(Notice severity badge has higher visual weight)</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="w-32">High Priority:</span>
                        <SeverityBadge severity="high" />
                        <StatusBadge status="investigating" />
                        <span className="text-sm text-gray-400">(Severity: font-semibold, Status: font-normal)</span>
                    </div>
                </div>
            </section>

            {/* Accessibility Note */}
            <section className="bg-gray-800 p-4 rounded">
                <h3 className="text-lg font-semibold mb-2">Accessibility Compliance</h3>
                <ul className="text-sm space-y-1">
                    <li>✅ All badges use solid backgrounds (no gradients or transparency)</li>
                    <li>✅ All badges use white text for maximum contrast</li>
                    <li>✅ All badges meet WCAG AA contrast requirements (4.5:1 minimum)</li>
                    <li>✅ Badges maintain readability in tables and dense lists</li>
                    <li>✅ Visual hierarchy: Severity badges have higher weight than status badges</li>
                </ul>
            </section>
        </div>
    );
}