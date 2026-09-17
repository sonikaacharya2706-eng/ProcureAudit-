import { AnomalyCase, AnomalyFlagDetail, BidRecord, GraphEdge, GraphNode, GraphPayload, RiskLevel, SystemMetrics } from '../types';
import { RAW_BIDS_DATA } from '../data/rawBids';

const AUDIT_STORAGE_KEY = 'procure_audit_cases_v1';

export function getStoredAuditOverrides(): Record<string, Partial<BidRecord>> {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAuditOverride(bidId: string, updates: Partial<BidRecord>): void {
  try {
    const current = getStoredAuditOverrides();
    current[bidId] = {
      ...current[bidId],
      ...updates,
      last_audited_at: new Date().toISOString()
    };
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to save audit override', e);
  }
}

export function resetAuditOverrides(): void {
  localStorage.removeItem(AUDIT_STORAGE_KEY);
}

/**
 * Runs the automated anomaly detection pipeline across procurement records
 * using the same 3 scoring rules implemented in the Python Pandas backend:
 * 1. Price Deviation (Category Z-Score)
 * 2. Collusion / Twin Bidding (Shared address + timestamp delta <= 120s)
 * 3. Win-Rate Monopolization (Vendor win-rate >= 60% in evaluation window)
 */
export function runProcurementAnomalyEngine(records?: BidRecord[]): AnomalyCase[] {
  const base = records || RAW_BIDS_DATA;
  const overrides = getStoredAuditOverrides();

  // Apply overrides
  const bids: BidRecord[] = base.map(b => {
    const override = overrides[b.bid_id];
    return override ? { ...b, ...override } : { ...b };
  });

  // 1. Group statistics by tender_category for Price Deviation
  const categoryStats: Record<string, { mean: number; std: number; count: number }> = {};
  const catGroups: Record<string, number[]> = {};

  bids.forEach(b => {
    if (!catGroups[b.tender_category]) catGroups[b.tender_category] = [];
    catGroups[b.tender_category].push(b.bid_amount);
  });

  Object.entries(catGroups).forEach(([cat, amounts]) => {
    const mean = amounts.reduce((acc, v) => acc + v, 0) / amounts.length;
    const variance = amounts.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (amounts.length > 1 ? amounts.length - 1 : 1);
    const std = Math.sqrt(variance) || 1;
    categoryStats[cat] = { mean, std, count: amounts.length };
  });

  // 2. Win-Rate Concentration by Vendor + Evaluation Window
  const vendorWindowStats: Record<string, { total: number; wins: number }> = {};
  bids.forEach(b => {
    const key = `${b.vendor_id}__${b.evaluation_window}`;
    if (!vendorWindowStats[key]) vendorWindowStats[key] = { total: 0, wins: 0 };
    vendorWindowStats[key].total += 1;
    if (b.is_winner === 1) vendorWindowStats[key].wins += 1;
  });

  // 3. Collusion & Twin Bidding by Tender
  const tenderGroups: Record<string, BidRecord[]> = {};
  bids.forEach(b => {
    if (!tenderGroups[b.tender_id]) tenderGroups[b.tender_id] = [];
    tenderGroups[b.tender_id].push(b);
  });

  interface CollusionNote {
    otherVendor: string;
    otherBidId: string;
    sharedAddress: boolean;
    address: string;
    twinTimestamp: boolean;
    timeDeltaSec: number;
  }

  const collusionMap: Record<string, CollusionNote[]> = {};

  Object.entries(tenderGroups).forEach(([tenderId, tenderBids]) => {
    for (let i = 0; i < tenderBids.length; i++) {
      for (let j = i + 1; j < tenderBids.length; j++) {
        const a = tenderBids[i];
        const b = tenderBids[j];

        const cleanAddrA = a.vendor_address.trim().toLowerCase();
        const cleanAddrB = b.vendor_address.trim().toLowerCase();
        const sharedAddress = cleanAddrA === cleanAddrB && a.vendor_id !== b.vendor_id;

        const timeA = new Date(a.submission_timestamp).getTime();
        const timeB = new Date(b.submission_timestamp).getTime();
        const timeDeltaSec = Math.abs(timeA - timeB) / 1000;
        const twinTimestamp = timeDeltaSec <= 120 && timeDeltaSec > 0;

        if (sharedAddress || twinTimestamp) {
          if (!collusionMap[a.bid_id]) collusionMap[a.bid_id] = [];
          if (!collusionMap[b.bid_id]) collusionMap[b.bid_id] = [];

          collusionMap[a.bid_id].push({
            otherVendor: b.vendor_name,
            otherBidId: b.bid_id,
            sharedAddress,
            address: a.vendor_address,
            twinTimestamp,
            timeDeltaSec
          });

          collusionMap[b.bid_id].push({
            otherVendor: a.vendor_name,
            otherBidId: a.bid_id,
            sharedAddress,
            address: b.vendor_address,
            twinTimestamp,
            timeDeltaSec
          });
        }
      }
    }
  });

  // Compile anomalies
  const anomalies: AnomalyCase[] = [];

  bids.forEach(bid => {
    const flags: AnomalyFlagDetail[] = [];
    const evidenceItems: string[] = [];
    let score = 0;

    const stats = categoryStats[bid.tender_category] || { mean: bid.bid_amount, std: 1, count: 1 };
    const priceDevPct = ((bid.bid_amount - stats.mean) / stats.mean) * 100;
    const zScore = (bid.bid_amount - stats.mean) / stats.std;

    // RULE 1: Price Deviation
    if (Math.abs(zScore) >= 1.65 || Math.abs(priceDevPct) >= 30.0) {
      const direction = priceDevPct > 0 ? 'above' : 'below';
      const severity: RiskLevel = Math.abs(zScore) >= 2.0 || Math.abs(priceDevPct) >= 50 ? 'Critical' : 'High';
      const ruleContribution = Math.min(40, Math.abs(zScore) * 16.0);
      score += ruleContribution;

      const summary = `Bid is ${Math.abs(priceDevPct).toFixed(1)}% ${direction} category benchmark ($${(stats.mean / 1e6).toFixed(2)}M avg); Z-score: ${zScore >= 0 ? '+' : ''}${zScore.toFixed(2)}`;
      flags.push({
        rule_id: 'RULE-PRICE-Z',
        rule_name: 'Price Anomaly (Category Z-Score)',
        severity,
        score_contribution: Math.round(ruleContribution),
        summary
      });
      evidenceItems.push(summary);
    }

    // RULE 2: Collusion / Twin Bidding
    const collusions = collusionMap[bid.bid_id] || [];
    const counterparts: Array<{ vendor_name: string; bid_id: string; reason: string }> = [];

    collusions.forEach(col => {
      if (col.sharedAddress) {
        const addrScore = 30;
        score += addrScore;
        const msg = `Identical physical address shared with competitor '${col.otherVendor}' (${col.address})`;
        flags.push({
          rule_id: 'RULE-TWIN-ADDR',
          rule_name: 'Collusion (Shared Address)',
          severity: 'Critical',
          score_contribution: addrScore,
          summary: msg
        });
        evidenceItems.push(msg);
        counterparts.push({
          vendor_name: col.otherVendor,
          bid_id: col.otherBidId,
          reason: 'Shared Physical Address'
        });
      }

      if (col.twinTimestamp) {
        const timeScore = 25;
        score += timeScore;
        const msg = `Twin submission: bid submitted within ${Math.round(col.timeDeltaSec)}s of '${col.otherVendor}'`;
        flags.push({
          rule_id: 'RULE-TWIN-TIME',
          rule_name: 'Collusion (Twin Timestamp)',
          severity: 'High',
          score_contribution: timeScore,
          summary: msg
        });
        evidenceItems.push(msg);
        counterparts.push({
          vendor_name: col.otherVendor,
          bid_id: col.otherBidId,
          reason: `Twin Submission (${Math.round(col.timeDeltaSec)}s delta)`
        });
      }
    });

    // RULE 3: Win-Rate Concentration
    const winKey = `${bid.vendor_id}__${bid.evaluation_window}`;
    const winData = vendorWindowStats[winKey] || { total: 1, wins: 0 };
    const winRate = winData.wins / winData.total;

    if (winData.total >= 3 && winRate >= 0.60) {
      const winScore = 30;
      score += winScore;
      const msg = `Win-rate concentration: Vendor won ${(winRate * 100).toFixed(1)}% (${winData.wins} of ${winData.total}) in ${bid.evaluation_window}`;
      flags.push({
        rule_id: 'RULE-WIN-RATE',
        rule_name: 'Win-Rate Monopolization',
        severity: 'High',
        score_contribution: winScore,
        summary: msg
      });
      evidenceItems.push(msg);
    }

    if (flags.length > 0 || score >= 20) {
      const finalScore = Math.min(100, Math.round(score));
      let risk_level: RiskLevel = 'Low';
      if (finalScore >= 70) risk_level = 'Critical';
      else if (finalScore >= 50) risk_level = 'High';
      else if (finalScore >= 30) risk_level = 'Medium';

      const evidence_trail = evidenceItems.length > 0
        ? evidenceItems.join(' • ')
        : 'Elevated statistical variance detected in bid telemetry.';

      anomalies.push({
        ...bid,
        risk_score: finalScore,
        risk_level,
        evidence_trail,
        price_deviation_pct: Number(priceDevPct.toFixed(1)),
        price_z_score: Number(zScore.toFixed(2)),
        category_mean: stats.mean,
        category_std: stats.std,
        flags,
        collusion_counterparts: counterparts
      });
    }
  });

  return anomalies.sort((a, b) => b.risk_score - a.risk_score);
}

export function calculateSystemMetrics(anomalies: AnomalyCase[], allBids?: BidRecord[]): SystemMetrics {
  const bids = allBids || RAW_BIDS_DATA;
  const uniqueTenders = new Set(bids.map(b => b.tender_id)).size;
  const totalBids = bids.length;
  const flaggedCases = anomalies.length;
  const highRiskCases = anomalies.filter(a => a.risk_level === 'Critical' || a.risk_level === 'High').length;
  const pendingReviews = anomalies.filter(a => a.audit_status === 'Pending Review' || a.audit_status === 'Under Review').length;
  const totalAuditedValue = bids.reduce((sum, b) => sum + b.bid_amount, 0);
  const highRiskExposure = anomalies
    .filter(a => a.risk_level === 'Critical' || a.risk_level === 'High')
    .reduce((sum, a) => sum + a.bid_amount, 0);

  const collusionVendors = new Set<string>();
  anomalies.forEach(a => {
    a.flags.forEach(f => {
      if (f.rule_name.includes('Collusion')) {
        collusionVendors.add(a.vendor_id);
      }
    });
  });

  return {
    total_tenders: uniqueTenders,
    total_bids: totalBids,
    flagged_cases_count: flaggedCases,
    high_risk_cases_count: highRiskCases,
    pending_reviews_count: pendingReviews,
    total_audited_value: totalAuditedValue,
    high_risk_exposure_value: highRiskExposure,
    active_collusion_clusters: Math.max(1, Math.floor(collusionVendors.size / 2))
  };
}

/**
 * Builds the graph payload with nodes and relationships
 */
export function buildRelationshipGraph(anomalies: AnomalyCase[], allBids?: BidRecord[]): GraphPayload {
  const bids = allBids || RAW_BIDS_DATA;
  const anomalyMap = new Map(anomalies.map(a => [a.bid_id, a]));

  const nodesMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  bids.forEach(b => {
    const vId = `vnd_${b.vendor_id}`;
    const tId = `tnd_${b.tender_id}`;
    const oId = `off_${b.procurement_official.replace(/\s+/g, '_')}`;
    const cleanAddr = b.vendor_address.trim().toLowerCase();
    const addrId = `addr_${Math.abs(Array.from(cleanAddr).reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0)) % 10000}`;

    const anom = anomalyMap.get(b.bid_id);
    const riskScore = anom ? anom.risk_score : 0;

    // Vendor Node
    if (!nodesMap.has(vId)) {
      nodesMap.set(vId, {
        id: vId,
        label: b.vendor_name,
        type: 'vendor',
        risk_score: riskScore,
        details: {
          vendor_id: b.vendor_id,
          address: b.vendor_address,
          bids_count: 1
        }
      });
    } else {
      const existing = nodesMap.get(vId)!;
      existing.risk_score = Math.max(existing.risk_score || 0, riskScore);
      if (existing.details) existing.details.bids_count = (existing.details.bids_count || 1) + 1;
    }

    // Tender Node
    if (!nodesMap.has(tId)) {
      nodesMap.set(tId, {
        id: tId,
        label: b.tender_id,
        type: 'tender',
        details: {
          title: b.tender_title,
          category: b.tender_category
        }
      });
    }

    // Official Node
    if (!nodesMap.has(oId)) {
      nodesMap.set(oId, {
        id: oId,
        label: b.procurement_official,
        type: 'official',
        details: {
          role: 'Evaluation Committee Lead'
        }
      });
    }

    // Address Node
    if (!nodesMap.has(addrId)) {
      nodesMap.set(addrId, {
        id: addrId,
        label: b.vendor_address.split(',')[0],
        type: 'address',
        details: {
          full_address: b.vendor_address
        }
      });
    }

    // Vendor -> Address link
    edges.push({
      id: `${vId}->${addrId}`,
      source: vId,
      target: addrId,
      label: 'REGISTERED_AT',
      relationship: 'REGISTERED_AT',
      risk: 'Normal'
    });

    // Vendor -> Tender link
    edges.push({
      id: `${vId}->${tId}__${b.bid_id}`,
      source: vId,
      target: tId,
      label: `$${(b.bid_amount / 1e6).toFixed(1)}M (${b.is_winner ? 'WON' : 'BID'})`,
      relationship: b.is_winner ? 'WON_TENDER' : 'SUBMITTED_BID',
      risk: anom ? anom.risk_level : 'Normal'
    });

    // Official -> Tender link
    edges.push({
      id: `${oId}->${tId}`,
      source: oId,
      target: tId,
      label: 'OVERSAW',
      relationship: 'OVERSAW_BY',
      risk: 'Normal'
    });
  });

  // Collusion direct edges between suspect vendors
  anomalies.forEach(a => {
    a.flags.forEach(f => {
      if (f.rule_name.includes('Collusion')) {
        const v1 = `vnd_${a.vendor_id}`;
        anomalies.forEach(b => {
          if (b.bid_id !== a.bid_id && b.tender_id === a.tender_id) {
            const v2 = `vnd_${b.vendor_id}`;
            if (v1 !== v2) {
              edges.push({
                id: `collusion_${v1}_${v2}`,
                source: v1,
                target: v2,
                label: 'SUSPECT_COLLUSION',
                relationship: 'SUSPECT_COLLUSION',
                risk: 'Critical'
              });
            }
          }
        });
      }
    });
  });

  // Deduplicate edges
  const seenEdges = new Set<string>();
  const uniqueEdges: GraphEdge[] = [];
  edges.forEach(e => {
    const key = `${e.source}__${e.target}__${e.relationship}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      uniqueEdges.push(e);
    }
  });

  return {
    nodes: Array.from(nodesMap.values()),
    edges: uniqueEdges
  };
}
