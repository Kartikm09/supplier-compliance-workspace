import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type Api,
  indexEvidence,
  type ReviewCase,
  ReviewerLab,
} from "./ReviewerLab";

const record = (id: string): ReviewCase => ({
  id,
  tenant: "apex",
  title: `Case ${id}`,
  evidence: `Evidence ${id}`,
  status: "draft",
  version: 1,
  assessment: "",
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("reviewer tasks", () => {
  it("T1: late evidence cannot replace a newer selection, even when transport ignores abort", async () => {
    const slow = deferred<ReviewCase>();
    const api = vi.fn((path: string) =>
      path === "/cases"
        ? Promise.resolve([record("a"), record("b")])
        : path === "/cases/a"
          ? slow.promise
          : Promise.resolve(record("b")),
    ) as Api;
    render(<ReviewerLab api={api} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Case b draft" }),
    );
    expect(await screen.findByText("Evidence b")).toBeVisible();
    await act(async () => {
      slow.resolve(record("a"));
      await slow.promise;
    });
    expect(screen.getByText("Evidence b")).toBeVisible();
    expect(screen.queryByText("Evidence a")).not.toBeInTheDocument();
  });

  it("T2: invalid assessment recovers and a successful transition restores focus", async () => {
    const api = vi.fn((path: string) =>
      Promise.resolve(
        path === "/cases"
          ? [record("a")]
          : path.endsWith("transitions")
            ? { ...record("a"), status: "submitted", version: 2 }
            : record("a"),
      ),
    ) as Api;
    render(<ReviewerLab api={api} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit assessment" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "written evidence assessment is required",
    );
    fireEvent.change(screen.getByLabelText("Written evidence assessment"), {
      target: { value: "The declaration is present." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit assessment" }));
    await waitFor(() =>
      expect(screen.getByTestId("case-status")).toHaveTextContent("submitted"),
    );
    expect(screen.getByRole("heading", { name: "Case a" })).toHaveFocus();
  });

  it("shows empty search and recovers from permission denial without discarding the draft", async () => {
    const api = vi.fn((path: string) =>
      path.endsWith("transitions")
        ? Promise.reject(new Error("This role cannot perform that action."))
        : Promise.resolve(path === "/cases" ? [record("a")] : record("a")),
    ) as Api;
    render(<ReviewerLab api={api} />);
    const input = await screen.findByLabelText("Written evidence assessment");
    fireEvent.change(input, { target: { value: "Keep this assessment." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit assessment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "cannot perform",
    );
    expect(input).toHaveValue("Keep this assessment.");
    fireEvent.change(screen.getByLabelText("Search cases"), {
      target: { value: "absent" },
    });
    expect(
      within(screen.getByRole("navigation")).getByText(
        "No cases match your search.",
      ),
    ).toBeVisible();
  });

  it("T3: indexed lookup preserves identities and visits each input only once", () => {
    let reads = 0;
    const records = Array.from({ length: 1000 }, (_, i) => ({
      get id() {
        reads++;
        return String(i);
      },
      value: i,
    }));
    for (let i = 0; i < 1000; i++)
      expect(records.find((item) => item.id === String(i))).toBe(records[i]);
    expect(reads).toBe(500500);
    reads = 0;
    const indexed = indexEvidence(records);
    for (let i = 0; i < 1000; i++)
      expect(indexed.get(String(i))).toBe(records[i]);
    expect(reads).toBe(1000);
    expect(indexEvidence([]).size).toBe(0);
    const first = { id: "same", value: 1 };
    expect(indexEvidence([first, { id: "same", value: 2 }]).get("same")).toBe(
      first,
    );
  });
});
