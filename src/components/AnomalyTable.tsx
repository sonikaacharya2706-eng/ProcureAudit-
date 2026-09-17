import React, { useState, useMemo } from 'react';
import { AnomalyCase, RiskLevel } from '../types';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ChevronRight, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Building2, 
  FileText, 
  AlertOctagon,
  HelpCircle,
  ExternalLink,
  CheckCircle,
  XCircle,
  TrendingUp,
  Tag
} from 'lucide-react';

interface AnomalyTableProps {
  anomalies: AnomalyCase[];
  onSelectCase: (anomalyCase: AnomalyCase) => void;
  onToggleFalsePositive: (bidId: string, currentStatus: string) => void;
  selectedRiskFilter?: RiskLevel | 'ALL';
  setSelectedRiskFilter: (filter: RiskLevel | 'ALL') => void;
  selectedStatusFilter: string;
  setSelectedStatusFilter: (status: string) => void;
  onOpenGraphWithNode?: (nodeId: string) => void;
}

export const AnomalyTable: React.FC<AnomalyTableProps> = ({
  anomalies,
  onSelectCase,
  onToggleFalsePositive,
  selectedRiskFilter = 'ALL',
  setSelectedRiskFilter,
  selectedStatusFilter,
  setSelectedStatusFilter,
  onOpenGraphWithNode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'risk_score' | 'bid_amount' | 'timestamp'>('risk_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set(anomalies.map(a => a.tender_category));
    return ['ALL', ...Array.from(cats)];
  }, [anomalies]);

  // Filter and sort anomalies
  const filteredAnomalies = useMemo(() => {
    return anomalies
      .filter(a => {
        // Risk Filter
        if (selectedRiskFilter !== 'ALL' && a.risk_level !== selectedRiskFilter) return false;
        
        // Status Filter
        if (selectedStatusFilter !== 'ALL') {
          if (selectedStatusFilter === 'Pending/Review' && !(a.audit_status === 'Pending Review' || a.audit_status === 'Under Review')) {
            return false;
          } else if (selectedStatusFilter !== 'Pending/Review' && a.audit_status !== selectedStatusFilter) {
            return false;
          }
        }

        // Category Filter
        if (categoryFilter !== 'ALL' && a.tender_category !== categoryFilter) return false;

        // Search Term
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matches =
            a.vendor_name.toLowerCase().includes(q) ||
            a.bid_id.toLowerCase().includes(q) ||
            a.tender_id.toLowerCase().includes(q) ||
            a.tender_title.toLowerCase().includes(q) ||
            a.evidence_trail.toLowerCase().includes(q) ||
            a.vendor_address.toLowerCase().includes(q) ||
            a.procurement_official.toLowerCase().includes(q);
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'risk_score') {
          diff = a.risk_score - b.risk_score;
        } else if (sortField === 'bid_amount') {
          diff = a.bid_amount - b.bid_amount;
        } else if (sortField === 'timestamp') {
          diff = new Date(a.submission_timestamp).getTime() - new Date(b.submission_timestamp).getTime();
        }
        return sortOrder === 'desc' ? -diff : diff;
      });
  }, [anomalies, selectedRiskFilter, selectedStatusFilter, categoryFilter, searchTerm, sortField, sortOrder]);

  const handleSort = (field: 'risk_score' | 'bid_amount' | 'timestamp') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getRiskBadge = (level: RiskLevel, score: number) => {
    let bg = 'bg-slate-100 text-slate-700 border-slate-200';
    let dot = 'bg-slate-400';
    if (level === 'Critical') {
      bg = 'bg-rose-50 text-rose-700 border-rose-200';
      dot = 'bg-rose-500';
    } else if (level === 'High') {
      bg = 'bg-amber-50 text-amber-700 border-amber-200';
      dot = 'bg-amber-500';
    } else if (level === 'Medium') {
      bg = 'bg-blue-50 text-blue-700 border-blue-200';
      dot = 'bg-blue-500';
    }

    return (
      <div className="flex flex-col items-start">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dot}`} />
          {level} ({score})
        </span>
        <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              level === 'Critical' ? 'bg-rose-500' : level === 'High' ? 'bg-amber-500' : 'bg-blue-500'
            }`} 
            style={{ width: `${score}%` }} 
          />
        </div>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Under Review':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 mr-1 text-amber-500" />
            Under Review
          </span>
        );
      case 'Confirmed Anomaly':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
            <AlertOctagon className="w-3 h-3 mr-1 text-rose-500" />
            Confirmed Fraud
          </span>
        );
      case 'False Positive':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
            <ShieldCheck className="w-3 h-3 mr-1 text-slate-500" />
            False Positive
          </span>
        );
      case 'Escalated to OIG':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-800 border border-purple-200">
            <ShieldAlert className="w-3 h-3 mr-1 text-purple-500" />
            Escalated to OIG
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" />
            Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-200">
            <HelpCircle className="w-3 h-3 mr-1 text-yellow-500" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Controls Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search vendor, tender ID, address, official, evidence..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Risk Filter */}
          <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-lg p-1 text-xs">
            <span className="text-slate-500 px-2 font-medium">Risk:</span>
            {(['ALL', 'Critical', 'High', 'Medium'] as const).map(risk => (
              <button
                key={risk}
                onClick={() => setSelectedRiskFilter(risk)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  selectedRiskFilter === risk
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {risk}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="ALL">All Audit Statuses</option>
            <option value="Pending/Review">Pending & Under Review</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Under Review">Under Review</option>
            <option value="Confirmed Anomaly">Confirmed Anomaly</option>
            <option value="False Positive">False Positive</option>
            <option value="Escalated to OIG">Escalated to OIG</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 max-w-[160px] truncate"
          >
            {categories.map(c => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count & Active Status */}
      <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div>
          Showing <span className="font-bold text-slate-900">{filteredAnomalies.length}</span> of {anomalies.length} flagged anomaly cases
          {searchTerm && <span className="italic ml-1">matching "{searchTerm}"</span>}
        </div>
        <div className="flex items-center space-x-3">
          <span className="hidden sm:inline">Ranked by calculated ML risk score</span>
          <button
            onClick={() => handleSort('risk_score')}
            className="font-medium text-slate-700 hover:text-slate-900 flex items-center"
          >
            Sort by Risk <ArrowUpDown className="w-3 h-3 ml-1" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">
                <button
                  onClick={() => handleSort('risk_score')}
                  className="flex items-center hover:text-slate-900"
                >
                  Risk Score
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </button>
              </th>
              <th className="py-3 px-4">Vendor Name</th>
              <th className="py-3 px-4">Tender Details</th>
              <th className="py-3 px-4">
                <button
                  onClick={() => handleSort('bid_amount')}
                  className="flex items-center hover:text-slate-900"
                >
                  Bid Amount
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </button>
              </th>
              <th className="py-3 px-4 min-w-[340px]">Explainable Evidence Trail</th>
              <th className="py-3 px-4">Audit Status</th>
              <th className="py-3 px-4 text-right">Investigator Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredAnomalies.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <AlertOctagon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium">No anomaly cases found matching filter criteria</p>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedRiskFilter('ALL');
                      setSelectedStatusFilter('ALL');
                      setCategoryFilter('ALL');
                    }}
                    className="mt-2 text-xs font-semibold text-slate-800 hover:underline"
                  >
                    Reset all filters
                  </button>
                </td>
              </tr>
            ) : (
              filteredAnomalies.map(caseItem => {
                const isFalsePositive = caseItem.audit_status === 'False Positive';

                return (
                  <tr
                    key={caseItem.bid_id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isFalsePositive ? 'opacity-60 bg-slate-50/40' : ''
                    }`}
                  >
                    {/* Risk Score */}
                    <td className="py-3.5 px-4 align-top">
                      {getRiskBadge(caseItem.risk_level, caseItem.risk_score)}
                    </td>

                    {/* Vendor Name & ID */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="font-semibold text-slate-900 flex items-center">
                        {caseItem.vendor_name}
                        {caseItem.is_winner === 1 && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            WINNER
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono flex items-center mt-0.5">
                        <span>{caseItem.vendor_id}</span>
                        <span className="mx-1">•</span>
                        <span>{caseItem.bid_id}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 max-w-[180px] truncate" title={caseItem.vendor_address}>
                        {caseItem.vendor_address}
                      </div>
                    </td>

                    {/* Tender Details */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="font-medium text-slate-900 text-xs sm:text-sm">
                        {caseItem.tender_title}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono text-slate-600">{caseItem.tender_id}</span>
                        <span>•</span>
                        <span className="truncate max-w-[130px]">{caseItem.tender_category}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Official: <span className="text-slate-600 font-medium">{caseItem.procurement_official}</span>
                      </div>
                    </td>

                    {/* Bid Amount & Market Variance */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        ${(caseItem.bid_amount / 1e6).toFixed(2)}M
                      </div>
                      {caseItem.price_deviation_pct !== null && (
                        <div className={`text-xs font-semibold flex items-center mt-0.5 ${
                          caseItem.price_deviation_pct > 0 ? 'text-rose-600' : 'text-blue-600'
                        }`}>
                          <TrendingUp className="w-3 h-3 mr-1 inline" />
                          {caseItem.price_deviation_pct > 0 ? '+' : ''}
                          {caseItem.price_deviation_pct}% vs cat.
                        </div>
                      )}
                      {caseItem.price_z_score !== null && (
                        <div className="text-[11px] text-slate-500 font-mono">
                          Z: {caseItem.price_z_score > 0 ? '+' : ''}{caseItem.price_z_score}
                        </div>
                      )}
                    </td>

                    {/* Explainable Evidence Trail */}
                    <td className="py-3.5 px-4 align-top">
                      {/* Flag Tags */}
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {caseItem.flags.map(f => (
                          <span
                            key={f.rule_id}
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                              f.severity === 'Critical'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : f.severity === 'High'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            <Tag className="w-2.5 h-2.5 mr-1" />
                            {f.rule_name}
                          </span>
                        ))}
                      </div>

                      {/* Explicit evidence text string */}
                      <div className="text-xs text-slate-700 leading-relaxed font-sans bg-slate-50/80 p-2 rounded-md border border-slate-200">
                        {caseItem.evidence_trail}
                      </div>

                      {caseItem.audit_notes && (
                        <div className="mt-1 text-[11px] text-indigo-700 italic flex items-center">
                          <span className="font-semibold mr-1">Auditor note:</span>
                          "{caseItem.audit_notes}"
                        </div>
                      )}
                    </td>

                    {/* Audit Status */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      {getStatusBadge(caseItem.audit_status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => onSelectCase(caseItem)}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors shadow-2xs"
                          title="Open complete investigative dossier and audit review modal"
                        >
                          Review Case
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </button>

                        <button
                          onClick={() => onToggleFalsePositive(caseItem.bid_id, caseItem.audit_status)}
                          className={`inline-flex items-center px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                            isFalsePositive
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title={isFalsePositive ? "Re-open investigation" : "Quick mark as False Positive"}
                        >
                          {isFalsePositive ? 'Re-open' : 'Mark FP'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
