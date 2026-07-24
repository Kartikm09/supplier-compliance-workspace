import { useQueryClient } from "@tanstack/react-query";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import { useWorkspace } from "../context/WorkspaceContext";

export type RealtimeStatus = "connecting" | "connected" | "offline";

export function useWorkspaceRealtime(): RealtimeStatus {
  const queryClient = useQueryClient();
  const { organization } = useWorkspace();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    if (!organization) {
      setStatus("offline");
      return;
    }
    setStatus("connecting");
    const topics =
      organization.organization_type === "buyer"
        ? [
            `buyer:${organization.id}:relationships`,
            `organization:${organization.id}:notifications`,
          ]
        : [`organization:${organization.id}:notifications`];
    const channels = topics.map((topic) =>
      supabase
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "*" }, () => {
          void queryClient.invalidateQueries();
        })
        .subscribe((nextStatus) => {
          if (nextStatus === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
            setStatus("connected");
            void queryClient.invalidateQueries();
          } else if (
            nextStatus === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
            nextStatus === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
            nextStatus === REALTIME_SUBSCRIBE_STATES.CLOSED
          ) {
            setStatus("offline");
          } else {
            setStatus("connecting");
          }
        }),
    );

    const handleOnline = () => {
      setStatus("connecting");
      void queryClient.invalidateQueries();
    };
    const handleOffline = () => setStatus("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [organization, queryClient]);

  return status;
}
