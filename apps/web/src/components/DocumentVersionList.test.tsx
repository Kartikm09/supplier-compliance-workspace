import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { documentVersion } from "../test/fixtures";
import { DocumentVersionList } from "./DocumentVersionList";

describe("DocumentVersionList", () => {
  it("renders immutable version metadata and requests signed access", () => {
    const onOpen = vi.fn();
    render(
      <DocumentVersionList onOpen={onOpen} versions={[documentVersion]} />,
    );
    expect(screen.getByText("Version 1")).toBeInTheDocument();
    expect(
      screen.getByText("fictional-quality-certificate.pdf"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open version 1" }));
    expect(onOpen).toHaveBeenCalledWith(documentVersion);
  });

  it("disables access while a version is not ready", () => {
    render(
      <DocumentVersionList
        onOpen={vi.fn()}
        versions={[
          {
            ...documentVersion,
            processing_status: "pending",
            upload_status: "processing",
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Open version 1" }),
    ).toBeDisabled();
  });
});
