import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useWorkspace } from "../context/WorkspaceContext";
import { loadAssessmentsForOrganization } from "../lib/api/assessments";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";

export function ReviewsPage() {
  const { organization } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("actionable");
  const query = useQuery({
    queryKey: ["review-queue", organization?.id],
    queryFn: () => loadAssessmentsForOrganization(organization!.id, "buyer"),
    enabled: Boolean(organization?.organization_type === "buyer"),
  });
  const filtered = useMemo(() => {
    const actionable = new Set(["submitted", "resubmitted", "under_review"]);
    return (query.data ?? []).filter(
      (assessment) =>
        (status === "all" ||
          (status === "actionable" && actionable.has(assessment.status)) ||
          assessment.status === status) &&
        `${assessment.programName} ${assessment.supplierName}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  }, [query.data, search, status]);

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
        eyebrow="Buyer review"
        subtitle="Evaluate questionnaire responses, private evidence, findings, and corrective actions."
        title="Review queue"
      />
      <div className="filter-bar">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search reviews</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search supplier or program"
            type="search"
            value={search}
          />
        </label>
        <label>
          <span className="sr-only">Review status</span>
          <select
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="actionable">Needs review</option>
            <option value="all">All assessments</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="resubmitted">Resubmitted</option>
            <option value="changes_requested">Changes requested</option>
            <option value="approved">Approved</option>
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
                  <th scope="col">Supplier</th>
                  <th scope="col">Program</th>
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
                        to={`/reviews/${assessment.id}`}
                      >
                        {assessment.supplierName}
                      </Link>
                    </td>
                    <td>{assessment.programName}</td>
                    <td>{assessment.completeness_percentage}%</td>
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
            action={<ClipboardList aria-hidden="true" size={22} />}
            description="No assessments match the current review filters."
            title="Review queue is clear"
          />
        )}
      </section>
    </>
  );
}
