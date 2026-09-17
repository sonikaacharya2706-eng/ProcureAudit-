import React, { useState } from 'react';
import { AnomalyCase } from '../types';
import { 
  X, 
  ShieldAlert, 
  Building2, 
  FileText, 
  Clock, 
  TrendingUp, 
  Network, 
  CheckCircle2, 
  AlertTriangle,
  UserCheck,
  MapPin,
  Calendar,
  Save,
  ArrowRight
} from 'lucide-react';

interface InvestigationModalProps {
  anomalyCase: AnomalyCase | null;
  onClose: () => void;
  onSaveAudit: (bidId: string, status: AnomalyCase['audit_status'], notes: string, auditor: string) => void;
  onJumpToGraph?: (vendorId: string) => void;
}

export const InvestigationModal: React.FC<InvestigationModalProps> = ({
  anomalyCase,
  onClose,
  onSaveAudit,
  onJumpToGraph
}) => {
  if (!anomalyCase) return null;

  const [status, setStatus] = useState<AnomalyCase['audit_status']>(anomalyCase.audit_status);
  const [notes, setNotes] = useState(anomalyCase.audit_notes || '');
  const [auditor, setAuditor] = useState(anomalyCase.auditor || 'Senior Inspector J. Miller');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAudit(anomalyCase.bid_id, status, notes, auditor);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              anomalyCase.risk_level === 'Critical'
                ? 'bg-rose-100 text-rose-700'
                : anomalyCase.risk_level === 'High'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">
                  Investigative Audit Dossier
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                  {anomalyCase.bid_id}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  anomalyCase.risk_level === 'Critical'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {anomalyCase.risk_level} Risk ({anomalyCase.risk_score}/100)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Tender: {anomalyCase.tender_id} • Category: {anomalyCase.tender_category}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Key Subject Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Vendor Under Audit
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {anomalyCase.vendor_name}
              </div>
              <div className="text-xs text-slate-600 font-mono mt-0.5">
                ID: {anomalyCase.vendor_id}
              </div>
              <div className="flex items-center text-xs text-slate-600 mt-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                <span className="truncate">{anomalyCase.vendor_address}</span>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Procurement Contract
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {anomalyCase.tender_title}
              </div>
              <div className="flex items-center space-x-3 text-xs text-slate-600 mt-2">
                <span className="flex items-center">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400 mr-1" />
                  Official: <strong className="ml-1 text-slate-800">{anomalyCase.procurement_official}</strong>
                </span>
                <span className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1" />
                  Window: <strong className="ml-1 text-slate-800">{anomalyCase.evaluation_window}</strong>
                </span>
              </div>
              <div className="mt-2 text-xs">
                Submission: <span className="font-mono text-slate-700">{anomalyCase.submission_timestamp}</span>
              </div>
            </div>
          </div>

          {/* Explainable Evidence Trail Details */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-500" />
              Explainable Evidence Trail & Automated Rule Hits
            </h4>
            <div className="space-y-2.5">
              {anomalyCase.flags.map(flag => (
                <div
                  key={flag.rule_id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900">
                        {flag.rule_name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        [{flag.rule_id}]
                      </span>
                    </div>
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                      +{flag.score_contribution} pts severity
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">
                    {flag.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Mathematical & Statistical Verification Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Price Deviation Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase mb-2">
                <span>Rule 1: Price Deviation Z-Score</span>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                ${(anomalyCase.bid_amount / 1e6).toFixed(2)}M
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Category Mean: ${((anomalyCase.category_mean || 0) / 1e6).toFixed(2)}M
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-600">Calculated Z-Score:</span>
                <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                  {anomalyCase.price_z_score !== null ? (anomalyCase.price_z_score > 0 ? `+${anomalyCase.price_z_score}` : anomalyCase.price_z_score) : 'N/A'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-slate-600">Deviation Percentage:</span>
                <span className="font-semibold text-slate-900">
                  {anomalyCase.price_deviation_pct !== null ? `${anomalyCase.price_deviation_pct}%` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Collusion & Network Link Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase mb-2">
                <span>Rule 2 & 3: Collusion & Win-Rate</span>
                <Network className="w-4 h-4 text-slate-400" />
              </div>
              {anomalyCase.collusion_counterparts && anomalyCase.collusion_counterparts.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-rose-700">Competitor Twin Links:</span>
                  {anomalyCase.collusion_counterparts.map((cp, idx) => (
                    <div key={idx} className="text-xs bg-rose-50 p-2 rounded border border-rose-100 text-rose-900">
                      <strong>{cp.vendor_name}</strong>: {cp.reason}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No direct twin-address collision in this specific tender record.
                </p>
              )}
              {onJumpToGraph && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onJumpToGraph(`vnd_${anomalyCase.vendor_id}`);
                  }}
                  className="mt-3 w-full inline-flex items-center justify-center text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg border border-indigo-200 transition-colors"
                >
                  Inspect in Collusion Network Graph
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </button>
              )}
            </div>
          </div>

          {/* Form: Audit Status Update & Investigator Log */}
          <form onSubmit={handleSave} className="p-4 rounded-xl border border-slate-300 bg-slate-50/70 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center">
              <UserCheck className="w-4 h-4 mr-1.5 text-slate-700" />
              Investigator Audit Action & Triage Sign-Off
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audit Determination Status
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="Pending Review">Pending Review</option>
                  <option value="Under Review">Under Review (Formal Investigation)</option>
                  <option value="Confirmed Anomaly">Confirmed Anomaly (Bid-Rigging Suspect)</option>
                  <option value="False Positive">False Positive (Justified Variance)</option>
                  <option value="Escalated to OIG">Escalated to Inspector General (OIG)</option>
                  <option value="Resolved">Resolved & Cleared</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Investigator Name / Badge ID
                </label>
                <input
                  type="text"
                  value={auditor}
                  onChange={e => setAuditor(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="e.g. Senior Investigator J. Miller"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Investigative Notes & Evidence Findings
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Document verification findings, sub-contractor inquiries, company registry filings, or justification for false positive..."
                className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500">
                {isSaved ? (
                  <span className="text-emerald-600 font-semibold flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Audit record persisted to backend audit trail!
                  </span>
                ) : (
                  <span>Updates immediately reflect across system risk metrics and reports.</span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Audit Determination
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
