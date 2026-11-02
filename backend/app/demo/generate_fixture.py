"""
Generates the DEMO fixture used by the reference backend and by the mobile app's
offline demo mode (debug builds only).

EVERY value produced here is fictional. Names, account numbers, holdings and
balances are invented for development and testing. The fixture is tagged with
"is_demo": true at the top level and on every response so clients can show a
DEMO banner.

Run:  python -m app.demo.generate_fixture
Writes: app/demo/demo_fixture.json  and  ../mobile/src/demo/fixture.json
"""
from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

from app.calc import xirr, absolute_return_pct

AS_OF = date(2026, 11, 1)
rng = random.Random(360)


def iso(d: date) -> str:
    return d.isoformat()


def month_add(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, min(d.day, 28))


def r2(x: float) -> float:
    return round(x, 2)


# ---------------------------------------------------------------- banking
bank_accounts = [
    {"id": "ba_1", "bank_name": "Demo Bank of India", "account_type": "Savings",
     "account_masked": "XXXXXX4821", "ifsc_prefix": "DEMO0", "available_balance": 284650.40,
     "current_balance": 286150.40},
    {"id": "ba_2", "bank_name": "Sample Co-operative Bank", "account_type": "Savings",
     "account_masked": "XXXXXX1093", "ifsc_prefix": "SMPL0", "available_balance": 92310.75,
     "current_balance": 92310.75},
    {"id": "ba_3", "bank_name": "Demo Bank of India", "account_type": "Current",
     "account_masked": "XXXXXX7764", "ifsc_prefix": "DEMO0", "available_balance": 41200.00,
     "current_balance": 41200.00},
]
for a in bank_accounts:
    a["last_synced_at"] = f"{iso(AS_OF)}T06:30:00+05:30"
    a["sync_status"] = "ok"

EXPENSE_CATS = {
    "Groceries": (1500, 6000), "Dining": (400, 2500), "Fuel": (1000, 3500),
    "Utilities": (800, 4500), "Rent": (32000, 32000), "Shopping": (700, 9000),
    "Travel": (1200, 15000), "Health": (300, 5000), "Entertainment": (200, 1500),
    "Education": (2000, 8000),
}
transactions = []
tid = 0
for m in range(12, -1, -1):
    month_start = month_add(date(AS_OF.year, AS_OF.month, 1), -m)
    if month_start > AS_OF:
        continue
    # salary
    tid += 1
    transactions.append({"id": f"tx_{tid}", "account_id": "ba_1", "date": iso(month_start + timedelta(days=0)),
                         "description": "SALARY CREDIT - DEMO EMPLOYER PVT LTD", "amount": 185000.0,
                         "direction": "credit", "category": "Salary"})
    tid += 1
    transactions.append({"id": f"tx_{tid}", "account_id": "ba_2", "date": iso(month_start + timedelta(days=4)),
                         "description": "INTEREST CREDIT", "amount": r2(rng.uniform(300, 900)),
                         "direction": "credit", "category": "Interest"})
    if m % 3 == 0:
        tid += 1
        transactions.append({"id": f"tx_{tid}", "account_id": "ba_3", "date": iso(month_start + timedelta(days=10)),
                             "description": "FREELANCE PAYMENT - SAMPLE CLIENT", "amount": r2(rng.uniform(20000, 60000)),
                             "direction": "credit", "category": "Freelance"})
    for cat, (lo, hi) in EXPENSE_CATS.items():
        n = 1 if cat in ("Rent", "Utilities", "Education") else rng.randint(1, 4)
        for _ in range(n):
            day = rng.randint(1, 27)
            d = month_start + timedelta(days=day)
            if d > AS_OF:
                continue
            tid += 1
            transactions.append({"id": f"tx_{tid}", "account_id": rng.choice(["ba_1", "ba_1", "ba_2"]),
                                 "date": iso(d), "description": f"{cat.upper()} - DEMO MERCHANT",
                                 "amount": r2(rng.uniform(lo, hi)), "direction": "debit", "category": cat})
transactions.sort(key=lambda t: t["date"], reverse=True)

# ---------------------------------------------------------------- demat
stocks = [
    ("DEMOINFRA", "Demo Infra Ltd", 120, 1420.0, 1688.35),
    ("SAMPLEBANK", "Sample Bank Ltd", 300, 612.5, 744.10),
    ("TESTPHARMA", "Test Pharma Ltd", 45, 3890.0, 3512.60),
    ("MOCKTECH", "Mock Technologies Ltd", 80, 1510.0, 1912.45),
    ("ALPHAFMCG", "Alpha FMCG Ltd", 60, 2420.0, 2601.00),
    ("BETAPOWER", "Beta Power Ltd", 500, 210.4, 198.75),
]
holdings = []
for sym, name, qty, avg, ltp in stocks:
    invested = qty * avg
    mv = qty * ltp
    holdings.append({"symbol": sym, "name": name, "exchange": "NSE", "quantity": qty,
                     "avg_price": avg, "ltp": ltp, "invested": r2(invested), "market_value": r2(mv),
                     "pnl": r2(mv - invested), "pnl_pct": r2((mv - invested) / invested * 100),
                     "day_change_pct": r2(rng.uniform(-2.5, 2.5))})
demat_totals = {"invested": r2(sum(h["invested"] for h in holdings)),
                "market_value": r2(sum(h["market_value"] for h in holdings))}
demat_totals["pnl"] = r2(demat_totals["market_value"] - demat_totals["invested"])
demat_totals["pnl_pct"] = r2(demat_totals["pnl"] / demat_totals["invested"] * 100)
demat = {"accounts": [{"id": "dm_1", "depository": "NSDL", "dp_name": "Demo Securities Ltd",
                       "bo_masked": "IN30XXXXXXXX5521"},
                      {"id": "dm_2", "depository": "CDSL", "dp_name": "Sample Broking Ltd",
                       "bo_masked": "1208XXXXXXXX0934"}],
         "holdings": holdings, "totals": demat_totals}

# ---------------------------------------------------------------- mutual funds (SIP cash flows -> XIRR)
schemes = [
    ("100001", "UTI Nifty 50 Index Fund - Direct Growth", "UTI Mutual Fund", "Equity: Index", 10000, 36, 0.0115),
    ("100002", "UTI Flexi Cap Fund - Direct Growth", "UTI Mutual Fund", "Equity: Flexi Cap", 7500, 30, 0.0120),
    ("100003", "Sample Midcap Fund - Direct Growth", "Sample AMC", "Equity: Mid Cap", 5000, 24, 0.0150),
    ("100004", "Demo Short Duration Fund - Direct Growth", "Demo AMC", "Debt: Short Duration", 5000, 18, 0.0058),
]
mf_holdings = []
sips = []
perf_by_month: dict[str, list[float]] = {}
for code, nm, amc, cat, amt, n, monthly_growth in schemes:
    nav0 = 50.0
    units = 0.0
    flows = []
    start = month_add(date(AS_OF.year, AS_OF.month, 5), -n)
    for i in range(n):
        d = month_add(start, i)
        noise = rng.uniform(-0.02, 0.02)
        nav = nav0 * ((1 + monthly_growth) ** i) * (1 + noise)
        units += amt / nav
        flows.append((d, -float(amt)))
        key = d.strftime("%Y-%m")
        inv_val = perf_by_month.setdefault(key, [0.0, 0.0])
        inv_val[0] += amt
    nav_now = nav0 * ((1 + monthly_growth) ** n)
    value = units * nav_now
    invested = amt * n
    flows.append((AS_OF, value))
    x = xirr(flows)
    mf_holdings.append({"scheme_code": code, "scheme_name": nm, "amc": amc, "category": cat,
                        "folio_masked": f"XXXX{rng.randint(1000, 9999)}", "units": round(units, 3),
                        "nav": r2(nav_now), "nav_date": iso(AS_OF - timedelta(days=1)),
                        "invested": r2(invested), "current_value": r2(value),
                        "absolute_return_pct": r2(absolute_return_pct(invested, value)),
                        "xirr_pct": r2(x * 100)})
    sips.append({"id": f"sip_{code}", "scheme_name": nm, "amc": amc, "amount": amt, "frequency": "Monthly",
                 "sip_day": 5, "next_date": iso(month_add(date(AS_OF.year, AS_OF.month, 5), 0 if AS_OF.day < 5 else 1)),
                 "installments_done": n, "start_date": iso(start), "status": "Active"})

all_flows = []
mf_inv = sum(h["invested"] for h in mf_holdings)
mf_val = sum(h["current_value"] for h in mf_holdings)
mf_totals = {"invested": r2(mf_inv), "current_value": r2(mf_val), "absolute_return_pct": r2(absolute_return_pct(mf_inv, mf_val))}
# portfolio XIRR from combined flows
combined = []
for code, nm, amc, cat, amt, n, g in schemes:
    start = month_add(date(AS_OF.year, AS_OF.month, 5), -n)
    combined += [(month_add(start, i), -float(amt)) for i in range(n)]
combined.append((AS_OF, mf_val))
mf_totals["xirr_pct"] = r2(xirr(combined) * 100)
mutual_funds = {"holdings": mf_holdings, "totals": mf_totals,
                "source_note": "Demo values. Real data comes from CAS / Account Aggregator feeds."}

# performance (invested vs value) for the last 24 months, investments only
perf = []
cum_inv = 0.0
for i in range(24, -1, -1):
    d = month_add(date(AS_OF.year, AS_OF.month, 1), -i)
    k = d.strftime("%Y-%m")
    cum_inv += perf_by_month.get(k, [0, 0])[0]
    frac = (24 - i) / 24
    val = cum_inv * (1 + 0.16 * frac + rng.uniform(-0.02, 0.02)) + demat_totals["invested"] * (0.85 + 0.25 * frac)
    perf.append({"date": iso(d), "invested": r2(cum_inv + demat_totals["invested"]), "value": r2(val)})
perf[-1]["value"] = r2(mf_val + demat_totals["market_value"])

# ---------------------------------------------------------------- savings
deposits = [
    {"id": "fd_1", "type": "FD", "bank": "Demo Bank of India", "account_masked": "XXXX2201", "principal": 300000.0,
     "rate_pct": 7.1, "start_date": "2025-03-15", "maturity_date": "2027-03-15", "maturity_amount": 344886.0,
     "payout": "Cumulative"},
    {"id": "fd_2", "type": "FD", "bank": "Sample Co-operative Bank", "account_masked": "XXXX8810", "principal": 150000.0,
     "rate_pct": 7.4, "start_date": "2024-12-01", "maturity_date": "2026-12-01", "maturity_amount": 173570.0,
     "payout": "Cumulative"},
    {"id": "rd_1", "type": "RD", "bank": "Demo Bank of India", "account_masked": "XXXX3402", "principal": 90000.0,
     "monthly_installment": 5000.0, "rate_pct": 6.8, "start_date": "2025-05-10", "maturity_date": "2027-05-10",
     "maturity_amount": 128240.0, "payout": "On maturity"},
]
for dpo in deposits:
    md = date.fromisoformat(dpo["maturity_date"])
    dpo["days_to_maturity"] = (md - AS_OF).days
fd_total = r2(sum(d["principal"] for d in deposits))
retirement = {
    "ppf": {"balance": 642300.0, "account_masked": "XXXX5120", "opened_on": "2016-04-10", "maturity_date": "2032-03-31",
            "fy_contribution": 90000.0, "fy_limit": 150000.0, "rate_pct": 7.1},
    "epf": {"balance": 1184500.0, "uan_masked": "XXXXXXXX6623", "employee_share": 702100.0, "employer_share": 482400.0,
            "rate_pct": 8.25, "last_contribution": "2026-10-15"},
    "nps": {"balance": 438900.0, "pran_masked": "XXXXXXXX1187", "tier1": 412400.0, "tier2": 26500.0,
            "scheme_mix": [{"asset": "Equity (E)", "pct": 75}, {"asset": "Corporate debt (C)", "pct": 15},
                           {"asset": "Govt securities (G)", "pct": 10}]},
}
ret_total = r2(retirement["ppf"]["balance"] + retirement["epf"]["balance"] + retirement["nps"]["balance"])
savings = {"deposits": deposits, "retirement": retirement,
           "totals": {"deposits": fd_total, "retirement": ret_total}}

# ---------------------------------------------------------------- insurance
insurance = [
    {"id": "in_1", "type": "life", "insurer": "Demo Life Insurance Co", "plan": "Term Plan 1 Cr",
     "policy_masked": "XXXXXX4410", "sum_assured": 10000000.0, "premium": 14820.0, "frequency": "Yearly",
     "renewal_date": "2027-01-18", "status": "Active", "insured": "Self"},
    {"id": "in_2", "type": "health", "insurer": "Sample Health Insurance Ltd", "plan": "Family Floater",
     "policy_masked": "XXXXXX9015", "sum_assured": 1000000.0, "premium": 28640.0, "frequency": "Yearly",
     "renewal_date": "2026-11-24", "status": "Renewal due", "insured": "Self, spouse, 1 child"},
    {"id": "in_3", "type": "motor", "insurer": "Test General Insurance Ltd", "plan": "Comprehensive - Car",
     "policy_masked": "XXXXXX2271", "sum_assured": 640000.0, "premium": 11250.0, "frequency": "Yearly",
     "renewal_date": "2027-06-02", "status": "Active", "insured": "Vehicle XX-00-XX-0000"},
]
for p in insurance:
    p["days_to_renewal"] = (date.fromisoformat(p["renewal_date"]) - AS_OF).days

# ---------------------------------------------------------------- liabilities
loans = [
    {"id": "ln_1", "lender": "Demo Bank of India", "type": "Home loan", "account_masked": "XXXX7781",
     "principal": 4500000.0, "outstanding": 3612400.0, "emi": 38950.0, "interest_rate_pct": 8.45,
     "next_emi_date": "2026-11-07", "tenure_left_months": 158},
    {"id": "ln_2", "lender": "Sample Finance Ltd", "type": "Car loan", "account_masked": "XXXX0552",
     "principal": 650000.0, "outstanding": 284300.0, "emi": 13480.0, "interest_rate_pct": 9.2,
     "next_emi_date": "2026-11-10", "tenure_left_months": 23},
]
cards = [
    {"id": "cc_1", "issuer": "Demo Bank of India", "card_name": "Demo Platinum", "last4": "4021",
     "credit_limit": 300000.0, "outstanding": 46210.0, "min_due": 2310.0, "due_date": "2026-11-18",
     "statement_date": "2026-10-28"},
    {"id": "cc_2", "issuer": "Sample Card Services", "card_name": "Sample Rewards", "last4": "8834",
     "credit_limit": 150000.0, "outstanding": 18950.0, "min_due": 950.0, "due_date": "2026-11-12",
     "statement_date": "2026-10-22"},
]
loan_out = sum(l["outstanding"] for l in loans)
card_out = sum(c["outstanding"] for c in cards)
liabilities = {"loans": loans, "cards": cards, "totals": {
    "loan_outstanding": r2(loan_out), "card_outstanding": r2(card_out),
    "total": r2(loan_out + card_out), "monthly_emi": r2(sum(l["emi"] for l in loans)),
    "credit_limit": r2(sum(c["credit_limit"] for c in cards)),
    "utilisation_pct": r2(card_out / sum(c["credit_limit"] for c in cards) * 100)}}

# ---------------------------------------------------------------- dashboard + history
bank_total = r2(sum(a["available_balance"] for a in bank_accounts))
assets = {"bank": bank_total, "demat": demat_totals["market_value"], "mutual_funds": mf_totals["current_value"],
          "fixed_deposits": fd_total, "retirement": ret_total}
total_assets = r2(sum(assets.values()))
net_worth = r2(total_assets - liabilities["totals"]["total"])
history = []
for i in range(24, -1, -1):
    d = month_add(date(AS_OF.year, AS_OF.month, 1), -i)
    factor = 1 - 0.012 * i + rng.uniform(-0.008, 0.008)
    history.append({"month": d.strftime("%Y-%m"), "net_worth": r2(net_worth * factor),
                    "assets": r2(total_assets * (1 - 0.009 * i)), "liabilities": r2(liabilities["totals"]["total"] * (1 + 0.006 * i))})
history[-1].update({"net_worth": net_worth, "assets": total_assets, "liabilities": liabilities["totals"]["total"]})

institutions = [
    {"id": "fi_1", "name": "Demo Bank of India", "type": "Bank", "linked_via": "Account Aggregator", "status": "Connected", "last_synced_at": f"{iso(AS_OF)}T06:30:00+05:30"},
    {"id": "fi_2", "name": "Sample Co-operative Bank", "type": "Bank", "linked_via": "Account Aggregator", "status": "Connected", "last_synced_at": f"{iso(AS_OF)}T06:30:00+05:30"},
    {"id": "fi_3", "name": "NSDL / CDSL (demat)", "type": "Depository", "linked_via": "Account Aggregator", "status": "Connected", "last_synced_at": f"{iso(AS_OF)}T06:31:00+05:30"},
    {"id": "fi_4", "name": "UTI Mutual Fund + other AMCs", "type": "Mutual funds", "linked_via": "CAS statement", "status": "Connected", "last_synced_at": f"{iso(AS_OF)}T06:32:00+05:30"},
    {"id": "fi_5", "name": "EPFO", "type": "Retirement", "linked_via": "Manual", "status": "Needs attention", "last_synced_at": "2026-10-15T09:00:00+05:30"},
]
sync = {"status": "partial", "last_synced_at": f"{iso(AS_OF)}T06:32:00+05:30",
        "institutions_ok": 4, "institutions_failed": 1,
        "items": [{"institution": i["name"], "status": "ok" if i["status"] == "Connected" else "stale",
                   "message": None if i["status"] == "Connected" else "Upload latest passbook or reconnect"} for i in institutions]}

dashboard = {"as_of": iso(AS_OF), "net_worth": net_worth, "total_assets": total_assets,
             "totals": {**assets, "liabilities": liabilities["totals"]["total"]},
             "net_worth_change_1m": r2(history[-1]["net_worth"] - history[-2]["net_worth"]),
             "net_worth_history": history[-13:], "sync": sync}

consents = [
    {"id": "cn_1", "aa_handle": "user@demo-aa", "aa_name": "Demo AA Pvt Ltd (sandbox)", "fip_names": ["Demo Bank of India", "Sample Co-operative Bank"],
     "fi_types": ["DEPOSIT", "TERM_DEPOSIT", "RECURRING_DEPOSIT"], "purpose": "Personal finance management",
     "status": "ACTIVE", "created_at": "2025-11-02", "valid_till": "2027-11-01", "fetch_frequency": "1 per day", "data_range_months": 12},
    {"id": "cn_2", "aa_handle": "user@demo-aa", "aa_name": "Demo AA Pvt Ltd (sandbox)", "fip_names": ["NSDL / CDSL (demat)"],
     "fi_types": ["EQUITIES"], "purpose": "Personal finance management",
     "status": "ACTIVE", "created_at": "2026-01-14", "valid_till": "2027-01-13", "fetch_frequency": "1 per day", "data_range_months": 12},
    {"id": "cn_3", "aa_handle": "user@demo-aa", "aa_name": "Demo AA Pvt Ltd (sandbox)", "fip_names": ["Sample Insurance Repository"],
     "fi_types": ["INSURANCE_POLICIES"], "purpose": "Personal finance management",
     "status": "PAUSED", "created_at": "2026-03-02", "valid_till": "2027-03-01", "fetch_frequency": "1 per week", "data_range_months": 24},
]

fixture = {
    "is_demo": True,
    "as_of": iso(AS_OF),
    "profile": {"id": "usr_demo", "full_name": "Demo User", "email": "demo@pf360.dev", "phone_masked": "+91 XXXXX X4321",
                "pan_masked": "XXXXX1234X", "kyc_status": "Demo"},
    "dashboard": dashboard,
    "bank_accounts": bank_accounts,
    "transactions": transactions,
    "demat": demat,
    "mutual_funds": mutual_funds,
    "sips": sips,
    "performance": perf,
    "savings": savings,
    "insurance": insurance,
    "liabilities": liabilities,
    "institutions": institutions,
    "consents": consents,
    "net_worth_history": history,
}

if __name__ == "__main__":
    here = Path(__file__).resolve().parent
    out = json.dumps(fixture, indent=1)
    (here / "demo_fixture.json").write_text(out)
    mobile = here.parents[2] / "mobile" / "src" / "demo" / "fixture.json"
    mobile.parent.mkdir(parents=True, exist_ok=True)
    mobile.write_text(out)
    print("net worth", net_worth, "| tx", len(transactions), "| mf xirr", mf_totals["xirr_pct"])
