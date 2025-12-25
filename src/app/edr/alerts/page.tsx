import { AlertsDashboard } from '@/components/edr/AlertsDashboard';

export default function AlertsPage() {
    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Security Alerts
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Monitor and manage security threats detected by Microsoft Defender
                </p>
            </div>
            <AlertsDashboard />
        </div>
    );
}
