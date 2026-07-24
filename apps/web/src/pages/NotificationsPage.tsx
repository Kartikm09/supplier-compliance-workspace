import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { loadNotifications, markNotificationRead } from "../lib/api/workspace";
import { errorMessage } from "../lib/errors";
import { formatDateTime, titleCase } from "../lib/format";

export function NotificationsPage() {
  const { user } = useAuth();
  const { organization } = useWorkspace();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", organization?.id, user?.id],
    queryFn: () => loadNotifications(organization!.id, user!.id),
    enabled: Boolean(organization && user),
  });
  const mutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => notify(errorMessage(error), "error"),
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

  return (
    <>
      <PageHeader
        eyebrow="Operational inbox"
        subtitle="Relationship updates, deadlines, findings, and processing results."
        title="Notifications"
      />
      <section className="section">
        {query.data?.length ? (
          <ul className="notification-list">
            {query.data.map((notification) => (
              <li
                className={notification.read_at ? "" : "notification--unread"}
                key={notification.id}
              >
                <span className="notification-list__icon" aria-hidden="true">
                  <Bell size={17} />
                </span>
                <div>
                  <div className="inline-heading">
                    <strong>{notification.title}</strong>
                    <span>{titleCase(notification.notification_type)}</span>
                  </div>
                  <p>{notification.body}</p>
                  <small>{formatDateTime(notification.created_at)}</small>
                </div>
                {!notification.read_at ? (
                  <Button
                    aria-label={`Mark ${notification.title} read`}
                    busy={
                      mutation.isPending &&
                      mutation.variables === notification.id
                    }
                    onClick={() => mutation.mutate(notification.id)}
                    tone="quiet"
                  >
                    <CheckCheck aria-hidden="true" size={17} />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            description="New workflow and deadline notifications will appear here."
            title="Inbox is clear"
          />
        )}
      </section>
    </>
  );
}
