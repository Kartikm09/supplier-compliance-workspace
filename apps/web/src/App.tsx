import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { OrganizationTypeRoute } from "./components/OrganizationTypeRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoadingState } from "./components/States";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";

const AuthPages = import("./pages/AuthPages");
const SignInPage = lazy(() =>
  AuthPages.then((module) => ({ default: module.SignInPage })),
);
const SignUpPage = lazy(() =>
  AuthPages.then((module) => ({ default: module.SignUpPage })),
);
const ResetPasswordPage = lazy(() =>
  AuthPages.then((module) => ({ default: module.ResetPasswordPage })),
);
const AuthCallbackPage = lazy(() =>
  AuthPages.then((module) => ({ default: module.AuthCallbackPage })),
);
const InvitationAcceptPage = lazy(() =>
  AuthPages.then((module) => ({ default: module.InvitationAcceptPage })),
);
const UnauthorizedPage = lazy(() =>
  AuthPages.then((module) => ({ default: module.UnauthorizedPage })),
);
const OrganizationRequiredPage = lazy(() =>
  AuthPages.then((module) => ({ default: module.OrganizationRequiredPage })),
);

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const RelationshipsPage = lazy(() =>
  import("./pages/RelationshipsPage").then((module) => ({
    default: module.RelationshipsPage,
  })),
);
const RelationshipDetailPage = lazy(() =>
  import("./pages/RelationshipDetailPage").then((module) => ({
    default: module.RelationshipDetailPage,
  })),
);
const ProgramsPage = lazy(() =>
  import("./pages/ProgramsPage").then((module) => ({
    default: module.ProgramsPage,
  })),
);
const ProgramBuilderPage = lazy(() =>
  import("./pages/ProgramBuilderPage").then((module) => ({
    default: module.ProgramBuilderPage,
  })),
);
const ReviewsPage = lazy(() =>
  import("./pages/ReviewsPage").then((module) => ({
    default: module.ReviewsPage,
  })),
);
const ReviewWorkspacePage = lazy(() =>
  import("./pages/ReviewWorkspacePage").then((module) => ({
    default: module.ReviewWorkspacePage,
  })),
);
const DecisionsPage = lazy(() =>
  import("./pages/DecisionsPage").then((module) => ({
    default: module.DecisionsPage,
  })),
);
const DecisionWorkspacePage = lazy(() =>
  import("./pages/DecisionWorkspacePage").then((module) => ({
    default: module.DecisionWorkspacePage,
  })),
);
const AssessmentsPage = lazy(() =>
  import("./pages/AssessmentsPage").then((module) => ({
    default: module.AssessmentsPage,
  })),
);
const AssessmentWorkspacePage = lazy(() =>
  import("./pages/AssessmentWorkspacePage").then((module) => ({
    default: module.AssessmentWorkspacePage,
  })),
);
const DocumentsPage = lazy(() =>
  import("./pages/DocumentsPage").then((module) => ({
    default: module.DocumentsPage,
  })),
);
const FindingsPage = lazy(() =>
  import("./pages/FindingsPage").then((module) => ({
    default: module.FindingsPage,
  })),
);
const FindingDetailPage = lazy(() =>
  import("./pages/FindingDetailPage").then((module) => ({
    default: module.FindingDetailPage,
  })),
);
const NotificationsPage = lazy(() =>
  import("./pages/NotificationsPage").then((module) => ({
    default: module.NotificationsPage,
  })),
);
const OrganizationPage = lazy(() =>
  import("./pages/OrganizationPage").then((module) => ({
    default: module.OrganizationPage,
  })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);
const AuditPage = lazy(() =>
  import("./pages/AuditPage").then((module) => ({
    default: module.AuditPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { retry: 0 },
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 15_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <Suspense fallback={<LoadingState label="Loading secure view" />}>
                <Routes>
                  <Route path="/sign-in" element={<SignInPage />} />
                  <Route path="/sign-up" element={<SignUpPage />} />
                  <Route
                    path="/reset-password"
                    element={<ResetPasswordPage />}
                  />
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />
                  <Route
                    path="/invitations/accept"
                    element={<InvitationAcceptPage />}
                  />
                  <Route path="/unauthorized" element={<UnauthorizedPage />} />
                  <Route
                    path="/organization-required"
                    element={<OrganizationRequiredPage />}
                  />

                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppShell />}>
                      <Route index element={<DashboardPage />} />
                      <Route
                        path="relationships"
                        element={<RelationshipsPage />}
                      />
                      <Route
                        path="relationships/:relationshipId"
                        element={<RelationshipDetailPage />}
                      />
                      <Route
                        element={
                          <OrganizationTypeRoute organizationType="buyer" />
                        }
                      >
                        <Route path="programs" element={<ProgramsPage />} />
                        <Route
                          path="programs/:programId"
                          element={<ProgramBuilderPage />}
                        />
                        <Route path="reviews" element={<ReviewsPage />} />
                        <Route
                          path="reviews/:assessmentId"
                          element={<ReviewWorkspacePage />}
                        />
                        <Route path="decisions" element={<DecisionsPage />} />
                        <Route
                          path="decisions/:assessmentId"
                          element={<DecisionWorkspacePage />}
                        />
                        <Route path="audit" element={<AuditPage />} />
                      </Route>
                      <Route
                        element={
                          <OrganizationTypeRoute organizationType="supplier" />
                        }
                      >
                        <Route
                          path="assessments"
                          element={<AssessmentsPage />}
                        />
                        <Route
                          path="assessments/:assessmentId"
                          element={<AssessmentWorkspacePage />}
                        />
                        <Route path="documents" element={<DocumentsPage />} />
                        <Route path="findings" element={<FindingsPage />} />
                        <Route
                          path="findings/:findingId"
                          element={<FindingDetailPage />}
                        />
                      </Route>
                      <Route
                        path="notifications"
                        element={<NotificationsPage />}
                      />
                      <Route
                        path="organization"
                        element={<OrganizationPage />}
                      />
                      <Route path="team" element={<OrganizationPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
