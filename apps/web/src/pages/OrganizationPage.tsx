import type { OrganizationRole } from "@scw/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Save, UserX } from "lucide-react";
import { type FormEvent } from "react";

import { Button } from "../components/Button";
import { SelectField, TextField } from "../components/FormField";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { hasCapability } from "../lib/access";
import {
  loadOrganizationMembers,
  loadSupplierProfile,
  saveSupplierProfile,
  updateMemberRole,
  updateMemberStatus,
  updateOrganization,
} from "../lib/api/workspace";
import { errorMessage } from "../lib/errors";
import { formatDate, titleCase } from "../lib/format";
import { formString, stringArray } from "../lib/forms";

const buyerRoles: OrganizationRole[] = [
  "buyer_owner",
  "buyer_admin",
  "buyer_reviewer",
  "buyer_viewer",
];
const supplierRoles: OrganizationRole[] = [
  "supplier_owner",
  "supplier_admin",
  "supplier_contributor",
  "supplier_viewer",
];

export function OrganizationPage() {
  const { user } = useAuth();
  const { organization, membership, refresh } = useWorkspace();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const canManage =
    Boolean(membership) && hasCapability(membership!.role, "manage_members");
  const members = useQuery({
    queryKey: ["organization-members", organization?.id],
    queryFn: () => loadOrganizationMembers(organization!.id),
    enabled: Boolean(organization),
  });
  const supplierProfile = useQuery({
    queryKey: ["supplier-profile", organization?.id],
    queryFn: () => loadSupplierProfile(organization!.id),
    enabled: organization?.organization_type === "supplier",
  });
  const organizationMutation = useMutation({
    mutationFn: (values: {
      country_code: string | null;
      display_name: string;
      legal_name: string;
    }) => updateOrganization(organization!.id, values),
    onSuccess: () => {
      notify("Organization details updated.", "success");
      void refresh();
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const supplierMutation = useMutation({
    mutationFn: (values: Parameters<typeof saveSupplierProfile>[1]) =>
      saveSupplierProfile(organization!.id, values),
    onSuccess: () => {
      notify("Supplier profile updated.", "success");
      void queryClient.invalidateQueries({ queryKey: ["supplier-profile"] });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const roleMutation = useMutation({
    mutationFn: updateMemberRole,
    onSuccess: () => {
      notify("Member role updated.", "success");
      void queryClient.invalidateQueries({
        queryKey: ["organization-members"],
      });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const statusMutation = useMutation({
    mutationFn: updateMemberStatus,
    onSuccess: () => {
      notify("Membership suspended.", "success");
      void queryClient.invalidateQueries({
        queryKey: ["organization-members"],
      });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });

  if (members.isLoading || supplierProfile.isLoading) return <LoadingState />;
  const queryError = members.error ?? supplierProfile.error;
  if (queryError) return <ErrorState message={errorMessage(queryError)} />;
  if (!organization || !membership) return null;
  const roles =
    organization.organization_type === "buyer" ? buyerRoles : supplierRoles;

  const saveOrganization = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    organizationMutation.mutate({
      country_code: formString(form, "countryCode").toUpperCase() || null,
      display_name: formString(form, "displayName"),
      legal_name: formString(form, "legalName"),
    });
  };
  const saveSupplier = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    supplierMutation.mutate({
      employee_range: formString(form, "employeeRange") || null,
      headquarters_country:
        formString(form, "headquartersCountry").toUpperCase() || null,
      primary_categories: formString(form, "categories")
        .split(",")
        .map((category) => category.trim())
        .filter(Boolean),
      registration_number:
        formString(form, "registrationNumber").trim() || null,
      tax_identifier: formString(form, "taxIdentifier").trim() || null,
      website: formString(form, "website").trim() || null,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow={`${titleCase(organization.organization_type)} settings`}
        subtitle="Maintain organization details and role assignments within the current tenant."
        title={organization.display_name}
        actions={<StatusBadge value={organization.status} />}
      />

      <div className="settings-grid">
        <section className="section">
          <div className="section__header">
            <div>
              <h2>Organization details</h2>
              <p>Shared identity shown throughout qualification records.</p>
            </div>
          </div>
          <form className="stack-form" onSubmit={saveOrganization}>
            <TextField
              defaultValue={organization.display_name}
              disabled={!canManage}
              label="Display name"
              name="displayName"
              required
            />
            <TextField
              defaultValue={organization.legal_name}
              disabled={!canManage}
              label="Legal name"
              name="legalName"
              required
            />
            <TextField
              defaultValue={organization.country_code ?? ""}
              disabled={!canManage}
              label="Country code"
              maxLength={2}
              name="countryCode"
            />
            {canManage ? (
              <div className="form-actions">
                <Button busy={organizationMutation.isPending} type="submit">
                  <Save aria-hidden="true" size={16} />
                  Save organization
                </Button>
              </div>
            ) : null}
          </form>
        </section>

        {organization.organization_type === "supplier" ? (
          <section className="section">
            <div className="section__header">
              <div>
                <h2>Supplier profile</h2>
                <p>
                  Business details shared with authorized buyer relationships.
                </p>
              </div>
            </div>
            <form className="stack-form" onSubmit={saveSupplier}>
              <div className="form-grid">
                <TextField
                  defaultValue={supplierProfile.data?.registration_number ?? ""}
                  disabled={!canManage}
                  label="Registration number"
                  name="registrationNumber"
                />
                <TextField
                  defaultValue={supplierProfile.data?.tax_identifier ?? ""}
                  disabled={!canManage}
                  hint="Use only fictional values in public demonstrations."
                  label="Tax identifier"
                  name="taxIdentifier"
                />
              </div>
              <TextField
                defaultValue={supplierProfile.data?.website ?? ""}
                disabled={!canManage}
                label="Website"
                name="website"
                type="url"
              />
              <div className="form-grid">
                <TextField
                  defaultValue={
                    supplierProfile.data?.headquarters_country ?? ""
                  }
                  disabled={!canManage}
                  label="Headquarters country"
                  maxLength={2}
                  name="headquartersCountry"
                />
                <SelectField
                  defaultValue={supplierProfile.data?.employee_range ?? ""}
                  disabled={!canManage}
                  label="Employee range"
                  name="employeeRange"
                >
                  <option value="">Not provided</option>
                  <option value="1-49">1-49</option>
                  <option value="50-249">50-249</option>
                  <option value="250-999">250-999</option>
                  <option value="1000+">1,000+</option>
                </SelectField>
              </div>
              <TextField
                defaultValue={stringArray(
                  supplierProfile.data?.primary_categories,
                ).join(", ")}
                disabled={!canManage}
                hint="Comma-separated categories."
                label="Primary categories"
                name="categories"
              />
              {canManage ? (
                <div className="form-actions">
                  <Button busy={supplierMutation.isPending} type="submit">
                    <Save aria-hidden="true" size={16} />
                    Save supplier profile
                  </Button>
                </div>
              ) : null}
            </form>
          </section>
        ) : (
          <section className="section organization-identity">
            <Building2 aria-hidden="true" size={28} />
            <h2>Buyer organization</h2>
            <p>
              Qualification programs and supplier relationships are owned by
              this tenant and protected by relationship-aware RLS.
            </p>
          </section>
        )}
      </div>

      <section className="section section--flush">
        <div className="section__header section__header--padded">
          <div>
            <h2>Team members</h2>
            <p>Active roles are enforced in database policies and functions.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Joined</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.data?.map((member) => {
                const self = member.user_id === user?.id;
                return (
                  <tr key={member.id}>
                    <td>
                      <strong>
                        {member.profile?.display_name ??
                          member.user_id.slice(0, 8)}
                      </strong>
                      <span className="table-subtitle">
                        {member.profile?.job_title ?? (self ? "You" : "Member")}
                      </span>
                    </td>
                    <td>
                      {canManage && !self ? (
                        <select
                          aria-label={`Role for ${member.profile?.display_name ?? "member"}`}
                          disabled={roleMutation.isPending}
                          onChange={(event) =>
                            roleMutation.mutate({
                              memberId: member.id,
                              role: event.target.value as OrganizationRole,
                            })
                          }
                          value={member.role}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {titleCase(role)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        titleCase(member.role)
                      )}
                    </td>
                    <td>
                      <StatusBadge value={member.membership_status} />
                    </td>
                    <td>{formatDate(member.joined_at)}</td>
                    <td>
                      {canManage &&
                      !self &&
                      member.membership_status === "active" ? (
                        <Button
                          aria-label={`Suspend ${member.profile?.display_name ?? "member"}`}
                          onClick={() =>
                            statusMutation.mutate({
                              memberId: member.id,
                              status: "suspended",
                            })
                          }
                          tone="quiet"
                        >
                          <UserX aria-hidden="true" size={17} />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
