import {
  acceptInvitationSchema,
  approvalDecisionSchema,
  correctiveActionSchema,
  createInvitationSchema,
  findingSchema,
  type ApprovalDecision,
  type Assessment,
  type CorrectiveAction,
  type Finding,
  type SupplierInvitation,
} from "@scw/contracts";
import { z } from "zod";

import { invokeEdgeFunction, supabase } from "../supabase";

const invitationResponseSchema = z.object({
  invitation_id: z.uuid(),
  token: z.string().min(24),
  expires_at: z.string(),
});

export async function createSupplierInvitation(values: {
  buyerOrganizationId: string;
  intendedSupplierName: string;
  invitedEmail: string;
}): Promise<{ expiresAt: string; invitationId: string; token: string }> {
  const input = createInvitationSchema.parse({
    buyer_organization_id: values.buyerOrganizationId,
    intended_supplier_name: values.intendedSupplierName,
    invited_email: values.invitedEmail,
  });
  const data = await invokeEdgeFunction<unknown>(
    "create-supplier-invitation",
    input,
  );
  const parsed = invitationResponseSchema.parse(data);
  return {
    expiresAt: parsed.expires_at,
    invitationId: parsed.invitation_id,
    token: parsed.token,
  };
}

export async function acceptSupplierInvitation(values: {
  supplierCountryCode: string;
  supplierDisplayName?: string;
  token: string;
}): Promise<{ organization_id: string; relationship_id: string }> {
  const input = acceptInvitationSchema.parse({
    token: values.token,
    ...(values.supplierDisplayName
      ? { supplier_display_name: values.supplierDisplayName }
      : {}),
    supplier_country_code: values.supplierCountryCode,
  });
  const displayName = input.supplier_display_name ?? "Supplier organization";
  const slugBase =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 56) || "supplier";
  return invokeEdgeFunction<{
    organization_id: string;
    relationship_id: string;
  }>("accept-supplier-invitation", {
    invitation_token: input.token,
    new_supplier: {
      country_code: input.supplier_country_code,
      display_name: displayName,
      legal_name: displayName,
      slug: `${slugBase}-${crypto.randomUUID().slice(0, 8)}`,
    },
  });
}

export async function createFinding(values: {
  assessmentId: string;
  category: string;
  description: string;
  dueAt: string | null;
  internalNote: string | null;
  severity: Finding["severity"];
  title: string;
}): Promise<Finding> {
  const input = findingSchema.parse({
    assessment_id: values.assessmentId,
    category: values.category,
    description: values.description,
    due_at: values.dueAt,
    internal_note: values.internalNote,
    severity: values.severity,
    title: values.title,
  });
  return invokeEdgeFunction<Finding>("create-finding", input);
}

export async function submitCorrectiveAction(values: {
  correction: string;
  findingId: string;
  preventiveAction: string;
  rootCause: string;
  targetCompletionDate: string;
}): Promise<CorrectiveAction> {
  const input = correctiveActionSchema.parse({
    correction: values.correction,
    finding_id: values.findingId,
    preventive_action: values.preventiveAction,
    root_cause: values.rootCause,
    target_completion_date: values.targetCompletionDate,
  });
  return invokeEdgeFunction<CorrectiveAction>(
    "submit-corrective-action",
    input,
  );
}

export async function recordApprovalDecision(values: {
  assessmentId: string;
  conditions: string | null;
  decision: ApprovalDecision["decision"];
  effectiveFrom: string;
  internalRationale: string;
  validUntil: string | null;
}): Promise<ApprovalDecision> {
  const input = approvalDecisionSchema.parse({
    assessment_id: values.assessmentId,
    conditions: values.conditions,
    decision: values.decision,
    effective_from: values.effectiveFrom,
    internal_rationale: values.internalRationale,
    valid_until: values.validUntil,
  });
  return invokeEdgeFunction<ApprovalDecision>(
    "record-approval-decision",
    input,
  );
}

export async function listSupplierInvitations(
  buyerOrganizationId: string,
): Promise<SupplierInvitation[]> {
  const { data, error } = await supabase
    .from("supplier_invitations")
    .select("*")
    .eq("buyer_organization_id", buyerOrganizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function generateAssessmentReport(
  assessmentId: string,
): Promise<{ job_id: number; status: "queued" }> {
  return invokeEdgeFunction<{
    job_id: number;
    status: "queued";
  }>("generate-assessment-report", { assessment_id: assessmentId });
}

export type InvitationAcceptance = Assessment;
