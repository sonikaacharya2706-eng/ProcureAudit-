import React, { useState, useMemo } from 'react';
import { BidRecord } from '../types';
import { RAW_BIDS_DATA } from '../data/rawBids';
import { Search, Filter, ArrowUpDown, CheckCircle, Clock, MapPin, Building2, Layers } from 'lucide-react';

interface RawBidsExplorerProps {
  onSelectBidForAudit?: (bid: BidRecord) => void;
}

export const RawBidsExplorer: React.FC<RawBidsExplorerProps> = ({
  onSelectBidForAudit
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [windowFilter, setWindowFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'bid_amount' | 'submission_timestamp' | 'tender_id'>('tender_id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const categories = useMemo(() => {
    return ['ALL', ...Array.from(new Set(RAW_BIDS_DATA.map(b => b.tender_category)))];
  }, []);

  const windows = useMemo(() => {
    return ['ALL', ...Array.from(new Set(RAW_BIDS_DATA.map(b => b.evaluation_window)))];
  }, []);

  const filteredBids = useMemo(() => {
    return RAW_BIDS_DATA
      .filter(b => {
        if (categoryFilter !== 'ALL' && b.tender_category !== categoryFilter) return false;
        if (windowFilter !== 'ALL' && b.evaluation_window !== windowFilter) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const match =
            b.bid_id.toLowerCase().includes(q) ||
            b.vendor_name.toLowerCase().includes(q) ||
            b.tender_id.toLowerCase().includes(q) ||
            b.tender_title.toLowerCase().includes(q) ||
            b.vendor_address.toLowerCase().includes(q) ||
            b.procurement_official.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'bid_amount') diff = a.bid_amount - b.bid_amount;
        else if (sortField === 'submission_timestamp') {
          diff = new Date(a.submission_timestamp).getTime() - new Date(b.submission_timestamp).getTime();
        } else if (sortField === 'tender_id') {
          diff = a.tender_id.localeCompare(b.tender_id);
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [categoryFilter, windowFilter, searchTerm, sortField, sortOrder]);

  const handleSort = (field: 'bid_amount' | 'submission_timestamp' | 'tender_id') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Controls Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search raw bids by vendor, tender ID, address, official..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {categories.map(c => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All Categories' : c}
              </option>
            ))}
          </select>

          <select
            value={windowFilter}
            onChange={e => setWindowFilter(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {windows.map(w => (
              <option key={w} value={w}>
                {w === 'ALL' ? 'All Eval Windows' : w}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 py-2 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <span>
          Displaying <strong className="text-slate-900">{filteredBids.length}</strong> raw procurement records
        </span>
        <span className="font-mono text-[11px] text-slate-500">
          Source: /backend/bids_data.csv
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">
                <button onClick={() => handleSort('tender_id')} className="flex items-center hover:text-slate-900">
                  Tender ID <ArrowUpDown className="w-3 h-3 ml-1" />
                </button>
              </th>
              <th className="py-3 px-4">Tender Title & Category</th>
              <th className="py-3 px-4">Vendor & Physical Address</th>
              <th className="py-3 px-4">
                <button onClick={() => handleSort('bid_amount')} className="flex items-center hover:text-slate-900">
                  Bid Amount <ArrowUpDown className="w-3 h-3 ml-1" />
                </button>
              </th>
              <th className="py-3 px-4">
                <button onClick={() => handleSort('submission_timestamp')} className="flex items-center hover:text-slate-900">
                  Timestamp <ArrowUpDown className="w-3 h-3 ml-1" />
                </button>
              </th>
              <th className="py-3 px-4">Result</th>
              <th className="py-3 px-4">Procurement Official</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredBids.map(b => (
              <tr key={b.bid_id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 align-top font-mono text-xs font-bold text-slate-900">
                  {b.tender_id}
                  <span className="block text-[10px] text-slate-400 font-normal">{b.bid_id}</span>
                </td>
                <td className="py-3 px-4 align-top">
                  <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                    {b.tender_title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {b.tender_category} • <span className="font-mono">{b.evaluation_window}</span>
                  </div>
                </td>
                <td className="py-3 px-4 align-top">
                  <div className="font-medium text-slate-900 text-xs sm:text-sm">
                    {b.vendor_name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400 mr-1 shrink-0" />
                    <span className="truncate max-w-[220px]" title={b.vendor_address}>{b.vendor_address}</span>
                  </div>
                </td>
                <td className="py-3 px-4 align-top whitespace-nowrap font-bold text-slate-900">
                  ${(b.bid_amount / 1e6).toFixed(2)}M
                  <span className="block text-[10px] text-slate-500 font-normal font-mono">
                    ${b.bid_amount.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-4 align-top whitespace-nowrap text-xs text-slate-600 font-mono">
                  {b.submission_timestamp.replace('T', ' ')}
                </td>
                <td className="py-3 px-4 align-top whitespace-nowrap">
                  {b.is_winner === 1 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                      Awarded
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">
                      Unsuccessful
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 align-top text-xs text-slate-700 font-medium">
                  {b.procurement_official}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
