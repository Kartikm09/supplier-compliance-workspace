import type {
  CorrectiveAction,
  Finding,
  FindingEvent,
  OrganizationType,
  SupplierRelationship,
} from "@scw/contracts";

import { supabase } from "../supabase";

export interface FindingSummary extends Finding {
  correctiveAction: CorrectiveAction | null;
}

export interface FindingDetailData {
  correctiveActions: CorrectiveAction[];
  events: FindingEvent[];
  finding: Finding;
}

export async function loadFindingsForOrganization(
  organizationId: string,
  organizationType: OrganizationType,
): Promise<FindingSummary[]> {
  const relationshipQuery = supabase.from("supplier_relationships").select("*");
  const { data: relationships, error: relationshipError } =
    organizationType === "buyer"
      ? await relationshipQuery.eq("buyer_organization_id", organizationId)
      : await relationshipQuery.eq("supplier_organization_id", organizationId);
  if (relationshipError) throw relationshipError;
  if (!relationships.length) return [];
  const { data: findings, error } = await supabase
    .from("findings")
    .select("*")
    .in(
      "supplier_relationship_id",
      relationships.map((relationship) => relationship.id),
    )
    .order("raised_at", { ascending: false });
  if (error) throw error;
  if (!findings.length) return [];
  const { data: actions, error: actionError } = await supabase
    .from("corrective_actions")
    .select("*")
    .in(
      "finding_id",
      findings.map((finding) => finding.id),
    )
    .order("created_at", { ascending: false });
  if (actionError) throw actionError;
  const actionByFinding = new Map(
    actions.map((action) => [action.finding_id, action]),
  );
  return findings.map((finding) => ({
    ...finding,
    correctiveAction: actionByFinding.get(finding.id) ?? null,
  }));
}

export async function loadFindingDetail(
  findingId: string,
): Promise<FindingDetailData> {
  const { data: finding, error } = await supabase
    .from("findings")
    .select("*")
    .eq("id", findingId)
    .single();
  if (error) throw error;
  const [eventResult, actionResult] = await Promise.all([
    supabase
      .from("finding_events")
      .select("*")
      .eq("finding_id", findingId)
      .order("created_at"),
    supabase
      .from("corrective_actions")
      .select("*")
      .eq("finding_id", findingId)
      .order("created_at", { ascending: false }),
  ]);
  if (eventResult.error) throw eventResult.error;
  if (actionResult.error) throw actionResult.error;
  return {
    correctiveActions: actionResult.data,
    events: eventResult.data,
    finding,
  };
}

export type RelationshipAccess = SupplierRelationship;
