// Compliance Service
// Manages compliance frameworks, controls, and assessments

import {
  ComplianceFramework,
  ComplianceControl,
  _HybridComplianceControl,
  ComplianceScore,
  ComplianceScoreHistory,
  ComplianceTrend,
  ComplianceReport,
  ComplianceRecommendation,
  AutomatedCheck,
  AutomatedComplianceStatus,
  ManualComplianceStatus,
  ComplianceStatus,
  ControlType,
  ApiResponse
} from '@/types';

import {
  AVAILABLE_FRAMEWORKS,
  getFrameworkById,
  getAllFrameworks,
  initializeFrameworkForTenant,
  calculateFrameworkCompleteness,
  calculateWeightedScore,
  getControlsByType,
  getPendingControls,
  getHighPriorityControls
} from '@/lib/compliance-frameworks';

// Mock data for development
const MOCK_FRAMEWORKS: ComplianceFramework[] = [];
const MOCK_CONTROLS: _HybridComplianceControl[] = [];
const MOCK_SCORES: ComplianceScore[] = [];

export class ComplianceService {
  // Framework Management
  async getAvailableFrameworks(): Promise<ApiResponse<typeof AVAILABLE_FRAMEWORKS>> {
    try {
      return {
        success: true,
        data: AVAILABLE_FRAMEWORKS
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'FRAMEWORKS_FETCH_ERROR',
          message: 'Failed to fetch available frameworks'
        }
      };
    }
  }

  // Legacy method name for existing API routes
  async getFrameworks(tenantId: string): Promise<ApiResponse<ComplianceFramework[]>> {
    return this.getTenantFrameworks(tenantId);
  }

  // Legacy method name for existing API routes  
  async getComplianceDashboardData(tenantId: string) {
    return this.getComplianceDashboard(tenantId);
  }

  async getTenantFrameworks(tenantId: string): Promise<ApiResponse<ComplianceFramework[]>> {
    try {
      // In a real implementation, this would query the database
      const tenantFrameworks = MOCK_FRAMEWORKS.filter(f => f.tenant_id === tenantId);

      // If no frameworks exist, return empty array
      if (tenantFrameworks.length === 0) {
        return {
          success: true,
          data: []
        };
      }

      return {
        success: true,
        data: tenantFrameworks
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'TENANT_FRAMEWORKS_ERROR',
          message: 'Failed to fetch tenant frameworks'
        }
      };
    }
  }

  async enableFramework(tenantId: string, frameworkKey: string): Promise<ApiResponse<ComplianceFramework>> {
    try {
      const frameworkInit = initializeFrameworkForTenant(frameworkKey, tenantId);
      if (!frameworkInit) {
        return {
          success: false,
          error: {
            code: 'FRAMEWORK_NOT_FOUND',
            message: 'Framework not found'
          }
        };
      }

      const { framework, controls } = frameworkInit;

      // Add framework to mock data
      MOCK_FRAMEWORKS.push(framework);

      // Add controls to mock data
      const frameworkControls: _HybridComplianceControl[] = controls.map(control => ({
        ...control,
        id: `${framework.id}-${control.control_id}`,
        framework_id: framework.id,
        created_at: new Date(),
        updated_at: new Date()
      }));

      MOCK_CONTROLS.push(...frameworkControls);

      return {
        success: true,
        data: framework
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'FRAMEWORK_ENABLE_ERROR',
          message: 'Failed to enable framework'
        }
      };
    }
  }

  async disableFramework(tenantId: string, frameworkId: string): Promise<ApiResponse<boolean>> {
    try {
      const frameworkIndex = MOCK_FRAMEWORKS.findIndex(
        f => f.id === frameworkId && f.tenant_id === tenantId
      );

      if (frameworkIndex === -1) {
        return {
          success: false,
          error: {
            code: 'FRAMEWORK_NOT_FOUND',
            message: 'Framework not found'
          }
        };
      }

      // Remove framework and its controls
      MOCK_FRAMEWORKS.splice(frameworkIndex, 1);

      const controlIndices = MOCK_CONTROLS
        .map((control, index) => control.framework_id === frameworkId ? index : -1)
        .filter(index => index !== -1)
        .reverse(); // Remove from end to avoid index shifting

      controlIndices.forEach(index => MOCK_CONTROLS.splice(index, 1));

      return {
        success: true,
        data: true
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'FRAMEWORK_DISABLE_ERROR',
          message: 'Failed to disable framework'
        }
      };
    }
  }

  // Control Management
  async getFrameworkControls(tenantId: string, frameworkId: string): Promise<ApiResponse<_HybridComplianceControl[]>> {
    try {
      const controls = MOCK_CONTROLS.filter(
        c => c.framework_id === frameworkId
      );

      // If no controls exist, initialize with default controls
      if (controls.length === 0) {
        const framework = MOCK_FRAMEWORKS.find(f => f.id === frameworkId && f.tenant_id === tenantId);
        if (framework) {
          // Extract framework key from ID
          const frameworkKey = framework.id.split('-')[1]; // e.g., 'hipaa' from 'framework-hipaa-2024-tenant123'
          const frameworkDef = getFrameworkById(frameworkKey);

          if (frameworkDef) {
            const defaultControls: _HybridComplianceControl[] = frameworkDef.controls.map(control => ({
              ...control,
              id: `${frameworkId}-${control.control_id}`,
              framework_id: frameworkId,
              created_at: new Date(),
              updated_at: new Date()
            }));

            MOCK_CONTROLS.push(...defaultControls);
            return {
              success: true,
              data: defaultControls
            };
          }
        }
      }

      return {
        success: true,
        data: controls
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'CONTROLS_FETCH_ERROR',
          message: 'Failed to fetch framework controls'
        }
      };
    }
  }

  async updateControlStatus(
    tenantId: string,
    controlId: string,
    status: ComplianceStatus,
    notes?: string
  ): Promise<ApiResponse<_HybridComplianceControl>> {
    try {
      const controlIndex = MOCK_CONTROLS.findIndex(c => c.id === controlId);

      if (controlIndex === -1) {
        return {
          success: false,
          error: {
            code: 'CONTROL_NOT_FOUND',
            message: 'Control not found'
          }
        };
      }

      MOCK_CONTROLS[controlIndex] = {
        ...MOCK_CONTROLS[controlIndex],
        status,
        overall_status: status,
        last_reviewed: new Date(),
        updated_at: new Date()
      };

      return {
        success: true,
        data: MOCK_CONTROLS[controlIndex]
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'CONTROL_UPDATE_ERROR',
          message: 'Failed to update control status'
        }
      };
    }
  }

  // Automated Assessments
  async runAutomatedAssessment(tenantId: string, frameworkId: string): Promise<ApiResponse<ComplianceScore>> {
    try {
      const controls = MOCK_CONTROLS.filter(c => c.framework_id === frameworkId);

      if (controls.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_CONTROLS_FOUND',
            message: 'No controls found for framework'
          }
        };
      }

      // Simulate automated checks
      const automatedControls = controls.filter(c =>
        c.control_type === ControlType.AUTOMATED || c.control_type === ControlType.HYBRID
      );

      // Update automated check results (simulation)
      automatedControls.forEach(control => {
        control.automated_checks.forEach(check => {
          // Simulate check execution
          check.status = Math.random() > 0.3 ? AutomatedComplianceStatus.PASS : AutomatedComplianceStatus.FAIL;
          check.confidence_score = Math.floor(Math.random() * 30) + 70; // 70-100
          check.last_checked = new Date();

          if (check.status === AutomatedComplianceStatus.PASS) {
            check.actual_result = check.expected_result;
          } else {
            check.actual_result = { ...check.expected_result, status: 'failed' };
          }
        });

        // Update control status based on automated checks
        const passedChecks = control.automated_checks.filter(c => c.status === AutomatedComplianceStatus.PASS).length;
        const totalChecks = control.automated_checks.length;

        if (totalChecks > 0) {
          control.automated_status = passedChecks === totalChecks ?
            AutomatedComplianceStatus.PASS :
            AutomatedComplianceStatus.FAIL;

          control.last_automated_assessment = new Date();

          // Update overall status for automated controls
          if (control.control_type === ControlType.AUTOMATED) {
            control.overall_status = control.automated_status === AutomatedComplianceStatus.PASS ?
              ComplianceStatus.COMPLETED :
              ComplianceStatus.NON_COMPLIANT;
          }
        }
      });

      // Calculate compliance score
      const score = this.calculateComplianceScore(frameworkId, tenantId, controls);
      MOCK_SCORES.push(score);

      return {
        success: true,
        data: score
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'ASSESSMENT_ERROR',
          message: 'Failed to run automated assessment'
        }
      };
    }
  }

  // Compliance Scoring
  async getComplianceScore(tenantId: string, frameworkId: string): Promise<ApiResponse<ComplianceScore>> {
    try {
      const existingScore = MOCK_SCORES.find(s => s.framework_id === frameworkId && s.tenant_id === tenantId);

      if (existingScore) {
        return {
          success: true,
          data: existingScore
        };
      }

      // Calculate new score
      const controls = MOCK_CONTROLS.filter(c => c.framework_id === frameworkId);
      const score = this.calculateComplianceScore(frameworkId, tenantId, controls);
      MOCK_SCORES.push(score);

      return {
        success: true,
        data: score
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'SCORE_CALCULATION_ERROR',
          message: 'Failed to calculate compliance score'
        }
      };
    }
  }

  // Recommendations
  async getComplianceRecommendations(tenantId: string, frameworkId: string): Promise<ApiResponse<ComplianceRecommendation[]>> {
    try {
      const controls = MOCK_CONTROLS.filter(c => c.framework_id === frameworkId);
      const recommendations: ComplianceRecommendation[] = [];

      // Generate recommendations based on control status
      const pendingControls = getPendingControls(controls);
      const highPriorityControls = getHighPriorityControls(controls);

      // High priority pending controls
      highPriorityControls
        .filter(control => control.overall_status !== ComplianceStatus.COMPLETED)
        .slice(0, 5)
        .forEach(control => {
          recommendations.push({
            id: `rec-${control.id}`,
            control_id: control.id,
            priority: control.weight >= 95 ? 'critical' : 'high',
            recommendation_type: 'gap_closure',
            title: `Complete ${control.title}`,
            description: `This high-priority control (weight: ${control.weight}) requires immediate attention to improve compliance score.`,
            estimated_effort: control.control_type === ControlType.AUTOMATED ? 'low' : 'medium',
            potential_impact: control.weight,
            confidence_in_recommendation: 95,
            created_at: new Date()
          });
        });

      // Automation opportunities
      controls
        .filter(control =>
          control.control_type === ControlType.MANUAL &&
          control.automated_checks.length === 0
        )
        .slice(0, 3)
        .forEach(control => {
          recommendations.push({
            id: `rec-auto-${control.id}`,
            control_id: control.id,
            priority: 'medium',
            recommendation_type: 'automation_opportunity',
            title: `Automate ${control.title}`,
            description: `This control could benefit from automated monitoring and assessment.`,
            estimated_effort: 'high',
            potential_impact: 25,
            confidence_in_recommendation: 80,
            created_at: new Date()
          });
        });

      return {
        success: true,
        data: recommendations
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'RECOMMENDATIONS_ERROR',
          message: 'Failed to generate recommendations'
        }
      };
    }
  }

  // Dashboard Data
  async getComplianceDashboard(tenantId: string): Promise<ApiResponse<{
    frameworks: ComplianceFramework[];
    scores: ComplianceScore[];
    recommendations: ComplianceRecommendation[];
    summary: {
      total_frameworks: number;
      average_score: number;
      pending_controls: number;
      critical_gaps: number;
    };
  }>> {
    try {
      const frameworks = MOCK_FRAMEWORKS.filter(f => f.tenant_id === tenantId);
      const scores = MOCK_SCORES.filter(s => s.tenant_id === tenantId);

      // Get recommendations for all frameworks
      const allRecommendations: ComplianceRecommendation[] = [];
      for (const framework of frameworks) {
        const frameworkRecs = await this.getComplianceRecommendations(tenantId, framework.id);
        if (frameworkRecs.success && frameworkRecs.data) {
          allRecommendations.push(...frameworkRecs.data);
        }
      }

      // Calculate summary
      const allControls = MOCK_CONTROLS.filter(c =>
        frameworks.some(f => f.id === c.framework_id)
      );

      const summary = {
        total_frameworks: frameworks.length,
        average_score: scores.length > 0 ?
          Math.round(scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length) : 0,
        pending_controls: getPendingControls(allControls).length,
        critical_gaps: allRecommendations.filter(r => r.priority === 'critical').length
      };

      return {
        success: true,
        data: {
          frameworks,
          scores,
          recommendations: allRecommendations.slice(0, 10), // Top 10 recommendations
          summary
        }
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'DASHBOARD_ERROR',
          message: 'Failed to fetch compliance dashboard data'
        }
      };
    }
  }

  // Private helper methods
  private calculateComplianceScore(frameworkId: string, tenantId: string, controls: _HybridComplianceControl[]): ComplianceScore {
    const totalControls = controls.length;
    const automatedControls = getControlsByType(controls, ControlType.AUTOMATED);
    const aiAssistedControls = getControlsByType(controls, ControlType.AI_ASSISTED);
    const manualControls = getControlsByType(controls, ControlType.MANUAL);
    const hybridControls = getControlsByType(controls, ControlType.HYBRID);

    const passedControls = controls.filter(c => c.overall_status === ComplianceStatus.COMPLETED);
    const failedControls = controls.filter(c => c.overall_status === ComplianceStatus.NON_COMPLIANT);
    const pendingControls = controls.filter(c =>
      c.overall_status === ComplianceStatus.NOT_STARTED ||
      c.overall_status === ComplianceStatus.IN_PROGRESS
    );

    const overallScore = calculateFrameworkCompleteness(controls);
    const weightedScore = calculateWeightedScore(controls);

    // Calculate type-specific scores
    const automatedScore = automatedControls.length > 0 ?
      calculateFrameworkCompleteness(automatedControls) : 0;
    const aiAssistedScore = aiAssistedControls.length > 0 ?
      calculateFrameworkCompleteness(aiAssistedControls) : 0;
    const manualScore = manualControls.length > 0 ?
      calculateFrameworkCompleteness(manualControls) : 0;

    // Calculate confidence score based on control types and assessment methods
    const automatedWeight = automatedControls.length / totalControls;
    const aiAssistedWeight = aiAssistedControls.length / totalControls;
    const manualWeight = manualControls.length / totalControls;

    const confidenceScore = Math.round(
      (automatedWeight * 95) + // High confidence in automated checks
      (aiAssistedWeight * 80) + // Medium-high confidence in AI-assisted
      (manualWeight * 70)       // Lower confidence in manual reviews
    );

    const totalWeight = controls.reduce((sum, control) => sum + control.weight, 0);

    return {
      framework_id: frameworkId,
      tenant_id: tenantId,
      overall_score: overallScore,
      weighted_score: weightedScore,
      automated_score: automatedScore,
      ai_assisted_score: aiAssistedScore,
      manual_score: manualScore,
      confidence_score: confidenceScore,
      total_controls: totalControls,
      automated_controls: automatedControls.length,
      ai_assisted_controls: aiAssistedControls.length,
      manual_controls: manualControls.length,
      hybrid_controls: hybridControls.length,
      passed_controls: passedControls.length,
      failed_controls: failedControls.length,
      pending_controls: pendingControls.length,
      total_weight: totalWeight,
      last_calculated: new Date(),
      calculation_metadata: {
        automated_weight: automatedWeight,
        ai_assisted_weight: aiAssistedWeight,
        manual_weight: manualWeight,
        confidence_adjustments: {}
      }
    };
  }
}

export const complianceService = new ComplianceService();