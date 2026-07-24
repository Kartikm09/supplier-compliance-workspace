import { describe, expect, it } from "vitest";

import { resolveAccessDestination } from "./ProtectedRoute";

describe("resolveAccessDestination", () => {
  it("waits while session state is unresolved", () => {
    expect(
      resolveAccessDestination({
        authLoading: true,
        hasMembership: false,
        path: "/reviews",
        userPresent: false,
        workspaceLoading: false,
      }),
    ).toBe("loading");
  });

  it("preserves the requested route for unauthenticated users", () => {
    expect(
      resolveAccessDestination({
        authLoading: false,
        hasMembership: false,
        path: "/assessments/abc?section=2",
        userPresent: false,
        workspaceLoading: false,
      }),
    ).toEqual({
      redirect: "/sign-in?next=%2Fassessments%2Fabc%3Fsection%3D2",
    });
  });

  it("requires an active membership after authentication", () => {
    expect(
      resolveAccessDestination({
        authLoading: false,
        hasMembership: false,
        path: "/",
        userPresent: true,
        workspaceLoading: false,
      }),
    ).toEqual({ redirect: "/organization-required" });
  });

  it("allows an authenticated organization member", () => {
    expect(
      resolveAccessDestination({
        authLoading: false,
        hasMembership: true,
        path: "/",
        userPresent: true,
        workspaceLoading: false,
      }),
    ).toBe("allow");
  });
});
