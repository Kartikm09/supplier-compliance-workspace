import type {
  AssessmentResponse,
  Question,
  QuestionOption,
} from "@scw/contracts";
import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ResponseDraft } from "../lib/api/assessments";
import { titleCase } from "../lib/format";

function initialValue(
  question: Question,
  response: AssessmentResponse | undefined,
): string | string[] {
  if (!response) return question.answer_type === "multi_select" ? [] : "";
  switch (question.answer_type) {
    case "boolean":
      return response.response_boolean === null
        ? ""
        : String(response.response_boolean);
    case "number":
      return response.response_number === null
        ? ""
        : String(response.response_number);
    case "date":
      return response.response_date ?? "";
    case "single_select":
      return response.response_option_id ?? "";
    case "multi_select":
      return Array.isArray(response.response_json)
        ? response.response_json.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
    case "text":
    case "long_text":
      return response.response_text ?? "";
  }
}

function toDraft(question: Question, value: string | string[]): ResponseDraft {
  switch (question.answer_type) {
    case "boolean":
      return { response_boolean: value === "" ? null : value === "true" };
    case "number":
      return {
        response_number:
          value === "" || Array.isArray(value) ? null : Number(value),
      };
    case "date":
      return { response_date: Array.isArray(value) ? null : value || null };
    case "single_select":
      return {
        response_option_id: Array.isArray(value) ? null : value || null,
      };
    case "multi_select":
      return { response_json: value };
    case "text":
    case "long_text":
      return {
        response_text: Array.isArray(value) ? null : value || null,
      };
  }
}

export function QuestionResponseField({
  disabled,
  onSave,
  options,
  question,
  response,
}: {
  disabled: boolean;
  onSave: (draft: ResponseDraft) => Promise<void>;
  options: QuestionOption[];
  question: Question;
  response?: AssessmentResponse | undefined;
}) {
  const [value, setValue] = useState<string | string[]>(() =>
    initialValue(question, response),
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const initial = useRef(true);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      setSaveState("saving");
      void onSaveRef
        .current(toDraft(question, value))
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [question.answer_type, value]);

  const inputId = `question-${question.id}`;
  const relevantOptions = options.filter(
    (option) => option.question_id === question.id,
  );
  const common = {
    "aria-describedby": question.help_text ? `${inputId}-help` : undefined,
    disabled,
    id: inputId,
  };

  return (
    <div className="response-field" id={`question-block-${question.id}`}>
      <div className="response-field__heading">
        <label htmlFor={inputId}>
          {question.prompt}
          {question.required ? <span aria-label="required"> *</span> : null}
        </label>
        <span className={`save-state save-state--${saveState}`}>
          {saveState === "saving" ? (
            <LoaderCircle aria-hidden="true" size={14} />
          ) : null}
          {saveState === "saved" ? (
            <Check aria-hidden="true" size={14} />
          ) : null}
          {saveState === "saving"
            ? "Saving"
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Save failed"
                : titleCase(question.answer_type)}
        </span>
      </div>
      {question.help_text ? (
        <p className="field__help" id={`${inputId}-help`}>
          {question.help_text}
        </p>
      ) : null}
      {question.answer_type === "long_text" ? (
        <textarea
          {...common}
          onChange={(event) => setValue(event.target.value)}
          rows={5}
          value={String(value)}
        />
      ) : null}
      {question.answer_type === "text" ? (
        <input
          {...common}
          onChange={(event) => setValue(event.target.value)}
          type="text"
          value={String(value)}
        />
      ) : null}
      {question.answer_type === "number" ? (
        <input
          {...common}
          onChange={(event) => setValue(event.target.value)}
          type="number"
          value={String(value)}
        />
      ) : null}
      {question.answer_type === "date" ? (
        <input
          {...common}
          onChange={(event) => setValue(event.target.value)}
          type="date"
          value={String(value)}
        />
      ) : null}
      {question.answer_type === "boolean" ? (
        <select
          {...common}
          onChange={(event) => setValue(event.target.value)}
          value={String(value)}
        >
          <option value="">Select an answer</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : null}
      {question.answer_type === "single_select" ? (
        <select
          {...common}
          onChange={(event) => setValue(event.target.value)}
          value={String(value)}
        >
          <option value="">Select an option</option>
          {relevantOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      {question.answer_type === "multi_select" ? (
        <fieldset {...common}>
          <legend className="sr-only">{question.prompt}</legend>
          <div className="check-grid">
            {relevantOptions.map((option) => {
              const selected =
                Array.isArray(value) && value.includes(option.id);
              return (
                <label className="check-field" key={option.id}>
                  <input
                    checked={selected}
                    disabled={disabled}
                    onChange={(event) =>
                      setValue((current) => {
                        const items = Array.isArray(current) ? current : [];
                        return event.target.checked
                          ? [...items, option.id]
                          : items.filter((item) => item !== option.id);
                      })
                    }
                    type="checkbox"
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
