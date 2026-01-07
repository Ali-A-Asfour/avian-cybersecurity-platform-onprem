'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api-client';

interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  event_type: string;
  source_type: string;
  correlation_id?: string;
  related_events: string[];
  threat_indicators: string[];
}

interface CorrelationGroup {
  id: string;
  events: TimelineEvent[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  confidence_score: number;
}

export function EventTimelineVisualization() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationGroup[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [viewMode, setViewMode] = useState<'timeline' | 'correlation'>('timeline');
  const [selectedEvent] = useState<TimelineEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimelineData();
  }, [selectedTimeRange]);

  const fetchTimelineData = async () => {
    try {
      setLoading(true);
      
      // Fetch timeline events
      const eventsData = await api.get(`/api/threat-lake/events?time_range=${selectedTimeRange}&limit=100`);
      setEvents(eventsData.events || []);

      // Fetch correlations
      const correlationsData = await api.get(`/api/threat-lake/correlations?time_range=${selectedTimeRange}`);
      setCorrelations(correlationsData.correlations || []);
    } catch (error) {
      console.error('Failed to fetch timeline data:', error);
      // Generate mock data for demonstration
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = () => {
    const now = new Date();
    const mockEvents: TimelineEvent[] = [];
    const mockCorrelations: CorrelationGroup[] = [];

    // Generate mock events
    for (let i = 0; i < 50; i++) {
      const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
      mockEvents.push({
        id: `event-${i}`,
        timestamp: timestamp.toISOString(),
        title: `Security Event ${i + 1}`,
        description: `Detailed description of security event ${i + 1}`,
        severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
        event_type: ['malware_detection', 'suspicious_login', 'network_anomaly', 'data_exfiltration'][Math.floor(Math.random() * 4)],
        source_type: ['edr_avast', 'firewall_pfsense', 'siem_splunk'][Math.floor(Math.random() * 3)],
        correlation_id: Math.random() > 0.7 ? `corr-${Math.floor(i / 3)}` : undefined,
        related_events: [],
        threat_indicators: [`IOC-${i}`, `TTP-${i}`]
      });
    }

    // Generate mock correlations
    for (let i = 0; i < 5; i++) {
      const correlatedEvents = mockEvents.filter(e => e.correlation_id === `corr-${i}`);
      if (correlatedEvents.length > 0) {
        mockCorrelations.push({
          id: `corr-${i}`,
          events: correlatedEvents,
          severity: 'high',
          title: `Attack Campaign ${i + 1}`,
          confidence_score: 0.8 + Math.random() * 0.2
        });
      }
    }

    setEvents(mockEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setCorrelations(mockCorrelations);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const severityConfig = {
      low: { variant: 'secondary' as const, label: 'Low' },
      medium: { variant: 'warning' as const, label: 'Medium' },
      high: { variant: 'destructive' as const, label: 'High' },
      critical: { variant: 'destructive' as const, label: 'Critical' }
    };

    const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.low;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatEventType = (eventType: string) => {
    return eventType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const groupEventsByHour = (events: TimelineEvent[]) => {
    const groups: Record<string, TimelineEvent[]> = {};
    
    events.forEach(event => {
      const hour = new Date(event.timestamp).toISOString().slice(0, 13) + ':00:00.000Z';
      if (!groups[hour]) groups[hour] = [];
      groups[hour].push(event);
    });

    return Object.entries(groups).sort(([a], [b]) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading timeline data...</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('timeline')}
              >
                Timeline View
              </Button>
              <Button
                variant={viewMode === 'correlation' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('correlation')}
              >
                Correlation View
              </Button>
            </div>
            
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          
          <Button variant="outline" size="sm" onClick={fetchTimelineData}>
            Refresh
          </Button>
        </div>
      </Card>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Event Timeline</h3>
          
          <div className="space-y-6">
            {groupEventsByHour(events).map(([hour, hourEvents]) => (
              <div key={hour} className="relative">
                {/* Time Header */}
                <div className="sticky top-0 bg-white z-10 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-gray-900">
                      {new Date(hour).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <Badge variant="secondary">{hourEvents.length} events</Badge>
                  </div>
                </div>

                {/* Events */}
                <div className="ml-4 border-l-2 border-gray-200 pl-4 space-y-3 mt-4">
                  {hourEvents.map((event, index) => (
                    <div
                      key={event.id}
                      className="relative cursor-pointer hover:bg-gray-50 p-3 rounded-lg border"
                      onClick={() => setSelectedEvent(event)}
                    >
                      {/* Severity Indicator */}
                      <div className={`absolute -left-7 w-3 h-3 rounded-full ${getSeverityColor(event.severity)}`}></div>
                      
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{event.title}</span>
                            {getSeverityBadge(event.severity)}
                            <Badge variant="outline" className="text-xs">
                              {formatEventType(event.event_type)}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-2">
                            {event.description}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>{event.source_type}</span>
                            <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                            {event.correlation_id && (
                              <Badge variant="secondary" className="text-xs">
                                Correlated
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {event.threat_indicators.length > 0 && (
                          <div className="flex flex-wrap gap-1 ml-4">
                            {event.threat_indicators.slice(0, 2).map((indicator, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {indicator}
                              </Badge>
                            ))}
                            {event.threat_indicators.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{event.threat_indicators.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Correlation View */}
      {viewMode === 'correlation' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Event Correlations</h3>
          
          <div className="space-y-4">
            {correlations.map((correlation) => (
              <div key={correlation.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{correlation.title}</h4>
                    {getSeverityBadge(correlation.severity)}
                    <Badge variant="outline">
                      Confidence: {(correlation.confidence_score * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <Badge variant="secondary">
                    {correlation.events.length} events
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {correlation.events.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${getSeverityColor(event.severity)}`}></div>
                        <span className="text-sm font-medium">{event.title}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {formatEventType(event.event_type)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {correlations.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-2">No correlations found</div>
                <p className="text-sm text-gray-400">
                  Events will be automatically correlated based on patterns and threat intelligence
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-2xl max-h-[80vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{selectedEvent.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    {getSeverityBadge(selectedEvent.severity)}
                    <Badge variant="outline">{formatEventType(selectedEvent.event_type)}</Badge>
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

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                    {selectedEvent.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Event Details</h4>
                    <div className="space-y-1 text-sm">
                      <div><strong>ID:</strong> {selectedEvent.id}</div>
                      <div><strong>Source:</strong> {selectedEvent.source_type}</div>
                      <div><strong>Type:</strong> {formatEventType(selectedEvent.event_type)}</div>
                      {selectedEvent.correlation_id && (
                        <div><strong>Correlation ID:</strong> {selectedEvent.correlation_id}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Threat Indicators</h4>
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
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button size="sm">Create Alert</Button>
                  <Button variant="outline" size="sm">Add to Investigation</Button>
                  <Button variant="outline" size="sm">View Related Events</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}