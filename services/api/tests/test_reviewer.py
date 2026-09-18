"""Real ASGI API tests. No browser visibility mocks are used for authorization."""

import pytest
from fastapi.testclient import TestClient

from supplier_compliance_api.reviewer import create_reviewer_app


@pytest.fixture
def client():
    with TestClient(create_reviewer_app()) as test_client:
        yield test_client


def auth(identity="apex-reviewer"):
    return {"Authorization": f"Bearer fixture-{identity}"}


def transition(
    client,
    identity="apex-contributor",
    action="submit",
    version=1,
    assessment="Evidence checked",
    case="apex-1",
    **extra,
):
    return client.post(
        f"/cases/{case}/transitions",
        headers=auth(identity),
        json={
            "action": action,
            "version": version,
            "assessment": assessment,
            **extra,
        },
    )


def test_identity_is_required_and_cannot_be_forged(client):
    assert client.get("/cases").status_code == 401
    assert client.get("/cases", headers=auth("unknown")).status_code == 401


def test_two_tenants_public_records_and_private_fields(client):
    apex = client.get("/cases", headers=auth()).json()
    greenline = client.get("/cases", headers=auth("greenline-reviewer")).json()
    assert {c["id"] for c in apex} == {"apex-1", "apex-2", "public-1"}
    assert {c["id"] for c in greenline} == {"greenline-1", "public-1"}
    assert client.get("/cases/apex-1", headers=auth("greenline-reviewer")).status_code == 404
    assert client.get("/cases/missing", headers=auth()).status_code == 404
    assert "private_note" not in client.get("/cases/apex-1", headers=auth("apex-viewer")).json()
    assert "private_note" in client.get("/cases/apex-1", headers=auth()).json()


@pytest.mark.parametrize(
    "identity,action",
    [
        ("apex-viewer", "submit"),
        ("apex-viewer", "approve"),
        ("apex-contributor", "approve"),
        ("apex-reviewer", "submit"),
    ],
)
def test_direct_requests_enforce_role(client, identity, action):
    assert transition(client, identity=identity, action=action).status_code == 403


def test_happy_path_version_conflict_and_replay(client):
    assert transition(client).json()["status"] == "submitted"
    assert transition(client, identity="apex-reviewer", action="approve").status_code == 409
    approved = transition(client, identity="apex-reviewer", action="approve", version=2)
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    assert (
        transition(client, identity="apex-reviewer", action="approve", version=3).status_code == 409
    )


def test_bad_input_recovers_without_state_change(client):
    assert transition(client, assessment="   ").status_code == 422
    assert transition(client, assessment="x" * 2001).status_code == 422
    assert transition(client, tenant="greenline").status_code == 422
    assert transition(client, version=True).status_code == 422
    assert transition(client).status_code == 200


def test_cross_tenant_and_public_mutations_are_denied(client):
    assert transition(client, identity="greenline-reviewer", action="approve").status_code == 404
    assert transition(client, case="public-1").status_code == 403


def test_restart_resets_only_synthetic_state(client):
    assert transition(client).status_code == 200
    with TestClient(create_reviewer_app()) as restarted:
        assert restarted.get("/cases/apex-1", headers=auth()).json()["status"] == "draft"
