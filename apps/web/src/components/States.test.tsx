import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, ErrorState, LoadingState } from "./States";

describe("workspace states", () => {
  it("announces loading without visual instruction text", () => {
    render(<LoadingState label="Loading supplier records" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading supplier records",
    );
  });

  it("provides a specific empty state", () => {
    render(
      <EmptyState
        description="Invite a supplier to begin."
        title="No relationships"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No relationships" }),
    ).toBeVisible();
    expect(screen.getByText("Invite a supplier to begin.")).toBeVisible();
  });

  it("lets a failed query be retried", () => {
    const retry = vi.fn();
    render(<ErrorState message="Request failed" retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
