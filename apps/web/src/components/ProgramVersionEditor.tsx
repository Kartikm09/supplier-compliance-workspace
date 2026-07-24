import type {
  DocumentRequirement,
  ProgramVersion,
  Question,
  QuestionnaireSection,
} from "@scw/contracts";
import { FilePlus2, HelpCircle, LockKeyhole, Plus, Rows3 } from "lucide-react";

import { titleCase } from "../lib/format";
import { Button } from "./Button";
import { EmptyState } from "./States";
import { StatusBadge } from "./StatusBadge";

export interface ProgramVersionEditorProps {
  canEdit: boolean;
  onAddQuestion: () => void;
  onAddRequirement: () => void;
  onAddSection: () => void;
  questions: Question[];
  requirements: DocumentRequirement[];
  sections: QuestionnaireSection[];
  version: ProgramVersion;
}

export function ProgramVersionEditor({
  canEdit,
  onAddQuestion,
  onAddRequirement,
  onAddSection,
  questions,
  requirements,
  sections,
  version,
}: ProgramVersionEditorProps) {
  const editable = canEdit && version.status === "draft";

  return (
    <div className="program-editor">
      <div className="program-editor__toolbar">
        <div>
          <div className="inline-heading">
            <h2>Version {version.version_number}</h2>
            <StatusBadge value={version.status} />
          </div>
          <p>
            {editable
              ? "Draft definitions can be changed until this version is published."
              : "Published definitions are immutable; create a new draft to revise them."}
          </p>
        </div>
        <div className="button-row">
          <Button disabled={!editable} onClick={onAddSection} tone="secondary">
            <Rows3 aria-hidden="true" size={16} />
            Add section
          </Button>
          <Button disabled={!editable} onClick={onAddQuestion} tone="secondary">
            <HelpCircle aria-hidden="true" size={16} />
            Add question
          </Button>
          <Button
            disabled={!editable}
            onClick={onAddRequirement}
            tone="secondary"
          >
            <FilePlus2 aria-hidden="true" size={16} />
            Add requirement
          </Button>
        </div>
      </div>

      {!editable ? (
        <div className="immutability-note">
          <LockKeyhole aria-hidden="true" size={18} />
          <p>
            Version {version.version_number} is read-only. Existing assessments
            stay linked to this exact definition.
          </p>
        </div>
      ) : null}

      <section className="builder-section">
        <div className="section__header">
          <div>
            <h3>Questionnaire</h3>
            <p>
              {questions.length} questions across {sections.length} sections.
            </p>
          </div>
        </div>
        {sections.length ? (
          <div className="questionnaire-outline">
            {sections.map((section) => {
              const sectionQuestions = questions.filter(
                (question) => question.section_id === section.id,
              );
              return (
                <article key={section.id}>
                  <div className="questionnaire-outline__section">
                    <span>{section.display_order + 1}</span>
                    <div>
                      <h4>{section.title}</h4>
                      {section.description ? (
                        <p>{section.description}</p>
                      ) : null}
                    </div>
                  </div>
                  {sectionQuestions.length ? (
                    <ol>
                      {sectionQuestions.map((question) => (
                        <li key={question.id}>
                          <div>
                            <strong>{question.prompt}</strong>
                            <span>
                              {titleCase(question.answer_type)}
                              {question.required
                                ? " · Required"
                                : " · Optional"}
                            </span>
                          </div>
                          <code>{question.stable_question_key}</code>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="outline-empty">
                      No questions in this section.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            action={
              editable ? (
                <Button onClick={onAddSection} tone="secondary">
                  <Plus aria-hidden="true" size={16} />
                  Add first section
                </Button>
              ) : undefined
            }
            description="Create sections before adding questionnaire questions."
            title="No questionnaire sections"
          />
        )}
      </section>

      <section className="builder-section">
        <div className="section__header">
          <div>
            <h3>Document requirements</h3>
            <p>Evidence rules applied when a supplier submits an assessment.</p>
          </div>
        </div>
        {requirements.length ? (
          <div className="requirement-grid">
            {requirements.map((requirement) => (
              <article key={requirement.id}>
                <div>
                  <strong>{requirement.name}</strong>
                  {requirement.required ? (
                    <span className="required-marker">Required</span>
                  ) : null}
                </div>
                <p>{requirement.description ?? "No additional guidance."}</p>
                <dl>
                  <div>
                    <dt>Maximum size</dt>
                    <dd>
                      {(requirement.maximum_size_bytes / (1024 * 1024)).toFixed(
                        0,
                      )}{" "}
                      MB
                    </dd>
                  </div>
                  <div>
                    <dt>Expiry date</dt>
                    <dd>
                      {requirement.requires_expiry_date
                        ? "Required"
                        : "Optional"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="No evidence documents are required by this version."
            title="No document requirements"
          />
        )}
      </section>
    </div>
  );
}
