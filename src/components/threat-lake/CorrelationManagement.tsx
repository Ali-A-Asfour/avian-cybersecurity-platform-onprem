'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { api } from '@/lib/api-client';
import {
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Settings,
  TrendingUp,
  Filter,
  Search
} from 'lucide-react';

interface CorrelationRule {
  id: string;
  name: string;
  description?: string;
  rule_logic: {
    conditions: Array<{
      field: string;
      operator: string;
      value: any;
      case_sensitive?: boolean;
    }>;
    operator: 'AND' | 'OR';
    time_window_minutes?: number;
    threshold_count?: number;
    grouping_fields?: string[];
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  time_window_minutes: number;
  threshold_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_triggered?: string;
  trigger_count: number;
}

interface EventCorrelation {
  id: string;
  correlation_rule_id: string;
  correlation_id: string;
  event_ids: string[];
  severity: string;
  confidence_score: number;
  threat_summary?: string;
  recommended_actions: Array<{
    action_type: string;
    description: string;
    priority: number;
    automated: boolean;
    playbook_id?: string;
  }>;
  status: 'new' | 'investigating' | 'confirmed' | 'false_positive' | 'resolved';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

const FIELD_OPTIONS = [
  { value: 'event_category', label: 'Event Category' },
  { value: 'event_type', label: 'Event Type' },
  { value: 'severity', label: 'Severity' },
  { value: 'source_system', label: 'Source System' },
  { value: 'normalized_data.source_ip', label: 'Source IP' },
  { value: 'normalized_data.destination_ip', label: 'Destination IP' },
  { value: 'normalized_data.user', label: 'User' },
  { value: 'normalized_data.process', label: 'Process' },
  { value: 'normalized_data.file_path', label: 'File Path' },
  { value: 'confidence_score', label: 'Confidence Score' }
];

const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'regex', label: 'Regex Match' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' }
];

export default function CorrelationManagement() {
  const [rules, setRules] = useState<CorrelationRule[]>([]);
  const [correlations, setCorrelations] = useState<EventCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<CorrelationRule | null>(null);
  const [selectedCorrelation, setSelectedCorrelation] = useState<EventCorrelation | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    severity: 'medium' as const,
    enabled: true,
    time_window_minutes: 60,
    threshold_count: 1,
    conditions: [{
      field: 'event_category',
      operator: 'equals',
      value: '',
      case_sensitive: false
    }],
    logic_operator: 'AND' as const
  });

  useEffect(() => {
    loadCorrelationRules();
    loadEventCorrelations();
  }, []);

  const loadCorrelationRules = async () => {
    try {
      const response = await api.get('/api/threat-lake/correlation-rules');
      const data = await response.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Failed to load correlation rules:', error);
    }
  };

  const loadEventCorrelations = async () => {
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll use mock data
      setCorrelations([]);
      setLoading(false);
    } catch {
      console.error('Failed to load event correlations:', error);
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    try {
      const ruleData = {
        name: ruleForm.name,
        description: ruleForm.description,
        rule_logic: {
          conditions: ruleForm.conditions,
          operator: ruleForm.logic_operator,
          time_window_minutes: ruleForm.time_window_minutes,
          threshold_count: ruleForm.threshold_count
        },
        severity: ruleForm.severity,
        enabled: ruleForm.enabled,
        time_window_minutes: ruleForm.time_window_minutes,
        threshold_count: ruleForm.threshold_count
      };

      const newRule = await api.post('/api/threat-lake/correlation-rules', ruleData);
      setRules([newRule, ...rules]);
      setShowRuleForm(false);
      resetRuleForm();
    } catch (error) {
      console.error('Failed to create correlation rule:', error);
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;

    try {
      // In a real implementation, this would update via API
      const updatedRules = rules.map(rule =>
        rule.id === editingRule.id ? { ...editingRule } : rule
      );
      setRules(updatedRules);
      setEditingRule(null);
      setShowRuleForm(false);
      resetRuleForm();
    } catch {
      console.error('Failed to update correlation rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this correlation rule?')) {
      return;
    }

    try {
      // In a real implementation, this would delete via API
      setRules(rules.filter(rule => rule.id !== ruleId));
    } catch {
      console.error('Failed to delete correlation rule:', error);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      // In a real implementation, this would update via API
      const updatedRules = rules.map(rule =>
        rule.id === ruleId ? { ...rule, enabled } : rule
      );
      setRules(updatedRules);
    } catch {
      console.error('Failed to toggle correlation rule:', error);
    }
  };

  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      description: '',
      severity: 'medium',
      enabled: true,
      time_window_minutes: 60,
      threshold_count: 1,
      conditions: [{
        field: 'event_category',
        operator: 'equals',
        value: '',
        case_sensitive: false
      }],
      logic_operator: 'AND'
    });
  };

  const addCondition = () => {
    setRuleForm({
      ...ruleForm,
      conditions: [
        ...ruleForm.conditions,
        {
          field: 'event_category',
          operator: 'equals',
          value: '',
          case_sensitive: false
        }
      ]
    });
  };

  const removeCondition = (_index: number) => {
    setRuleForm({
      ...ruleForm,
      conditions: ruleForm.conditions.filter((_, i) => i !== index)
    });
  };

  const updateCondition = (index: number, field: string, value: any) => {
    const updatedConditions = [...ruleForm.conditions];
    updatedConditions[index] = {
      ...updatedConditions[index],
      [field]: value
    };
    setRuleForm({
      ...ruleForm,
      conditions: updatedConditions
    });
  };

  const getSeverityBadge = (severity: string) => {
    // Map to standard severity levels
    const mapSeverity = (sev: string): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
      switch (sev.toLowerCase()) {
        case 'critical': return 'critical';
        case 'high': return 'high';
        case 'medium': return 'medium';
        case 'low': return 'low';
        default: return 'info';
      }
    };

    return <SeverityBadge severity={mapSeverity(severity)} size="sm" />;
  };

  const getStatusBadge = (status: string) => {
    // Map to standard status types
    const mapStatus = (stat: string): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
      switch (stat.toLowerCase()) {
        case 'new': return 'new';
        case 'investigating': return 'investigating';
        case 'confirmed': return 'escalated';
        case 'false_positive': return 'closed';
        case 'resolved': return 'resolved';
        default: return 'new';
      }
    };

    return <StatusBadge status={mapStatus(status)} size="sm" />;
  };

  const filteredCorrelations = correlations.filter(correlation => {
    const matchesStatus = !filterStatus || correlation.status === filterStatus;
    const matchesSearch = !searchTerm ||
      correlation.threat_summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      correlation.correlation_id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Correlation Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage event correlation rules and view correlation results
          </p>
        </div>
        <Button
          onClick={() => setShowRuleForm(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Rule</span>
        </Button>
      </div>

      {/* Correlation Rules */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Correlation Rules
        </h3>

        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {rule.name}
                  </h4>
                  {getSeverityBadge(rule.severity)}
                  <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                    <Target className="w-4 h-4" />
                    <span>{rule.trigger_count} triggers</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                    className={`flex items-center space-x-1 ${rule.enabled ? 'text-green-600' : 'text-gray-400'
                      }`}
                  >
                    {rule.enabled ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>Disable</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Enable</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingRule(rule);
                      setShowRuleForm(true);
                    }}
                    className="flex items-center space-x-1"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </Button>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {rule.description}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Time Window:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {rule.time_window_minutes} minutes
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Threshold:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {rule.threshold_count} events
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                  <span className={`ml-2 ${rule.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>

              {rule.last_triggered && (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Last triggered: {new Date(rule.last_triggered).toLocaleString()}
                </div>
              )}
            </div>
          ))}

          {rules.length === 0 && (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No correlation rules configured
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Event Correlations */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Event Correlations
          </h3>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search correlations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="investigating">Investigating</option>
              <option value="confirmed">Confirmed</option>
              <option value="false_positive">False Positive</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {filteredCorrelations.map((correlation) => (
            <div key={correlation.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getStatusBadge(correlation.status)}
                  {getSeverityBadge(correlation.severity)}
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {correlation.event_ids.length} events
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Confidence: {(correlation.confidence_score * 100).toFixed(0)}%
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCorrelation(correlation)}
                    className="flex items-center space-x-1"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                  </Button>
                </div>
              </div>

              <div className="text-sm text-gray-900 dark:text-white mb-2">
                {correlation.threat_summary || 'No threat summary available'}
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                Created: {new Date(correlation.created_at).toLocaleString()}
                {correlation.assigned_to && (
                  <span className="ml-4">Assigned to: {correlation.assigned_to}</span>
                )}
              </div>
            </div>
          ))}

          {filteredCorrelations.length === 0 && (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No event correlations found
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Rule Form Modal */}
      {showRuleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {editingRule ? 'Edit Correlation Rule' : 'Create Correlation Rule'}
              </h3>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Rule Name
                    </label>
                    <input
                      type="text"
                      value={ruleForm.name}
                      onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter rule name..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Severity
                    </label>
                    <select
                      value={ruleForm.severity}
                      onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={ruleForm.description}
                    onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Describe what this rule detects..."
                  />
                </div>

                {/* Rule Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Time Window (minutes)
                    </label>
                    <input
                      type="number"
                      value={ruleForm.time_window_minutes}
                      onChange={(e) => setRuleForm({ ...ruleForm, time_window_minutes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="10080"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Threshold Count
                    </label>
                    <input
                      type="number"
                      value={ruleForm.threshold_count}
                      onChange={(e) => setRuleForm({ ...ruleForm, threshold_count: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Logic Operator
                    </label>
                    <select
                      value={ruleForm.logic_operator}
                      onChange={(e) => setRuleForm({ ...ruleForm, logic_operator: e.target.value as 'AND' | 'OR' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Conditions
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addCondition}
                      className="flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Condition</span>
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {ruleForm.conditions.map((condition, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <select
                          value={condition.field}
                          onChange={(e) => updateCondition(index, 'field', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {FIELD_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {OPERATOR_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, 'value', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Value..."
                        />

                        <div className="flex items-center justify-between">
                          <label className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={condition.case_sensitive || false}
                              onChange={(e) => updateCondition(index, 'case_sensitive', e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>Case sensitive</span>
                          </label>
                          {ruleForm.conditions.length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeCondition(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Enable/Disable */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={ruleForm.enabled}
                    onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enable rule immediately
                  </label>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRuleForm(false);
                    setEditingRule(null);
                    resetRuleForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingRule ? handleUpdateRule : handleCreateRule}
                  disabled={!ruleForm.name.trim()}
                >
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}