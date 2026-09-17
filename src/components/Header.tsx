import React from 'react';
import { ShieldAlert, Network, TableProperties, Download, RotateCcw, Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'graph' | 'bids';
  setActiveTab: (tab: 'dashboard' | 'graph' | 'bids') => void;
  flaggedCount: number;
  onResetAudit: () => void;
  onExportReport: () => void;
  isBackendConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  flaggedCount,
  onResetAudit,
  onExportReport
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-rose-400 shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">ProcureAudit</span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Automated Public Procurement Anomaly Detection & Collusion Cartel Radar
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onExportReport}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
              title="Export flagged anomalies to CSV audit dossier"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">Export Audit CSV</span>
            </button>
            <button
              onClick={onResetAudit}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              title="Reset all investigative audit notes to baseline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Reset Triage</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 sm:space-x-4 border-t border-slate-100 -mb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`inline-flex items-center px-3 sm:px-4 py-2.5 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'dashboard'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Activity className="w-4 h-4 mr-2" />
            Investigator Dashboard
            {flaggedCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-rose-100 text-rose-700 font-bold">
                {flaggedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('graph')}
            className={`inline-flex items-center px-3 sm:px-4 py-2.5 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'graph'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Network className="w-4 h-4 mr-2" />
            Collusion Network Graph
          </button>

          <button
            onClick={() => setActiveTab('bids')}
            className={`inline-flex items-center px-3 sm:px-4 py-2.5 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'bids'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <TableProperties className="w-4 h-4 mr-2" />
            All Procurement Bids (45)
          </button>
        </div>
      </div>
    </header>
  );
};
