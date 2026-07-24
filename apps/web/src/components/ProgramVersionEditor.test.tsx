import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { programVersion } from "../test/fixtures";
import { ProgramVersionEditor } from "./ProgramVersionEditor";

describe("ProgramVersionEditor", () => {
  it("enables draft changes for an authorized buyer", () => {
    const onAddSection = vi.fn();
    render(
      <ProgramVersionEditor
        canEdit
        onAddQuestion={vi.fn()}
        onAddRequirement={vi.fn()}
        onAddSection={onAddSection}
        questions={[]}
        requirements={[]}
        sections={[]}
        version={programVersion}
      />,
    );
    const button = screen.getByRole("button", { name: "Add section" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onAddSection).toHaveBeenCalledOnce();
  });

  it("locks a published version even for an authorized buyer", () => {
    render(
      <ProgramVersionEditor
        canEdit
        onAddQuestion={vi.fn()}
        onAddRequirement={vi.fn()}
        onAddSection={vi.fn()}
        questions={[]}
        requirements={[]}
        sections={[]}
        version={{
          ...programVersion,
          published_at: "2026-07-03T09:00:00Z",
          status: "active",
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Add section" })).toBeDisabled();
    expect(
      screen.getByText(/published definitions are immutable/i),
    ).toBeInTheDocument();
  });
});
