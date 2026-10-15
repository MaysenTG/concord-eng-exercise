import { type ReactNode, useEffect, useRef } from "react";
import { useCaseNav } from "../case-nav";
import { ActionDesk } from "../components/action-desk";
import { buildActionPlan } from "../data/action-desk";
import { COPY, caseStatusLabel, type LoadState } from "../data/constants";
import { formatExpiry } from "../data/dates";
import type { EmployeeRow } from "../data/priority";
import {
  passportBeforeVisa,
  type ReplyClock,
  replyClock,
} from "../data/signals";
import { validateEmployee } from "../data/validate-employee";
import { openCase, openQueue } from "../router";

type CasePageProps = {
  employeeId: string;
  rows: EmployeeRow[];
  loadState: LoadState;
};

function keyFacts(
  row: EmployeeRow,
  reply: ReplyClock | null
): { label: string; value: string; title?: string }[] {
  const facts: { label: string; value: string; title?: string }[] = [];
  const visa = row.visa_type.trim();
  if (visa) {
    facts.push({ label: "Visa", value: visa });
  }
  facts.push({
    label: "Status",
    value: caseStatusLabel(row.case_status.trim()),
  });
  if (reply?.due) {
    facts.push({ label: "Reply by", value: reply.due });
  } else {
    const expiry = formatExpiry(row.expires_at);
    if (expiry.label !== COPY.EMPTY) {
      facts.push({
        label: "Visa expires",
        title: expiry.title,
        value: expiry.label,
      });
    }
  }
  return facts;
}

const SECTIONS: {
  title: string;
  tone?: "case" | "profile";
  fields: [keyof EmployeeRow, string][];
}[] = [
  {
    fields: [
      ["visa_type", "Visa type"],
      ["case_status", "Case status"],
      ["assigned_advisor", "Advisor"],
      ["filed_at", "Date filed"],
      ["granted_at", "Date approved"],
      ["expires_at", "Visa expires"],
      ["last_updated", "Last updated"],
    ],
    title: "Visa",
    tone: "case",
  },
  {
    fields: [
      ["profile_status", "Profile status"],
      ["profile_completion_pct", "Completion"],
    ],
    title: "Profile",
    tone: "profile",
  },
  {
    fields: [["passport_expiry", "Passport expires"]],
    title: "Passport",
  },
  {
    fields: [
      ["full_name", "Name"],
      ["email", "Email"],
      ["nationality", "Nationality"],
      ["employee_id", "Employee ID"],
    ],
    title: "Person",
  },
  {
    fields: [
      ["company", "Company"],
      ["department", "Department"],
      ["job_title", "Job title"],
      ["work_location", "Work location"],
    ],
    title: "Work",
  },
];

function fieldValue(
  row: EmployeeRow,
  key: string
): { text: string; hint?: string } {
  const raw = (row[key] ?? "").trim();
  if (!raw) {
    return { text: COPY.EMPTY };
  }
  if (key === "case_status") {
    const label = caseStatusLabel(raw);
    if (label === raw) {
      return { text: raw };
    }
    return { hint: `Recorded as “${raw}”`, text: label };
  }
  if (key === "expires_at" || key === "passport_expiry") {
    const expiry = formatExpiry(raw);
    if (expiry.title && expiry.label !== raw) {
      return { text: `${expiry.label} (${raw})` };
    }
    return { text: expiry.label };
  }
  if (key === "profile_completion_pct") {
    return { text: `${raw}%` };
  }
  return { text: raw };
}

function FactValue({
  fieldKey,
  value,
}: {
  fieldKey: string;
  value: { text: string; hint?: string };
}) {
  const pct = Number(value.text.replace("%", ""));
  const showMeter =
    fieldKey === "profile_completion_pct" && Number.isFinite(pct);
  let body: ReactNode = value.text;
  if (showMeter) {
    body = (
      <span className="meter">
        <span className="meter-track">
          <span
            className="meter-fill"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </span>
        {value.text}
      </span>
    );
  } else if (fieldKey === "case_status" || fieldKey === "profile_status") {
    body = <span className="status-pill">{value.text}</span>;
  } else if (fieldKey === "email" && value.text !== COPY.EMPTY) {
    body = <a href={`mailto:${value.text}`}>{value.text}</a>;
  }

  return (
    <dd>
      {body}
      {value.hint ? <span className="fact-hint">{value.hint}</span> : null}
    </dd>
  );
}

function CaseWarnings({
  passport,
  warnings,
}: {
  passport: { passport: string; visa: string } | null;
  warnings: string[];
}) {
  if (!(passport || warnings.length > 0)) {
    return null;
  }
  return (
    <div className="case-notices">
      {passport ? (
        <section className="callout callout-warn">
          <h2>Passport expires before the visa</h2>
          <p>
            Passport {passport.passport}. Visa {passport.visa}. Travel can be
            blocked while the visa is still valid.
          </p>
        </section>
      ) : null}
      {warnings.length > 0 ? (
        <section className="callout callout-warn">
          <h2>{COPY.CHECK_THESE}</h2>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function finishAction(nextCaseId?: string) {
  if (nextCaseId) {
    openCase(nextCaseId);
    return;
  }
  openQueue();
}

export function CasePage({ employeeId, rows, loadState }: CasePageProps) {
  const { nextCaseId } = useCaseNav();
  const row = rows.find((candidate) => candidate.employee_id === employeeId);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (loadState === "loading" || !employeeId) {
      return;
    }
    headingRef.current?.focus();
  }, [employeeId, loadState]);

  if (!row) {
    if (loadState === "loading") {
      return (
        <div className="case-panel">
          <p className="subtitle">{COPY.LOADING_CASE}</p>
        </div>
      );
    }
    return (
      <div className="case-panel">
        <h1 ref={headingRef} tabIndex={-1}>
          {loadState === "error" ? COPY.LOAD_FAILED : COPY.CASE_NOT_FOUND}
        </h1>
        {loadState === "ready" ? (
          <p className="subtitle">
            There is no case with id {employeeId}. It may have been removed from
            the export.
          </p>
        ) : null}
      </div>
    );
  }

  const warnings = validateEmployee(row, rows);
  const reply = replyClock(row);
  const passport = passportBeforeVisa(row);
  const plan = buildActionPlan(row);

  return (
    <div className="case-panel">
      <header className="case-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          {row.full_name}
        </h1>
        <p>{[row.job_title, row.company].filter(Boolean).join(" · ")}</p>
        <dl className="key-facts">
          {keyFacts(row, reply).map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd title={fact.title}>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {plan ? (
        <ActionDesk
          key={employeeId}
          nextCaseId={nextCaseId}
          onComplete={finishAction}
          plan={plan}
        />
      ) : null}

      <CaseWarnings passport={passport} warnings={warnings} />

      <section className="record">
        {SECTIONS.map((section) => (
          <div
            className={
              section.tone
                ? `record-card record-card-${section.tone}`
                : "record-card"
            }
            key={section.title}
          >
            <h2>{section.title}</h2>
            <dl className="facts">
              {section.tone === "case" && reply ? (
                <div className="fact">
                  <dt>Reply by</dt>
                  <dd>
                    {reply.due ?? reply.label}
                    <span className="fact-hint">{reply.detail}</span>
                  </dd>
                </div>
              ) : null}
              {section.fields.map(([key, label]) => (
                <div className="fact" key={key}>
                  <dt>{label}</dt>
                  <FactValue fieldKey={key} value={fieldValue(row, key)} />
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>
    </div>
  );
}
