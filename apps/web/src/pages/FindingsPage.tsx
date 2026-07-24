import { useQuery } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useWorkspace } from "../context/WorkspaceContext";
import { loadFindingsForOrganization } from "../lib/api/findings";
import { errorMessage } from "../lib/errors";
import { formatDate, relativeDeadline } from "../lib/format";

export function FindingsPage() {
  const { organization } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const query = useQuery({
    queryKey: ["findings", organization?.id],
    queryFn: () =>
      loadFindingsForOrganization(
        organization!.id,
        organization!.organization_type,
      ),
    enabled: Boolean(organization),
  });
  const filtered = useMemo(
    () =>
      (query.data ?? []).filter(
        (finding) =>
          (status === "all" || finding.status === status) &&
          `${finding.title} ${finding.category}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [query.data, search, status],
  );

  if (query.isLoading) return <LoadingState />;
  if (query.error) {
    return (
      <ErrorState
        message={errorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Corrective action"
        subtitle="Respond to supplier-visible review findings and preserve the verification timeline."
        title="Findings"
      />
      <div className="filter-bar">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search findings</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or category"
            type="search"
            value={search}
          />
        </label>
        <label>
          <span className="sr-only">Finding status</span>
          <select
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">All statuses</option>
            <option value="response_required">Response required</option>
            <option value="response_submitted">Response submitted</option>
            <option value="verification_required">Verification required</option>
            <option value="verified">Verified</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <span className="filter-count">{filtered.length} findings</span>
      </div>
      <section className="section section--flush">
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Finding</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Due</th>
                  <th scope="col">Corrective action</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((finding) => (
                  <tr key={finding.id}>
                    <td>
                      <Link
                        className="table-link"
                        to={`/findings/${finding.id}`}
                      >
                        #{finding.finding_number} {finding.title}
                      </Link>
                      <span className="table-subtitle">{finding.category}</span>
                    </td>
                    <td>
                      <StatusBadge value={finding.severity} />
                    </td>
                    <td>
                      {formatDate(finding.due_at)}
                      <span className="table-subtitle">
                        {relativeDeadline(finding.due_at)}
                      </span>
                    </td>
                    <td>
                      {finding.correctiveAction ? (
                        <StatusBadge value={finding.correctiveAction.status} />
                      ) : (
                        "Not submitted"
                      )}
                    </td>
                    <td>
                      <StatusBadge value={finding.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            action={<ShieldCheck aria-hidden="true" size={22} />}
            description="No supplier-visible findings match the current filters."
            title="No findings"
          />
        )}
      </section>
    </>
  );
}
