'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

interface QueryResult {
  id: string;
  timestamp: string;
  event_type: string;
  severity: string;
  source_type: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
}

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  description: string;
  created_at: string;
  created_by: string;
}

interface QueryTemplate {
  name: string;
  description: string;
  query: string;
  category: string;
}

export function ThreatLakeQueryInterface() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QueryResult[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<QueryTemplate | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [queryDescription, setQueryDescription] = useState('');

  const queryTemplates: QueryTemplate[] = [
    {
      name: 'High Severity Events',
      description: 'Find all high and critical severity events in the last 24 hours',
      query: 'severity:(high OR critical) AND timestamp:[now-24h TO now]',
      category: 'Security'
    },
    {
      name: 'Failed Login Attempts',
      description: 'Search for failed authentication events',
      query: 'event_type:authentication_failure AND timestamp:[now-1h TO now]',
      category: 'Authentication'
    },
    {
      name: 'Malware Detections',
      description: 'Find malware detection events from EDR systems',
      query: 'event_type:malware_detection AND source_type:edr_*',
      category: 'Malware'
    },
    {
      name: 'Network Anomalies',
      description: 'Detect unusual network traffic patterns',
      query: 'event_type:network_anomaly AND (bytes_transferred:>1000000 OR connection_count:>100)',
      category: 'Network'
    },
    {
      name: 'Data Exfiltration Indicators',
      description: 'Look for potential data exfiltration activities',
      query: 'event_type:data_transfer AND (destination_external:true OR bytes_transferred:>10000000)',
      category: 'Data Loss'
    },
    {
      name: 'Privilege Escalation',
      description: 'Find privilege escalation attempts',
      query: 'event_type:privilege_escalation OR (event_type:process_creation AND process_name:*admin*)',
      category: 'Privilege'
    }
  ];

  useEffect(() => {
    fetchSavedQueries();
  }, []);

  const fetchSavedQueries = async () => {
    try {
      const response = await fetch('/api/threat-lake/queries');
      if (response.ok) {
        const data = await response.json();
        setSavedQueries(data.queries || []);
      }
    } catch {
      console.error('Failed to fetch saved queries:', error);
    }
  };

  const executeQuery = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      const response = await fetch('/api/threat-lake/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, limit: 100 })
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      } else {
        const error = await response.json();
        alert(`Query failed: ${error.message}`);
      }
    } catch {
      console.error('Failed to execute query:', error);
      alert('Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  const saveQuery = async () => {
    if (!queryName.trim() || !query.trim()) return;

    try {
      const response = await fetch('/api/threat-lake/queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: queryName,
          description: queryDescription,
          query
        })
      });

      if (response.ok) {
        setShowSaveDialog(false);
        setQueryName('');
        setQueryDescription('');
        fetchSavedQueries();
        alert('Query saved successfully');
      }
    } catch {
      console.error('Failed to save query:', error);
      alert('Failed to save query');
    }
  };

  const loadTemplate = (template: QueryTemplate) => {
    setQuery(template.query);
    setSelectedTemplate(template);
  };

  const loadSavedQuery = (savedQuery: SavedQuery) => {
    setQuery(savedQuery.query);
  };

  const exportResults = () => {
    const csv = [
      ['ID', 'Timestamp', 'Event Type', 'Severity', 'Source Type', 'Title', 'Description'],
      ...results.map(result => [
        result.id,
        result.timestamp,
        result.event_type,
        result.severity,
        result.source_type,
        result.title,
        result.description
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-lake-query-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Query Builder */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Threat Lake Query Interface</h3>
        
        <div className="space-y-4">
          {/* Query Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Query (Lucene syntax)
            </label>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your query (e.g., severity:high AND event_type:malware_detection)"
                className="flex-1 font-mono text-sm"
                onKeyPress={(e) => e.key === 'Enter' && executeQuery()}
              />
              <Button onClick={executeQuery} disabled={loading || !query.trim()}>
                {loading ? 'Executing...' : 'Execute'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(true)}
                disabled={!query.trim()}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Query Help */}
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
            <strong>Query Syntax Examples:</strong>
            <ul className="mt-1 space-y-1">
              <li>• <code>severity:high</code> - Find high severity events</li>
              <li>• <code>event_type:malware_detection</code> - Find malware events</li>
              <li>• <code>source_ip:192.168.1.*</code> - Find events from IP range</li>
              <li>• <code>timestamp:[now-1h TO now]</code> - Events from last hour</li>
              <li>• <code>severity:(high OR critical) AND event_type:authentication_failure</code> - Complex query</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Templates and Saved Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query Templates */}
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Query Templates</h4>
          <div className="space-y-2">
            {queryTemplates.map((template, index) => (
              <div
                key={index}
                className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                  selectedTemplate?.name === template.name ? 'border-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => loadTemplate(template)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{template.name}</span>
                  <Badge variant="outline" className="text-xs">{template.category}</Badge>
                </div>
                <p className="text-xs text-gray-600">{template.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Saved Queries */}
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Saved Queries</h4>
          <div className="space-y-2">
            {savedQueries.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">
                No saved queries yet
              </div>
            ) : (
              savedQueries.map((savedQuery) => (
                <div
                  key={savedQuery.id}
                  className="p-3 border rounded cursor-pointer hover:bg-gray-50"
                  onClick={() => loadSavedQuery(savedQuery)}
                >
                  <div className="font-medium text-sm">{savedQuery.name}</div>
                  <p className="text-xs text-gray-600 mb-1">{savedQuery.description}</p>
                  <div className="text-xs text-gray-500">
                    Created {new Date(savedQuery.created_at).toLocaleDateString()} by {savedQuery.created_by}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Query Results */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="font-semibold">Query Results</h4>
            <p className="text-sm text-gray-600">
              {results.length} events found
            </p>
          </div>
          {results.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportResults}>
              Export CSV
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Executing query...</div>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-2">No results</div>
            <p className="text-sm text-gray-400">
              {query ? 'Try adjusting your query parameters' : 'Enter a query to search the threat lake'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result) => (
              <div key={result.id} className="border rounded p-3 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{result.title}</span>
                    <Badge
                      variant={
                        result.severity === 'critical' || result.severity === 'high'
                          ? 'destructive'
                          : result.severity === 'medium'
                          ? 'warning'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {result.severity}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {result.event_type}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(result.timestamp).toLocaleString()}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">{result.description}</p>
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>ID: {result.id}</span>
                  <span>Source: {result.source_type}</span>
                  {result.metadata.source_ip && (
                    <span>IP: {result.metadata.source_ip}</span>
                  )}
                  {result.metadata.user && (
                    <span>User: {result.metadata.user}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Save Query Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full m-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Save Query</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Query Name
                  </label>
                  <Input
                    value={queryName}
                    onChange={(e) => setQueryName(e.target.value)}
                    placeholder="Enter query name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={queryDescription}
                    onChange={(e) => setQueryDescription(e.target.value)}
                    placeholder="Enter query description"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Query
                  </label>
                  <div className="text-sm font-mono bg-gray-50 p-2 rounded border">
                    {query}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button onClick={saveQuery} disabled={!queryName.trim()}>
                  Save Query
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSaveDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}