"""Deterministic and transparent supplier risk scoring."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from supplier_compliance_api.models import (
    RecalculateRiskRequest,
    RiskContribution,
    RiskResult,
)

RISK_WEIGHTS: dict[str, dict[str, Decimal]] = {
    "supplier-risk-v1": {
        "quality_management": Decimal("0.25"),
        "information_security": Decimal("0.20"),
        "business_continuity": Decimal("0.20"),
        "document_validity": Decimal("0.20"),
        "delivery_capability": Decimal("0.15"),
    }
}
TWO_PLACES = Decimal("0.01")


def calculate_risk(request: RecalculateRiskRequest) -> RiskResult:
    """Calculate an immutable, reproducible score for the requested model version."""

    weights = RISK_WEIGHTS[request.calculation_version]
    breakdown: dict[str, RiskContribution] = {}
    base_score = Decimal("0")
    for factor in sorted(request.factors, key=lambda item: item.name):
        weight = weights[factor.name]
        contribution = (factor.score * weight).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        base_score += contribution
        breakdown[factor.name] = RiskContribution(
            score=factor.score.quantize(TWO_PLACES, rounding=ROUND_HALF_UP),
            weight=weight,
            contribution=contribution,
        )

    critical_adjustment = min(
        Decimal(request.unresolved_critical_findings) * Decimal("15"),
        Decimal("30"),
    )
    expiry_adjustment = min(
        Decimal(request.documents_expiring_within_30_days) * Decimal("2"),
        Decimal("10"),
    )
    total = min(
        Decimal("100"),
        base_score + critical_adjustment + expiry_adjustment,
    ).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    return RiskResult(
        assessment_id=request.assessment_id,
        calculation_version=request.calculation_version,
        total_score=total,
        risk_level=_risk_level(total),
        scoring_breakdown=breakdown,
        adjustments={
            "unresolved_critical_findings": critical_adjustment,
            "documents_expiring_within_30_days": expiry_adjustment,
        },
    )


def _risk_level(score: Decimal) -> Literal["low", "medium", "high", "critical"]:
    if score < Decimal("25"):
        return "low"
    if score < Decimal("50"):
        return "medium"
    if score < Decimal("75"):
        return "high"
    return "critical"
