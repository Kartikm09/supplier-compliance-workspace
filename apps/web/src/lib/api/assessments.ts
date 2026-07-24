import type {
  ApprovalDecision,
  Assessment,
  AssessmentResponse,
  CorrectiveAction,
  DocumentRequirement,
  DocumentReview,
  DocumentVersion,
  Finding,
  FindingEvent,
  Json,
  Organization,
  OrganizationType,
  ProgramVersion,
  QualificationProgram,
  Question,
  QuestionOption,
  QuestionnaireSection,
  RiskEvaluation,
  SupplierDocument,
  SupplierRelationship,
} from "@scw/contracts";

import { invokeEdgeFunction, supabase } from "../supabase";

export interface AssessmentSummary extends Assessment {
  buyerName: string;
  programName: string;
  supplierName: string;
}

export interface AssessmentDocument extends SupplierDocument {
  versions: DocumentVersion[];
}

export interface AssessmentWorkspaceData {
  assessment: Assessment;
  correctiveActions: CorrectiveAction[];
  decisions: ApprovalDecision[];
  documentReviews: DocumentReview[];
  documents: AssessmentDocument[];
  findingEvents: FindingEvent[];
  findings: Finding[];
  program: QualificationProgram;
  questions: Question[];
  questionOptions: QuestionOption[];
  relationship: SupplierRelationship;
  requirements: DocumentRequirement[];
  responses: AssessmentResponse[];
  riskEvaluations: RiskEvaluation[];
  sections: QuestionnaireSection[];
  version: ProgramVersion;
}

async function loadOrganizationNames(
  relationships: SupplierRelationship[],
): Promise<Map<string, Organization>> {
  const ids = [
    ...new Set(
      relationships.flatMap((relationship) => [
        relationship.buyer_organization_id,
        relationship.supplier_organization_id,
      ]),
    ),
  ];
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  return new Map(data.map((organization) => [organization.id, organization]));
}

export async function loadAssessmentsForOrganization(
  organizationId: string,
  organizationType: OrganizationType,
): Promise<AssessmentSummary[]> {
  const relationshipQuery = supabase.from("supplier_relationships").select("*");
  const { data: relationships, error: relationshipError } =
    organizationType === "buyer"
      ? await relationshipQuery.eq("buyer_organization_id", organizationId)
      : await relationshipQuery.eq("supplier_organization_id", organizationId);
  if (relationshipError) throw relationshipError;
  if (!relationships.length) return [];
  const { data: assessments, error } = await supabase
    .from("assessments")
    .select("*")
    .in(
      "supplier_relationship_id",
      relationships.map((relationship) => relationship.id),
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!assessments.length) return [];
  const [organizationById, programResult] = await Promise.all([
    loadOrganizationNames(relationships),
    supabase
      .from("qualification_programs")
      .select("*")
      .in("id", [
        ...new Set(
          assessments.map((assessment) => assessment.qualification_program_id),
        ),
      ]),
  ]);
  if (programResult.error) throw programResult.error;
  const relationshipById = new Map(
    relationships.map((relationship) => [relationship.id, relationship]),
  );
  const programById = new Map(
    programResult.data.map((program) => [program.id, program]),
  );
  return assessments.flatMap((assessment) => {
    const relationship = relationshipById.get(
      assessment.supplier_relationship_id,
    );
    const program = programById.get(assessment.qualification_program_id);
    if (!relationship || !program) return [];
    return [
      {
        ...assessment,
        buyerName:
          organizationById.get(relationship.buyer_organization_id)
            ?.display_name ?? "Buyer",
        supplierName:
          organizationById.get(relationship.supplier_organization_id)
            ?.display_name ?? "Supplier",
        programName: program.name,
      },
    ];
  });
}

export async function loadAssessmentWorkspace(
  assessmentId: string,
): Promise<AssessmentWorkspaceData> {
  const { data: assessment, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", assessmentId)
    .single();
  if (error) throw error;
  const [
    relationshipResult,
    programResult,
    versionResult,
    sectionResult,
    questionResult,
    questionOptionResult,
    responseResult,
    requirementResult,
    documentResult,
    findingResult,
    riskResult,
    decisionResult,
    documentReviewResult,
  ] = await Promise.all([
    supabase
      .from("supplier_relationships")
      .select("*")
      .eq("id", assessment.supplier_relationship_id)
      .single(),
    supabase
      .from("qualification_programs")
      .select("*")
      .eq("id", assessment.qualification_program_id)
      .single(),
    supabase
      .from("program_versions")
      .select("*")
      .eq("id", assessment.program_version_id)
      .single(),
    supabase
      .from("questionnaire_sections")
      .select("*")
      .eq("program_version_id", assessment.program_version_id)
      .order("display_order"),
    supabase
      .from("questions")
      .select("*")
      .eq("program_version_id", assessment.program_version_id)
      .order("display_order"),
    supabase.from("question_options").select("*").order("display_order"),
    supabase
      .from("assessment_responses")
      .select("*")
      .eq("assessment_id", assessmentId),
    supabase
      .from("document_requirements")
      .select("*")
      .eq("program_version_id", assessment.program_version_id)
      .order("display_order"),
    supabase
      .from("documents")
      .select("*")
      .eq("supplier_relationship_id", assessment.supplier_relationship_id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("findings_visible")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("finding_number"),
    supabase
      .from("risk_evaluations_visible")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("calculated_at", { ascending: false }),
    supabase
      .from("approval_decisions_visible")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("decided_at", { ascending: false }),
    supabase
      .from("document_reviews_visible")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: false }),
  ]);
  const results = [
    relationshipResult,
    programResult,
    versionResult,
    sectionResult,
    questionResult,
    questionOptionResult,
    responseResult,
    requirementResult,
    documentResult,
    findingResult,
    riskResult,
    decisionResult,
    documentReviewResult,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  if (!relationshipResult.data || !programResult.data || !versionResult.data) {
    throw new Error("Assessment context is incomplete.");
  }

  const documents = documentResult.data ?? [];
  const versionRows = documents.length
    ? await supabase
        .from("document_versions")
        .select("*")
        .in(
          "document_id",
          documents.map((document) => document.id),
        )
        .order("version_number", { ascending: false })
    : { data: [] as DocumentVersion[], error: null };
  if (versionRows.error) throw versionRows.error;
  const versionsByDocument = new Map<string, DocumentVersion[]>();
  for (const version of versionRows.data) {
    const existing = versionsByDocument.get(version.document_id) ?? [];
    existing.push(version);
    versionsByDocument.set(version.document_id, existing);
  }
  const findings = findingResult.data ?? [];
  const [correctiveResult, eventResult] = findings.length
    ? await Promise.all([
        supabase
          .from("corrective_actions")
          .select("*")
          .in(
            "finding_id",
            findings.map((finding) => finding.id),
          ),
        supabase
          .from("finding_events")
          .select("*")
          .in(
            "finding_id",
            findings.map((finding) => finding.id),
          )
          .order("created_at"),
      ])
    : [
        { data: [] as CorrectiveAction[], error: null },
        { data: [] as FindingEvent[], error: null },
      ];
  if (correctiveResult.error) throw correctiveResult.error;
  if (eventResult.error) throw eventResult.error;

  return {
    assessment,
    correctiveActions: correctiveResult.data,
    decisions: decisionResult.data ?? [],
    documentReviews: documentReviewResult.data ?? [],
    documents: documents.map((document) => ({
      ...document,
      versions: versionsByDocument.get(document.id) ?? [],
    })),
    findingEvents: eventResult.data,
    findings,
    program: programResult.data,
    questions: questionResult.data ?? [],
    questionOptions: (questionOptionResult.data ?? []).filter((option) =>
      (questionResult.data ?? []).some(
        (question) => question.id === option.question_id,
      ),
    ),
    relationship: relationshipResult.data,
    requirements: requirementResult.data ?? [],
    responses: responseResult.data ?? [],
    riskEvaluations: riskResult.data ?? [],
    sections: sectionResult.data ?? [],
    version: versionResult.data,
  };
}

export interface ResponseDraft {
  response_boolean?: boolean | null;
  response_date?: string | null;
  response_json?: Json;
  response_number?: number | null;
  response_option_id?: string | null;
  response_text?: string | null;
}

export async function saveAssessmentResponse(values: {
  assessmentId: string;
  draft: ResponseDraft;
  questionId: string;
  userId: string;
}): Promise<AssessmentResponse> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("assessment_responses")
    .upsert(
      {
        answered_at: now,
        answered_by: values.userId,
        assessment_id: values.assessmentId,
        question_id: values.questionId,
        response_boolean: values.draft.response_boolean ?? null,
        response_date: values.draft.response_date ?? null,
        response_json: values.draft.response_json ?? null,
        response_number: values.draft.response_number ?? null,
        response_option_id: values.draft.response_option_id ?? null,
        response_text: values.draft.response_text ?? null,
        updated_at: now,
      },
      { onConflict: "assessment_id,question_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function beginAssessment(
  assessmentId: string,
): Promise<Assessment> {
  const { data, error } = await supabase.rpc("transition_assessment", {
    p_assessment_id: assessmentId,
    p_expected_status: "draft",
    p_next_status: "in_progress",
  });
  if (error) throw error;
  return data;
}

export async function transitionAssessmentStatus(values: {
  assessmentId: string;
  expectedStatus: string;
  nextStatus: string;
}): Promise<Assessment> {
  const { data, error } = await supabase.rpc("transition_assessment", {
    p_assessment_id: values.assessmentId,
    p_expected_status: values.expectedStatus,
    p_next_status: values.nextStatus,
  });
  if (error) throw error;
  return data;
}

export async function submitAssessment(values: {
  assessmentId: string;
  declaration: string;
}): Promise<Assessment> {
  return invokeEdgeFunction<Assessment>("submit-assessment", {
    assessment_id: values.assessmentId,
    supplier_declaration: values.declaration,
  });
}

export async function saveDocumentReview(values: {
  assessmentId: string;
  documentVersionId: string;
  internalNote: string | null;
  reviewerNote: string | null;
  status: DocumentReview["status"];
}): Promise<DocumentReview> {
  const { data, error } = await supabase.rpc("record_document_review", {
    buyer_internal_note: values.internalNote,
    requested_status: values.status,
    supplier_note: values.reviewerNote,
    target_assessment_id: values.assessmentId,
    target_document_version_id: values.documentVersionId,
  });
  if (error) throw error;
  return data;
}
