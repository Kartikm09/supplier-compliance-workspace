import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Search, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/Button";
import { TextField } from "../components/FormField";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  createSupplierInvitation,
  listSupplierInvitations,
} from "../lib/api/actions";
import { loadRelationships } from "../lib/api/relationships";
import { errorMessage } from "../lib/errors";
import { formatDate, titleCase } from "../lib/format";
import { formString } from "../lib/forms";

export function RelationshipsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const { organization, membership } = useWorkspace();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [oneTimeInvitation, setOneTimeInvitation] = useState<{
    expiresAt: string;
    token: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const buyer = organization?.organization_type === "buyer";
  const canInvite =
    membership?.role === "buyer_owner" || membership?.role === "buyer_admin";

  const query = useQuery({
    queryKey: ["relationships", organization?.id],
    queryFn: () =>
      loadRelationships(organization!.id, organization!.organization_type),
    enabled: Boolean(organization),
  });
  const invitations = useQuery({
    queryKey: ["supplier-invitations", organization?.id],
    queryFn: () => listSupplierInvitations(organization!.id),
    enabled: Boolean(organization && buyer && canInvite),
  });
  const inviteMutation = useMutation({
    mutationFn: createSupplierInvitation,
    onSuccess: (result) => {
      setOneTimeInvitation({
        expiresAt: result.expiresAt,
        token: result.token,
      });
      notify("Invitation created. The token is shown once.", "success");
      void queryClient.invalidateQueries({
        queryKey: ["supplier-invitations", organization?.id],
      });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const filtered = useMemo(
    () =>
      (query.data ?? []).filter(
        (relationship) =>
          (status === "all" || relationship.relationship_status === status) &&
          relationship.counterpartName
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [query.data, search, status],
  );

  const submitInvitation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !user) return;
    const form = new FormData(event.currentTarget);
    inviteMutation.mutate({
      buyerOrganizationId: organization.id,
      intendedSupplierName: formString(form, "supplierName"),
      invitedEmail: formString(form, "email"),
    });
  };

  const copyInvitation = async () => {
    if (!oneTimeInvitation) return;
    const link = `${window.location.origin}/invitations/accept?token=${encodeURIComponent(oneTimeInvitation.token)}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (query.isLoading) return <LoadingState />;
  if (query.error) {
    return (
      <ErrorState
        message={errorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  }
  if (!organization) return null;

  return (
    <>
      <PageHeader
        eyebrow={buyer ? "Buyer portfolio" : "Buyer collaboration"}
        subtitle={
          buyer
            ? "Track each supplier from invitation through qualification and renewal."
            : "Monitor qualification work shared with each purchasing organization."
        }
        title={buyer ? "Supplier relationships" : "Buyer relationships"}
        actions={
          buyer && canInvite ? (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus aria-hidden="true" size={17} />
              Invite supplier
            </Button>
          ) : undefined
        }
      />

      <div className="filter-bar">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search relationships</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder={buyer ? "Search suppliers" : "Search buyers"}
            type="search"
            value={search}
          />
        </label>
        <label>
          <span className="sr-only">Relationship status</span>
          <select
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">All statuses</option>
            <option value="invited">Invited</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
        </label>
        <span className="filter-count">{filtered.length} relationships</span>
      </div>

      <section className="section section--flush">
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{buyer ? "Supplier" : "Buyer"}</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Risk tier</th>
                  <th scope="col">Onboarding</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((relationship) => (
                  <tr key={relationship.id}>
                    <td>
                      <Link
                        className="table-link"
                        to={`/relationships/${relationship.id}`}
                      >
                        {relationship.counterpartName}
                      </Link>
                    </td>
                    <td>{relationship.buyer_supplier_code}</td>
                    <td>{titleCase(relationship.risk_tier)}</td>
                    <td>
                      <StatusBadge value={relationship.onboarding_status} />
                    </td>
                    <td>
                      <StatusBadge value={relationship.relationship_status} />
                    </td>
                    <td>{formatDate(relationship.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description={
              query.data?.length
                ? "No relationships match the current search and status filters."
                : buyer
                  ? "Invite a supplier to begin a relationship-scoped qualification."
                  : "Accepted buyer invitations will appear here."
            }
            title="No relationships found"
          />
        )}
      </section>

      {buyer && invitations.data?.length ? (
        <section className="section">
          <div className="section__header">
            <div>
              <h2>Recent invitations</h2>
              <p>Token values are never shown again after creation.</p>
            </div>
          </div>
          <ul className="compact-list">
            {invitations.data.slice(0, 5).map((invitation) => (
              <li key={invitation.id}>
                <div>
                  <strong>{invitation.intended_supplier_name}</strong>
                  <span>{invitation.invited_email}</span>
                </div>
                <StatusBadge value={invitation.status} />
                <span>Expires {formatDate(invitation.expires_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {inviteOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="invite-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <header className="modal__header">
              <div>
                <p className="eyebrow">New relationship</p>
                <h2 id="invite-title">Invite a supplier</h2>
              </div>
              <button
                aria-label="Close invitation dialog"
                className="icon-button"
                onClick={() => {
                  setInviteOpen(false);
                  setOneTimeInvitation(null);
                }}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            {oneTimeInvitation ? (
              <div className="one-time-secret">
                <p>
                  Share this invitation link securely. It expires{" "}
                  {formatDate(oneTimeInvitation.expiresAt)} and is shown only
                  once.
                </p>
                <code>
                  {`${window.location.origin}/invitations/accept?token=${oneTimeInvitation.token}`}
                </code>
                <Button tone="secondary" onClick={() => void copyInvitation()}>
                  {copied ? (
                    <Check aria-hidden="true" size={16} />
                  ) : (
                    <Copy aria-hidden="true" size={16} />
                  )}
                  {copied ? "Copied" : "Copy invitation link"}
                </Button>
              </div>
            ) : (
              <form
                className="stack-form"
                onSubmit={(event) => submitInvitation(event)}
              >
                <TextField
                  label="Supplier organization"
                  name="supplierName"
                  required
                />
                <TextField
                  label="Supplier contact email"
                  name="email"
                  required
                  type="email"
                />
                <p className="form-note">
                  The recipient will create or select their supplier
                  organization after authenticating.
                </p>
                <div className="form-actions">
                  <Button
                    onClick={() => setInviteOpen(false)}
                    tone="secondary"
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button busy={inviteMutation.isPending} type="submit">
                    Create invitation
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
