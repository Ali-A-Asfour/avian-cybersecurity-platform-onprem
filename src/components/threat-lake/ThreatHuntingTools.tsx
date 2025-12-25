'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SecurityEventSearch } from './SecurityEventSearch';
import { EventTimelineVisualization } from './EventTimelineVisualization';
import { ThreatLakeQueryInterface } from './ThreatLakeQueryInterface';
// Simple text-based icons for compatibility
const SimpleIcon = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block w-4 h-4 text-center">{children}</span>
);

interface HuntQuery {
  id?: string;
  name: string;
  description: string;
  query: {
    event_category?: string;
    event_type?: string;
    severity?: string;
    start_time: string;
    end_time: string;
    search_text?: string;
    threat_indicators?: Array<{
      indicator_type: string;
      indicator_value: string;
    }>;
    aggregations?: {
      group_by: string[];
      time_bucket: string;
      include_stats: boolean;
    };
  };
  created_at?: string;
  created_by?: string;
}

interface HuntResult {
  events: Array<{
    id: string;
    event_category: string;
    event_type: string;
    severity: string;
    confidence_score: number;
    threat_indicators: Array<{
      indicator_type: string;
      indicator_value: string;
      confidence_score: number;
    }>;
    timestamp: string;
    source_system: string;
    enrichment_data: any;
    normalized_data: any;
  }>;
  aggregations?: {
    severity_distribution?: Array<{ severity: string; count: number }>;
    category_distribution?: Array<{ event_category: string; count: number }>;
    time_series?: Array<{ time_bucket: string; count: number }>;
    statistics?: {
      total_events: number;
      avg_confidence: number;
      earliest_event: string;
      latest_event: string;
      unique_assets: number;
      unique_sources: number;
    };
  };
  total: number;
}

interface SavedQuery {
  id: string;
  name: string;
  description: string;
  query: any;
  created_at: string;
  created_by: string;
  usage_count: number;
}

const PREDEFINED_QUERIES = [
  {
    name: 'High Confidence Critical Events',
    description: 'Critical severity events with confidence score > 80%',
    query: {
      severity: 'critical',
      start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date().toISOString(),
      aggregations: {
        group_by: ['event_category', 'source_system'],
        time_bucket: 'hour',
        include_stats: true
      }
    }
  },
  {
    name: 'Malware Indicators',
    description: 'Events with malware-related threat intelligence matches',
    query: {
      event_category: 'malware',
      start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date().toISOString(),
      search_text: 'malware',
      aggregations: {
        group_by: ['event_type'],
        time_bucket: 'day',
        include_stats: true
      }
    }
  },
  {
    name: 'Authentication Anomalies',
    description: 'Authentication events with unusual patterns',
    query: {
      event_category: 'authentication',
      start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date().toISOString(),
      aggregations: {
        group_by: ['event_type', 'severity'],
        time_bucket: 'hour',
        include_stats: true
      }
    }
  },
  {
    name: 'Network Intrusion Patterns',
    description: 'Network events indicating potential intrusion attempts',
    query: {
      event_category: 'network',
      severity: 'high',
      start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date().toISOString(),
      aggregations: {
        group_by: ['event_type'],
        time_bucket: 'hour',
        include_stats: true
      }
    }
  }
];

export default function ThreatHuntingTools() {
  const [activeTab, setActiveTab] = useState<'search' | 'timeline' | 'query' | 'advanced'>('search');
  const [currentQuery, setCurrentQuery] = useState<HuntQuery>({
    name: '',
    description: '',
    query: {
      start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date().toISOString(),
      aggregations: {
        group_by: ['severity', 'event_category'],
        time_bucket: 'hour',
        include_stats: true
      }
    }
  });
  
  const [huntResults, setHuntResults] = useState<HuntResult | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedEvent] = useState<any>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSavedQueries();
  }, []);

  const loadSavedQueries = async () => {
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll use mock data
      setSavedQueries([]);
    } catch (error) {
      console.error('Failed to load saved queries:', error);
    }
  };

  const executeHunt = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/threat-lake/events/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: {
            ...currentQuery.query,
            limit: 100
          },
          aggregations: currentQuery.query.aggregations
        })
      });

      if (response.ok) {
        const data = await response.json();
        setHuntResults(data);
      } else {
        console.error('Hunt execution failed');
      }
    } catch (error) {
      console.error('Failed to execute hunt:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveQuery = async () => {
    if (!currentQuery.name.trim()) {
      alert('Please provide a name for the query');
      return;
    }

    try {
      // In a real implementation, this would save to an API
      const newQuery: SavedQuery = {
        id: crypto.randomUUID(),
        name: currentQuery.name,
        description: currentQuery.description,
        query: currentQuery.query,
        created_at: new Date().toISOString(),
        created_by: 'current_user',
        usage_count: 0
      };

      setSavedQueries([newQuery, ...savedQueries]);
      setShowSaveDialog(false);
      setCurrentQuery({
        ...currentQuery,
        name: '',
        description: ''
      });
    } catch (error) {
      console.error('Failed to save query:', error);
    }
  };

  const loadPredefinedQuery = (query: any) => {
    setCurrentQuery({
      name: query.name,
      description: query.description,
      query: query.query
    });
  };

  const loadSavedQuery = (savedQuery: SavedQuery) => {
    setCurrentQuery({
      name: savedQuery.name,
      description: savedQuery.description,
      query: savedQuery.query
    });
  };

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const exportResults = async () => {
    if (!huntResults) return;

    try {
      const csvContent = [
        // Header
        ['ID', 'Category', 'Type', 'Severity', 'Confidence', 'Timestamp', 'Source System'].join(','),
        // Data rows
        ...huntResults.events.map(event => [
          event.id,
          event.event_category,
          event.event_type,
          event.severity,
          (event.confidence_score * 100).toFixed(1) + '%',
          new Date(event.timestamp).toLocaleString(),
          event.source_system
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `threat-hunt-results-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export results:', error);
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getIndicatorIcon = (type: string) => {
    switch (type) {
      case 'ip': return <SimpleIcon>🌍</SimpleIcon>;
      case 'domain': return <SimpleIcon>🌐</SimpleIcon>;
      case 'hash_md5':
      case 'hash_sha1':
      case 'hash_sha256': return <SimpleIcon>#</SimpleIcon>;
      case 'file_path': return <SimpleIcon>📄</SimpleIcon>;
      case 'user_agent': return <SimpleIcon>👤</SimpleIcon>;
      default: return <SimpleIcon>🛡️</SimpleIcon>;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'search':
        return <SecurityEventSearch />;
      case 'timeline':
        return <EventTimelineVisualization />;
      case 'query':
        return <ThreatLakeQueryInterface />;
      case 'advanced':
        return renderAdvancedHuntingTab();
      default:
        return <SecurityEventSearch />;
    }
  };

  const renderAdvancedHuntingTab = () => (
    <div className="space-y-6">
      {/* Predefined Queries */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Hunt Templates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PREDEFINED_QUERIES.map((query, index) => (
            <div
              key={index}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => loadPredefinedQuery(query)}
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                {query.name}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {query.description}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Query Builder */}
      {showQueryBuilder && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Query Builder
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center space-x-2"
              >
                <SimpleIcon>💾</SimpleIcon>
                <span>Save Query</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Event Category
              </label>
              <select
                value={currentQuery.query.event_category || ''}
                onChange={(e) => setCurrentQuery({
                  ...currentQuery,
                  query: {
                    ...currentQuery.query,
                    event_category: e.target.value || undefined
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                <option value="malware">Malware</option>
                <option value="network">Network</option>
                <option value="authentication">Authentication</option>
                <option value="data_access">Data Access</option>
                <option value="system">System</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Severity
              </label>
              <select
                value={currentQuery.query.severity || ''}
                onChange={(e) => setCurrentQuery({
                  ...currentQuery,
                  query: {
                    ...currentQuery.query,
                    severity: e.target.value || undefined
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Range
              </label>
              <select
                onChange={(e) => {
                  const hours = parseInt(e.target.value);
                  const endTime = new Date();
                  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);
                  setCurrentQuery({
                    ...currentQuery,
                    query: {
                      ...currentQuery.query,
                      start_time: startTime.toISOString(),
                      end_time: endTime.toISOString()
                    }
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">Last Hour</option>
                <option value="24">Last 24 Hours</option>
                <option value="168">Last Week</option>
                <option value="720">Last Month</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Text
            </label>
            <input
              type="text"
              placeholder="Search in event data..."
              value={currentQuery.query.search_text || ''}
              onChange={(e) => setCurrentQuery({
                ...currentQuery,
                query: {
                  ...currentQuery.query,
                  search_text: e.target.value || undefined
                }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </Card>
      )}

      {/* Hunt Results */}
      {huntResults && (
        <div className="space-y-6">
          {/* Results Summary */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Hunt Results
              </h3>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {huntResults.total.toLocaleString()} events found
                </span>
                <Button
                  variant="outline"
                  onClick={exportResults}
                  className="flex items-center space-x-2"
                >
                  <SimpleIcon>⬇️</SimpleIcon>
                  <span>Export</span>
                </Button>
              </div>
            </div>

            {/* Statistics */}
            {huntResults.aggregations?.statistics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {huntResults.aggregations.statistics.total_events.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Events</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {(huntResults.aggregations.statistics.avg_confidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {huntResults.aggregations.statistics.unique_assets}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Unique Assets</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {huntResults.aggregations.statistics.unique_sources}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Data Sources</div>
                </div>
              </div>
            )}

            {/* Events List */}
            <div className="space-y-2">
              {huntResults.events.map((event) => (
                <div key={event.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => toggleEventExpansion(event.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {expandedEvents.has(event.id) ? (
                          <SimpleIcon>▼</SimpleIcon>
                        ) : (
                          <SimpleIcon>▶</SimpleIcon>
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {event.event_type}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {event.event_category} • {event.source_system}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={getSeverityBadgeColor(event.severity)}>
                          {event.severity}
                        </Badge>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedEvents.has(event.id) && (
                    <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                        {/* Event Details */}
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                            Event Details
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Confidence:</span>
                              <span className="font-medium">
                                {(event.confidence_score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Source:</span>
                              <span className="font-medium">{event.source_system}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Category:</span>
                              <span className="font-medium">{event.event_category}</span>
                            </div>
                          </div>
                        </div>

                        {/* Threat Indicators */}
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                            Threat Indicators
                          </h4>
                          {event.threat_indicators.length > 0 ? (
                            <div className="space-y-2">
                              {event.threat_indicators.map((indicator, index) => (
                                <div key={index} className="flex items-center space-x-2 text-sm">
                                  {getIndicatorIcon(indicator.indicator_type)}
                                  <span className="font-medium">{indicator.indicator_type}:</span>
                                  <span className="text-gray-600 dark:text-gray-400 font-mono">
                                    {indicator.indicator_value}
                                  </span>
                                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                    {(indicator.confidence_score * 100).toFixed(0)}%
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              No threat indicators detected
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Raw Data */}
                      {event.normalized_data && (
                        <div className="mt-4">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                            Normalized Data
                          </h4>
                          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto">
                            {JSON.stringify(event.normalized_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {huntResults.events.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-gray-500 dark:text-gray-400">
                  No events found matching your hunt criteria
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Security Event Management & Threat Hunting
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Advanced security event search, investigation, and threat hunting tools
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => setShowQueryBuilder(!showQueryBuilder)}
            className="flex items-center space-x-2"
          >
            <SimpleIcon>🔽</SimpleIcon>
            <span>Query Builder</span>
          </Button>
          <Button
            onClick={executeHunt}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <SimpleIcon>▶️</SimpleIcon>
            <span>{loading ? 'Hunting...' : 'Execute Hunt'}</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'search', name: 'Event Search', description: 'Search and filter security events' },
            { id: 'timeline', name: 'Timeline View', description: 'Event timeline and correlation' },
            { id: 'query', name: 'Query Interface', description: 'Advanced threat lake queries' },
            { id: 'advanced', name: 'Advanced Hunting', description: 'Complex hunt operations' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Predefined Queries */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Hunt Templates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PREDEFINED_QUERIES.map((query, index) => (
            <div
              key={index}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => loadPredefinedQuery(query)}
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                {query.name}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {query.description}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Query Builder */}
      {showQueryBuilder && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Query Builder
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center space-x-2"
              >
                <SimpleIcon>💾</SimpleIcon>
                <span>Save Query</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Event Category
              </label>
              <select
                value={currentQuery.query.event_category || ''}
                onChange={(e) => setCurrentQuery({
                  ...currentQuery,
                  query: {
                    ...currentQuery.query,
                    event_category: e.target.value || undefined
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                <option value="malware">Malware</option>
                <option value="network">Network</option>
                <option value="authentication">Authentication</option>
                <option value="data_access">Data Access</option>
                <option value="system">System</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Severity
              </label>
              <select
                value={currentQuery.query.severity || ''}
                onChange={(e) => setCurrentQuery({
                  ...currentQuery,
                  query: {
                    ...currentQuery.query,
                    severity: e.target.value || undefined
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Range
              </label>
              <select
                onChange={(e) => {
                  const hours = parseInt(e.target.value);
                  const endTime = new Date();
                  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);
                  setCurrentQuery({
                    ...currentQuery,
                    query: {
                      ...currentQuery.query,
                      start_time: startTime.toISOString(),
                      end_time: endTime.toISOString()
                    }
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">Last Hour</option>
                <option value="24">Last 24 Hours</option>
                <option value="168">Last Week</option>
                <option value="720">Last Month</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Text
            </label>
            <input
              type="text"
              placeholder="Search in event data..."
              value={currentQuery.query.search_text || ''}
              onChange={(e) => setCurrentQuery({
                ...currentQuery,
                query: {
                  ...currentQuery.query,
                  search_text: e.target.value || undefined
                }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </Card>
      )}

      {/* Save Query Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Save Hunt Query
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Query Name
                </label>
                <input
                  type="text"
                  value={currentQuery.name}
                  onChange={(e) => setCurrentQuery({
                    ...currentQuery,
                    name: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter query name..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={currentQuery.description}
                  onChange={(e) => setCurrentQuery({
                    ...currentQuery,
                    description: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe what this query does..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveQuery}>
                Save Query
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Hunt Results */}
      {huntResults && (
        <div className="space-y-6">
          {/* Results Summary */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Hunt Results
              </h3>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {huntResults.total.toLocaleString()} events found
                </span>
                <Button
                  variant="outline"
                  onClick={exportResults}
                  className="flex items-center space-x-2"
                >
                  <SimpleIcon>⬇️</SimpleIcon>
                  <span>Export</span>
                </Button>
              </div>
            </div>

            {/* Statistics */}
            {huntResults.aggregations?.statistics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {huntResults.aggregations.statistics.total_events.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Events</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {(huntResults.aggregations.statistics.avg_confidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {huntResults.aggregations.statistics.unique_assets}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Unique Assets</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {huntResults.aggregations.statistics.unique_sources}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Data Sources</div>
                </div>
              </div>
            )}

            {/* Events List */}
            <div className="space-y-2">
              {huntResults.events.map((event) => (
                <div key={event.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => toggleEventExpansion(event.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {expandedEvents.has(event.id) ? (
                          <SimpleIcon>▼</SimpleIcon>
                        ) : (
                          <SimpleIcon>▶</SimpleIcon>
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {event.event_type}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {event.event_category} • {event.source_system}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={getSeverityBadgeColor(event.severity)}>
                          {event.severity}
                        </Badge>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedEvents.has(event.id) && (
                    <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                        {/* Event Details */}
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                            Event Details
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Confidence:</span>
                              <span className="font-medium">
                                {(event.confidence_score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Source:</span>
                              <span className="font-medium">{event.source_system}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Category:</span>
                              <span className="font-medium">{event.event_category}</span>
                            </div>
                          </div>
                        </div>

                        {/* Threat Indicators */}
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                            Threat Indicators
                          </h4>
                          {event.threat_indicators.length > 0 ? (
                            <div className="space-y-2">
                              {event.threat_indicators.map((indicator, index) => (
                                <div key={index} className="flex items-center space-x-2 text-sm">
                                  {getIndicatorIcon(indicator.indicator_type)}
                                  <span className="font-medium">{indicator.indicator_type}:</span>
                                  <span className="text-gray-600 dark:text-gray-400 font-mono">
                                    {indicator.indicator_value}
                                  </span>
                                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                    {(indicator.confidence_score * 100).toFixed(0)}%
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              No threat indicators detected
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Raw Data */}
                      {event.normalized_data && (
                        <div className="mt-4">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                            Normalized Data
                          </h4>
                          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto">
                            {JSON.stringify(event.normalized_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {huntResults.events.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-gray-500 dark:text-gray-400">
                  No events found matching your hunt criteria
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}