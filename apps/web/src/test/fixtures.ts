import type {
  ApprovalDecision,
  AssessmentResponse,
  DocumentRequirement,
  DocumentVersion,
  ProgramVersion,
  Question,
  RiskEvaluation,
  SupplierDocument,
} from "@scw/contracts";

export const programVersion: ProgramVersion = {
  change_summary: null,
  created_at: "2026-07-01T09:00:00Z",
  effective_from: null,
  id: "00000000-0000-4000-8000-000000000001",
  published_at: null,
  published_by: null,
  qualification_program_id: "00000000-0000-4000-8000-000000000002",
  status: "draft",
  version_number: 1,
};

export const requiredQuestion: Question = {
  answer_type: "text",
  conditional_visibility_rules: {},
  display_order: 0,
  help_text: null,
  id: "00000000-0000-4000-8000-000000000003",
  program_version_id: programVersion.id,
  prompt: "Describe the quality management process.",
  required: true,
  risk_weight: 10,
  section_id: "00000000-0000-4000-8000-000000000004",
  stable_question_key: "quality_process",
  validation_rules: {},
};

export const completedResponse: AssessmentResponse = {
  answered_at: "2026-07-02T09:00:00Z",
  answered_by: "00000000-0000-4000-8000-000000000005",
  assessment_id: "00000000-0000-4000-8000-000000000006",
  id: "00000000-0000-4000-8000-000000000007",
  question_id: requiredQuestion.id,
  response_boolean: null,
  response_date: null,
  response_json: null,
  response_number: null,
  response_option_id: null,
  response_text: "Documented controls with quarterly management review.",
  updated_at: "2026-07-02T09:00:00Z",
};

export const requiredDocument: DocumentRequirement = {
  accepted_mime_types: ["application/pdf"],
  description: "Current fictional certificate.",
  display_order: 0,
  id: "00000000-0000-4000-8000-000000000008",
  maximum_size_bytes: 10 * 1024 * 1024,
  minimum_validity_days: 30,
  name: "Quality certificate",
  program_version_id: programVersion.id,
  required: true,
  requires_expiry_date: true,
  requires_issue_date: true,
  stable_requirement_key: "quality_certificate",
};

export const supplierDocument: SupplierDocument = {
  created_at: "2026-07-02T09:00:00Z",
  created_by: "00000000-0000-4000-8000-000000000005",
  current_version_id: "00000000-0000-4000-8000-000000000009",
  document_requirement_id: requiredDocument.id,
  document_type: "quality_certificate",
  id: "00000000-0000-4000-8000-000000000010",
  status: "ready",
  supplier_organization_id: "00000000-0000-4000-8000-000000000011",
  supplier_relationship_id: "00000000-0000-4000-8000-000000000012",
  updated_at: "2026-07-02T09:00:00Z",
};

export const documentVersion: DocumentVersion = {
  byte_size: 42_000,
  document_id: supplierDocument.id,
  expiry_date: "2027-07-01",
  id: "00000000-0000-4000-8000-000000000009",
  issue_date: "2026-07-01",
  issuing_body: "Fictional Quality Registry",
  mime_type: "application/pdf",
  original_filename: "fictional-quality-certificate.pdf",
  processing_error: null,
  processing_status: "complete",
  sanitized_filename: "fictional-quality-certificate.pdf",
  sha256_hash: "a".repeat(64),
  storage_path: "buyer/relationship/document/1/file.pdf",
  superseded_at: null,
  upload_status: "ready",
  uploaded_at: "2026-07-02T09:00:00Z",
  uploaded_by: "00000000-0000-4000-8000-000000000005",
  version_number: 1,
};

export const riskEvaluation: RiskEvaluation = {
  assessment_id: completedResponse.assessment_id,
  calculated_at: "2026-07-03T09:00:00Z",
  calculated_by_type: "rule_engine",
  calculation_version: "risk-v1",
  id: "00000000-0000-4000-8000-000000000013",
  risk_level: "medium",
  scoring_breakdown: { continuity: 12 },
  superseded_at: null,
  total_score: 34,
};

export const approvalDecision: ApprovalDecision = {
  assessment_id: completedResponse.assessment_id,
  buyer_organization_id: "00000000-0000-4000-8000-000000000014",
  conditions: "Replace the certificate before its expiry date.",
  created_at: "2026-07-04T09:00:00Z",
  decided_at: "2026-07-04T09:00:00Z",
  decided_by: "00000000-0000-4000-8000-000000000015",
  decision: "conditionally_approved",
  effective_from: "2026-07-04",
  id: "00000000-0000-4000-8000-000000000016",
  internal_rationale:
    "Controls are adequate with a time-bound evidence condition.",
  valid_until: "2027-07-04",
};
