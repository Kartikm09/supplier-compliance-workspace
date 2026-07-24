import type {
  ApprovalDecision,
  Assessment,
  AssessmentResponse,
  AuditEvent,
  CorrectiveAction,
  DocumentRequirement,
  DocumentReview,
  DocumentVersion,
  Finding,
  FindingEvent,
  Json,
  Notification,
  Organization,
  OrganizationMember,
  Profile,
  ProgramVersion,
  QualificationProgram,
  Question,
  QuestionnaireSection,
  QuestionOption,
  ReviewTask,
  RiskEvaluation,
  SupplierDocument,
  SupplierInvitation,
  SupplierProfile,
  SupplierRelationship,
} from "./models.js";

type Table<Row extends object> = {
  Insert: Partial<Row> & Record<string, unknown>;
  Relationships: [];
  Row: Row & Record<string, unknown>;
  Update: Partial<Row> & Record<string, unknown>;
};

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    CompositeTypes: { [_ in never]: never };
    Enums: {
      assessment_status:
        | "draft"
        | "in_progress"
        | "submitted"
        | "under_review"
        | "changes_requested"
        | "resubmitted"
        | "approved"
        | "conditionally_approved"
        | "rejected"
        | "withdrawn";
      organization_role:
        | "buyer_owner"
        | "buyer_admin"
        | "buyer_reviewer"
        | "buyer_viewer"
        | "supplier_owner"
        | "supplier_admin"
        | "supplier_contributor"
        | "supplier_viewer";
      organization_type: "buyer" | "supplier";
    };
    Functions: {
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: Notification;
      };
      publish_program_version: {
        Args: {
          requested_effective_from?: string;
          target_program_version_id: string;
        };
        Returns: ProgramVersion;
      };
      record_document_review: {
        Args: {
          buyer_internal_note?: string | null;
          requested_status: string;
          supplier_note?: string | null;
          target_assessment_id: string;
          target_document_version_id: string;
        };
        Returns: DocumentReview;
      };
      request_assessment_report: {
        Args: {
          request_correlation_id: string;
          target_assessment_id: string;
        };
        Returns: number;
      };
      start_assessment_review: {
        Args: { target_assessment_id: string };
        Returns: Assessment;
      };
      transition_assessment: {
        Args: {
          p_assessment_id: string;
          p_expected_status: string;
          p_next_status: string;
        };
        Returns: Assessment;
      };
    };
    Tables: {
      approval_decisions: Table<ApprovalDecision>;
      assessment_responses: Table<AssessmentResponse>;
      assessments: Table<Assessment>;
      audit_events: Table<AuditEvent>;
      corrective_actions: Table<CorrectiveAction>;
      document_requirements: Table<DocumentRequirement>;
      document_reviews: Table<DocumentReview>;
      document_versions: Table<DocumentVersion>;
      documents: Table<SupplierDocument>;
      finding_events: Table<FindingEvent>;
      findings: Table<Finding>;
      notifications: Table<Notification>;
      organization_members: Table<OrganizationMember>;
      organizations: Table<Organization>;
      profiles: Table<Profile>;
      program_versions: Table<ProgramVersion>;
      qualification_programs: Table<QualificationProgram>;
      question_options: Table<QuestionOption>;
      questionnaire_sections: Table<QuestionnaireSection>;
      questions: Table<Question>;
      review_tasks: Table<ReviewTask>;
      risk_evaluations: Table<RiskEvaluation>;
      supplier_invitations: Table<SupplierInvitation>;
      supplier_profiles: Table<SupplierProfile>;
      supplier_relationships: Table<SupplierRelationship>;
    };
    Views: { [_ in never]: never };
  };
}

export type { Json };
