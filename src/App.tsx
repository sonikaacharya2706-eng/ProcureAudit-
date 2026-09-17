import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AnomalyCase, BidRecord, RiskLevel } from './types';
import { 
  runProcurementAnomalyEngine, 
  calculateSystemMetrics, 
  buildRelationshipGraph, 
  saveAuditOverride, 
  resetAuditOverrides 
} from './analytics/engine';
import { Header } from './components/Header';
import { MetricsCards } from './components/MetricsCards';
import { AnomalyTable } from './components/AnomalyTable';
import { InvestigationModal } from './components/InvestigationModal';
import { RelationshipGraph } from './components/RelationshipGraph';
import { RawBidsExplorer } from './components/RawBidsExplorer';
import { RAW_BIDS_DATA } from './data/rawBids';
import { AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'graph' | 'bids'>('dashboard');
  const [anomalies, setAnomalies] = useState<AnomalyCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<AnomalyCase | null>(null);
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [graphInitialNode, setGraphInitialNode] = useState<string | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show temporary toast notification
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  // Recalculate anomalies from analytics engine
  const refreshAnomalies = useCallback(() => {
    const computed = runProcurementAnomalyEngine();
    setAnomalies(computed);
  }, []);

  // Initial load
  useEffect(() => {
    refreshAnomalies();

    // Check if python backend is active on localhost:8000
    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 1000);
        const res = await fetch('http://127.0.0.1:8000/api/health', { signal: controller.signal });
        clearTimeout(t);
        if (res.ok) {
          setIsBackendConnected(true);
        }
      } catch {
        setIsBackendConnected(false);
      }
    };
    checkBackend();
  }, [refreshAnomalies]);

  // Derived metrics and graph
  const metrics = useMemo(() => {
    return calculateSystemMetrics(anomalies);
  }, [anomalies]);

  const graphData = useMemo(() => {
    return buildRelationshipGraph(anomalies);
  }, [anomalies]);

  // Save audit updates (from modal or quick action)
  const handleSaveAudit = (
    bidId: string,
    status: AnomalyCase['audit_status'],
    notes: string,
    auditor: string
  ) => {
    saveAuditOverride(bidId, {
      audit_status: status,
      audit_notes: notes,
      auditor
    });

    // Also attempt to push to Python backend if reachable
    fetch('http://127.0.0.1:8000/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bid_id: bidId,
        audit_status: status,
        audit_notes: notes,
        auditor
      })
    }).catch(() => {
      // Offline fallback already persisted via local analytics engine
    });

    refreshAnomalies();
    if (selectedCase && selectedCase.bid_id === bidId) {
      setSelectedCase(prev => prev ? { ...prev, audit_status: status, audit_notes: notes, auditor } : null);
    }
    showToast(`Audit determination '${status}' recorded for ${bidId}.`);
  };

  // Quick toggle false positive
  const handleToggleFalsePositive = (bidId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'False Positive' ? 'Under Review' : 'False Positive';
    const notes = newStatus === 'False Positive' ? 'Marked as False Positive by Investigator via quick action' : 'Re-opened for forensic review';
    handleSaveAudit(bidId, newStatus as any, notes, 'Investigator');
  };

  // Reset all audit changes
  const handleResetAudit = () => {
    if (window.confirm('Reset all investigator triage determinations and audit notes back to factory baseline?')) {
      resetAuditOverrides();
      refreshAnomalies();
      showToast('Investigative triage records reset to factory baseline.');
    }
  };

  // Export CSV Dossier
  const handleExportCSV = () => {
    const headers = [
      'bid_id',
      'tender_id',
      'tender_title',
      'tender_category',
      'vendor_id',
      'vendor_name',
      'bid_amount',
      'submission_timestamp',
      'vendor_address',
      'risk_score',
      'risk_level',
      'evidence_trail',
      'audit_status',
      'audit_notes'
    ];

    const rows = anomalies.map(a => [
      a.bid_id,
      a.tender_id,
      `"${a.tender_title.replace(/"/g, '""')}"`,
      `"${a.tender_category}"`,
      a.vendor_id,
      `"${a.vendor_name.replace(/"/g, '""')}"`,
      a.bid_amount,
      a.submission_timestamp,
      `"${a.vendor_address.replace(/"/g, '""')}"`,
      a.risk_score,
      a.risk_level,
      `"${a.evidence_trail.replace(/"/g, '""')}"`,
      a.audit_status,
      `"${(a.audit_notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `procure_audit_anomalies_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported CSV dossier with explainable evidence trails.');
  };

  // Jump to graph with specific node highlighted
  const handleJumpToGraph = (vendorNodeId: string) => {
    setGraphInitialNode(vendorNodeId);
    setActiveTab('graph');
  };

  return (
    <div className="min-h-screen bg-slate-100/60 flex flex-col text-slate-900 font-sans antialiased">
      {/* Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        flaggedCount={metrics.flagged_cases_count}
        onResetAudit={handleResetAudit}
        onExportReport={handleExportCSV}
        isBackendConnected={isBackendConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Executive Metric Cards */}
            <MetricsCards
              metrics={metrics}
              onFilterPending={() => setSelectedStatusFilter('Pending/Review')}
              onFilterHighRisk={() => setSelectedRiskFilter('High')}
            />

            {/* Anomaly Risk Table */}
            <AnomalyTable
              anomalies={anomalies}
              onSelectCase={setSelectedCase}
              onToggleFalsePositive={handleToggleFalsePositive}
              selectedRiskFilter={selectedRiskFilter}
              setSelectedRiskFilter={setSelectedRiskFilter}
              selectedStatusFilter={selectedStatusFilter}
              setSelectedStatusFilter={setSelectedStatusFilter}
              onOpenGraphWithNode={handleJumpToGraph}
            />
          </div>
        )}

        {activeTab === 'graph' && (
          <div className="space-y-4">
            <RelationshipGraph
              graphData={graphData}
              selectedInitialNodeId={graphInitialNode}
              onSelectNodeForAudit={(vendorId) => {
                setActiveTab('dashboard');
                // find case with this vendor
                const match = anomalies.find(a => a.vendor_id === vendorId);
                if (match) setSelectedCase(match);
              }}
            />
          </div>
        )}

        {activeTab === 'bids' && (
          <div className="space-y-4">
            <RawBidsExplorer
              onSelectBidForAudit={(bid) => {
                const anom = anomalies.find(a => a.bid_id === bid.bid_id);
                if (anom) {
                  setSelectedCase(anom);
                } else {
                  showToast(`Bid ${bid.bid_id} is within statistical baseline limits.`);
                }
              }}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <span>ProcureAudit Anomaly Detection System</span>
          </div>
          <div>
            Built with 3 Automated Detection Rules: Category Z-Scores • Twin Address & Time Collusion • Win-Rate Monopolies
          </div>
        </div>
      </footer>

      {/* Investigation Dossier Modal */}
      {selectedCase && (
        <InvestigationModal
          anomalyCase={selectedCase}
          onClose={() => setSelectedCase(null)}
          onSaveAudit={handleSaveAudit}
          onJumpToGraph={handleJumpToGraph}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-800 flex items-center space-x-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
