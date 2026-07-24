import type {
  DocumentRequirement,
  ProgramVersion,
  QualificationProgram,
  Question,
  QuestionnaireSection,
} from "@scw/contracts";

import { supabase } from "../supabase";

export interface ProgramSummary extends QualificationProgram {
  currentVersion: ProgramVersion | null;
}

export interface ProgramWorkspaceData {
  program: QualificationProgram;
  requirements: DocumentRequirement[];
  sections: QuestionnaireSection[];
  questions: Question[];
  selectedVersion: ProgramVersion;
  versions: ProgramVersion[];
}

export async function loadPrograms(
  buyerOrganizationId: string,
): Promise<ProgramSummary[]> {
  const { data: programs, error } = await supabase
    .from("qualification_programs")
    .select("*")
    .eq("buyer_organization_id", buyerOrganizationId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!programs.length) return [];
  const { data: versions, error: versionError } = await supabase
    .from("program_versions")
    .select("*")
    .in(
      "qualification_program_id",
      programs.map((program) => program.id),
    )
    .order("version_number", { ascending: false });
  if (versionError) throw versionError;
  const versionById = new Map(versions.map((version) => [version.id, version]));
  return programs.map((program) => ({
    ...program,
    currentVersion: program.current_version_id
      ? (versionById.get(program.current_version_id) ?? null)
      : null,
  }));
}

export async function createProgram(values: {
  buyerOrganizationId: string;
  category: string;
  createdBy: string;
  description: string;
  name: string;
}): Promise<QualificationProgram> {
  const { data: program, error } = await supabase
    .from("qualification_programs")
    .insert({
      buyer_organization_id: values.buyerOrganizationId,
      category: values.category,
      created_by: values.createdBy,
      description: values.description,
      name: values.name,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;
  const { error: versionError } = await supabase
    .from("program_versions")
    .insert({
      qualification_program_id: program.id,
      status: "draft",
      version_number: 1,
    });
  if (versionError) throw versionError;
  return program;
}

export async function loadProgramWorkspace(
  programId: string,
  requestedVersionId?: string,
): Promise<ProgramWorkspaceData> {
  const { data: program, error } = await supabase
    .from("qualification_programs")
    .select("*")
    .eq("id", programId)
    .single();
  if (error) throw error;
  const { data: versions, error: versionsError } = await supabase
    .from("program_versions")
    .select("*")
    .eq("qualification_program_id", programId)
    .order("version_number", { ascending: false });
  if (versionsError) throw versionsError;
  const selectedVersion =
    versions.find((version) => version.id === requestedVersionId) ??
    versions.find((version) => version.status === "draft") ??
    versions.find((version) => version.id === program.current_version_id) ??
    versions[0];
  if (!selectedVersion) throw new Error("This program has no version.");
  const [sectionResult, questionResult, requirementResult] = await Promise.all([
    supabase
      .from("questionnaire_sections")
      .select("*")
      .eq("program_version_id", selectedVersion.id)
      .order("display_order"),
    supabase
      .from("questions")
      .select("*")
      .eq("program_version_id", selectedVersion.id)
      .order("display_order"),
    supabase
      .from("document_requirements")
      .select("*")
      .eq("program_version_id", selectedVersion.id)
      .order("display_order"),
  ]);
  if (sectionResult.error) throw sectionResult.error;
  if (questionResult.error) throw questionResult.error;
  if (requirementResult.error) throw requirementResult.error;
  return {
    program,
    requirements: requirementResult.data,
    sections: sectionResult.data,
    questions: questionResult.data,
    selectedVersion,
    versions,
  };
}

export async function createDraftVersion(
  programId: string,
  latestVersion: number,
): Promise<ProgramVersion> {
  const { data, error } = await supabase
    .from("program_versions")
    .insert({
      qualification_program_id: programId,
      status: "draft",
      version_number: latestVersion + 1,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function saveSection(values: {
  description: string | null;
  displayOrder: number;
  programVersionId: string;
  title: string;
}): Promise<QuestionnaireSection> {
  const { data, error } = await supabase
    .from("questionnaire_sections")
    .insert({
      description: values.description,
      display_order: values.displayOrder,
      program_version_id: values.programVersionId,
      title: values.title,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function saveQuestion(
  values: Partial<Question> &
    Pick<
      Question,
      | "answer_type"
      | "display_order"
      | "program_version_id"
      | "prompt"
      | "required"
      | "risk_weight"
      | "section_id"
      | "stable_question_key"
    >,
): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .insert({
      ...values,
      conditional_visibility_rules: values.conditional_visibility_rules ?? {},
      help_text: values.help_text ?? null,
      validation_rules: values.validation_rules ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function saveRequirement(
  values: Partial<DocumentRequirement> &
    Pick<
      DocumentRequirement,
      | "accepted_mime_types"
      | "display_order"
      | "maximum_size_bytes"
      | "minimum_validity_days"
      | "name"
      | "program_version_id"
      | "required"
      | "requires_expiry_date"
      | "requires_issue_date"
      | "stable_requirement_key"
    >,
): Promise<DocumentRequirement> {
  const { data, error } = await supabase
    .from("document_requirements")
    .insert({
      ...values,
      description: values.description ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function publishProgramVersion(
  versionId: string,
): Promise<ProgramVersion> {
  const { data, error } = await supabase.rpc("publish_program_version", {
    requested_effective_from: new Date().toISOString().slice(0, 10),
    target_program_version_id: versionId,
  });
  if (error) throw error;
  return data;
}
