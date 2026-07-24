import type { OrganizationType } from "@scw/contracts";
import { Navigate, Outlet } from "react-router-dom";

import { useWorkspace } from "../context/WorkspaceContext";

export function OrganizationTypeRoute({
  organizationType,
}: {
  organizationType: OrganizationType;
}) {
  const { organization } = useWorkspace();
  if (organization?.organization_type !== organizationType) {
    return <Navigate replace to="/unauthorized" />;
  }
  return <Outlet />;
}
