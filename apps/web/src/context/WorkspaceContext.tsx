import type {
  MembershipWithOrganization,
  Organization,
  OrganizationMember,
} from "@scw/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { loadMemberships } from "../lib/api/workspace";
import { useAuth } from "./AuthContext";

const storageKey = "scw-selected-organization";

export interface WorkspaceContextValue {
  error: Error | null;
  loading: boolean;
  membership: MembershipWithOrganization | null;
  memberships: MembershipWithOrganization[];
  organization: Organization | null;
  refresh: () => Promise<unknown>;
  selectOrganization: (organizationId: string) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(
    () => window.localStorage.getItem(storageKey) ?? "",
  );
  const query = useQuery({
    queryKey: ["memberships", user?.id],
    queryFn: () => loadMemberships(user!.id),
    enabled: Boolean(user),
  });
  const memberships = query.data ?? [];

  useEffect(() => {
    if (!memberships.length) return;
    if (!memberships.some((item) => item.organization_id === selectedId)) {
      const fallback = memberships[0]?.organization_id ?? "";
      setSelectedId(fallback);
      window.localStorage.setItem(storageKey, fallback);
    }
  }, [memberships, selectedId]);

  const membership =
    memberships.find((item) => item.organization_id === selectedId) ?? null;
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      error: query.error,
      loading: query.isLoading,
      membership,
      memberships,
      organization: membership?.organization ?? null,
      refresh: query.refetch,
      selectOrganization: (organizationId: string) => {
        if (
          !memberships.some((item) => item.organization_id === organizationId)
        ) {
          return;
        }
        setSelectedId(organizationId);
        window.localStorage.setItem(storageKey, organizationId);
      },
    }),
    [membership, memberships, query.error, query.isLoading, query.refetch],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}

export type WorkspaceMember = OrganizationMember;
