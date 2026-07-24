import type { FindingEvent } from "@scw/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FindingTimeline } from "../components/FindingTimeline";

const events: FindingEvent[] = [
  {
    actor_user_id: null,
    comment: "Please provide a replacement certificate.",
    created_at: "2026-07-03T09:00:00Z",
    event_type: "replacement_requested",
    finding_id: "00000000-0000-4000-8000-000000000001",
    id: "00000000-0000-4000-8000-000000000002",
    metadata: {},
    organization_id: "00000000-0000-4000-8000-000000000003",
    supplier_visible: true,
  },
  {
    actor_user_id: null,
    comment: "Internal risk score requires owner review.",
    created_at: "2026-07-03T10:00:00Z",
    event_type: "internal_review_note",
    finding_id: "00000000-0000-4000-8000-000000000001",
    id: "00000000-0000-4000-8000-000000000004",
    metadata: {},
    organization_id: "00000000-0000-4000-8000-000000000003",
    supplier_visible: false,
  },
];

describe("FindingTimeline", () => {
  it("hides buyer-internal events from supplier users", () => {
    render(<FindingTimeline events={events} organizationType="supplier" />);

    expect(
      screen.getByText("Please provide a replacement certificate."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Internal risk score requires owner review."),
    ).not.toBeInTheDocument();
  });

  it("shows the complete review trail to buyer users", () => {
    render(<FindingTimeline events={events} organizationType="buyer" />);

    expect(
      screen.getByText("Internal risk score requires owner review."),
    ).toBeInTheDocument();
  });
});
