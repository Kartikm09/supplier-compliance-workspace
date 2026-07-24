import {
  canContributeSupplierData,
  canDecideAssessments,
  canManagePrograms,
  canManageSupplierSubmission,
  canReviewAssessments,
  isBuyerRole,
  isSupplierRole,
  type OrganizationRole,
  type OrganizationType,
} from "@scw/contracts";

export type Capability =
  | "manage_programs"
  | "review_assessments"
  | "decide_assessments"
  | "contribute_supplier_data"
  | "submit_assessment"
  | "manage_members";

export function hasCapability(
  role: OrganizationRole,
  capability: Capability,
): boolean {
  switch (capability) {
    case "manage_programs":
      return canManagePrograms(role);
    case "review_assessments":
      return canReviewAssessments(role);
    case "decide_assessments":
      return canDecideAssessments(role);
    case "contribute_supplier_data":
      return canContributeSupplierData(role);
    case "submit_assessment":
      return canManageSupplierSubmission(role);
    case "manage_members":
      return (
        role === "buyer_owner" ||
        role === "buyer_admin" ||
        role === "supplier_owner" ||
        role === "supplier_admin"
      );
  }
}

export function roleMatchesOrganization(
  role: OrganizationRole,
  organizationType: OrganizationType,
): boolean {
  return organizationType === "buyer"
    ? isBuyerRole(role)
    : isSupplierRole(role);
}
