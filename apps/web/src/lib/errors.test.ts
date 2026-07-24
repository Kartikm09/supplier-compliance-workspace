import { describe, expect, it } from "vitest";

import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("does not expose PostgREST single-row details on denied resources", () => {
    expect(
      errorMessage({
        code: "PGRST116",
        message: "Cannot coerce the result to a single JSON object",
      }),
    ).toBe("The requested record was not found or access was denied.");
  });

  it("does not expose table names from database permission errors", () => {
    expect(
      errorMessage({
        code: "42501",
        message: "permission denied for table private_records",
      }),
    ).toBe("You do not have permission to access this workspace data.");
  });
});
