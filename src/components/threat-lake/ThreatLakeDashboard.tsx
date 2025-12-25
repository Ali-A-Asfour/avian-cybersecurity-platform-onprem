'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  Database,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Clock,
  Target
} from 'lucide-react';

interface ThreatAnalytics {
  severity_distribution: Array<{ severity: string; count: number }>;
  category_distribution: Array<{ event_category: string; count: number }>;
  correlation_status: Array<{ status: string; count: number }>;
  top_threat_indicators: Array<{
    indicator_type: string;
    indicator_value: string;
    threat_type: string;
    event_count: number;
  }>;
  time_range: {
    start_time: string;
    end_time: string;
  };
  trends?: {
    hourly_events: Array<{
      hour: string;
      severity: string;
      event_count: number;
      avg_confidence: number;
    }>;
    severity_trends: Array<{
      severity: string;
      avg_count: number;
      trend_direction: 'increasing' | 'decreasing' | 'stable';
      trend_strength: number;
    }>;
  };
  predictions?: {
    available: boolean;
    model_version?: string;
    model_accuracy?: number;
    predictions?: Array<{
      event_category: string;
      severity: string;
      predicted_count: number;
      confidence: number;
      prediction_window: string;
    }>;
  };
}

interface ThreatLakeEvent {
  id: string;
  event_category: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  threat_indicators: Array<{
    indicator_type: string;
    indicator_value: string;
    confidence_score: number;
  }>;
  timestamp: string;
  source_system: string;
  enrichment_data: {
    threat_intelligence_matches: Array<{
      indicator_type: string;
      threat_type: string;
      confidence_score: number;
      feed_name: string;
    }>;
  };
}

interface SearchFilters {
  event_category?: string;
  severity?: string;
  start_time?: string;
  end_time?: string;
  search_text?: string;
  min_confidence_score?: number;
}

const SEVERITY_COLORS = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#DC2626'
};

const STATUS_COLORS = {
  new: '#3B82F6',
  investigating: '#F59E0B',
  confirmed: '#EF4444',
  false_positive: '#6B7280',
  resolved: '#10B981'
};

export default function ThreatLakeDashboard() {
  const [analytics, setAnalytics] = useState<ThreatAnalytics | null>(null);
  const [events, setEvents] = useState<ThreatLakeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [timeRange, setTimeRange] = useState('24h');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadThreatAnalytics();
    loadRecentEvents();
  }, [timeRange]);

  const loadThreatAnalytics = async () => {
    try {
      setLoading(true);
      const endTime = new Date();
      const startTime = new Date();

      switch (timeRange) {
        case '1h':
          startTime.setHours(startTime.getHours() - 1);
          break;
        case '24h':
          startTime.setHours(startTime.getHours() - 24);
          break;
        case '7d':
          startTime.setDate(startTime.getDate() - 7);
          break;
        case '30d':
          startTime.setDate(startTime.getDate() - 30);
          break;
      }

      const params = new URLSearchParams({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        include_trends: 'true',
        include_predictions: 'true'
      });

      const response = await fetch(`/api/threat-lake/analytics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to load threat analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentEvents = async () => {
    try {
      const params = new URLSearchParams({
        limit: '50',
        ...searchFilters
      });

      const response = await fetch(`/api/threat-lake/events?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to load recent events:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadThreatAnalytics(), loadRecentEvents()]);
    setRefreshing(false);
  };

  const handleSearch = async () => {
    await loadRecentEvents();
  };

  const exportData = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
        ...searchFilters
      });

      const response = await fetch(`/api/threat-lake/events/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `threat-lake-events-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export data:', error);
    }
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

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'increasing': return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing': return <TrendingUp className="w-4 h-4 text-green-500 rotate-180" />;
      default: return <Target className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading threat lake analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AVIAN Threat Lake
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Centralized threat intelligence and security event analysis
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Events
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analytics.severity_distribution.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
                </p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Critical Events
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {analytics.severity_distribution.find(item => item.severity === 'critical')?.count || 0}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Active Correlations
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {analytics.correlation_status.filter(item =>
                    ['new', 'investigating', 'confirmed'].includes(item.status)
                  ).reduce((sum, item) => sum + item.count, 0)}
                </p>
              </div>
              <Target className="w-8 h-8 text-orange-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Threat Indicators
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {analytics.top_threat_indicators.length}
                </p>
              </div>
              <Shield className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Severity Distribution */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Event Severity Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.severity_distribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ severity, count, percent }) =>
                    `${severity}: ${count} (${(percent * 100).toFixed(1)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="severity"
                >
                  {analytics.severity_distribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SEVERITY_COLORS[entry.severity as keyof typeof SEVERITY_COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Category Distribution */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Event Categories
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.category_distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="event_category"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Trends and Predictions */}
      {analytics?.trends && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Severity Trends */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Severity Trends
            </h3>
            <div className="space-y-3">
              {analytics.trends.severity_trends.map((trend, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getSeverityBadge(trend.severity)}
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Avg: {trend.avg_count.toFixed(1)} events/hour
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(trend.trend_direction)}
                    <span className="text-sm font-medium capitalize">
                      {trend.trend_direction}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Predictions */}
          {analytics.predictions?.available && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Threat Predictions (Next 24h)
              </h3>
              <div className="space-y-3">
                <div className="text-xs text-gray-500 mb-3">
                  Model: v{analytics.predictions.model_version}
                  (Accuracy: {(analytics.predictions.model_accuracy! * 100).toFixed(1)}%)
                </div>
                {analytics.predictions.predictions?.slice(0, 5).map((prediction, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">
                        {prediction.event_category}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {prediction.severity} severity
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">
                        {prediction.predicted_count}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(prediction.confidence * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Events
          </h3>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center space-x-2"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </Button>
            <Button
              variant="outline"
              onClick={exportData}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </Button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <input
              type="text"
              placeholder="Search events..."
              value={searchFilters.search_text || ''}
              onChange={(e) => setSearchFilters({ ...searchFilters, search_text: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={searchFilters.event_category || ''}
              onChange={(e) => setSearchFilters({ ...searchFilters, event_category: e.target.value || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="malware">Malware</option>
              <option value="network">Network</option>
              <option value="authentication">Authentication</option>
              <option value="data_access">Data Access</option>
            </select>
            <select
              value={searchFilters.severity || ''}
              onChange={(e) => setSearchFilters({ ...searchFilters, severity: e.target.value || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="number"
              placeholder="Min Confidence"
              min="0"
              max="1"
              step="0.1"
              value={searchFilters.min_confidence_score || ''}
              onChange={(e) => setSearchFilters({
                ...searchFilters,
                min_confidence_score: e.target.value ? parseFloat(e.target.value) : undefined
              })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={handleSearch} className="flex items-center space-x-2">
              <Search className="w-4 h-4" />
              <span>Search</span>
            </Button>
          </div>
        )}

        {/* Events Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Threat Intel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.event_type}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {event.event_category} • {event.source_system}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSeverityBadge(event.severity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${event.confidence_score * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {(event.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {event.enrichment_data.threat_intelligence_matches.length > 0 ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          {event.enrichment_data.threat_intelligence_matches.length} matches
                        </Badge>
                      ) : (
                        <span className="text-gray-400">No matches</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-1"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {events.length === 0 && (
          <div className="text-center py-8">
            <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No events found matching your criteria
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}