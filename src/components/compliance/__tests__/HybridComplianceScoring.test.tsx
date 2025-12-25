import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { HybridComplianceScoring } from '../HybridComplianceScoring';

// Mock fetch
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('HybridComplianceScoring', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => 
      new Promise(() => {}) // Never resolves to keep loading state
    );

    render(<HybridComplianceScoring tenantId="test-tenant" />);
    
    expect(screen.getByText('Hybrid Compliance Scoring')).toBeInTheDocument();
  });

  it('displays compliance score data when loaded', async () => {
    const mockScoreData = {
      success: true,
      data: {
        framework_id: 'test-framework',
        tenant_id: 'test-tenant',
        overall_score: 85,
        weighted_score: 82,
        automated_score: 90,
        ai_assisted_score: 80,
        manual_score: 85,
        confidence_score: 88,
        total_controls: 10,
        automated_controls: 4,
        ai_assisted_controls: 3,
        manual_controls: 2,
        hybrid_controls: 1,
        passed_controls: 7,
        failed_controls: 1,
        pending_controls: 2,
        total_weight: 850,
        last_calculated: new Date(),
        calculation_metadata: {
          automated_weight: 0.4,
          ai_assisted_weight: 0.3,
          manual_weight: 0.3,
          confidence_adjustments: {}
        }
      }
    };

    const mockTrendsData = {
      success: true,
      data: {
        framework_id: 'test-framework',
        tenant_id: 'test-tenant',
        period: 'weekly' as const,
        trend_data: [],
        accuracy_metrics: {
          prediction_accuracy: 85,
          confidence_reliability: 90,
          trend_stability: 88
        }
      }
    };

    const mockRecommendations = {
      success: true,
      data: []
    };

    const mockHistory = {
      success: true,
      data: []
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockScoreData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrendsData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRecommendations,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      } as Response);

    render(<HybridComplianceScoring tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Overall Score')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument(); // Automated score
      expect(screen.getByText('80%')).toBeInTheDocument(); // AI-assisted score
      expect(screen.getByText('85%')).toBeInTheDocument(); // Manual score
    });
  });

  it('calls correct API endpoints on load', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true, data: {} }),
    } as Response;

    mockFetch.mockResolvedValue(mockResponse);

    render(<HybridComplianceScoring tenantId="test-tenant" frameworkId="test-framework" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/compliance/hybrid-score?tenant_id=test-tenant&framework_id=test-framework')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/compliance/trends?tenant_id=test-tenant&period=weekly&framework_id=test-framework')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/compliance/recommendations?tenant_id=test-tenant&framework_id=test-framework')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/compliance/score-history?tenant_id=test-tenant&limit=5&framework_id=test-framework')
      );
    });
  });
});