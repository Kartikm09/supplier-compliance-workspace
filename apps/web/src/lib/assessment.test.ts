import { describe, expect, it } from "vitest";

import {
  completedResponse,
  requiredDocument,
  requiredQuestion,
  supplierDocument,
} from "../test/fixtures";
import { validateAssessmentCompletion } from "./assessment";

describe("validateAssessmentCompletion", () => {
  it("identifies missing required answers and evidence", () => {
    const result = validateAssessmentCompletion(
      [requiredQuestion],
      [],
      [requiredDocument],
      [],
    );
    expect(result.complete).toBe(false);
    expect(result.percentage).toBe(0);
    expect(result.missingQuestionIds).toEqual([requiredQuestion.id]);
    expect(result.missingDocumentRequirementIds).toEqual([requiredDocument.id]);
  });

  it("marks a complete assessment ready for submission", () => {
    const result = validateAssessmentCompletion(
      [requiredQuestion],
      [completedResponse],
      [requiredDocument],
      [supplierDocument],
    );
    expect(result).toEqual({
      complete: true,
      missingDocumentRequirementIds: [],
      missingQuestionIds: [],
      percentage: 100,
    });
  });
});
