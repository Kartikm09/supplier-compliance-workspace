import { z } from "zod";

export const organizationTypeSchema = z.enum(["buyer", "supplier"]);

export const organizationRoleSchema = z.enum([
  "buyer_owner",
  "buyer_admin",
  "buyer_reviewer",
  "buyer_viewer",
  "supplier_owner",
  "supplier_admin",
  "supplier_contributor",
  "supplier_viewer",
]);

export const membershipStatusSchema = z.enum([
  "invited",
  "active",
  "suspended",
  "removed",
]);

export const relationshipStatusSchema = z.enum([
  "invited",
  "active",
  "suspended",
  "terminated",
]);

export const assessmentStatusSchema = z.enum([
  "draft",
  "in_progress",
  "submitted",
  "under_review",
  "changes_requested",
  "resubmitted",
  "approved",
  "conditionally_approved",
  "rejected",
  "withdrawn",
]);

export const findingStatusSchema = z.enum([
  "open",
  "response_required",
  "response_submitted",
  "verification_required",
  "verified",
  "rejected",
  "closed",
]);

export const correctiveActionStatusSchema = z.enum([
  "draft",
  "submitted",
  "accepted",
  "revision_required",
  "completed",
]);

export const documentVersionStatusSchema = z.enum([
  "pending_upload",
  "uploaded",
  "processing",
  "ready",
  "rejected",
  "superseded",
]);

export const decisionSchema = z.enum([
  "approved",
  "conditionally_approved",
  "rejected",
  "deferred",
]);

export const answerTypeSchema = z.enum([
  "text",
  "long_text",
  "number",
  "boolean",
  "date",
  "single_select",
  "multi_select",
]);

export const createInvitationSchema = z.object({
  intended_supplier_name: z.string().trim().min(2).max(160),
  invited_email: z.email(),
  buyer_organization_id: z.uuid(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(24).max(512),
  supplier_display_name: z.string().trim().min(2).max(160).optional(),
  supplier_country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});

export const programSchema = z.object({
  buyer_organization_id: z.uuid(),
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(100),
});

export const questionSchema = z.object({
  program_version_id: z.uuid(),
  section_id: z.uuid(),
  stable_question_key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/),
  prompt: z.string().trim().min(5).max(1000),
  help_text: z.string().trim().max(1200).nullable().optional(),
  answer_type: answerTypeSchema,
  required: z.boolean(),
  display_order: z.number().int().min(0),
  risk_weight: z.number().min(0).max(100),
});

export const documentRequirementSchema = z.object({
  program_version_id: z.uuid(),
  stable_requirement_key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1200).nullable().optional(),
  required: z.boolean(),
  accepted_mime_types: z.array(z.string().trim().min(3)).min(1),
  maximum_size_bytes: z
    .number()
    .int()
    .min(1024)
    .max(25 * 1024 * 1024),
  requires_issue_date: z.boolean(),
  requires_expiry_date: z.boolean(),
  minimum_validity_days: z.number().int().min(0).max(3650),
  display_order: z.number().int().min(0),
});

export const responseValueSchema = z
  .object({
    response_text: z.string().max(10_000).nullable().optional(),
    response_number: z.number().nullable().optional(),
    response_boolean: z.boolean().nullable().optional(),
    response_date: z.iso.date().nullable().optional(),
    response_option_id: z.uuid().nullable().optional(),
    response_json: z.unknown().nullable().optional(),
  })
  .refine(
    (value) =>
      [
        value.response_text,
        value.response_number,
        value.response_boolean,
        value.response_date,
        value.response_option_id,
        value.response_json,
      ].filter((candidate) => candidate !== null && candidate !== undefined)
        .length <= 1,
    "Only one response value may be supplied.",
  );

export const correctiveActionSchema = z.object({
  finding_id: z.uuid(),
  root_cause: z.string().trim().min(10).max(4000),
  correction: z.string().trim().min(10).max(4000),
  preventive_action: z.string().trim().min(10).max(4000),
  target_completion_date: z.iso.date(),
});

export const findingSchema = z.object({
  assessment_id: z.uuid(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.string().trim().min(2).max(100),
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(4000),
  internal_note: z.string().trim().max(4000).nullable().optional(),
  due_at: z.iso.datetime().nullable().optional(),
});

export const approvalDecisionSchema = z.object({
  assessment_id: z.uuid(),
  decision: decisionSchema,
  effective_from: z.iso.date(),
  valid_until: z.iso.date().nullable().optional(),
  conditions: z.string().trim().max(4000).nullable().optional(),
  internal_rationale: z.string().trim().min(10).max(4000),
});

export const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(120),
  job_title: z.string().trim().max(160).nullable().optional(),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type AnswerType = z.infer<typeof answerTypeSchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;
export type CorrectiveActionInput = z.infer<typeof correctiveActionSchema>;
export type CorrectiveActionStatus = z.infer<
  typeof correctiveActionStatusSchema
>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type DocumentVersionStatus = z.infer<typeof documentVersionStatusSchema>;
export type FindingInput = z.infer<typeof findingSchema>;
export type FindingStatus = z.infer<typeof findingStatusSchema>;
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type OrganizationType = z.infer<typeof organizationTypeSchema>;
export type RelationshipStatus = z.infer<typeof relationshipStatusSchema>;
export type ResponseValue = z.infer<typeof responseValueSchema>;

const buyerRoles = new Set<OrganizationRole>([
  "buyer_owner",
  "buyer_admin",
  "buyer_reviewer",
  "buyer_viewer",
]);
const supplierRoles = new Set<OrganizationRole>([
  "supplier_owner",
  "supplier_admin",
  "supplier_contributor",
  "supplier_viewer",
]);

export function isBuyerRole(role: OrganizationRole): boolean {
  return buyerRoles.has(role);
}

export function isSupplierRole(role: OrganizationRole): boolean {
  return supplierRoles.has(role);
}

export function canManagePrograms(role: OrganizationRole): boolean {
  return role === "buyer_owner" || role === "buyer_admin";
}

export function canReviewAssessments(role: OrganizationRole): boolean {
  return (
    role === "buyer_owner" ||
    role === "buyer_admin" ||
    role === "buyer_reviewer"
  );
}

export function canDecideAssessments(role: OrganizationRole): boolean {
  return role === "buyer_owner";
}

export function canManageSupplierSubmission(role: OrganizationRole): boolean {
  return role === "supplier_owner" || role === "supplier_admin";
}

export function canContributeSupplierData(role: OrganizationRole): boolean {
  return (
    role === "supplier_owner" ||
    role === "supplier_admin" ||
    role === "supplier_contributor"
  );
}

export function isReadOnlyRole(role: OrganizationRole): boolean {
  return role === "buyer_viewer" || role === "supplier_viewer";
}
