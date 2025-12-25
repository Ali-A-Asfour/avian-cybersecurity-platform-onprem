import { ComplianceDashboard } from '@/components/edr/ComplianceDashboard';

export default function CompliancePage() {
    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Device Compliance
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Monitor device compliance with Intune policies and security baselines
                </p>
            </div>
            <ComplianceDashboard />
        </div>
    );
}
