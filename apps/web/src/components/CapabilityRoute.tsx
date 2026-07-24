import type { Capability } from "../lib/access";
import { hasCapability } from "../lib/access";
import { Navigate, Outlet } from "react-router-dom";

import { useWorkspace } from "../context/WorkspaceContext";

export function CapabilityRoute({ capability }: { capability: Capability }) {
  const { membership } = useWorkspace();
  if (!membership || !hasCapability(membership.role, capability)) {
    return <Navigate replace to="/unauthorized" />;
  }
  return <Outlet />;
}
