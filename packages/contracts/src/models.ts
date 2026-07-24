import type {
  AnswerType,
  AssessmentStatus,
  CorrectiveActionStatus,
  Decision,
  DocumentVersionStatus,
  FindingStatus,
  MembershipStatus,
  OrganizationRole,
  OrganizationType,
  RelationshipStatus,
} from "./schemas.js";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Profile {
  avatar_path: string | null;
  created_at: string;
  display_name: string;
  id: string;
  job_title: string | null;
  updated_at: string;
}

export interface Organization {
  country_code: string | null;
  created_at: string;
  created_by: string;
  display_name: string;
  id: string;
  legal_name: string;
  organization_type: OrganizationType;
  slug: string;
  status: string;
  updated_at: string;
}

export interface OrganizationMember {
  created_at: string;
  id: string;
  invited_by: string | null;
  joined_at: string | null;
  membership_status: MembershipStatus;
  organization_id: string;
  role: OrganizationRole;
  user_id: string;
}

export interface MembershipWithOrganization extends OrganizationMember {
  organization: Organization;
}

export interface SupplierProfile {
  created_at: string;
  employee_range: string | null;
  headquarters_country: string | null;
  id: string;
  primary_categories: Json;
  profile_status: string;
  registration_number: string | null;
  supplier_organization_id: string;
  tax_identifier: string | null;
  updated_at: string;
  website: string | null;
}

export interface SupplierRelationship {
  accepted_at: string | null;
  buyer_organization_id: string;
  buyer_owner_user_id: string | null;
  buyer_supplier_code: string;
  created_at: string;
  id: string;
  invited_at: string | null;
  onboarding_status: string;
  relationship_status: RelationshipStatus;
  risk_tier: string;
  supplier_organization_id: string;
  supplier_owner_user_id: string | null;
  suspended_at: string | null;
  updated_at: string;
}

export interface SupplierInvitation {
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  buyer_organization_id: string;
  created_at: string;
  created_by: string;
  expires_at: string;
  id: string;
  intended_supplier_name: string;
  invited_email: string;
  invitation_token_hash: string;
  resulting_supplier_organization_id: string | null;
  status: string;
  token_prefix: string;
}

export interface QualificationProgram {
  buyer_organization_id: string;
  category: string;
  created_at: string;
  created_by: string;
  current_version_id: string | null;
  description: string;
  id: string;
  name: string;
  status: string;
  updated_at: string;
}

export interface ProgramVersion {
  change_summary: string | null;
  created_at: string;
  effective_from: string | null;
  id: string;
  published_at: string | null;
  published_by: string | null;
  qualification_program_id: string;
  status: "draft" | "active" | "retired";
  version_number: number;
}

export interface QuestionnaireSection {
  description: string | null;
  display_order: number;
  id: string;
  program_version_id: string;
  title: string;
}

export interface Question {
  answer_type: AnswerType;
  conditional_visibility_rules: Json;
  display_order: number;
  help_text: string | null;
  id: string;
  program_version_id: string;
  prompt: string;
  required: boolean;
  risk_weight: number;
  section_id: string;
  stable_question_key: string;
  validation_rules: Json;
}

export interface QuestionOption {
  display_order: number;
  id: string;
  label: string;
  question_id: string;
  risk_score: number;
  value: string;
}

export interface DocumentRequirement {
  accepted_mime_types: string[];
  description: string | null;
  display_order: number;
  id: string;
  maximum_size_bytes: number;
  minimum_validity_days: number;
  name: string;
  program_version_id: string;
  required: boolean;
  requires_expiry_date: boolean;
  requires_issue_date: boolean;
  stable_requirement_key: string;
}

export interface Assessment {
  assigned_buyer_reviewer_id: string | null;
  assigned_supplier_user_id: string | null;
  completeness_percentage: number;
  created_at: string;
  decided_at: string | null;
  id: string;
  program_version_id: string;
  qualification_program_id: string;
  review_started_at: string | null;
  started_at: string | null;
  status: AssessmentStatus;
  submitted_at: string | null;
  supplier_declaration: string | null;
  supplier_relationship_id: string;
  updated_at: string;
}

export interface AssessmentResponse {
  answered_at: string | null;
  answered_by: string | null;
  assessment_id: string;
  id: string;
  question_id: string;
  response_boolean: boolean | null;
  response_date: string | null;
  response_json: Json;
  response_number: number | null;
  response_option_id: string | null;
  response_text: string | null;
  updated_at: string;
}

export interface SupplierDocument {
  created_at: string;
  created_by: string;
  current_version_id: string | null;
  document_requirement_id: string | null;
  document_type: string;
  id: string;
  status: string;
  supplier_organization_id: string;
  supplier_relationship_id: string;
  updated_at: string;
}

export interface DocumentVersion {
  byte_size: number;
  document_id: string;
  expiry_date: string | null;
  id: string;
  issue_date: string | null;
  issuing_body: string | null;
  mime_type: string;
  original_filename: string;
  processing_error: string | null;
  processing_status: string;
  sanitized_filename: string;
  sha256_hash: string | null;
  storage_path: string;
  superseded_at: string | null;
  upload_status: DocumentVersionStatus;
  uploaded_at: string;
  uploaded_by: string;
  version_number: number;
}

export interface DocumentReview {
  assessment_id: string;
  created_at: string;
  document_version_id: string;
  id: string;
  internal_note: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  reviewer_user_id: string;
  status: "pending" | "accepted" | "rejected" | "replacement_requested";
}

export interface ReviewTask {
  assessment_id: string;
  assigned_to: string;
  buyer_organization_id: string;
  completed_at: string | null;
  created_at: string;
  due_at: string | null;
  id: string;
  status: string;
  task_type: string;
}

export interface Finding {
  assessment_id: string;
  assigned_supplier_user_id: string | null;
  buyer_organization_id: string;
  category: string;
  closed_at: string | null;
  description: string;
  due_at: string | null;
  finding_number: number;
  id: string;
  internal_note: string | null;
  raised_at: string;
  raised_by: string;
  severity: "low" | "medium" | "high" | "critical";
  status: FindingStatus;
  supplier_relationship_id: string;
  title: string;
}

export interface FindingEvent {
  actor_user_id: string | null;
  comment: string | null;
  created_at: string;
  event_type: string;
  finding_id: string;
  id: string;
  metadata: Json;
  organization_id: string;
  supplier_visible: boolean;
}

export interface CorrectiveAction {
  correction: string;
  created_at: string;
  finding_id: string;
  id: string;
  preventive_action: string;
  root_cause: string;
  status: CorrectiveActionStatus;
  submitted_at: string | null;
  submitted_by: string;
  supplier_organization_id: string;
  target_completion_date: string;
  updated_at: string;
  verification_note: string | null;
  verified_at: string | null;
  verified_by: string | null;
}

export interface RiskEvaluation {
  assessment_id: string;
  calculated_at: string;
  calculated_by_type: string;
  calculation_version: string;
  id: string;
  risk_level: string;
  scoring_breakdown: Json;
  superseded_at: string | null;
  total_score: number;
}

export interface ApprovalDecision {
  assessment_id: string;
  buyer_organization_id: string;
  conditions: string | null;
  created_at: string;
  decided_at: string;
  decided_by: string;
  decision: Decision;
  effective_from: string;
  id: string;
  internal_rationale: string | null;
  valid_until: string | null;
}

export interface Notification {
  body: string;
  created_at: string;
  id: string;
  notification_type: string;
  organization_id: string;
  read_at: string | null;
  related_resource_id: string | null;
  related_resource_type: string | null;
  status: string;
  title: string;
  user_id: string | null;
}

export interface AuditEvent {
  action: string;
  actor_organization_id: string | null;
  actor_user_id: string | null;
  correlation_id: string;
  created_at: string;
  id: string;
  new_values: Json;
  old_values: Json;
  organization_id: string;
  relationship_id: string | null;
  resource_id: string;
  resource_type: string;
}

export interface DashboardMetrics {
  activeRelationships: number;
  assessmentsAwaitingAction: number;
  documentsExpiringSoon: number;
  openFindings: number;
  overdueActions: number;
}
