"""Portfolio maths shared by the backend. Mirrors mobile/src/lib/calc.ts."""
from __future__ import annotations

from datetime import date
from typing import Iterable


def _xnpv(rate: float, flows: list[tuple[date, float]]) -> float:
    t0 = flows[0][0]
    return sum(cf / (1 + rate) ** ((d - t0).days / 365.0) for d, cf in flows)


def _dxnpv(rate: float, flows: list[tuple[date, float]]) -> float:
    t0 = flows[0][0]
    total = 0.0
    for d, cf in flows:
        t = (d - t0).days / 365.0
        total -= t * cf / (1 + rate) ** (t + 1)
    return total


def xirr(cashflows: Iterable[tuple[date, float]], guess: float = 0.1) -> float:
    """Annualised XIRR. Outflows negative, inflows positive. Newton with bisection fallback."""
    flows = sorted(cashflows, key=lambda f: f[0])
    if not any(cf < 0 for _, cf in flows) or not any(cf > 0 for _, cf in flows):
        raise ValueError("XIRR needs at least one negative and one positive cash flow")
    rate = guess
    for _ in range(100):
        f = _xnpv(rate, flows)
        df = _dxnpv(rate, flows)
        if df == 0:
            break
        new = rate - f / df
        if new <= -0.9999:
            break
        if abs(new - rate) < 1e-10:
            return new
        rate = new
    lo, hi = -0.9999, 10.0
    for _ in range(300):
        mid = (lo + hi) / 2
        if _xnpv(lo, flows) * _xnpv(mid, flows) <= 0:
            hi = mid
        else:
            lo = mid
        if hi - lo < 1e-10:
            break
    return (lo + hi) / 2


def absolute_return_pct(invested: float, current: float) -> float:
    if invested == 0:
        return 0.0
    return (current - invested) / invested * 100
