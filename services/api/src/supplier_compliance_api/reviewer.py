"""Loopback-only synthetic reviewer API; never mounted in the processing service.

The public demo identities are fixture selectors, NOT deployable authentication.
The HTTP service enforces roles, tenancy, confidentiality and version checks.
Restart the process to reset all synthetic state.
"""

from copy import deepcopy
from threading import Lock
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field


class Identity(BaseModel):
    tenant: str
    role: Literal["contributor", "reviewer", "viewer"]


class ReviewCase(BaseModel):
    id: str
    tenant: str
    title: str
    visibility: Literal["public", "private"] = "private"
    status: Literal["draft", "submitted", "approved"] = "draft"
    version: int = 1
    evidence: str
    private_note: str = ""
    assessment: str = ""
    updated_at: str = "2026-09-18T09:00:00Z"


class Transition(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    action: Literal["submit", "approve"]
    version: int = Field(ge=1)
    assessment: str = Field(min_length=1, max_length=2000)


IDENTITIES = {
    "fixture-apex-contributor": Identity(tenant="apex", role="contributor"),
    "fixture-apex-reviewer": Identity(tenant="apex", role="reviewer"),
    "fixture-apex-viewer": Identity(tenant="apex", role="viewer"),
    "fixture-greenline-reviewer": Identity(tenant="greenline", role="reviewer"),
}
FIXTURES = [
    ReviewCase(
        id="apex-1",
        tenant="apex",
        title="Nova material declaration",
        evidence="Synthetic declaration v2: recycled resin content 40%.",
        private_note="Buyer-only: independently verify the signed declaration.",
    ),
    ReviewCase(
        id="apex-2",
        tenant="apex",
        title="Nova safety evidence",
        evidence="Synthetic safety inspection v1: one corrective action open.",
        private_note="Buyer-only: this inspection remains under review.",
    ),
    ReviewCase(
        id="greenline-1",
        tenant="greenline",
        title="Greenline packaging audit",
        evidence="Synthetic packaging audit: closure evidence pending.",
        private_note="Greenline-only review note.",
    ),
    ReviewCase(
        id="public-1",
        tenant="reference",
        title="Public assessment handbook",
        visibility="public",
        status="approved",
        evidence="Fictional training guidance v1.",
    ),
]


def create_reviewer_app() -> FastAPI:
    app = FastAPI(title="Synthetic supplier reviewer lab", version="1.0.0")
    cases = {case.id: deepcopy(case) for case in FIXTURES}
    lock = Lock()

    def identity(authorization: Annotated[str | None, Header()] = None) -> Identity:
        if authorization is None or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Select a synthetic fixture identity.")
        found = IDENTITIES.get(authorization.removeprefix("Bearer "))
        if found is None:
            raise HTTPException(401, "Unknown fixture identity.")
        return found

    def visible(case_id: str, actor: Identity) -> ReviewCase:
        case = cases.get(case_id)
        if case is None or (case.visibility != "public" and case.tenant != actor.tenant):
            raise HTTPException(404, "Case not found.")
        return case

    def response(case: ReviewCase, actor: Identity) -> dict[str, object]:
        result = case.model_dump()
        if case.tenant != actor.tenant or actor.role != "reviewer":
            result.pop("private_note")
        return result

    @app.get("/cases")
    def list_cases(actor: Annotated[Identity, Depends(identity)]) -> list[dict[str, object]]:
        with lock:
            return [
                response(case, actor)
                for case in cases.values()
                if case.visibility == "public" or case.tenant == actor.tenant
            ]

    @app.get("/cases/{case_id}")
    def get_case(case_id: str, actor: Annotated[Identity, Depends(identity)]) -> dict[str, object]:
        with lock:
            return response(visible(case_id, actor), actor)

    @app.post("/cases/{case_id}/transitions")
    def transition(
        case_id: str, request: Transition, actor: Annotated[Identity, Depends(identity)]
    ) -> dict[str, object]:
        with lock:
            case = visible(case_id, actor)
            expected_role = "contributor" if request.action == "submit" else "reviewer"
            if case.tenant != actor.tenant or actor.role != expected_role:
                raise HTTPException(403, "This role cannot perform that action.")
            if case.version != request.version:
                raise HTTPException(409, "Case changed. Reload and review the latest evidence.")
            expected_state = "draft" if request.action == "submit" else "submitted"
            if case.status != expected_state:
                raise HTTPException(409, "Invalid review transition.")
            if not request.assessment.strip():
                raise HTTPException(422, "A written evidence assessment is required.")
            case.status = "submitted" if request.action == "submit" else "approved"
            case.assessment = request.assessment.strip()
            case.version += 1
            return response(case, actor)

    return app


app = create_reviewer_app()
