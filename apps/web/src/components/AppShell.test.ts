import { describe, expect, it } from "vitest";

import { navigationForMembership } from "./AppShell";

describe("navigationForMembership", () => {
  it("provides buyer operational areas to a buyer reviewer", () => {
    const labels = navigationForMembership("buyer", "buyer_reviewer").map(
      (item) => item.label,
    );
    expect(labels).toContain("Suppliers");
    expect(labels).toContain("Programs");
    expect(labels).toContain("Review queue");
    expect(labels).not.toContain("Documents");
    expect(labels).not.toContain("Decisions");
  });

  it("includes owner decision governance", () => {
    const labels = navigationForMembership("buyer", "buyer_owner").map(
      (item) => item.label,
    );
    expect(labels).toContain("Decisions");
  });

  it("provides supplier contribution areas to a supplier contributor", () => {
    const labels = navigationForMembership(
      "supplier",
      "supplier_contributor",
    ).map((item) => item.label);
    expect(labels).toEqual([
      "Dashboard",
      "Buyer relationships",
      "Assessments",
      "Documents",
      "Findings",
    ]);
  });
});
