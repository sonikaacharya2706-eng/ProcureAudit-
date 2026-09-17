# ProcureAudit: Automated Public Procurement Anomaly Detection

ProcureAudit is an explainable decision-support platform designed to analyze public procurement data, identify anomalous bidding behaviors, and map hidden relationships among vendors and public officials. Developed for Manipal Hackathon 2026 under the Peace, Justice and Strong Institutions track.

---

## 📌 Overview

ProcureAudit automates the audit pipeline to flag red flags—such as price deviations, bid rotation, and repeated vendor pairings—without relying on black-box accusations. Instead of auto-labeling corruption, the system calculates transparent risk scores and provides investigators with the contextual evidence needed to make informed decisions.

- Prototype Demo: https://procureaudit-public-procurement-anomaly-detection.ai.studio

---

## 🚀 Key Features

* Statistical Anomaly Detection: Identifies abnormal price deviations, single-bidder tenders, odd bidding proximity, and unusual win frequencies.
* Relationship & Entity Mapping: Visualizes hidden connections—including shared addresses, common owners, and repeated vendor-official pairings—via dynamic network graphs.
* Risk-Based Prioritization: Sorts flagged cases using a composite score of anomaly likelihood and financial exposure, allowing teams to review high-impact cases first.
* Explainable Alerts: Translates detection signals into human-readable rationales (e.g., "Price 40% above market average") alongside supporting data points.
* Human-in-the-Loop Audit Trail: Enables reviewers to mark alerts as false positives, request more evidence, or refer cases for formal audit while feeding observations back into the system.

---

## 🏗️ System Architecture & Workflow

The platform operates across a tiered pipeline:

1. Data Ingestion & Cleaning: Ingests tender notices, bid records, contracts, and vendor metadata, standardizing entities and removing duplicates.
2. Feature Extraction & Analysis: Extracts relational patterns, calculates price baselines, and runs anomaly detection algorithms.
3. Scoring & Alert Generation: Generates explainable risk scores and determines if cases meet review thresholds.
4. Investigator Dashboard: Presents interactive network graphs, comparative pricing distributions, and case logs.
5. Feedback Loop: Records investigator actions to create an auditable decision trail and calibrate future rules.

---

## 💻 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| Frontend | React, TypeScript, Tailwind CSS, Vite, Cytoscape.js |
| Backend & Analytics | Python, FastAPI, Pandas |
| Data & Storage | SQLite, Local CSVs |
| VCS | GitHub |

---

## 👥 Team Code X

* Sonika
* Kaushal V
* Adithya Alva
* Ashwini Shenoy
* Dhanush Neermarga

---

## 📚 References

1. MDPI: Information 2025 (16/3/177) - https://www.mdpi.com/2078-2489/16/3/177
2. International Transactions in Operational Research (ITOR 12968) - https://onlinelibrary.wiley.com/doi/abs/10.1111/itor.12968
3. International Transactions in Operational Research (ITOR 12811) - https://onlinelibrary.wiley.com/doi/abs/10.1111/itor.12811
4. Springer Link: Procurement Analytics Chapter - https://link.springer.com/chapter/10.1007/978-3-031-43427-3_5
