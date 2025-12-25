'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface DataSource {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error' | 'connecting';
  last_heartbeat: string;
  events_processed: number;
  created_at: string;
}

interface DataFlowNode {
  id: string;
  name: string;
  type: 'source' | 'processor' | 'destination';
  status: 'active' | 'inactive' | 'error';
  throughput: number;
  connections: string[];
}

interface DataFlowVisualizationProps {
  dataSources: DataSource[];
}

export function DataFlowVisualization({ dataSources }: DataFlowVisualizationProps) {
  const [flowData, setFlowData] = useState<DataFlowNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [troubleshootingMode, setTroubleshootingMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlowData();
    const interval = setInterval(fetchFlowData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [dataSources]);

  const fetchFlowData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/data-sources/flow');
      if (response.ok) {
        const data = await response.json();
        setFlowData(data.flow_nodes || []);
      }
    } catch (error) {
      console.error('Failed to fetch flow data:', error);
      // Generate mock flow data for demonstration
      generateMockFlowData();
    } finally {
      setLoading(false);
    }
  };

  const generateMockFlowData = () => {
    const nodes: DataFlowNode[] = [
      // Data Sources - grouped by company
      ...dataSources.map(source => ({
        id: source.id,
        name: `${(source as any).company?.split(' ')[0] || 'Unknown'} - ${source.name.split(' - ')[1] || source.name}`,
        type: 'source' as const,
        status: source.status === 'active' ? 'active' as const : 
                source.status === 'error' ? 'error' as const : 
                (source as any).status === 'warning' ? 'error' as const : 'inactive' as const,
        throughput: Math.floor(source.events_processed / 100) + Math.floor(Math.random() * 100),
        connections: ['normalizer'],
        company: (source as any).company,
        location: (source as any).location
      })),
      // Processing Nodes
      {
        id: 'normalizer',
        name: 'Multi-Tenant Data Normalizer',
        type: 'processor' as const,
        status: 'active' as const,
        throughput: dataSources.reduce((sum, s) => sum + Math.floor(s.events_processed / 100), 0),
        connections: ['enricher']
      },
      {
        id: 'enricher',
        name: 'AI Threat Enricher',
        type: 'processor' as const,
        status: 'active' as const,
        throughput: Math.floor(dataSources.reduce((sum, s) => sum + s.events_processed, 0) / 150),
        connections: ['correlator', 'threat-lake']
      },
      {
        id: 'correlator',
        name: 'Cross-Tenant Event Correlator',
        type: 'processor' as const,
        status: 'active' as const,
        throughput: Math.floor(dataSources.reduce((sum, s) => sum + s.events_processed, 0) / 200),
        connections: ['alert-engine']
      },
      // Destinations
      {
        id: 'threat-lake',
        name: 'AVIAN Global Threat Lake',
        type: 'destination' as const,
        status: 'active' as const,
        throughput: Math.floor(dataSources.reduce((sum, s) => sum + s.events_processed, 0) / 120),
        connections: []
      },
      {
        id: 'alert-engine',
        name: 'Multi-Tenant Alert Engine',
        type: 'destination' as const,
        status: 'active' as const,
        throughput: Math.floor(dataSources.reduce((sum, s) => sum + s.events_processed, 0) / 500),
        connections: []
      }
    ];
    setFlowData(nodes);
  };

  const getNodeColor = (node: DataFlowNode) => {
    if (troubleshootingMode && node.status === 'error') return 'bg-red-500';
    if (troubleshootingMode && node.throughput === 0) return 'bg-yellow-500';
    
    switch (node.type) {
      case 'source': return node.status === 'active' ? 'bg-blue-500' : 'bg-gray-400';
      case 'processor': return node.status === 'active' ? 'bg-green-500' : 'bg-gray-400';
      case 'destination': return node.status === 'active' ? 'bg-purple-500' : 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'source': return '📡';
      case 'processor': return '⚙️';
      case 'destination': return '🗄️';
      default: return '❓';
    }
  };

  const formatThroughput = (throughput: number) => {
    if (throughput >= 1000) return `${(throughput / 1000).toFixed(1)}K/s`;
    return `${throughput}/s`;
  };

  const runDiagnostics = async (nodeId: string) => {
    try {
      const response = await fetch(`/api/data-sources/${nodeId}/diagnostics`, {
        method: 'POST'
      });
      const _result = await response.json();
      alert(`Diagnostics for ${nodeId}:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      alert('Failed to run diagnostics');
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading data flow visualization...</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Data Flow Visualization</h3>
            <p className="text-sm text-gray-600">Real-time view of data processing pipeline</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={troubleshootingMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setTroubleshootingMode(!troubleshootingMode)}
            >
              {troubleshootingMode ? 'Exit Troubleshooting' : 'Troubleshooting Mode'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchFlowData}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Flow Visualization */}
      <Card className="p-6">
        <div className="space-y-8">
          {/* Data Sources Layer - Grouped by Company */}
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-3">Data Sources by Company</h4>
            <div className="space-y-4">
              {(() => {
                const sourceNodes = flowData.filter(node => node.type === 'source');
                const companiesMap = new Map();
                
                sourceNodes.forEach(node => {
                  const company = (node as any).company || 'Unknown Company';
                  if (!companiesMap.has(company)) {
                    companiesMap.set(company, []);
                  }
                  companiesMap.get(company).push(node);
                });

                return Array.from(companiesMap.entries()).map(([company, nodes]) => (
                  <div key={company} className="border rounded-lg p-3 bg-gray-50">
                    <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>{company}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {nodes.length} source{nodes.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {nodes.map((node: any) => (
                        <div
                          key={node.id}
                          className={`relative p-3 rounded border cursor-pointer transition-all ${
                            selectedNode === node.id ? 'border-blue-500 shadow-md bg-white' : 'border-gray-200 bg-white'
                          }`}
                          onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                        >
                          <div className={`w-2 h-2 rounded-full ${getNodeColor(node)} mb-1`}></div>
                          <div className="text-xs font-medium">{getNodeIcon(node.type)} {node.name}</div>
                          <div className="text-xs text-gray-500">{formatThroughput(node.throughput)}</div>
                          <div className="text-xs text-gray-400">{node.location}</div>
                          {troubleshootingMode && node.status === 'error' && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">!</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Processing Layer */}
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-3">Processing Pipeline</h4>
            <div className="flex justify-center">
              <div className="flex items-center gap-8">
                {flowData.filter(node => node.type === 'processor').map((node, index) => (
                  <React.Fragment key={node.id}>
                    <div
                      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedNode === node.id ? 'border-blue-500 shadow-lg' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                    >
                      <div className={`w-3 h-3 rounded-full ${getNodeColor(node)} mb-2`}></div>
                      <div className="text-sm font-medium">{getNodeIcon(node.type)} {node.name}</div>
                      <div className="text-xs text-gray-500">{formatThroughput(node.throughput)}</div>
                      {troubleshootingMode && node.throughput === 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">⚠</span>
                        </div>
                      )}
                    </div>
                    {index < flowData.filter(n => n.type === 'processor').length - 1 && (
                      <div className="w-8 h-0.5 bg-gray-300"></div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Destinations Layer */}
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-3">Destinations</h4>
            <div className="flex justify-center gap-8">
              {flowData.filter(node => node.type === 'destination').map(node => (
                <div
                  key={node.id}
                  className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedNode === node.id ? 'border-blue-500 shadow-lg' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                >
                  <div className={`w-3 h-3 rounded-full ${getNodeColor(node)} mb-2`}></div>
                  <div className="text-sm font-medium">{getNodeIcon(node.type)} {node.name}</div>
                  <div className="text-xs text-gray-500">{formatThroughput(node.throughput)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Node Details */}
      {selectedNode && (
        <Card className="p-6">
          {(() => {
            const node = flowData.find(n => n.id === selectedNode);
            if (!node) return null;
            
            return (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{node.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={node.status === 'active' ? 'secondary' : 'destructive'}
                        className={node.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {node.status}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {node.type.charAt(0).toUpperCase() + node.type.slice(1)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runDiagnostics(node.id)}
                  >
                    Run Diagnostics
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Throughput</div>
                    <div className="text-xl font-mono">{formatThroughput(node.throughput)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Connections</div>
                    <div className="text-xl font-mono">{node.connections.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <div className="text-xl">{node.status}</div>
                  </div>
                </div>
                
                {node.connections.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm text-gray-600 mb-2">Connected To:</div>
                    <div className="flex flex-wrap gap-2">
                      {node.connections.map(connId => {
                        const connectedNode = flowData.find(n => n.id === connId);
                        return connectedNode ? (
                          <Badge key={connId} variant="outline">
                            {connectedNode.name}
                          </Badge>
                        ) : (
                          <Badge key={connId} variant="secondary">
                            {connId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Troubleshooting Tools */}
      {troubleshootingMode && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Troubleshooting Tools</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Common Issues</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Red nodes: Connection or processing errors</li>
                <li>• Yellow nodes: Zero throughput (potential bottleneck)</li>
                <li>• Check network connectivity for source nodes</li>
                <li>• Verify authentication credentials</li>
                <li>• Monitor resource usage on processing nodes</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Quick Actions</h4>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full">
                  Test All Connections
                </Button>
                <Button variant="outline" size="sm" className="w-full">
                  Restart Processing Pipeline
                </Button>
                <Button variant="outline" size="sm" className="w-full">
                  Export Diagnostic Report
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

