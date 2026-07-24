import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useWorkspace } from "../context/WorkspaceContext";
import { loadAssessmentsForOrganization } from "../lib/api/assessments";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";

export function AssessmentsPage() {
  const { organization } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const query = useQuery({
    queryKey: ["assessments", organization?.id],
    queryFn: () =>
      loadAssessmentsForOrganization(
        organization!.id,
        organization!.organization_type,
      ),
    enabled: Boolean(organization),
  });
  const filtered = useMemo(
    () =>
      (query.data ?? []).filter(
        (assessment) =>
          (status === "all" || assessment.status === status) &&
          `${assessment.programName} ${assessment.buyerName}`
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
        eyebrow="Supplier workspace"
        subtitle="Complete assigned questionnaires, attach evidence, and submit a traceable declaration."
        title="Assessments"
      />
      <div className="filter-bar">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search assessments</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search program or buyer"
            type="search"
            value={search}
          />
        </label>
        <label>
          <span className="sr-only">Assessment status</span>
          <select
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="in_progress">In progress</option>
            <option value="changes_requested">Changes requested</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="conditionally_approved">Conditional</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <span className="filter-count">{filtered.length} assessments</span>
      </div>
      <section className="section section--flush">
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Program</th>
                  <th scope="col">Buyer</th>
                  <th scope="col">Completion</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>
                      <Link
                        className="table-link"
                        to={`/assessments/${assessment.id}`}
                      >
                        {assessment.programName}
                      </Link>
                    </td>
                    <td>{assessment.buyerName}</td>
                    <td>
                      <div className="progress-cell">
                        <progress
                          max={100}
                          value={assessment.completeness_percentage}
                        />
                        <span>{assessment.completeness_percentage}%</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge value={assessment.status} />
                    </td>
                    <td>{formatDateTime(assessment.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            action={<ClipboardCheck aria-hidden="true" size={22} />}
            description="Assigned supplier qualifications appear here after a buyer creates an assessment."
            title="No assessments found"
          />
        )}
      </section>
    </>
  );
}
