"""
Customer Operations Analytics — Python ETL Pipeline
Author: Palak Gautam
Description:
    Reads raw customer data, computes KPIs (Retention Rate, SLA Compliance,
    Revenue at Risk), flags records, and exports a processed dataset for
    Power BI and the Chart.js web dashboard.
"""

import pandas as pd
import json
import os

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data")

INPUT_FILE     = os.path.join(DATA_DIR, "customer_operations.csv")
OUTPUT_CSV     = os.path.join(DATA_DIR, "processed_customer_operations.csv")
OUTPUT_KPI     = os.path.join(DATA_DIR, "kpi_summary.json")
OUTPUT_MONTHLY = os.path.join(DATA_DIR, "monthly_summary.json")

# ── Load ───────────────────────────────────────────────────────────────────────
df = pd.read_csv(INPUT_FILE)
print(f"Loaded {len(df)} records.")

# ── Feature Engineering ────────────────────────────────────────────────────────
df["retention_flag"] = df["retained"].apply(lambda x: 1 if x == "Yes" else 0)
df["sla_flag"]       = df["sla_met"].apply(lambda x: 1 if x == "Yes" else 0)
df["ticket_resolution_rate"] = (df["tickets_resolved"] / df["tickets_open"]).round(2)

# ── Overall KPIs ───────────────────────────────────────────────────────────────
total_customers  = len(df)
retention_rate   = round(df["retention_flag"].mean() * 100, 1)
sla_compliance   = round(df["sla_flag"].mean() * 100, 1)
revenue_at_risk  = int(df[df["risk_level"] == "High"]["revenue"].sum())
total_revenue    = int(df["revenue"].sum())

kpi_summary = {
    "total_customers":  total_customers,
    "retention_rate":   retention_rate,
    "sla_compliance":   sla_compliance,
    "revenue_at_risk":  revenue_at_risk,
    "total_revenue":    total_revenue,
}

print("\n── KPI Summary ──────────────────────────────")
for k, v in kpi_summary.items():
    print(f"  {k}: {v}")

# ── Monthly Aggregation ────────────────────────────────────────────────────────
month_order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
df["month"] = pd.Categorical(df["month"], categories=month_order, ordered=True)

monthly = (
    df.groupby("month", observed=True)
    .agg(
        customers   = ("customer_id", "count"),
        retention   = ("retention_flag", lambda x: round(x.mean() * 100, 1)),
        sla         = ("sla_flag",       lambda x: round(x.mean() * 100, 1)),
        low_risk    = ("risk_level",     lambda x: (x == "Low").sum()),
        medium_risk = ("risk_level",     lambda x: (x == "Medium").sum()),
        high_risk   = ("risk_level",     lambda x: (x == "High").sum()),
        total_rev   = ("revenue",        "sum"),
    )
    .reset_index()
)

monthly_records = monthly.to_dict(orient="records")

# ── Export ──────────────────────────────────────────────────────────────────────
df.to_csv(OUTPUT_CSV, index=False)

with open(OUTPUT_KPI, "w") as f:
    json.dump(kpi_summary, f, indent=2)

with open(OUTPUT_MONTHLY, "w") as f:
    json.dump(monthly_records, f, indent=2)

print("\nExports complete:")
print(f"  → {OUTPUT_CSV}")
print(f"  → {OUTPUT_KPI}")
print(f"  → {OUTPUT_MONTHLY}")
print("\nPipeline executed successfully.")