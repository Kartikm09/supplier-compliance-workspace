"""Questionnaire completeness and deterministic risk-scoring tests."""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from supplier_compliance_api.models import (
    JobMetadata,
    QuestionnaireAnswer,
    RecalculateRiskRequest,
    RiskFactor,
)
from supplier_compliance_api.questionnaires import calculate_completeness
from supplier_compliance_api.risk import calculate_risk


def test_complete_questionnaire_scores_100_percent() -> None:
    result = calculate_completeness(
        [
            QuestionnaireAnswer(
                stable_question_key="quality-policy",
                answer_type="text",
                required=True,
                value="Documented and reviewed annually.",
            ),
            QuestionnaireAnswer(
                stable_question_key="certified",
                answer_type="boolean",
                required=True,
                value=False,
            ),
        ]
    )
    assert result.complete
    assert result.completeness_percentage == Decimal("100")
    assert result.required_answered == 2


def test_missing_required_answer_reduces_completeness() -> None:
    result = calculate_completeness(
        [
            QuestionnaireAnswer(
                stable_question_key="quality-policy",
                answer_type="text",
                required=True,
                value="",
            ),
            QuestionnaireAnswer(
                stable_question_key="continuity-plan",
                answer_type="boolean",
                required=True,
                value=True,
            ),
        ]
    )
    assert not result.complete
    assert result.completeness_percentage == Decimal("50.00")
    assert result.missing_required_keys == ["quality-policy"]


def test_hidden_required_answer_does_not_count() -> None:
    result = calculate_completeness(
        [
            QuestionnaireAnswer(
                stable_question_key="conditional-detail",
                answer_type="text",
                required=True,
                visible=False,
            )
        ]
    )
    assert result.complete
    assert result.required_total == 0
    assert result.completeness_percentage == Decimal("100")


@pytest.mark.parametrize(
    ("answer_type", "value"),
    [
        ("text", "evidence"),
        ("number", 42),
        ("boolean", False),
        ("date", "2026-07-24"),
        ("single_select", "yes"),
        ("multi_select", ["quality", "security"]),
    ],
)
def test_supported_answer_types_are_valid(answer_type: str, value: object) -> None:
    result = calculate_completeness(
        [
            QuestionnaireAnswer.model_validate(
                {
                    "stable_question_key": "answer",
                    "answer_type": answer_type,
                    "required": True,
                    "value": value,
                }
            )
        ]
    )
    assert result.complete


@pytest.mark.parametrize(
    ("answer_type", "value"),
    [
        ("number", True),
        ("boolean", "yes"),
        ("date", "24/07/2026"),
        ("multi_select", ["valid", ""]),
    ],
)
def test_invalid_answer_types_are_flagged(answer_type: str, value: object) -> None:
    result = calculate_completeness(
        [
            QuestionnaireAnswer.model_validate(
                {
                    "stable_question_key": "answer",
                    "answer_type": answer_type,
                    "required": True,
                    "value": value,
                }
            )
        ]
    )
    assert not result.complete
    assert result.invalid_answer_keys == ["answer"]


def risk_request(
    *,
    scores: tuple[int, int, int, int, int] = (20, 20, 20, 20, 20),
    critical_findings: int = 0,
    expiring_documents: int = 0,
) -> RecalculateRiskRequest:
    names = (
        "quality_management",
        "information_security",
        "business_continuity",
        "document_validity",
        "delivery_capability",
    )
    return RecalculateRiskRequest(
        job=JobMetadata(job_id="risk-job"),
        assessment_id=uuid4(),
        factors=[
            RiskFactor.model_validate({"name": name, "score": score})
            for name, score in zip(names, scores, strict=True)
        ],
        unresolved_critical_findings=critical_findings,
        documents_expiring_within_30_days=expiring_documents,
    )


def test_risk_score_is_weighted_and_transparent() -> None:
    result = calculate_risk(risk_request(scores=(10, 20, 30, 40, 50)))
    assert result.total_score == Decimal("28.00")
    assert result.risk_level == "medium"
    assert result.scoring_breakdown["quality_management"].weight == Decimal("0.25")
    assert sum(item.contribution for item in result.scoring_breakdown.values()) == Decimal("28.00")


def test_risk_adjustments_are_capped() -> None:
    result = calculate_risk(
        risk_request(
            scores=(60, 60, 60, 60, 60),
            critical_findings=10,
            expiring_documents=10,
        )
    )
    assert result.total_score == Decimal("100.00")
    assert result.risk_level == "critical"
    assert result.adjustments["unresolved_critical_findings"] == Decimal("30")
    assert result.adjustments["documents_expiring_within_30_days"] == Decimal("10")


@pytest.mark.parametrize(
    ("score", "level"),
    [(0, "low"), (25, "medium"), (50, "high"), (75, "critical")],
)
def test_risk_level_boundaries(score: int, level: str) -> None:
    result = calculate_risk(risk_request(scores=(score,) * 5))
    assert result.risk_level == level


def test_risk_calculation_is_independent_of_factor_order() -> None:
    original = risk_request(scores=(10, 20, 30, 40, 50))
    reversed_request = original.model_copy(update={"factors": list(reversed(original.factors))})
    assert calculate_risk(original).total_score == calculate_risk(reversed_request).total_score


def test_risk_request_rejects_duplicate_or_missing_factor() -> None:
    valid = risk_request()
    with pytest.raises(ValidationError, match="unique"):
        RecalculateRiskRequest.model_validate(
            {
                **valid.model_dump(mode="json"),
                "factors": [valid.factors[0].model_dump(mode="json")] * 5,
            }
        )
