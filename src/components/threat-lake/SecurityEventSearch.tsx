'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';

interface SecurityEvent {
  id: string;
  timestamp: string;
  source_type: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  source_ip?: string;
  destination_ip?: string;
  user?: string;
  asset_id?: string;
  tags: string[];
  correlation_id?: string;
  threat_indicators: string[];
}

interface SearchFilters {
  query: string;
  severity: string[];
  source_type: string[];
  event_type: string[];
  time_range: string;
  start_date?: string;
  end_date?: string;
}

export function SecurityEventSearch() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent] = useState<SecurityEvent | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    severity: [],
    source_type: [],
    event_type: [],
    time_range: '24h'
  });

  useEffect(() => {
    searchEvents();
  }, []);

  const searchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters.query) params.append('q', filters.query);
      if (filters.severity.length > 0) params.append('severity', filters.severity.join(','));
      if (filters.source_type.length > 0) params.append('source_type', filters.source_type.join(','));
      if (filters.event_type.length > 0) params.append('event_type', filters.event_type.join(','));
      params.append('time_range', filters.time_range);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await fetch(`/api/threat-lake/events/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch {
      console.error('Failed to search events:', error);
    } finally {
      setLoading(false);
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

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const addToFilter = (key: 'severity' | 'source_type' | 'event_type', value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key] : [...prev[key], value]
    }));
  };

  const removeFromFilter = (key: 'severity' | 'source_type' | 'event_type', value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].filter(v => v !== value)
    }));
  };

  const exportResults = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.query) params.append('q', filters.query);
      params.append('format', 'csv');

      const response = await fetch(`/api/threat-lake/events/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-events-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch {
      console.error('Failed to export events:', error);
    }
  };

  const columns = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (event: SecurityEvent) => (
        <span className="text-sm font-mono">
          {new Date(event.timestamp).toLocaleString()}
        </span>
      )
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (event: SecurityEvent) => getSeverityBadge(event.severity)
    },
    {
      key: 'title',
      header: 'Event',
      render: (event: SecurityEvent) => (
        <div>
          <div className="font-medium">{event.title}</div>
          <div className="text-sm text-gray-500">{event.event_type}</div>
        </div>
      )
    },
    {
      key: 'source',
      header: 'Source',
      render: (event: SecurityEvent) => (
        <div className="text-sm">
          <div>{event.source_type}</div>
          {event.source_ip && (
            <div className="text-gray-500 font-mono">{event.source_ip}</div>
          )}
        </div>
      )
    },
    {
      key: 'indicators',
      header: 'Threat Indicators',
      render: (event: SecurityEvent) => (
        <div className="flex flex-wrap gap-1">
          {event.threat_indicators.slice(0, 2).map((indicator, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {indicator}
            </Badge>
          ))}
          {event.threat_indicators.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{event.threat_indicators.length - 2}
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (event: SecurityEvent) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedEvent(event)}
        >
          Details
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search events (e.g., malware, IP:192.168.1.1, user:admin)"
                value={filters.query}
                onChange={(e) => handleFilterChange('query', e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchEvents()}
              />
            </div>
            <Button onClick={searchEvents} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Severity:</span>
              {['low', 'medium', 'high', 'critical'].map(severity => (
                <button
                  key={severity}
                  onClick={() =>
                    filters.severity.includes(severity)
                      ? removeFromFilter('severity', severity)
                      : addToFilter('severity', severity)
                  }
                  className={`px-2 py-1 text-xs rounded ${filters.severity.includes(severity)
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {severity}
                </button>
              ))}
            </div>
          </div>

          {/* Time Range */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Time Range:</span>
            <select
              value={filters.time_range}
              onChange={(e) => handleFilterChange('time_range', e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {filters.time_range === 'custom' && (
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={filters.start_date || ''}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <input
                  type="datetime-local"
                  value={filters.end_date || ''}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            )}
          </div>

          {/* Active Filters */}
          {(filters.severity.length > 0 || filters.source_type.length > 0 || filters.event_type.length > 0) && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {filters.severity.map(severity => (
                <button
                  key={severity}
                  onClick={() => removeFromFilter('severity', severity)}
                  className="relative group"
                >
                  <SeverityBadge severity={severity as any} size="sm" />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    ×
                  </span>
                </button>
              ))}
              {filters.source_type.map(type => (
                <Badge
                  key={type}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeFromFilter('source_type', type)}
                >
                  source:{type} ×
                </Badge>
              ))}
              {filters.event_type.map(type => (
                <Badge
                  key={type}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeFromFilter('event_type', type)}
                >
                  type:{type} ×
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold">Search Results</h3>
            <p className="text-sm text-gray-600">
              {events.length} events found
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportResults}>
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={searchEvents}>
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Searching events...</div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">No events found</div>
            <p className="text-sm text-gray-400">
              Try adjusting your search criteria or time range
            </p>
          </div>
        ) : (
          <DataTable
            data={events}
            columns={columns}
            searchable={false}
          />
        )}
      </Card>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-4xl max-h-[80vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{selectedEvent.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    {getSeverityBadge(selectedEvent.severity)}
                    <Badge variant="outline">{selectedEvent.event_type}</Badge>
                    <span className="text-sm text-gray-500">
                      {new Date(selectedEvent.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEvent(null)}
                >
                  Close
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Event Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>ID:</strong> {selectedEvent.id}</div>
                    <div><strong>Source Type:</strong> {selectedEvent.source_type}</div>
                    <div><strong>Event Type:</strong> {selectedEvent.event_type}</div>
                    {selectedEvent.source_ip && (
                      <div><strong>Source IP:</strong> {selectedEvent.source_ip}</div>
                    )}
                    {selectedEvent.destination_ip && (
                      <div><strong>Destination IP:</strong> {selectedEvent.destination_ip}</div>
                    )}
                    {selectedEvent.user && (
                      <div><strong>User:</strong> {selectedEvent.user}</div>
                    )}
                    {selectedEvent.asset_id && (
                      <div><strong>Asset ID:</strong> {selectedEvent.asset_id}</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Threat Intelligence</h4>
                  <div className="space-y-2">
                    {selectedEvent.threat_indicators.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedEvent.threat_indicators.map((indicator, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {indicator}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No threat indicators</div>
                    )}
                  </div>

                  {selectedEvent.correlation_id && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Correlation</h4>
                      <div className="text-sm">
                        <strong>Correlation ID:</strong> {selectedEvent.correlation_id}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                  {selectedEvent.description}
                </p>
              </div>

              {selectedEvent.tags.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedEvent.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-2">
                <Button size="sm">Create Alert</Button>
                <Button variant="outline" size="sm">Add to Investigation</Button>
                <Button variant="outline" size="sm">Export Event</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}