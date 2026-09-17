export interface BidRecord {
  bid_id: string;
  tender_id: string;
  tender_title: string;
  tender_category: string;
  evaluation_window: string;
  vendor_id: string;
  vendor_name: string;
  bid_amount: number;
  submission_timestamp: string;
  vendor_address: string;
  is_winner: number;
  procurement_official: string;
  audit_status: 'Pending Review' | 'Under Review' | 'False Positive' | 'Confirmed Anomaly' | 'Escalated to OIG' | 'Resolved';
  audit_notes?: string;
  last_audited_at?: string;
  auditor?: string;
}

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export interface AnomalyFlagDetail {
  rule_id: string;
  rule_name: string;
  severity: RiskLevel;
  score_contribution: number;
  summary: string;
}

export interface AnomalyCase extends BidRecord {
  risk_score: number;
  risk_level: RiskLevel;
  evidence_trail: string;
  price_deviation_pct: number | null;
  price_z_score: number | null;
  category_mean?: number;
  category_std?: number;
  flags: AnomalyFlagDetail[];
  collusion_counterparts?: Array<{
    vendor_name: string;
    bid_id: string;
    reason: string;
  }>;
}

export interface SystemMetrics {
  total_tenders: number;
  total_bids: number;
  flagged_cases_count: number;
  high_risk_cases_count: number;
  pending_reviews_count: number;
  total_audited_value: number;
  high_risk_exposure_value: number;
  active_collusion_clusters: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'vendor' | 'tender' | 'address' | 'official';
  risk_score?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  details?: {
    address?: string;
    vendor_id?: string;
    title?: string;
    category?: string;
    role?: string;
    full_address?: string;
    bids_count?: number;
  };
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  label: string;
  relationship: 'SUBMITTED_BID' | 'WON_TENDER' | 'REGISTERED_AT' | 'OVERSAW_BY' | 'SUSPECT_COLLUSION';
  risk?: RiskLevel | 'Normal';
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AuditHistoryEntry {
  id: string;
  bid_id: string;
  previous_status: string;
  new_status: string;
  notes: string;
  auditor: string;
  timestamp: string;
}
