import type { FindingEvent, OrganizationType } from "@scw/contracts";

import { formatDateTime } from "../lib/format";

export function FindingTimeline({
  events,
  organizationType,
}: {
  events: FindingEvent[];
  organizationType: OrganizationType;
}) {
  const visibleEvents = events.filter(
    (event) => organizationType === "buyer" || event.supplier_visible,
  );

  if (visibleEvents.length === 0) {
    return <p className="muted-copy">No shared timeline events yet.</p>;
  }

  return (
    <ol className="timeline">
      {visibleEvents.map((event) => (
        <li key={event.id}>
          <span aria-hidden="true" />
          <div>
            <strong>{event.event_type.replaceAll("_", " ")}</strong>
            {event.comment ? <p>{event.comment}</p> : null}
            <small>{formatDateTime(event.created_at)}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}
