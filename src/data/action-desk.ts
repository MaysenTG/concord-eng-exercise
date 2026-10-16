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
 *
 * CTAs are framed as outbound sends (government, beneficiary, client). In this
 * exercise they do not call an API — see `demoNote` / `doneLabel`.
 */

export type ActionKind =
  | "submitEvidence"
  | "filePetition"
  | "requestProfile"
  | "followUpDenial"
  | "confirmWithdrawn";

/** Who the primary button would reach in a real product. */
export type ActionDestination = "government" | "beneficiary" | "client";

export type ChecklistItem = {
  id: string;
  label: string;
  /** Shown under the label when useful. */
  detail?: string;
  /** Must be ticked before the primary button enables. Default true. */
  required?: boolean;
};

/**
 * Dummy file upload shown on evidence workflows.
 * The UI never accepts a real file — see ActionDesk.
 */
export type ActionUpload = {
  /** Primary label on the dropzone. */
  label: string;
  /** Explains what would be uploaded in a real product. */
  hint: string;
  /** Shown as the fake selected filename after the demo attach step. */
  demoFileName: string;
};

export type ActionPlan = {
  kind: ActionKind;
  title: string;
  detail?: string;
  /** Outbound-sounding button label, e.g. "Submit reply to the government". */
  cta: string;
  destination: ActionDestination;
  urgent: boolean;
  checklist: ChecklistItem[];
  /** When set, the desk shows a file-upload step instead of (or before) a checklist. */
  upload?: ActionUpload;
  /** Short line under the CTA while armed — demo does not send. */
  demoNote: string;
  /** Shown after the CTA is pressed, before we open the next case. */
  doneLabel: string;
};

const DEMO = {
  government:
    "Demo only — this would submit to the government. Nothing is sent here.",
  beneficiary:
    "Demo only — this would email the employee. Nothing is sent here.",
  client: "Demo only — this would notify the client. Nothing is sent here.",
  doneGovNext:
    "Would have submitted to the government — nothing sent. Opening next case…",
  doneGovQueue:
    "Would have submitted to the government — nothing sent. Back to your list…",
  doneBeneficiaryNext:
    "Would have sent the request — nothing sent. Opening next case…",
  doneBeneficiaryQueue:
    "Would have sent the request — nothing sent. Back to your list…",
  doneClientNext:
    "Would have notified the client — nothing sent. Opening next case…",
  doneClientQueue:
    "Would have notified the client — nothing sent. Back to your list…",
} as const;

function profilePercent(row: EmployeeRow): number | null {
  const pct = Number(row.profile_completion_pct);
  return Number.isFinite(pct) ? pct : null;
}

function submitEvidence(row: EmployeeRow, reply: ReplyClock): ActionPlan {
  const dueLine = reply.due
    ? `${reply.label}. Due ${reply.due}.`
    : reply.detail;
  const o1aHint =
    row.visa_type === VISA_TYPE.O1A
      ? " O-1A replies usually include expert letters and achievement proof."
      : "";

  return {
    checklist: [],
    cta: "Resubmit case to the government",
    demoNote:
      "Demo only — nothing is uploaded or submitted to the government.",
    destination: "government",
    detail: `${dueLine} Attach the supporting evidence below, then resubmit the case.${o1aHint}`,
    doneLabel: DEMO.doneGovNext,
    kind: "submitEvidence",
    title: "Upload evidence & resubmit",
    upload: {
      demoFileName: "rfe-evidence-pack.pdf",
      hint: "In a real product you'd choose the RFE response packet here. This exercise only attaches a placeholder — no files leave your machine.",
      label: "Evidence for the RFE reply",
    },
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
    cta: "Submit petition to the government",
    demoNote: DEMO.government,
    destination: "government",
    detail:
      "Last look before it leaves Concord. In production this would file with the government and lock the record.",
    doneLabel: DEMO.doneGovNext,
    kind: "filePetition",
    title: "File the petition",
    urgent: false,
  };
}

function requestProfile(row: EmployeeRow): ActionPlan {
  const pct = profilePercent(row);
  const almostDone = pct !== null && pct >= PRIORITY.profile.quickWinAtPercent;
  const name = row.full_name.trim() || "the employee";

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
    cta: `Send request to ${name}`,
    demoNote: DEMO.beneficiary,
    destination: "beneficiary",
    detail:
      pct === null
        ? "Profile still needs information before it can be filed."
        : almostDone
          ? `Almost finished — ${pct}% filled in. A short chase should unblock filing.`
          : `${pct}% filled in. Send a clear ask for what is still missing.`,
    doneLabel: DEMO.doneBeneficiaryNext,
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
    cta: "Send follow-up to the client",
    demoNote: DEMO.client,
    destination: "client",
    detail: "Confirm the next step with the client — appeal, refile, or close.",
    doneLabel: DEMO.doneClientNext,
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
    cta: "Send confirmation to the client",
    demoNote: DEMO.client,
    destination: "client",
    detail: "Make sure the withdrawal is closed out with the client.",
    doneLabel: DEMO.doneClientNext,
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
  if (hasNext) {
    return plan.doneLabel;
  }
  if (plan.destination === "government") {
    return DEMO.doneGovQueue;
  }
  if (plan.destination === "beneficiary") {
    return DEMO.doneBeneficiaryQueue;
  }
  return DEMO.doneClientQueue;
}
