"""Questionnaire answer validation and completeness calculation."""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from supplier_compliance_api.models import QuestionnaireAnswer, QuestionnaireCompleteness


def calculate_completeness(
    answers: list[QuestionnaireAnswer],
) -> QuestionnaireCompleteness:
    """Validate visible answer values and calculate required-answer completeness."""

    missing: list[str] = []
    invalid: list[str] = []
    required_total = 0
    required_answered = 0

    for answer in answers:
        if not answer.visible:
            continue
        present = _has_value(answer.value)
        valid = present and _valid_value(answer.answer_type, answer.value)
        if present and not valid:
            invalid.append(answer.stable_question_key)
        if answer.required:
            required_total += 1
            if not present:
                missing.append(answer.stable_question_key)
            elif valid:
                required_answered += 1

    percentage = (
        Decimal("100")
        if required_total == 0
        else (Decimal(required_answered) * Decimal("100") / Decimal(required_total)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    )
    return QuestionnaireCompleteness(
        complete=not missing and not invalid,
        completeness_percentage=percentage,
        required_total=required_total,
        required_answered=required_answered,
        missing_required_keys=missing,
        invalid_answer_keys=invalid,
    )


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return bool(value)
    return True


def _valid_value(answer_type: str, value: Any) -> bool:
    if answer_type == "text":
        return isinstance(value, str) and bool(value.strip())
    if answer_type == "number":
        return isinstance(value, (int, float, Decimal)) and not isinstance(value, bool)
    if answer_type == "boolean":
        return isinstance(value, bool)
    if answer_type == "date":
        if isinstance(value, date):
            return True
        if isinstance(value, str):
            try:
                date.fromisoformat(value)
            except ValueError:
                return False
            return True
        return False
    if answer_type == "single_select":
        return isinstance(value, str) and bool(value.strip())
    if answer_type == "multi_select":
        return (
            isinstance(value, list)
            and bool(value)
            and all(isinstance(item, str) and bool(item.strip()) for item in value)
        )
    return False
