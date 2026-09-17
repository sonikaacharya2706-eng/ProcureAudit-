# ProcureAudit - Automated Public Procurement Anomaly Detection Backend

A production-grade Python FastAPI backend utilizing Pandas statistical and relational algorithms to automatically detect fraudulent patterns in public procurement tenders:
1. **Price Deviation**: Z-score calculation grouped by tender category benchmark.
2. **Collusion & Twin Bidding**: Identical physical address matching and timestamp delta $\Delta t \le 120$ seconds between competitors.
3. **Win-Rate Monopolization**: Statistical concentration where a single vendor wins $\ge 60\%$ of tenders in a given evaluation window.

## Directory Structure
```
backend/
├── bids_data.csv        # Realistic mock public procurement dataset (45 bids, 15 tenders)
├── main.py              # FastAPI application with analytical Pandas pipeline
├── requirements.txt     # Python dependencies (FastAPI, Uvicorn, Pandas, Pydantic)
└── README.md            # Documentation & setup guide
```

## Setup & Running Instructions

### 1. Create and activate a Python virtual environment
```bash
cd backend
python3 -m venv venv

# On macOS/Linux:
source venv/bin/activate

# On Windows (cmd):
venv\Scripts\activate.bat
# On Windows (PowerShell):
venv\Scripts\Activate.ps1
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Start the FastAPI Server
```bash
uvicorn main:app --reload --port 8000
```

The server will be running at `http://127.0.0.1:8000`.
- Swagger API Docs: `http://127.0.0.1:8000/docs`
- Redoc API Docs: `http://127.0.0.1:8000/redoc`

### 4. API Endpoints
- `GET /api/bids`: Retrieve all raw procurement records with category and text filters.
- `GET /api/anomalies`: Runs the Pandas analytics pipeline and returns flagged cases with explainable evidence trails.
- `POST /api/audit`: Update audit status and notes for an anomaly case.
- `GET /api/metrics`: Retrieve executive dashboard indicators.
- `GET /api/graph`: Returns relationship graph nodes and edges for vendors, tenders, addresses, and officials.
