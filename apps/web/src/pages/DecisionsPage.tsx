import { useQuery } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useWorkspace } from "../context/WorkspaceContext";
import { loadAssessmentsForOrganization } from "../lib/api/assessments";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";

export function DecisionsPage() {
  const { organization } = useWorkspace();
  const query = useQuery({
    queryKey: ["decision-queue", organization?.id],
    queryFn: () => loadAssessmentsForOrganization(organization!.id, "buyer"),
    enabled: Boolean(organization?.organization_type === "buyer"),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.error) {
    return (
      <ErrorState
        message={errorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  }
  const decisionReady = (query.data ?? []).filter((assessment) =>
    ["under_review", "approved", "conditionally_approved", "rejected"].includes(
      assessment.status,
    ),
  );

  return (
    <>
      <PageHeader
        eyebrow="Buyer governance"
        subtitle="Record immutable approval outcomes after evidence and finding review."
        title="Decision workspace"
      />
      <section className="section section--flush">
        {decisionReady.length ? (
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
                {decisionReady.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>
                      <Link
                        className="table-link"
                        to={`/decisions/${assessment.id}`}
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
            action={<Scale aria-hidden="true" size={23} />}
            description="Assessments under review appear here when they are ready for a buyer decision."
            title="No decisions pending"
          />
        )}
      </section>
    </>
  );
}
