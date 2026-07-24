import type { MembershipWithOrganization } from "@scw/contracts";
import { describe, expect, it } from "vitest";

import { resolveSelectedMembership } from "./WorkspaceContext";

const apexMembership: MembershipWithOrganization = {
  created_at: "2026-07-01T09:05:00Z",
  id: "10000000-0000-4000-8000-000000000002",
  invited_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0",
  joined_at: "2026-07-01T09:05:00Z",
  membership_status: "active",
  organization: {
    country_code: "DE",
    created_at: "2026-07-01T09:00:00Z",
    created_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0",
    display_name: "Apex Components Group",
    id: "11111111-1111-4111-8111-111111111111",
    legal_name: "Apex Components Group Demonstration GmbH",
    organization_type: "buyer",
    slug: "apex-components-group",
    status: "active",
    updated_at: "2026-07-01T09:00:00Z",
  },
  organization_id: "11111111-1111-4111-8111-111111111111",
  role: "buyer_admin",
  user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
};

describe("resolveSelectedMembership", () => {
  it("uses the first valid membership before local selection is persisted", () => {
    expect(resolveSelectedMembership([apexMembership], "")).toBe(
      apexMembership,
    );
  });

  it("returns null when the user has no active memberships", () => {
    expect(resolveSelectedMembership([], apexMembership.organization_id)).toBe(
      null,
    );
  });
});
