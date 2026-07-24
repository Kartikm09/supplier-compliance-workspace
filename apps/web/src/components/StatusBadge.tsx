import { titleCase } from "../lib/format";

const positive = new Set([
  "active",
  "accepted",
  "approved",
  "completed",
  "ready",
  "verified",
]);
const negative = new Set([
  "critical",
  "failed",
  "rejected",
  "suspended",
  "terminated",
]);
const warning = new Set([
  "changes_requested",
  "conditionally_approved",
  "medium",
  "pending",
  "response_required",
  "revision_required",
  "under_review",
]);

export function StatusBadge({ value }: { value: string }) {
  const tone = positive.has(value)
    ? "positive"
    : negative.has(value)
      ? "negative"
      : warning.has(value)
        ? "warning"
        : "neutral";
  return <span className={`status status--${tone}`}>{titleCase(value)}</span>;
}
