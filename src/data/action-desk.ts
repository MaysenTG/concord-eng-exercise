import { CASE_STATUS, VISA_TYPE } from "./constants";
import {
  type EmployeeRow,
  isActive,
  isReadyToFile,
  PRIORITY,
} from "./priority";
import { passportBeforeVisa, type ReplyClock, replyClock } from "./signals";

/**
 * Action desk — the advisor's next move on a case.
 *
 * Add a new kind: extend `ActionKind`, write a builder, call it from `buildActionPlan`.
 * The UI only renders an `ActionPlan`; it does not branch on case status.
 */

export type ActionKind =
  | "submitEvidence"
  | "filePetition"
  | "requestProfile"
  | "followUpDenial"
  | "confirmWithdrawn";

export type ChecklistItem = {
  id: string;
  label: string;
  /** Shown under the label when useful. */
  detail?: string;
  /** Must be ticked before the primary button enables. Default true. */
  required?: boolean;
};

export type ActionPlan = {
  kind: ActionKind;
  title: string;
  detail?: string;
  cta: string;
  urgent: boolean;
  checklist: ChecklistItem[];
  /** Shown after the CTA is pressed, before we open the next case. */
  doneLabel: string;
};

const COPY = {
  doneNext: "Done — opening the next case…",
  doneQueue: "Done — back to your list…",
} as const;

function profilePercent(row: EmployeeRow): number | null {
  const pct = Number(row.profile_completion_pct);
  return Number.isFinite(pct) ? pct : null;
}

function submitEvidence(row: EmployeeRow, reply: ReplyClock): ActionPlan {
  const detail = reply.due ? `${reply.label}. Due ${reply.due}.` : reply.detail;

  return {
    checklist: [
      {
        detail: "Confirm what the government asked for",
        id: "notice",
        label: "RFE notice reviewed",
      },
      {
        detail:
          row.visa_type === VISA_TYPE.O1A
            ? "O-1A — expect expert letters and achievement proof"
            : undefined,
        id: "evidence",
        label: "Supporting evidence gathered",
      },
      { id: "letter", label: "Cover response drafted" },
    ],
    cta: "Mark reply submitted",
    detail,
    doneLabel: COPY.doneNext,
    kind: "submitEvidence",
    title: "Assemble & submit the reply",
    urgent: reply.overdue,
  };
}

function filePetition(row: EmployeeRow): ActionPlan {
  const passport = passportBeforeVisa(row);
  const checklist: ChecklistItem[] = [
    {
      detail: "Nothing left to fill in before filing",
      id: "profile",
      label: "Profile is complete",
    },
    {
      detail: "You cannot edit this after it goes to the government",
      id: "petition",
      label: "Petition packet reviewed",
    },
    {
      detail: passport
        ? `Passport ends ${passport.passport}; visa would run to ${passport.visa}`
        : "Passport expiry is clear of the visa dates",
      id: "passport",
      label: "Passport covers the visa term",
    },
  ];

  if (row.visa_type === VISA_TYPE.O1A) {
    checklist.push({
      detail: "High-complexity petition — double-check before you file",
      id: "o1a",
      label: "O-1A evidence bundle checked",
    });
  }

  return {
    checklist,
    cta: "File petition",
    detail: "Last look before submission. After this, the record is locked.",
    doneLabel: COPY.doneNext,
    kind: "filePetition",
    title: "File the petition",
    urgent: false,
  };
}

function requestProfile(row: EmployeeRow): ActionPlan {
  const pct = profilePercent(row);
  const almostDone = pct !== null && pct >= PRIORITY.profile.quickWinAtPercent;

  const checklist: ChecklistItem[] = [
    { id: "passport", label: "Passport scan" },
    { id: "cv", label: "CV / resume" },
    {
      id: "role",
      label: "Job title and work location confirmed",
      required: !almostDone,
    },
    {
      id: "hr",
      label: "HR contact copied on the request",
      required: false,
    },
  ];

  return {
    checklist,
    cta: "Send request",
    detail:
      pct === null
        ? "Profile still needs information before it can be filed."
        : almostDone
          ? `Almost finished — ${pct}% filled in. A short chase should unblock filing.`
          : `${pct}% filled in. Send a clear ask for what is still missing.`,
    doneLabel: COPY.doneNext,
    kind: "requestProfile",
    title: "Request missing pieces",
    urgent: false,
  };
}

function followUpDenial(): ActionPlan {
  return {
    checklist: [
      { id: "client", label: "Client informed of the decision" },
      { id: "options", label: "Options discussed (appeal / refile / close)" },
      {
        id: "next",
        label: "Next step agreed",
        required: false,
      },
    ],
    cta: "Log follow-up",
    detail: "Confirm the next step with the client — appeal, refile, or close.",
    doneLabel: COPY.doneNext,
    kind: "followUpDenial",
    title: "Follow up on the denial",
    urgent: false,
  };
}

function confirmWithdrawn(): ActionPlan {
  return {
    checklist: [
      { id: "client", label: "Client confirmed the withdrawal" },
      {
        id: "gov",
        label: "No outstanding government reply",
        required: false,
      },
    ],
    cta: "Mark confirmed",
    detail: "Make sure the withdrawal is closed out with the client.",
    doneLabel: COPY.doneNext,
    kind: "confirmWithdrawn",
    title: "Confirm nothing else is owed",
    urgent: false,
  };
}

/**
 * Derive the action desk for a case. Returns null when the advisor has nothing
 * to do (approved, or waiting on the government).
 */
export function buildActionPlan(
  row: EmployeeRow,
  now: Date = new Date()
): ActionPlan | null {
  if (!isActive(row)) {
    return null;
  }

  const reply = replyClock(row, now);
  if (reply) {
    return submitEvidence(row, reply);
  }

  const status = row.case_status.trim();
  if (status === CASE_STATUS.DENIED) {
    return followUpDenial();
  }
  if (status === CASE_STATUS.WITHDRAWN) {
    return confirmWithdrawn();
  }
  if (status === CASE_STATUS.FILED || status === CASE_STATUS.IN_REVIEW) {
    return null;
  }
  if (isReadyToFile(row)) {
    return filePetition(row);
  }
  if (status === "" || status === CASE_STATUS.NOT_FILED) {
    return requestProfile(row);
  }

  return null;
}

export function doneLabelFor(plan: ActionPlan, hasNext: boolean): string {
  return hasNext ? plan.doneLabel : COPY.doneQueue;
}
