import type {
  ApprovalDecision,
  Assessment,
  DashboardMetrics,
  Finding,
  Organization,
  OrganizationType,
  SupplierDocument,
  SupplierProfile,
  SupplierRelationship,
} from "@scw/contracts";

import { supabase } from "../supabase";

export interface RelationshipSummary extends SupplierRelationship {
  buyer: Organization;
  counterpartName: string;
  supplier: Organization;
}

export interface RelationshipDetailData {
  approvals: ApprovalDecision[];
  assessments: Assessment[];
  buyer: Organization;
  documents: SupplierDocument[];
  findings: Finding[];
  relationship: SupplierRelationship;
  supplier: Organization;
  supplierProfile: SupplierProfile | null;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentAssessments: Assessment[];
  recentFindings: Finding[];
  recentRelationships: RelationshipSummary[];
}

async function loadOrganizations(ids: string[]): Promise<Organization[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .in("id", [...new Set(ids)]);
  if (error) throw error;
  return data;
}

export async function loadRelationships(
  organizationId: string,
  organizationType: OrganizationType,
): Promise<RelationshipSummary[]> {
  const query = supabase
    .from("supplier_relationships")
    .select("*")
    .order("updated_at", { ascending: false });
  const { data: relationships, error } =
    organizationType === "buyer"
      ? await query.eq("buyer_organization_id", organizationId)
      : await query.eq("supplier_organization_id", organizationId);
  if (error) throw error;
  if (!relationships.length) return [];
  const organizations = await loadOrganizations(
    relationships.flatMap((relationship) => [
      relationship.buyer_organization_id,
      relationship.supplier_organization_id,
    ]),
  );
  const byId = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );
  return relationships.flatMap((relationship) => {
    const buyer = byId.get(relationship.buyer_organization_id);
    const supplier = byId.get(relationship.supplier_organization_id);
    if (!buyer || !supplier) return [];
    return [
      {
        ...relationship,
        buyer,
        supplier,
        counterpartName:
          organizationType === "buyer"
            ? supplier.display_name
            : buyer.display_name,
      },
    ];
  });
}

export async function loadRelationshipDetail(
  relationshipId: string,
): Promise<RelationshipDetailData> {
  const { data: relationship, error } = await supabase
    .from("supplier_relationships")
    .select("*")
    .eq("id", relationshipId)
    .single();
  if (error) throw error;
  const [
    organizations,
    assessmentResult,
    findingResult,
    documentResult,
    supplierProfileResult,
  ] = await Promise.all([
    loadOrganizations([
      relationship.buyer_organization_id,
      relationship.supplier_organization_id,
    ]),
    supabase
      .from("assessments")
      .select("*")
      .eq("supplier_relationship_id", relationshipId)
      .order("created_at", { ascending: false }),
    supabase
      .from("findings_visible")
      .select("*")
      .eq("supplier_relationship_id", relationshipId)
      .order("raised_at", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("supplier_relationship_id", relationshipId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("supplier_profiles")
      .select("*")
      .eq("supplier_organization_id", relationship.supplier_organization_id)
      .maybeSingle(),
  ]);
  if (assessmentResult.error) throw assessmentResult.error;
  if (findingResult.error) throw findingResult.error;
  if (documentResult.error) throw documentResult.error;
  if (supplierProfileResult.error) throw supplierProfileResult.error;
  const buyer = organizations.find(
    (organization) => organization.id === relationship.buyer_organization_id,
  );
  const supplier = organizations.find(
    (organization) => organization.id === relationship.supplier_organization_id,
  );
  if (!buyer || !supplier) {
    throw new Error("Relationship organizations are unavailable.");
  }
  const assessmentIds = assessmentResult.data.map(
    (assessment) => assessment.id,
  );
  const approvalResult = assessmentIds.length
    ? await supabase
        .from("approval_decisions_visible")
        .select("*")
        .in("assessment_id", assessmentIds)
        .order("decided_at", { ascending: false })
    : { data: [] as ApprovalDecision[], error: null };
  if (approvalResult.error) throw approvalResult.error;

  return {
    approvals: approvalResult.data,
    assessments: assessmentResult.data,
    buyer,
    documents: documentResult.data,
    findings: findingResult.data,
    relationship,
    supplier,
    supplierProfile: supplierProfileResult.data,
  };
}

export async function loadDashboard(
  organizationId: string,
  organizationType: OrganizationType,
): Promise<DashboardData> {
  const relationships = await loadRelationships(
    organizationId,
    organizationType,
  );
  const relationshipIds = relationships.map((relationship) => relationship.id);
  if (!relationshipIds.length) {
    return {
      metrics: {
        activeRelationships: 0,
        assessmentsAwaitingAction: 0,
        documentsExpiringSoon: 0,
        openFindings: 0,
        overdueActions: 0,
      },
      recentAssessments: [],
      recentFindings: [],
      recentRelationships: [],
    };
  }
  const [assessmentResult, findingResult, documentResult] = await Promise.all([
    supabase
      .from("assessments")
      .select("*")
      .in("supplier_relationship_id", relationshipIds)
      .order("updated_at", { ascending: false }),
    supabase
      .from("findings_visible")
      .select("*")
      .in("supplier_relationship_id", relationshipIds)
      .order("raised_at", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .in("supplier_relationship_id", relationshipIds),
  ]);
  if (assessmentResult.error) throw assessmentResult.error;
  if (findingResult.error) throw findingResult.error;
  if (documentResult.error) throw documentResult.error;
  const documents = documentResult.data;
  const versionResult = documents.length
    ? await supabase
        .from("document_versions")
        .select("*")
        .in(
          "document_id",
          documents.map((document) => document.id),
        )
    : { data: [], error: null };
  if (versionResult.error) throw versionResult.error;
  const now = Date.now();
  const soon = now + 60 * 24 * 60 * 60 * 1000;
  const actionStatuses =
    organizationType === "buyer"
      ? new Set(["submitted", "resubmitted", "under_review"])
      : new Set(["draft", "in_progress", "changes_requested"]);
  const openStatuses = new Set([
    "open",
    "response_required",
    "response_submitted",
    "verification_required",
    "rejected",
  ]);

  return {
    metrics: {
      activeRelationships: relationships.filter(
        (relationship) => relationship.relationship_status === "active",
      ).length,
      assessmentsAwaitingAction: assessmentResult.data.filter((assessment) =>
        actionStatuses.has(assessment.status),
      ).length,
      documentsExpiringSoon: versionResult.data.filter((version) => {
        if (!version.expiry_date) return false;
        const expiry = new Date(version.expiry_date).getTime();
        return expiry >= now && expiry <= soon;
      }).length,
      openFindings: findingResult.data.filter((finding) =>
        openStatuses.has(finding.status),
      ).length,
      overdueActions: findingResult.data.filter(
        (finding) =>
          openStatuses.has(finding.status) &&
          Boolean(finding.due_at) &&
          new Date(finding.due_at!).getTime() < now,
      ).length,
    },
    recentAssessments: assessmentResult.data.slice(0, 6),
    recentFindings: findingResult.data.slice(0, 6),
    recentRelationships: relationships.slice(0, 5),
  };
}
