import { useQuery } from "@tanstack/react-query";
import { FileClock, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useWorkspace } from "../context/WorkspaceContext";
import { loadAuditEvents } from "../lib/api/workspace";
import { errorMessage } from "../lib/errors";
import { formatDateTime, titleCase } from "../lib/format";

export function AuditPage() {
  const { organization } = useWorkspace();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["audit-events", organization?.id],
    queryFn: () => loadAuditEvents(organization!.id),
    enabled: Boolean(organization),
  });
  const filtered = useMemo(
    () =>
      (query.data ?? []).filter((event) =>
        `${event.action} ${event.resource_type} ${event.resource_id}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [query.data, search],
  );

  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState message={errorMessage(query.error)} />;

  return (
    <>
      <PageHeader
        eyebrow="Append-only history"
        subtitle="Trace sensitive actions without exposing protected field values."
        title="Audit events"
      />
      <div className="filter-bar">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search audit events</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search action or resource"
            type="search"
            value={search}
          />
        </label>
        <span className="filter-count">{filtered.length} events</span>
      </div>
      <section className="section section--flush">
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Resource</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Correlation</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => (
                  <tr key={event.id}>
                    <td>{titleCase(event.action)}</td>
                    <td>
                      {titleCase(event.resource_type)}
                      <span className="table-subtitle">
                        {event.resource_id.slice(0, 8)}
                      </span>
                    </td>
                    <td>{event.actor_user_id?.slice(0, 8) ?? "System"}</td>
                    <td>
                      <code>{event.correlation_id.slice(0, 12)}</code>
                    </td>
                    <td>{formatDateTime(event.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            action={<FileClock aria-hidden="true" size={22} />}
            description="Audited workflow actions will appear here."
            title="No audit events"
          />
        )}
      </section>
    </>
  );
}
