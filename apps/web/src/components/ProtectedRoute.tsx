import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { LoadingState } from "./States";

export function resolveAccessDestination({
  authLoading,
  hasMembership,
  path,
  userPresent,
  workspaceLoading,
}: {
  authLoading: boolean;
  hasMembership: boolean;
  path: string;
  userPresent: boolean;
  workspaceLoading: boolean;
}): "allow" | "loading" | { redirect: string } {
  if (authLoading || workspaceLoading) return "loading";
  if (!userPresent) {
    return { redirect: `/sign-in?next=${encodeURIComponent(path)}` };
  }
  if (!hasMembership) return { redirect: "/organization-required" };
  return "allow";
}

export function ProtectedRoute() {
  const { loading: authLoading, user } = useAuth();
  const { loading: workspaceLoading, membership } = useWorkspace();
  const location = useLocation();
  const destination = resolveAccessDestination({
    authLoading,
    hasMembership: Boolean(membership),
    path: `${location.pathname}${location.search}`,
    userPresent: Boolean(user),
    workspaceLoading,
  });
  if (destination === "loading") {
    return <LoadingState label="Checking secure session" />;
  }
  if (typeof destination === "object") {
    return <Navigate replace to={destination.redirect} />;
  }
  return <Outlet />;
}
