import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GraphPayload, GraphNode, GraphEdge, RiskLevel } from '../types';
import { 
  Network, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Filter, 
  Layers, 
  ShieldAlert, 
  Building2, 
  MapPin, 
  UserCheck, 
  FileText, 
  Info,
  Sparkles,
  Search
} from 'lucide-react';

interface RelationshipGraphProps {
  graphData: GraphPayload;
  selectedInitialNodeId?: string | null;
  onSelectNodeForAudit?: (vendorId: string) => void;
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  graphData,
  selectedInitialNodeId,
  onSelectNodeForAudit
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(selectedInitialNodeId || null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [highlightCollusionOnly, setHighlightCollusionOnly] = useState(false);
  const [searchNodeQuery, setSearchNodeQuery] = useState('');

  // Update selected node if prop changes
  useEffect(() => {
    if (selectedInitialNodeId) {
      setSelectedNodeId(selectedInitialNodeId);
      // center on selected node
      const n = graphData.nodes.find(node => node.id === selectedInitialNodeId);
      if (n && n.x && n.y) {
        setPan({ x: 400 - n.x, y: 300 - n.y });
        setZoom(1.1);
      }
    }
  }, [selectedInitialNodeId, graphData]);

  // Compute layout coordinates for nodes (deterministic circular + clustered layout)
  const layoutNodes = useMemo(() => {
    const width = 900;
    const height = 650;
    const cx = width / 2;
    const cy = height / 2;

    // Separate by type
    const vendors = graphData.nodes.filter(n => n.type === 'vendor');
    const addresses = graphData.nodes.filter(n => n.type === 'address');
    const officials = graphData.nodes.filter(n => n.type === 'official');
    const tenders = graphData.nodes.filter(n => n.type === 'tender');

    const positionedNodes: (GraphNode & { x: number; y: number })[] = [];

    // Addresses in inner center cluster
    addresses.forEach((addr, i) => {
      const angle = (i / Math.max(1, addresses.length)) * 2 * Math.PI;
      const r = 110;
      positionedNodes.push({
        ...addr,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      });
    });

    // Vendors around addresses
    vendors.forEach((v, i) => {
      const angle = (i / Math.max(1, vendors.length)) * 2 * Math.PI - 0.2;
      const r = 240;
      positionedNodes.push({
        ...v,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      });
    });

    // Officials on the left/top arc
    officials.forEach((o, i) => {
      const angle = Math.PI * 0.75 + (i / Math.max(1, officials.length)) * Math.PI * 0.5;
      const r = 360;
      positionedNodes.push({
        ...o,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle) - 40
      });
    });

    // Tenders on outer orbit
    tenders.forEach((t, i) => {
      const angle = (i / Math.max(1, tenders.length)) * 2 * Math.PI;
      const r = 350;
      positionedNodes.push({
        ...t,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle) + 20
      });
    });

    return positionedNodes;
  }, [graphData]);

  const nodeMap = useMemo(() => {
    return new Map(layoutNodes.map(n => [n.id, n]));
  }, [layoutNodes]);

  // Selected node object & its immediate neighbors
  const selectedNode = useMemo(() => {
    return layoutNodes.find(n => n.id === selectedNodeId) || null;
  }, [layoutNodes, selectedNodeId]);

  const connectedEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return graphData.edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId);
  }, [graphData.edges, selectedNodeId]);

  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedNodeId) {
      ids.add(selectedNodeId);
      connectedEdges.forEach(e => {
        ids.add(e.source);
        ids.add(e.target);
      });
    }
    return ids;
  }, [selectedNodeId, connectedEdges]);

  // Handle canvas drag / pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'circle' || (e.target as HTMLElement).tagName === 'text') return;
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  // Node coloring
  const getNodeColor = (type: GraphNode['type'], riskScore: number = 0) => {
    if (type === 'vendor') {
      if (riskScore >= 70) return '#e11d48'; // Rose-600
      if (riskScore >= 50) return '#d97706'; // Amber-600
      return '#4f46e5'; // Indigo-600
    }
    if (type === 'address') return '#f59e0b'; // Amber-500
    if (type === 'official') return '#059669'; // Emerald-600
    if (type === 'tender') return '#0284c7'; // Sky-600
    return '#64748b';
  };

  const getNodeIcon = (type: GraphNode['type']) => {
    switch (type) {
      case 'vendor':
        return <Building2 className="w-3.5 h-3.5 text-white" />;
      case 'address':
        return <MapPin className="w-3.5 h-3.5 text-white" />;
      case 'official':
        return <UserCheck className="w-3.5 h-3.5 text-white" />;
      case 'tender':
        return <FileText className="w-3.5 h-3.5 text-white" />;
    }
  };

  // Collusion clusters list for quick filter
  const collusionClusters = [
    {
      name: 'Twin Bidding Cluster Alpha (Apex Infra & Summit Horizons)',
      desc: 'Shared physical address at Suite 404, 742 Evergreen Terr; bids submitted 18s apart on Highway 104 Overpass (TND-902).',
      vendor1: 'vnd_VND-104',
      vendor2: 'vnd_VND-105'
    },
    {
      name: 'Municipal IT Monopolization Cluster (Vanguard & CyberCore)',
      desc: 'Shared address at 88 Industrial Pkwy Ste 3B; submissions within 19s-24s; Vanguard won 80% of window tenders.',
      vendor1: 'vnd_VND-101',
      vendor2: 'vnd_VND-102'
    }
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[760px]">
      {/* Top Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center">
              Procurement Collusion Network & Entity Link Graph
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {layoutNodes.length} Entities • {graphData.edges.length} Relationships
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Uncovering hidden ties between vendors, shared shell addresses, tenders, and procurement officials.
            </p>
          </div>
        </div>

        {/* Action & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick cluster focus button */}
          <button
            onClick={() => setHighlightCollusionOnly(!highlightCollusionOnly)}
            className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              highlightCollusionOnly
                ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
            {highlightCollusionOnly ? 'Showing Collusion Only' : 'Highlight Collusion Cartels'}
          </button>

          {/* Node Type Filter */}
          <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-lg p-1 text-xs">
            <span className="text-slate-500 px-1 font-medium">Type:</span>
            {['ALL', 'vendor', 'address', 'tender', 'official'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2 py-0.5 rounded capitalize font-medium transition-colors ${
                  filterType === t
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Zoom controls */}
          <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-lg p-1">
            <button
              onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-semibold px-1 text-slate-700">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                setSelectedNodeId(null);
              }}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded ml-1"
              title="Reset View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas & Detail Sidebar Container */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* SVG Graph Canvas */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 h-full bg-slate-900 select-none cursor-grab active:cursor-grabbing overflow-hidden relative"
        >
          {/* Background Grid Pattern */}
          <svg className="w-full h-full">
            <defs>
              <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
              </pattern>
              {/* Glow filter for suspect collusion */}
              <filter id="collusion-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#graph-grid)" />

            <g transform={`translate(${pan.x + 80}, ${pan.y + 40}) scale(${zoom})`}>
              {/* Edges */}
              {graphData.edges.map((edge, idx) => {
                const src = nodeMap.get(edge.source);
                const tgt = nodeMap.get(edge.target);
                if (!src || !tgt) return null;

                const isCollusion = edge.relationship === 'SUSPECT_COLLUSION';
                const isSelected = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);

                // If filter collusion only is active
                if (highlightCollusionOnly && !isCollusion && !isSelected) {
                  return null;
                }

                // If filter type is active and endpoints don't match
                if (filterType !== 'ALL') {
                  if (src.type !== filterType && tgt.type !== filterType) return null;
                }

                // Calculate edge style
                let strokeColor = 'rgba(148, 163, 184, 0.25)';
                let strokeWidth = 1.2;
                let strokeDash = undefined;

                if (isCollusion) {
                  strokeColor = '#f43f5e'; // Rose-500
                  strokeWidth = 3;
                  strokeDash = '6,4';
                } else if (edge.relationship === 'REGISTERED_AT') {
                  strokeColor = 'rgba(245, 158, 11, 0.45)'; // Amber
                  strokeWidth = 1.6;
                } else if (edge.relationship === 'WON_TENDER') {
                  strokeColor = 'rgba(16, 185, 129, 0.55)'; // Emerald
                  strokeWidth = 2;
                } else if (isSelected) {
                  strokeColor = '#38bdf8'; // Sky-400
                  strokeWidth = 2.5;
                }

                const midX = (src.x + tgt.x) / 2;
                const midY = (src.y + tgt.y) / 2;

                return (
                  <g key={`edge-${idx}`}>
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      filter={isCollusion ? 'url(#collusion-glow)' : undefined}
                      className={isCollusion ? 'animate-pulse' : ''}
                    />

                    {/* Collusion Label Badge on Edge */}
                    {isCollusion && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x="-58"
                          y="-10"
                          width="116"
                          height="20"
                          rx="4"
                          fill="#be123c"
                          stroke="#fda4af"
                          strokeWidth="1"
                        />
                        <text
                          textAnchor="middle"
                          y="4"
                          fontSize="9"
                          fill="#ffffff"
                          fontWeight="bold"
                        >
                          SUSPECT COLLUSION
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {layoutNodes.map(node => {
                // Filter type check
                if (filterType !== 'ALL' && node.type !== filterType) {
                  return null;
                }

                const isSelected = selectedNodeId === node.id;
                const isConnected = connectedNodeIds.has(node.id);
                const hasHighRisk = (node.risk_score || 0) >= 50;

                let r = 16;
                if (node.type === 'vendor') r = 20;
                if (node.type === 'address') r = 18;
                if (node.type === 'tender') r = 17;
                if (node.type === 'official') r = 18;

                const nodeColor = getNodeColor(node.type, node.risk_score);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    className="cursor-pointer group"
                  >
                    {/* Pulsing ring for high risk or collusion */}
                    {hasHighRisk && (
                      <circle
                        r={r + 8}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="2"
                        strokeDasharray="4,4"
                        className="animate-spin"
                        style={{ animationDuration: '8s' }}
                      />
                    )}

                    {/* Selection halo */}
                    {isSelected && (
                      <circle
                        r={r + 6}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="3"
                      />
                    )}

                    {/* Main Node Circle */}
                    <circle
                      r={r}
                      fill={nodeColor}
                      stroke="#ffffff"
                      strokeWidth={isSelected ? 3 : 1.5}
                      className="transition-transform group-hover:scale-110 shadow-lg"
                    />

                    {/* Node Type Initial or Badge */}
                    <text
                      textAnchor="middle"
                      dy="4"
                      fontSize="10"
                      fill="#ffffff"
                      fontWeight="bold"
                      className="pointer-events-none"
                    >
                      {node.type === 'vendor' ? 'V' : node.type === 'address' ? 'A' : node.type === 'tender' ? 'T' : 'O'}
                    </text>

                    {/* Node Label */}
                    <text
                      textAnchor="middle"
                      y={r + 14}
                      fontSize="11"
                      fill={isSelected ? '#38bdf8' : '#e2e8f0'}
                      fontWeight={isSelected ? 'bold' : '500'}
                      className="pointer-events-none select-none drop-shadow-md"
                    >
                      {node.label.length > 22 ? `${node.label.substring(0, 20)}...` : node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Canvas Floating Legend */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-xl text-xs text-slate-300 space-y-2 pointer-events-auto">
            <div className="font-semibold text-white flex items-center">
              <Layers className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              Graph Legend
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-rose-600 mr-2 shrink-0 border border-white/40" />
                <span>Vendor (Critical Risk)</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-indigo-600 mr-2 shrink-0 border border-white/40" />
                <span>Vendor (Standard)</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-amber-500 mr-2 shrink-0 border border-white/40" />
                <span>Physical Address</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-emerald-600 mr-2 shrink-0 border border-white/40" />
                <span>Procurement Official</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-sky-600 mr-2 shrink-0 border border-white/40" />
                <span>Tender Contract</span>
              </div>
              <div className="flex items-center text-rose-400 font-bold">
                <span className="w-4 h-0.5 bg-rose-500 mr-2 inline-block border-t border-dashed border-rose-300" />
                <span>Suspect Collusion</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Inspection Drawer / Sidebar */}
        <div className="w-80 border-l border-slate-200 bg-white p-5 overflow-y-auto flex flex-col justify-between shrink-0 shadow-lg">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Inspected Node
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${
                  selectedNode.type === 'vendor' ? 'bg-indigo-100 text-indigo-800' :
                  selectedNode.type === 'address' ? 'bg-amber-100 text-amber-800' :
                  selectedNode.type === 'official' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-sky-100 text-sky-800'
                }`}>
                  {selectedNode.type}
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900">
                  {selectedNode.label}
                </h4>
                <p className="font-mono text-xs text-slate-500 mt-0.5">
                  ID: {selectedNode.id}
                </p>
              </div>

              {selectedNode.risk_score && selectedNode.risk_score > 0 ? (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800">
                      Calculated Anomaly Risk:
                    </span>
                    <span className="text-sm font-bold text-rose-700">
                      {selectedNode.risk_score}/100
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-700 mt-1">
                    Multiple red flags triggered across tender submissions.
                  </p>
                </div>
              ) : null}

              {/* Node Specific Metadata */}
              <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {selectedNode.details?.address && (
                  <div>
                    <span className="font-semibold text-slate-700">Registered Address:</span>
                    <p className="text-slate-900 mt-0.5">{selectedNode.details.address}</p>
                  </div>
                )}
                {selectedNode.details?.full_address && (
                  <div>
                    <span className="font-semibold text-slate-700">Address String:</span>
                    <p className="text-slate-900 mt-0.5">{selectedNode.details.full_address}</p>
                  </div>
                )}
                {selectedNode.details?.title && (
                  <div>
                    <span className="font-semibold text-slate-700">Contract Title:</span>
                    <p className="text-slate-900 mt-0.5">{selectedNode.details.title}</p>
                  </div>
                )}
                {selectedNode.details?.role && (
                  <div>
                    <span className="font-semibold text-slate-700">Official Role:</span>
                    <p className="text-slate-900 mt-0.5">{selectedNode.details.role}</p>
                  </div>
                )}
              </div>

              {/* Connected Relationships list */}
              <div>
                <span className="text-xs font-bold text-slate-900 block mb-2">
                  Connected Links ({connectedEdges.length})
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {connectedEdges.map((e, idx) => {
                    const otherId = e.source === selectedNode.id ? e.target : e.source;
                    const otherNode = nodeMap.get(otherId);
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedNodeId(otherId)}
                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs flex items-center justify-between transition-colors"
                      >
                        <div className="truncate mr-2">
                          <span className="font-semibold text-slate-900 block truncate">
                            {otherNode?.label || otherId}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {e.relationship}
                          </span>
                        </div>
                        {e.risk === 'Critical' && (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            Alert
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              {selectedNode.type === 'vendor' && onSelectNodeForAudit && (
                <button
                  onClick={() => {
                    const rawVendorId = selectedNode.id.replace('vnd_', '');
                    onSelectNodeForAudit(rawVendorId);
                  }}
                  className="w-full inline-flex items-center justify-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
                >
                  View Vendor Anomalies in Table
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-12 space-y-4">
              <Info className="w-8 h-8 text-slate-300 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Select an Entity Node
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Click on any vendor, address, official, or tender node on the canvas to inspect its relationships and fraud indicators.
                </p>
              </div>

              {/* Pre-packaged suspicious clusters */}
              <div className="text-left pt-4 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  Suspicious Cartels to Audit:
                </span>
                <div className="space-y-2">
                  {collusionClusters.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setSelectedNodeId(c.vendor1);
                        const n = nodeMap.get(c.vendor1);
                        if (n) setPan({ x: 380 - n.x, y: 280 - n.y });
                      }}
                      className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/70 cursor-pointer transition-colors"
                    >
                      <span className="text-xs font-bold text-rose-900 block">
                        {c.name}
                      </span>
                      <p className="text-[11px] text-rose-700 mt-1 leading-snug">
                        {c.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 text-center">
            <span className="text-[11px] text-slate-400">
              Interactive SVG Graph Engine • Drag to pan • Scroll to zoom
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
