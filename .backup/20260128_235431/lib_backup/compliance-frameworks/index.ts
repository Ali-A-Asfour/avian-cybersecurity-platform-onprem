// Compliance Frameworks Index
// Centralized access to all compliance frameworks

import { ComplianceFramework, _HybridComplianceControl } from '@/types';
import { HIPAA_FRAMEWORK, getAllHIPAAControls } from './hipaa';
import { PHIPA_FRAMEWORK, getAllPHIPAControls } from './phipa';

export interface ComplianceFrameworkDefinition {
    framework: ComplianceFramework;
    controls: Omit<_HybridComplianceControl, 'id' | 'framework_id' | 'created_at' | 'updated_at'>[];
    description: string;
    applicableRegions: string[];
    industryFocus: string[];
    implementationGuide?: string;
}

export const AVAILABLE_FRAMEWORKS: Record<string, ComplianceFrameworkDefinition> = {
    'hipaa': {
        framework: HIPAA_FRAMEWORK,
        controls: getAllHIPAAControls(),
        description: 'Health Insurance Portability and Accountability Act (HIPAA) Security Rule for protecting electronic protected health information (ePHI) in the United States.',
        applicableRegions: ['United States', 'US Territories'],
        industryFocus: ['Healthcare', 'Health Insurance', 'Healthcare Clearinghouses', 'Business Associates'],
        implementationGuide: 'https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html'
    },
    'phipa': {
        framework: PHIPA_FRAMEWORK,
        controls: getAllPHIPAControls(),
        description: 'Personal Health Information Protection Act (PHIPA) for protecting personal health information in Ontario, Canada.',
        applicableRegions: ['Ontario, Canada'],
        industryFocus: ['Healthcare Providers', 'Health Information Custodians', 'Health Service Providers'],
        implementationGuide: 'https://www.ipc.on.ca/health/'
    }
};

export const getFrameworkById = (frameworkId: string): ComplianceFrameworkDefinition | null => {
    return AVAILABLE_FRAMEWORKS[frameworkId] || null;
};

export const getAllFrameworks = (): ComplianceFrameworkDefinition[] => {
    return Object.values(AVAILABLE_FRAMEWORKS);
};

export const getFrameworksByRegion = (region: string): ComplianceFrameworkDefinition[] => {
    return Object.values(AVAILABLE_FRAMEWORKS).filter(framework =>
        framework.applicableRegions.some(r => r.toLowerCase().includes(region.toLowerCase()))
    );
};

export const getFrameworksByIndustry = (industry: string): ComplianceFrameworkDefinition[] => {
    return Object.values(AVAILABLE_FRAMEWORKS).filter(framework =>
        framework.industryFocus.some(i => i.toLowerCase().includes(industry.toLowerCase()))
    );
};

// Framework initialization helper
export const initializeFrameworkForTenant = (
    frameworkKey: string,
    tenantId: string
): { framework: ComplianceFramework; controls: Omit<_HybridComplianceControl, 'id' | 'framework_id' | 'created_at' | 'updated_at'>[] } | null => {
    const frameworkDef = AVAILABLE_FRAMEWORKS[frameworkKey];
    if (!frameworkDef) return null;

    const framework: ComplianceFramework = {
        ...frameworkDef.framework,
        id: `${frameworkDef.framework.id}-${tenantId}`,
        tenant_id: tenantId,
    };

    return {
        framework,
        controls: frameworkDef.controls
    };
};

// Compliance scoring helpers
export const calculateFrameworkCompleteness = (controls: _HybridComplianceControl[]): number => {
    if (controls.length === 0) return 0;

    const completedControls = controls.filter(control =>
        control.overall_status === 'completed'
    ).length;

    return Math.round((completedControls / controls.length) * 100);
};

export const calculateWeightedScore = (controls: _HybridComplianceControl[]): number => {
    if (controls.length === 0) return 0;

    const totalWeight = controls.reduce((sum, control) => sum + control.weight, 0);
    const weightedScore = controls.reduce((sum, control) => {
        const controlScore = control.overall_status === 'completed' ? control.weight : 0;
        return sum + controlScore;
    }, 0);

    return Math.round((weightedScore / totalWeight) * 100);
};

export const getControlsByType = (controls: _HybridComplianceControl[], controlType: string) => {
    return controls.filter(control => control.control_type === controlType);
};

export const getPendingControls = (controls: _HybridComplianceControl[]) => {
    return controls.filter(control =>
        control.overall_status === 'not_started' ||
        control.overall_status === 'in_progress'
    );
};

export const getHighPriorityControls = (controls: _HybridComplianceControl[]) => {
    return controls
        .filter(control => control.weight >= 90)
        .sort((a, b) => b.weight - a.weight);
};

// Export individual frameworks for direct access
export { HIPAA_FRAMEWORK, getAllHIPAAControls } from './hipaa';
export { PHIPA_FRAMEWORK, getAllPHIPAControls } from './phipa';