import React from 'react';
import { SystemMetrics } from '../types';
import { Layers, AlertTriangle, Clock, DollarSign, Network, CheckCircle2 } from 'lucide-react';

interface MetricsCardsProps {
  metrics: SystemMetrics;
  onFilterPending?: () => void;
  onFilterHighRisk?: () => void;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  metrics,
  onFilterPending,
  onFilterHighRisk
}) => {
  const formatCurrency = (amount: number) => {
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    return `$${amount.toLocaleString()}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Tenders */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Tenders
          </span>
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {metrics.total_tenders}
          </span>
          <span className="ml-2 text-xs text-slate-500 font-medium">
            ({metrics.total_bids} total bids)
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          5 categories across 2024-Q1 through Q3
        </p>
      </div>

      {/* Flagged High-Risk Cases */}
      <div 
        onClick={onFilterHighRisk}
        className="bg-white p-5 rounded-xl border border-rose-200 shadow-xs hover:border-rose-300 transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
            High-Risk Cases
          </span>
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 group-hover:scale-105 transition-transform">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline">
          <span className="text-2xl font-bold tracking-tight text-rose-600">
            {metrics.high_risk_cases_count}
          </span>
          <span className="ml-2 text-xs text-slate-500 font-medium">
            of {metrics.flagged_cases_count} flagged total
          </span>
        </div>
        <div className="mt-2 flex items-center text-xs text-rose-600 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1.5 animate-pulse" />
          {formatCurrency(metrics.high_risk_exposure_value)} high-risk exposure
        </div>
      </div>

      {/* Pending Reviews */}
      <div 
        onClick={onFilterPending}
        className="bg-white p-5 rounded-xl border border-amber-200 shadow-xs hover:border-amber-300 transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Pending Reviews
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline">
          <span className="text-2xl font-bold tracking-tight text-amber-700">
            {metrics.pending_reviews_count}
          </span>
          <span className="ml-2 text-xs text-slate-500 font-medium">
            awaiting auditor sign-off
          </span>
        </div>
        <p className="mt-2 text-xs text-amber-700">
          Action required: Verify collusion or mark false positive
        </p>
      </div>

      {/* Total Value Audited */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Value Audited
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {formatCurrency(metrics.total_audited_value)}
          </span>
        </div>
        <div className="mt-2 flex items-center text-xs text-emerald-700 font-medium">
          <Network className="w-3.5 h-3.5 mr-1 text-emerald-600" />
          {metrics.active_collusion_clusters} Collusion Cartels Isolated
        </div>
      </div>
    </div>
  );
};
