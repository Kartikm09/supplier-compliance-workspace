import { ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { Button } from "../components/Button";
import { TextField } from "../components/FormField";
import { LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { acceptSupplierInvitation } from "../lib/api/actions";
import { errorMessage } from "../lib/errors";
import { formString } from "../lib/forms";
import { supabase } from "../lib/supabase";

function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function AuthLayout({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            <ShieldCheck size={21} />
          </span>
          <strong>Supplier Compliance Workspace</strong>
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>
          Secure qualification, evidence review, findings, and decisions across
          buyer and supplier organizations.
        </p>
        <ul className="auth-proof">
          <li>Relationship-scoped access</li>
          <li>Private document versions</li>
          <li>Traceable review decisions</li>
        </ul>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}

export function SignInPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const next = safeNext(searchParams.get("next"));

  if (user) return <Navigate replace to={next} />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      notify("Signed in securely.", "success");
      void navigate(next, { replace: true });
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout eyebrow="Secure workspace" title="Welcome back">
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <div>
          <h2>Sign in</h2>
          <p>Use the account associated with your buyer or supplier team.</p>
        </div>
        <TextField
          autoComplete="email"
          label="Work email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <TextField
          autoComplete="current-password"
          label="Password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <div className="auth-form__aside">
          <Link to="/reset-password">Forgot password?</Link>
        </div>
        <Button busy={busy} type="submit">
          Sign in
        </Button>
        <p className="auth-form__footer">
          Joining a supplier workspace?{" "}
          <Link to={`/sign-up?next=${encodeURIComponent(next)}`}>
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export function SignUpPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const next = safeNext(searchParams.get("next"));

  if (user) return <Navigate replace to={next} />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = formString(form, "displayName").trim();
    const email = formString(form, "email").trim();
    const password = formString(form, "password");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Supplier onboarding"
      title="Create your secure account"
    >
      {submitted ? (
        <div className="auth-form">
          <h2>Check your email</h2>
          <p>
            Use the verification link to activate your account. Invitation
            acceptance resumes after sign-in.
          </p>
          <Link className="button button--secondary" to="/sign-in">
            Return to sign in
          </Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <div>
            <h2>Create account</h2>
            <p>
              Registration does not grant access without a valid membership.
            </p>
          </div>
          <TextField
            autoComplete="name"
            label="Full name"
            minLength={2}
            name="displayName"
            required
          />
          <TextField
            autoComplete="email"
            label="Work email"
            name="email"
            required
            type="email"
          />
          <TextField
            autoComplete="new-password"
            hint="Use at least 12 characters."
            label="Password"
            minLength={12}
            name="password"
            required
            type="password"
          />
          <Button busy={busy} type="submit">
            Create account
          </Button>
          <p className="auth-form__footer">
            Already registered? <Link to="/sign-in">Sign in</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        formString(form, "email"),
        { redirectTo: `${window.location.origin}/auth/callback?next=/profile` },
      );
      if (error) throw error;
      setSent(true);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout eyebrow="Account recovery" title="Reset your password">
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <h2>Recovery link</h2>
        <p>
          {sent
            ? "If the account exists, a recovery link has been sent."
            : "Enter your account email to request a time-limited recovery link."}
        </p>
        {!sent ? (
          <>
            <TextField label="Work email" name="email" required type="email" />
            <Button busy={busy} type="submit">
              Send recovery link
            </Button>
          </>
        ) : null}
        <Link to="/sign-in">Return to sign in</Link>
      </form>
    </AuthLayout>
  );
}

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  useEffect(() => {
    const next = safeNext(searchParams.get("next"));
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        notify(
          error?.message ?? "The authentication link is no longer valid.",
          "error",
        );
        void navigate("/sign-in", { replace: true });
        return;
      }
      void navigate(next, { replace: true });
    });
  }, [navigate, notify, searchParams]);

  return <LoadingState label="Completing authentication" />;
}

export function InvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { notify } = useToast();
  const token = searchParams.get("token") ?? "";
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingState label="Checking invitation" />;
  if (!user) {
    return (
      <Navigate
        replace
        to={`/sign-in?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
      />
    );
  }

  const accept = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await acceptSupplierInvitation({
        supplierCountryCode: formString(form, "countryCode"),
        token,
        supplierDisplayName: formString(form, "supplierName").trim(),
      });
      notify("Supplier invitation accepted.", "success");
      void navigate("/", { replace: true });
      window.location.reload();
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout eyebrow="Buyer invitation" title="Join a supplier relationship">
      <form className="auth-form" onSubmit={(event) => void accept(event)}>
        <h2>Accept invitation</h2>
        <p>
          Confirm the supplier organization name. The secure invitation token
          will be validated once and is never stored in the browser after use.
        </p>
        <TextField
          label="Supplier organization"
          minLength={2}
          name="supplierName"
          required
        />
        <TextField
          autoCapitalize="characters"
          label="Headquarters country code"
          maxLength={2}
          minLength={2}
          name="countryCode"
          placeholder="DE"
          required
        />
        <Button busy={busy} disabled={token.length < 24} type="submit">
          Accept and continue
        </Button>
        {token.length < 24 ? (
          <p className="form-error" role="alert">
            This invitation link is incomplete or invalid.
          </p>
        ) : null}
      </form>
    </AuthLayout>
  );
}

export function UnauthorizedPage() {
  return (
    <main className="standalone-state">
      <ShieldCheck aria-hidden="true" size={34} />
      <h1>Access not permitted</h1>
      <p>
        Your current organization role does not permit this operation. Database
        policies enforce the same boundary.
      </p>
      <Link className="button button--primary" to="/">
        Return to dashboard
      </Link>
    </main>
  );
}

export function OrganizationRequiredPage() {
  const { signOut } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const leave = async () => {
    setBusy(true);
    try {
      await signOut();
      void navigate("/sign-in", { replace: true });
    } catch (error) {
      notify(errorMessage(error), "error");
      setBusy(false);
    }
  };

  return (
    <main className="standalone-state">
      <ShieldCheck aria-hidden="true" size={34} />
      <h1>No active organization</h1>
      <p>
        Ask a buyer or supplier administrator for an invitation. Access begins
        only after an active membership is created.
      </p>
      <Button busy={busy} onClick={() => void leave()} tone="secondary">
        Sign out
      </Button>
    </main>
  );
}
