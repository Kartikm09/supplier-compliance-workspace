import type { OrganizationRole, OrganizationType } from "@scw/contracts";
import {
  Bell,
  BookOpenCheck,
  Building2,
  CheckSquare2,
  ChevronDown,
  ClipboardCheck,
  FileClock,
  Files,
  Gauge,
  ListTodo,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useWorkspaceRealtime } from "../hooks/useWorkspaceRealtime";
import { errorMessage } from "../lib/errors";
import { initials, titleCase } from "../lib/format";

interface NavigationItem {
  icon: typeof Gauge;
  label: string;
  path: string;
}

const sharedNavigation: NavigationItem[] = [
  { label: "Dashboard", path: "/", icon: Gauge },
];
const buyerNavigation: NavigationItem[] = [
  { label: "Suppliers", path: "/relationships", icon: Building2 },
  { label: "Programs", path: "/programs", icon: ClipboardCheck },
  { label: "Review queue", path: "/reviews", icon: ListTodo },
  { label: "Decisions", path: "/decisions", icon: CheckSquare2 },
  { label: "Audit", path: "/audit", icon: FileClock },
];
const supplierNavigation: NavigationItem[] = [
  { label: "Buyer relationships", path: "/relationships", icon: Building2 },
  { label: "Assessments", path: "/assessments", icon: ClipboardCheck },
  { label: "Documents", path: "/documents", icon: Files },
  { label: "Findings", path: "/findings", icon: ShieldAlert },
];

export function navigationForMembership(
  organizationType: OrganizationType,
  role: OrganizationRole,
): NavigationItem[] {
  const items = [
    ...sharedNavigation,
    ...(organizationType === "buyer" ? buyerNavigation : supplierNavigation),
  ];
  return role === "buyer_owner"
    ? items
    : items.filter((item) => item.path !== "/decisions");
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { membership, memberships, organization, selectOrganization } =
    useWorkspace();
  const { notify } = useToast();
  const realtimeStatus = useWorkspaceRealtime();
  const navigation =
    organization && membership
      ? navigationForMembership(organization.organization_type, membership.role)
      : sharedNavigation;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <div className="brand-mark" aria-hidden="true">
            <ShieldAlert size={19} />
          </div>
          <div>
            <strong>Supplier Compliance</strong>
            <span>Workspace</span>
          </div>
          <button
            aria-label="Close navigation"
            className="icon-button sidebar__close"
            onClick={() => setMenuOpen(false)}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="context-label">
          <span>
            {titleCase(organization?.organization_type ?? "workspace")}
          </span>
          <strong>{organization?.display_name}</strong>
        </div>
        <nav aria-label="Primary navigation">
          {navigation.map(({ icon: Icon, label, path }) => (
            <NavLink
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link--active" : ""}`
              }
              end={path === "/"}
              key={path}
              onClick={() => setMenuOpen(false)}
              to={path}
            >
              <Icon aria-hidden="true" size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__bottom">
          <NavLink className="nav-link" to="/team">
            <UsersRound aria-hidden="true" size={18} />
            Team
          </NavLink>
          <NavLink className="nav-link" to="/profile">
            <Settings aria-hidden="true" size={18} />
            Profile
          </NavLink>
          <a
            className="nav-link"
            href="https://github.com/Kartikm09/supplier-compliance-workspace"
            rel="noreferrer"
            target="_blank"
          >
            <BookOpenCheck aria-hidden="true" size={18} />
            Repository
          </a>
        </div>
      </aside>

      <div
        aria-hidden="true"
        className={`sidebar-backdrop ${menuOpen ? "sidebar-backdrop--visible" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <section className="app-main">
        <header className="topbar">
          <button
            aria-label="Open navigation"
            className="icon-button topbar__menu"
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" size={20} />
          </button>
          <label className="organization-select">
            <span className="sr-only">Current organization</span>
            <select
              value={organization?.id ?? ""}
              onChange={(event) => selectOrganization(event.target.value)}
            >
              {memberships.map((item) => (
                <option value={item.organization_id} key={item.organization_id}>
                  {item.organization.display_name}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={15} />
          </label>
          <div className={`connection connection--${realtimeStatus}`}>
            <span aria-hidden="true" />
            {titleCase(realtimeStatus)}
          </div>
          <div className="topbar__spacer" />
          <NavLink
            aria-label="Notifications"
            className="icon-button"
            to="/notifications"
          >
            <Bell aria-hidden="true" size={18} />
          </NavLink>
          <div className="user-menu">
            <div className="avatar" aria-hidden="true">
              {initials(
                (user?.user_metadata.display_name as string | undefined) ??
                  user?.email ??
                  "User",
              )}
            </div>
            <div className="user-menu__copy">
              <strong>
                {(user?.user_metadata.display_name as string | undefined) ??
                  user?.email?.split("@")[0]}
              </strong>
              <span>{membership ? titleCase(membership.role) : "Member"}</span>
            </div>
            <button
              aria-label="Sign out"
              className="icon-button"
              onClick={() => void handleSignOut()}
              title="Sign out"
              type="button"
            >
              <LogOut aria-hidden="true" size={17} />
            </button>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
