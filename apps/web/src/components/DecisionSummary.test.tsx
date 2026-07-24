import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { approvalDecision } from "../test/fixtures";
import { DecisionSummary } from "./DecisionSummary";

describe("DecisionSummary", () => {
  it("shows conditions but hides buyer rationale from suppliers", () => {
    render(
      <DecisionSummary
        decisions={[approvalDecision]}
        organizationType="supplier"
      />,
    );
    expect(
      screen.getByText("Replace the certificate before its expiry date."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/controls are adequate/i),
    ).not.toBeInTheDocument();
  });

  it("shows the internal rationale to buyer users", () => {
    render(
      <DecisionSummary
        decisions={[approvalDecision]}
        organizationType="buyer"
      />,
    );
    expect(screen.getByText("Internal rationale")).toBeInTheDocument();
    expect(screen.getByText(/controls are adequate/i)).toBeInTheDocument();
  });
});
