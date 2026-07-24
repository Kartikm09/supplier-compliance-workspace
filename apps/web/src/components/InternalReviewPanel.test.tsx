import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { riskEvaluation } from "../test/fixtures";
import { InternalReviewPanel } from "./InternalReviewPanel";

describe("InternalReviewPanel", () => {
  it("does not render internal scoring or notes in supplier context", () => {
    const { container } = render(
      <InternalReviewPanel
        internalNote="Buyer-only evidence concern"
        organizationType="supplier"
        riskEvaluations={[riskEvaluation]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByText("Buyer-only evidence concern"),
    ).not.toBeInTheDocument();
  });

  it("renders internal information for buyer context", () => {
    render(
      <InternalReviewPanel
        internalNote="Buyer-only evidence concern"
        organizationType="buyer"
        riskEvaluations={[riskEvaluation]}
      />,
    );
    expect(screen.getByText("Buyer internal review")).toBeInTheDocument();
    expect(screen.getByText("Buyer-only evidence concern")).toBeInTheDocument();
    expect(screen.getByText("34")).toBeInTheDocument();
  });
});
