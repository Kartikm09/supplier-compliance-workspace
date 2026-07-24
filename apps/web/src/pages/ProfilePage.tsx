import { profileSchema } from "@scw/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { type FormEvent } from "react";

import { Button } from "../components/Button";
import { TextField } from "../components/FormField";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { loadProfile, saveProfile } from "../lib/api/workspace";
import { errorMessage } from "../lib/errors";
import { formString } from "../lib/forms";

export function ProfilePage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => loadProfile(user!.id),
    enabled: Boolean(user),
  });
  const mutation = useMutation({
    mutationFn: (values: { display_name: string; job_title: string | null }) =>
      saveProfile(user!.id, values),
    onSuccess: () => {
      notify("Profile updated.", "success");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = profileSchema.safeParse({
      display_name: formString(form, "displayName"),
      job_title: formString(form, "jobTitle").trim() || null,
    });
    if (!parsed.success) {
      notify(
        parsed.error.issues[0]?.message ?? "Review your profile.",
        "error",
      );
      return;
    }
    mutation.mutate({
      display_name: parsed.data.display_name,
      job_title: parsed.data.job_title ?? null,
    });
  };

  if (query.isLoading) return <LoadingState />;
  if (query.error) {
    return <ErrorState message={errorMessage(query.error)} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Personal settings"
        subtitle="Your identity is shown in assignment, review, and audit records."
        title="Profile"
      />
      <section className="section settings-section">
        <form className="stack-form" onSubmit={submit}>
          <TextField
            defaultValue={
              query.data?.display_name ??
              (user?.user_metadata.display_name as string | undefined) ??
              ""
            }
            label="Display name"
            name="displayName"
            required
          />
          <TextField
            defaultValue={query.data?.job_title ?? ""}
            label="Job title"
            name="jobTitle"
          />
          <TextField
            disabled
            label="Account email"
            type="email"
            value={user?.email ?? ""}
          />
          <div className="form-actions">
            <Button busy={mutation.isPending} type="submit">
              <Save aria-hidden="true" size={16} />
              Save profile
            </Button>
          </div>
        </form>
      </section>
    </>
  );
}
