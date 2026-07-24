import type {
  AuditEvent,
  MembershipWithOrganization,
  Notification,
  Organization,
  OrganizationMember,
  Profile,
  SupplierProfile,
  OrganizationRole,
} from "@scw/contracts";

import { supabase } from "../supabase";

export async function loadMemberships(
  userId: string,
): Promise<MembershipWithOrganization[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", userId)
    .eq("membership_status", "active")
    .order("joined_at", { ascending: true });
  if (membershipError) throw membershipError;
  if (!memberships.length) return [];

  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select("*")
    .in(
      "id",
      memberships.map((membership) => membership.organization_id),
    );
  if (organizationError) throw organizationError;
  const organizationById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );

  return memberships.flatMap((membership) => {
    const organization = organizationById.get(membership.organization_id);
    return organization ? [{ ...membership, organization }] : [];
  });
}

export async function loadOrganizationMembers(
  organizationId: string,
): Promise<Array<OrganizationMember & { profile: Profile | null }>> {
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at");
  if (error) throw error;
  if (!members.length) return [];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in(
      "id",
      members.map((member) => member.user_id),
    );
  if (profileError) throw profileError;
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return members.map((member) => ({
    ...member,
    profile: profileById.get(member.user_id) ?? null,
  }));
}

export async function loadNotifications(
  organizationId: string,
  userId: string,
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("organization_id", organizationId)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProfile(
  userId: string,
  values: Pick<Profile, "display_name" | "job_title">,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      display_name: values.display_name,
      job_title: values.job_title,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function loadAuditEvents(
  organizationId: string,
): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from("audit_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function loadOrganization(
  organizationId: string,
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrganization(
  organizationId: string,
  values: Pick<Organization, "country_code" | "display_name" | "legal_name">,
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .update({
      country_code: values.country_code,
      display_name: values.display_name,
      legal_name: values.legal_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function loadSupplierProfile(
  supplierOrganizationId: string,
): Promise<SupplierProfile | null> {
  const { data, error } = await supabase
    .from("supplier_profiles")
    .select("*")
    .eq("supplier_organization_id", supplierOrganizationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveSupplierProfile(
  supplierOrganizationId: string,
  values: Pick<
    SupplierProfile,
    | "employee_range"
    | "headquarters_country"
    | "primary_categories"
    | "registration_number"
    | "tax_identifier"
    | "website"
  >,
): Promise<SupplierProfile> {
  const { data, error } = await supabase
    .from("supplier_profiles")
    .upsert(
      {
        ...values,
        profile_status: "complete",
        supplier_organization_id: supplierOrganizationId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "supplier_organization_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateMemberRole(values: {
  memberId: string;
  role: OrganizationRole;
}): Promise<OrganizationMember> {
  const { data, error } = await supabase
    .from("organization_members")
    .update({ role: values.role })
    .eq("id", values.memberId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateMemberStatus(values: {
  memberId: string;
  status: OrganizationMember["membership_status"];
}): Promise<OrganizationMember> {
  const { data, error } = await supabase
    .from("organization_members")
    .update({ membership_status: values.status })
    .eq("id", values.memberId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
