"""
Automated Public Procurement Anomaly Detection System
FastAPI Backend with Pandas Statistical & Behavioral Analytics
"""

import os
from datetime import datetime
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Initialize FastAPI application
app = FastAPI(
    title="ProcureAudit - Public Procurement Anomaly Detection API",
    description="Automated analytics engine detecting price anomalies, twin-bidding collusion, and win-rate monopolies in public tenders.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust to specific frontend host in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Filepath to the CSV dataset
DATA_FILE = os.path.join(os.path.dirname(__file__), "bids_data.csv")

# In-memory store for audit updates (persisted back to CSV upon mutation)
audit_override_store: Dict[str, Dict[str, Any]] = {}


# --- Pydantic Data Models ---

class BidRecord(BaseModel):
    bid_id: str
    tender_id: str
    tender_title: str
    tender_category: str
    evaluation_window: str
    vendor_id: str
    vendor_name: str
    bid_amount: float
    submission_timestamp: str
    vendor_address: str
    is_winner: int
    procurement_official: str
    audit_status: str
    audit_notes: Optional[str] = ""


class AnomalyFlagDetail(BaseModel):
    rule_id: str
    rule_name: str
    severity: str  # Critical, High, Medium, Low
    score_contribution: float
    summary: str


class AnomalyCase(BaseModel):
    bid_id: str
    tender_id: str
    tender_title: str
    tender_category: str
    evaluation_window: str
    vendor_id: str
    vendor_name: str
    bid_amount: float
    submission_timestamp: str
    vendor_address: str
    is_winner: int
    procurement_official: str
    risk_score: float
    risk_level: str  # Critical, High, Medium, Low
    evidence_trail: str
    price_deviation_pct: Optional[float] = None
    price_z_score: Optional[float] = None
    flags: List[AnomalyFlagDetail]
    audit_status: str
    audit_notes: Optional[str] = ""
    last_audited_at: Optional[str] = None
    auditor: Optional[str] = None


class AuditUpdateRequest(BaseModel):
    bid_id: str
    audit_status: str = Field(..., description="e.g. Under Review, False Positive, Confirmed Anomaly, Escalated to OIG, Resolved")
    audit_notes: Optional[str] = ""
    auditor: Optional[str] = "Special Investigator J. Miller"


class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # vendor, tender, address, official
    risk_score: Optional[float] = 0.0
    details: Optional[Dict[str, Any]] = None


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str
    relationship: str  # SUBMITTED_BID, WON_TENDER, REGISTERED_AT, OVERSAW_BY, SUSPECT_COLLUSION
    risk: Optional[str] = "Normal"


class GraphPayload(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


class SystemMetrics(BaseModel):
    total_tenders: int
    total_bids: int
    flagged_cases_count: int
    high_risk_cases_count: int
    pending_reviews_count: int
    total_audited_value: float
    high_risk_exposure_value: float
    active_collusion_clusters: int


# --- Helper Functions & Analytics Engine ---

def load_dataset() -> pd.DataFrame:
    """Loads CSV dataset and applies any in-memory audit updates."""
    if not os.path.exists(DATA_FILE):
        raise FileNotFoundError(f"Data file not found at: {DATA_FILE}")
    
    df = pd.read_csv(DATA_FILE)
    df["bid_amount"] = pd.to_numeric(df["bid_amount"], errors="coerce").fillna(0.0)
    df["is_winner"] = pd.to_numeric(df["is_winner"], errors="coerce").fillna(0).astype(int)
    df["submission_timestamp"] = pd.to_datetime(df["submission_timestamp"], errors="coerce")
    
    # Fill empty notes
    if "audit_notes" not in df.columns:
        df["audit_notes"] = ""
    else:
        df["audit_notes"] = df["audit_notes"].fillna("")

    # Apply audit overrides
    for bid_id, overrides in audit_override_store.items():
        mask = df["bid_id"] == bid_id
        if mask.any():
            for key, val in overrides.items():
                df.loc[mask, key] = val

    return df


def detect_procurement_anomalies(df: pd.DataFrame) -> List[AnomalyCase]:
    """
    Core Analytics Pipeline implementing 3 Automated Scoring Rules using Pandas:
    1. Price Deviation (Z-score & % delta vs Category benchmark)
    2. Collusion / Twin Bidding (identical addresses and submission delta <= 120s)
    3. Win-Rate Concentration (abnormally high win rate >= 60% in evaluation window)
    """
    anomalies: List[AnomalyCase] = []

    # 1. Price Deviation Analysis (Group by Category)
    category_stats = df.groupby("tender_category")["bid_amount"].agg(["mean", "std"]).reset_index()
    category_stats.rename(columns={"mean": "cat_mean", "std": "cat_std"}, inplace=True)
    category_stats["cat_std"] = category_stats["cat_std"].replace(0, np.nan)
    
    df_merged = df.merge(category_stats, on="tender_category", how="left")
    df_merged["z_score"] = (df_merged["bid_amount"] - df_merged["cat_mean"]) / df_merged["cat_std"].fillna(1.0)
    df_merged["price_dev_pct"] = ((df_merged["bid_amount"] - df_merged["cat_mean"]) / df_merged["cat_mean"]) * 100.0

    # 2. Win-Rate Concentration Analysis (Group by Vendor + Evaluation Window)
    win_stats = df.groupby(["vendor_id", "evaluation_window"]).agg(
        total_bids=("bid_id", "count"),
        total_wins=("is_winner", "sum")
    ).reset_index()
    win_stats["win_rate"] = win_stats["total_wins"] / win_stats["total_bids"]
    df_merged = df_merged.merge(win_stats, on=["vendor_id", "evaluation_window"], how="left")

    # 3. Collusion & Twin Bidding Proximity Analysis (Group by Tender)
    # Check pairwise timing and addresses within each tender
    tender_collusion_map: Dict[str, List[Dict[str, Any]]] = {}
    for tender_id, group in df.groupby("tender_id"):
        sorted_group = group.sort_values("submission_timestamp")
        collusion_notes = []
        records = sorted_group.to_dict("records")
        for i in range(len(records)):
            for j in range(i + 1, len(records)):
                rec_a = records[i]
                rec_b = records[j]
                
                # Check address match
                addr_match = (
                    rec_a["vendor_address"].strip().lower() == rec_b["vendor_address"].strip().lower() 
                    and rec_a["vendor_id"] != rec_b["vendor_id"]
                )
                
                # Check timestamp delta
                time_delta = abs((rec_a["submission_timestamp"] - rec_b["submission_timestamp"]).total_seconds())
                is_twin_timestamp = time_delta <= 120.0  # within 2 minutes

                if addr_match or (is_twin_timestamp and time_delta > 0):
                    collusion_notes.append({
                        "bid_a": rec_a["bid_id"],
                        "bid_b": rec_b["bid_id"],
                        "vendor_a": rec_a["vendor_name"],
                        "vendor_b": rec_b["vendor_name"],
                        "address_shared": addr_match,
                        "address": rec_a["vendor_address"],
                        "time_delta_sec": time_delta,
                        "is_twin_timestamp": is_twin_timestamp
                    })
        tender_collusion_map[tender_id] = collusion_notes

    # Iterate each bid and compile findings
    for _, row in df_merged.iterrows():
        flags: List[AnomalyFlagDetail] = []
        evidence_items: List[str] = []
        score = 0.0

        bid_id = str(row["bid_id"])
        tender_id = str(row["tender_id"])
        z_val = float(row["z_score"]) if pd.notna(row["z_score"]) else 0.0
        pct_val = float(row["price_dev_pct"]) if pd.notna(row["price_dev_pct"]) else 0.0
        win_rate = float(row["win_rate"]) if pd.notna(row["win_rate"]) else 0.0
        total_bids = int(row["total_bids"]) if pd.notna(row["total_bids"]) else 1
        total_wins = int(row["total_wins"]) if pd.notna(row["total_wins"]) else 0

        # RULE 1: Price Deviation (Z-score & % delta)
        if abs(z_val) >= 1.65 or abs(pct_val) >= 30.0:
            direction = "above" if pct_val > 0 else "below"
            severity = "Critical" if abs(z_val) >= 2.0 or abs(pct_val) >= 50.0 else "High"
            rule_score = min(40.0, abs(z_val) * 16.0)
            score += rule_score
            
            summary_msg = f"Bid is {abs(pct_val):.1f}% {direction} category mean ($ {row['cat_mean']:,.0f}); Z-score: {z_val:+.2f}"
            flags.append(AnomalyFlagDetail(
                rule_id="RULE-PRICE-Z",
                rule_name="Price Anomaly (Category Z-Score)",
                severity=severity,
                score_contribution=rule_score,
                summary=summary_msg
            ))
            evidence_items.append(summary_msg)

        # RULE 2: Collusion / Twin Bidding
        t_collusions = tender_collusion_map.get(tender_id, [])
        for col in t_collusions:
            if col["bid_a"] == bid_id or col["bid_b"] == bid_id:
                other_vendor = col["vendor_b"] if col["bid_a"] == bid_id else col["vendor_a"]
                time_delta = col["time_delta_sec"]
                
                if col["address_shared"]:
                    addr_score = 30.0
                    score += addr_score
                    msg = f"Identical physical address shared with competitor '{other_vendor}' ({col['address']})"
                    flags.append(AnomalyFlagDetail(
                        rule_id="RULE-TWIN-ADDR",
                        rule_name="Collusion (Shared Address)",
                        severity="Critical",
                        score_contribution=addr_score,
                        summary=msg
                    ))
                    evidence_items.append(msg)

                if col["is_twin_timestamp"]:
                    time_score = 25.0
                    score += time_score
                    msg = f"Twin submission: bid submitted within {time_delta:.0f}s of '{other_vendor}'"
                    flags.append(AnomalyFlagDetail(
                        rule_id="RULE-TWIN-TIME",
                        rule_name="Collusion (Twin Timestamp)",
                        severity="High",
                        score_contribution=time_score,
                        summary=msg
                    ))
                    evidence_items.append(msg)

        # RULE 3: Win-Rate Concentration
        if total_bids >= 3 and win_rate >= 0.60:
            win_score = 30.0
            score += win_score
            msg = f"Win-rate concentration: Vendor won {win_rate*100:.1f}% ({total_wins} of {total_bids}) in {row['evaluation_window']}"
            flags.append(AnomalyFlagDetail(
                rule_id="RULE-WIN-RATE",
                rule_name="Win-Rate Monopolization",
                severity="High",
                score_contribution=win_score,
                summary=msg
            ))
            evidence_items.append(msg)

        # Only flag if at least one rule fired or score > 20
        if flags or score > 20.0:
            final_score = min(100.0, round(score, 1))
            
            if final_score >= 70.0:
                level = "Critical"
            elif final_score >= 50.0:
                level = "High"
            elif final_score >= 30.0:
                level = "Medium"
            else:
                level = "Low"

            # Formulate full explainable evidence trail string
            evidence_trail = " | ".join(evidence_items) if evidence_items else "Elevated statistical variance detected."

            override_info = audit_override_store.get(bid_id, {})
            current_status = override_info.get("audit_status", str(row["audit_status"]))
            current_notes = override_info.get("audit_notes", str(row["audit_notes"]))

            anomalies.append(AnomalyCase(
                bid_id=bid_id,
                tender_id=tender_id,
                tender_title=str(row["tender_title"]),
                tender_category=str(row["tender_category"]),
                evaluation_window=str(row["evaluation_window"]),
                vendor_id=str(row["vendor_id"]),
                vendor_name=str(row["vendor_name"]),
                bid_amount=float(row["bid_amount"]),
                submission_timestamp=str(row["submission_timestamp"]),
                vendor_address=str(row["vendor_address"]),
                is_winner=int(row["is_winner"]),
                procurement_official=str(row["procurement_official"]),
                risk_score=final_score,
                risk_level=level,
                evidence_trail=evidence_trail,
                price_deviation_pct=round(pct_val, 1) if pd.notna(pct_val) else None,
                price_z_score=round(z_val, 2) if pd.notna(z_val) else None,
                flags=flags,
                audit_status=current_status,
                audit_notes=current_notes,
                last_audited_at=override_info.get("last_audited_at"),
                auditor=override_info.get("auditor")
            ))

    # Sort descending by risk score
    anomalies.sort(key=lambda x: x.risk_score, reverse=True)
    return anomalies


# --- API Endpoints ---

@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat(), "service": "ProcureAudit Anomaly Detector"}


@app.get("/api/bids", response_model=List[BidRecord])
def get_all_bids(
    category: Optional[str] = Query(None, description="Filter by tender category"),
    tender_id: Optional[str] = Query(None, description="Filter by tender ID"),
    search: Optional[str] = Query(None, description="Search keyword in vendor or tender")
):
    """
    Returns all public procurement bid records with optional category and search filters.
    """
    df = load_dataset()
    if category:
        df = df[df["tender_category"].str.lower() == category.lower()]
    if tender_id:
        df = df[df["tender_id"] == tender_id]
    if search:
        s = search.lower()
        df = df[
            df["vendor_name"].str.lower().str.contains(s) |
            df["tender_title"].str.lower().str.contains(s) |
            df["bid_id"].str.lower().str.contains(s)
        ]

    records = []
    for _, row in df.iterrows():
        override = audit_override_store.get(str(row["bid_id"]), {})
        records.append(BidRecord(
            bid_id=str(row["bid_id"]),
            tender_id=str(row["tender_id"]),
            tender_title=str(row["tender_title"]),
            tender_category=str(row["tender_category"]),
            evaluation_window=str(row["evaluation_window"]),
            vendor_id=str(row["vendor_id"]),
            vendor_name=str(row["vendor_name"]),
            bid_amount=float(row["bid_amount"]),
            submission_timestamp=str(row["submission_timestamp"]),
            vendor_address=str(row["vendor_address"]),
            is_winner=int(row["is_winner"]),
            procurement_official=str(row["procurement_official"]),
            audit_status=override.get("audit_status", str(row["audit_status"])),
            audit_notes=override.get("audit_notes", str(row["audit_notes"] if pd.notna(row["audit_notes"]) else ""))
        ))
    return records


@app.get("/api/anomalies", response_model=List[AnomalyCase])
def get_flagged_anomalies(
    min_score: Optional[float] = Query(0.0, description="Filter cases by minimum risk score"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level (Critical, High, Medium, Low)"),
    status: Optional[str] = Query(None, description="Filter by audit status")
):
    """
    Runs the automated anomaly detection script using Pandas and returns all flagged cases
    ranked by composite risk score with explainable evidence trails.
    """
    df = load_dataset()
    anomalies = detect_procurement_anomalies(df)

    if min_score > 0.0:
        anomalies = [a for a in anomalies if a.risk_score >= min_score]
    if risk_level:
        anomalies = [a for a in anomalies if a.risk_level.lower() == risk_level.lower()]
    if status:
        anomalies = [a for a in anomalies if a.audit_status.lower() == status.lower()]

    return anomalies


@app.post("/api/audit")
def update_audit_status(payload: AuditUpdateRequest):
    """
    Allows an investigator to update the status of a flagged case
    (e.g., mark as 'Under Review', 'False Positive', 'Confirmed Anomaly', 'Escalated to OIG').
    """
    df = load_dataset()
    if not (df["bid_id"] == payload.bid_id).any():
        raise HTTPException(status_code=404, detail=f"Bid record '{payload.bid_id}' not found.")

    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    audit_override_store[payload.bid_id] = {
        "audit_status": payload.audit_status,
        "audit_notes": payload.audit_notes or "",
        "last_audited_at": timestamp,
        "auditor": payload.auditor or "Investigator"
    }

    # Persist to disk if writable
    try:
        mask = df["bid_id"] == payload.bid_id
        df.loc[mask, "audit_status"] = payload.audit_status
        df.loc[mask, "audit_notes"] = payload.audit_notes
        df.to_csv(DATA_FILE, index=False)
    except Exception:
        pass  # In memory store still maintains state

    return {
        "message": "Audit record updated successfully.",
        "bid_id": payload.bid_id,
        "audit_status": payload.audit_status,
        "audit_notes": payload.audit_notes,
        "audited_at": timestamp,
        "auditor": payload.auditor
    }


@app.get("/api/metrics", response_model=SystemMetrics)
def get_metrics_summary():
    """
    Returns executive summary indicators for the procurement investigator dashboard.
    """
    df = load_dataset()
    anomalies = detect_procurement_anomalies(df)

    total_tenders = int(df["tender_id"].nunique())
    total_bids = len(df)
    flagged_count = len(anomalies)
    high_risk_count = sum(1 for a in anomalies if a.risk_level in ["Critical", "High"])
    pending_reviews = sum(1 for a in anomalies if a.audit_status in ["Pending Review", "Under Review"])
    total_audited_value = float(df["bid_amount"].sum())
    high_risk_exposure = float(sum(a.bid_amount for a in anomalies if a.risk_level in ["Critical", "High"]))
    
    # Active collusion clusters count
    collusion_vendors = set()
    for a in anomalies:
        for f in a.flags:
            if "Collusion" in f.rule_name:
                collusion_vendors.add(a.vendor_id)

    return SystemMetrics(
        total_tenders=total_tenders,
        total_bids=total_bids,
        flagged_cases_count=flagged_count,
        high_risk_cases_count=high_risk_count,
        pending_reviews_count=pending_reviews,
        total_audited_value=round(total_audited_value, 2),
        high_risk_exposure_value=round(high_risk_exposure, 2),
        active_collusion_clusters=len(collusion_vendors)
    )


@app.get("/api/graph", response_model=GraphPayload)
def get_relationship_graph():
    """
    Constructs a knowledge graph of Vendors, Shared Addresses, Procurement Officials,
    and Tenders to expose collusion networks and bidding cartels.
    """
    df = load_dataset()
    anomalies = detect_procurement_anomalies(df)
    anomaly_map = {a.bid_id: a for a in anomalies}

    nodes: Dict[str, GraphNode] = {}
    edges: List[GraphEdge] = []

    for _, row in df.iterrows():
        v_id = f"vnd_{row['vendor_id']}"
        t_id = f"tnd_{row['tender_id']}"
        o_id = f"off_{row['procurement_official'].replace(' ', '_')}"
        addr_id = f"addr_{hash(row['vendor_address'].strip().lower()) % 100000}"

        # Vendor Node
        if v_id not in nodes:
            nodes[v_id] = GraphNode(
                id=v_id,
                label=str(row["vendor_name"]),
                type="vendor",
                risk_score=0.0,
                details={"address": row["vendor_address"], "vendor_id": row["vendor_id"]}
            )

        # Tender Node
        if t_id not in nodes:
            nodes[t_id] = GraphNode(
                id=t_id,
                label=str(row["tender_id"]),
                type="tender",
                details={"title": row["tender_title"], "category": row["tender_category"]}
            )

        # Official Node
        if o_id not in nodes:
            nodes[o_id] = GraphNode(
                id=o_id,
                label=str(row["procurement_official"]),
                type="official",
                details={"role": "Evaluation Committee Chair"}
            )

        # Address Node
        if addr_id not in nodes:
            nodes[addr_id] = GraphNode(
                id=addr_id,
                label=str(row["vendor_address"]),
                type="address",
                details={"full_address": row["vendor_address"]}
            )

        # Vendor -> Address link
        edges.append(GraphEdge(
            source=v_id,
            target=addr_id,
            label="REGISTERED_AT",
            relationship="REGISTERED_AT"
        ))

        # Vendor -> Tender link
        bid_id = str(row["bid_id"])
        is_winner = int(row["is_winner"]) == 1
        anom = anomaly_map.get(bid_id)

        if anom:
            # Update vendor risk
            nodes[v_id].risk_score = max(nodes[v_id].risk_score or 0.0, anom.risk_score)

        rel = "WON_TENDER" if is_winner else "SUBMITTED_BID"
        edge_risk = anom.risk_level if anom else "Normal"
        edges.append(GraphEdge(
            source=v_id,
            target=t_id,
            label=f"${row['bid_amount']/1e6:.1f}M ({'WON' if is_winner else 'BID'})",
            relationship=rel,
            risk=edge_risk
        ))

        # Official -> Tender link
        edges.append(GraphEdge(
            source=o_id,
            target=t_id,
            label="OVERSAW",
            relationship="OVERSAW_BY"
        ))

    # Add explicit collusion links between vendors that share address or twin bids
    for a in anomalies:
        for f in a.flags:
            if "Collusion" in f.rule_name:
                # Find other colluding vendor
                v1_id = f"vnd_{a.vendor_id}"
                for b in anomalies:
                    if b.bid_id != a.bid_id and b.tender_id == a.tender_id:
                        v2_id = f"vnd_{b.vendor_id}"
                        # avoid duplicate self-loops
                        if v1_id != v2_id:
                            edges.append(GraphEdge(
                                source=v1_id,
                                target=v2_id,
                                label="SUSPECT_COLLUSION",
                                relationship="SUSPECT_COLLUSION",
                                risk="Critical"
                            ))

    # Deduplicate edges
    unique_edges = []
    seen = set()
    for e in edges:
        key = (e.source, e.target, e.relationship)
        if key not in seen:
            seen.add(key)
            unique_edges.append(e)

    return GraphPayload(nodes=list(nodes.values()), edges=unique_edges)


if __name__ == "__main__":
    import uvicorn
    print("Starting ProcureAudit FastAPI Server on http://127.0.0.1:8000 ...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
