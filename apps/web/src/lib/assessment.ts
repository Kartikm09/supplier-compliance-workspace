import type {
  AssessmentResponse,
  DocumentRequirement,
  Question,
  SupplierDocument,
} from "@scw/contracts";

function hasResponse(response: AssessmentResponse | undefined): boolean {
  if (!response) return false;
  return [
    response.response_text,
    response.response_number,
    response.response_boolean,
    response.response_date,
    response.response_option_id,
    response.response_json,
  ].some((value) => value !== null && value !== undefined && value !== "");
}

export interface CompletionCheck {
  complete: boolean;
  missingDocumentRequirementIds: string[];
  missingQuestionIds: string[];
  percentage: number;
}

export function validateAssessmentCompletion(
  questions: Question[],
  responses: AssessmentResponse[],
  requirements: DocumentRequirement[],
  documents: SupplierDocument[],
): CompletionCheck {
  const responseByQuestion = new Map(
    responses.map((response) => [response.question_id, response]),
  );
  const requirementIds = new Set(
    documents
      .filter((document) => document.status !== "rejected")
      .map((document) => document.document_requirement_id)
      .filter((id): id is string => Boolean(id)),
  );
  const requiredQuestions = questions.filter((question) => question.required);
  const requiredDocuments = requirements.filter(
    (requirement) => requirement.required,
  );
  const missingQuestionIds = requiredQuestions
    .filter((question) => !hasResponse(responseByQuestion.get(question.id)))
    .map((question) => question.id);
  const missingDocumentRequirementIds = requiredDocuments
    .filter((requirement) => !requirementIds.has(requirement.id))
    .map((requirement) => requirement.id);
  const total = requiredQuestions.length + requiredDocuments.length;
  const answered =
    total - missingQuestionIds.length - missingDocumentRequirementIds.length;

  return {
    complete:
      missingQuestionIds.length === 0 &&
      missingDocumentRequirementIds.length === 0,
    missingDocumentRequirementIds,
    missingQuestionIds,
    percentage: total === 0 ? 100 : Math.round((answered / total) * 100),
  };
}
