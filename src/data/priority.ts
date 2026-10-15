import {
  CASE_STATUS,
  PROFILE_STATUS,
  RFE_RESPONSE_DAYS,
  VISA_TYPE,
} from "./constants";
import { daysBetween, parseCsvDate } from "./dates";

export type EmployeeRow = Record<string, string>;

export type PriorityPart = {
  score: number;
  reasons: string[];
};

/**
 * Queue order. Edit `order` — the first group is the top of the queue.
 *
 * A case stays in its group. Completion, how long a case has been waiting,
 * and O-1A only reorder cases inside that group.
 *
 * Inside a group, higher is more urgent:
 * - rfe: days the reply is overdue. No date sorts with a reply due today.
 * - readyToFile: O-1A first
 * - denied: days since the last update
 * - profile: completion percent. 0% is last.
 * - withdrawn: O-1A first
 * - waiting: days since the case was filed
 * - approved: no order
 *
 * O-1A adds `visa.o1aTie`, which is smaller than one day or one percent.
 */
const QUEUE_ORDER = [
  "rfe",
  "readyToFile",
  "denied",
  "profile",
  "withdrawn",
  "waiting",
  "approved",
] as const;

type QueueGroup = (typeof QUEUE_ORDER)[number];

/** Days of within-group urgency cannot cross into the next group. */
const WITHIN_LIMIT = 10_000;
const GROUP_GAP = WITHIN_LIMIT * 2 + 1;

export const PRIORITY = {
  order: QUEUE_ORDER,
  band: {
    action: 2,
    waiting: 1,
    approved: 0,
  },
  profile: {
    readyReason: "The profile is complete and ready to submit",
    incompleteReason: "The profile still needs information",
    quickWinAtPercent: 80,
    quickWinReason: "Almost finished — a short task",
    fullPercent: 100,
  },
  rfe: {
    reason: "The government asked for more evidence",
  },
  denied: {
    reason: "Denied — needs a follow-up",
  },
  withdrawn: {
    reason: "Withdrawn — confirm nothing else is owed",
  },
  waiting: {
    staleAfterDays: 30,
    filedReason: "Submitted and still waiting",
    inReviewReason: "The government is reviewing this case",
    staleReason: "It has been waiting a long time since it was submitted",
  },
  visa: {
    o1aTie: 0.1,
  },
} as const;

/** Inactive = successfully filed (Approved). Everything else needs attention. */
export function isActive(row: EmployeeRow): boolean {
  return row.case_status !== CASE_STATUS.APPROVED;
}

/** The advisor still has a task. Filed and in review are waiting on the government. */
export function needsAdvisorAction(row: EmployeeRow): boolean {
  if (!isActive(row)) {
    return false;
  }
  const status = row.case_status.trim();
  return status !== CASE_STATUS.FILED && status !== CASE_STATUS.IN_REVIEW;
}

function attentionRank(row: EmployeeRow): number {
  if (needsAdvisorAction(row)) {
    return PRIORITY.band.action;
  }
  if (isActive(row)) {
    return PRIORITY.band.waiting;
  }
  return PRIORITY.band.approved;
}

/** Group order first. Score only breaks ties inside a group. */
export function comparePriority(
  a: { row: EmployeeRow; score: number },
  b: { row: EmployeeRow; score: number }
): number {
  const rank = attentionRank(b.row) - attentionRank(a.row);
  if (rank !== 0) {
    return rank;
  }
  return b.score - a.score;
}

export function isReadyToFile(row: EmployeeRow): boolean {
  const status = row.case_status.trim();
  const preFile = status === "" || status === CASE_STATUS.NOT_FILED;
  if (!preFile) {
    return false;
  }
  if (row.profile_status === PROFILE_STATUS.COMPLETED) {
    return true;
  }
  const pct = Number(row.profile_completion_pct);
  return Number.isFinite(pct) && pct >= PRIORITY.profile.fullPercent;
}

export function defaultAdvisor(rows: EmployeeRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const advisor = row.assigned_advisor.trim();
    if (!advisor) {
      continue;
    }
    counts.set(advisor, (counts.get(advisor) ?? 0) + 1);
  }

  let best = "";
  let bestCount = -1;
  for (const [advisor, count] of counts) {
    if (count > bestCount) {
      best = advisor;
      bestCount = count;
    }
  }
  return best;
}

export function uniqueAdvisors(rows: EmployeeRow[]): string[] {
  return [
    ...new Set(rows.map((r) => r.assigned_advisor.trim()).filter(Boolean)),
  ].sort();
}

export function uniqueCompanies(rows: EmployeeRow[]): string[] {
  return [...new Set(rows.map((r) => r.company.trim()).filter(Boolean))].sort();
}

export function uniqueCaseStatuses(rows: EmployeeRow[]): string[] {
  const set = new Set(rows.map((r) => r.case_status));
  return [...set].sort((a, b) => {
    if (a === "") {
      return 1;
    }
    if (b === "") {
      return -1;
    }
    return a.localeCompare(b);
  });
}

function completionPercent(row: EmployeeRow): number {
  const pct = Number(row.profile_completion_pct);
  if (!Number.isFinite(pct)) {
    return 0;
  }
  return Math.min(PRIORITY.profile.fullPercent, Math.max(0, pct));
}

function daysSince(value: string, now: Date): number | null {
  const date = parseCsvDate(value);
  if (!date) {
    return null;
  }
  return daysBetween(date, now);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function queueGroup(row: EmployeeRow): QueueGroup {
  const status = row.case_status.trim();
  if (status === CASE_STATUS.RFE_ISSUED) {
    return "rfe";
  }
  if (status === CASE_STATUS.DENIED) {
    return "denied";
  }
  if (status === CASE_STATUS.WITHDRAWN) {
    return "withdrawn";
  }
  if (status === CASE_STATUS.FILED || status === CASE_STATUS.IN_REVIEW) {
    return "waiting";
  }
  if (status === CASE_STATUS.APPROVED) {
    return "approved";
  }
  if (isReadyToFile(row)) {
    return "readyToFile";
  }
  return "profile";
}

/** Days the evidence reply is overdue. Positive is late. No date counts as due today. */
function replyUrgency(row: EmployeeRow, now: Date): number {
  const anchor = parseCsvDate(row.last_updated) ?? parseCsvDate(row.filed_at);
  if (!anchor) {
    return 0;
  }
  const due = addDays(anchor, RFE_RESPONSE_DAYS);
  return -daysBetween(now, due);
}

function withinGroup(row: EmployeeRow, group: QueueGroup, now: Date): number {
  if (group === "rfe") {
    return replyUrgency(row, now);
  }
  if (group === "denied") {
    return (
      daysSince(row.last_updated, now) ?? daysSince(row.filed_at, now) ?? 0
    );
  }
  if (group === "profile") {
    return completionPercent(row);
  }
  if (group === "waiting") {
    const days = daysSince(row.filed_at, now);
    if (days === null || days <= 0) {
      return 0;
    }
    return days;
  }
  return 0;
}

function groupScore(
  group: QueueGroup,
  within: number,
  row: EmployeeRow
): number {
  const tie =
    group !== "approved" && row.visa_type === VISA_TYPE.O1A
      ? PRIORITY.visa.o1aTie
      : 0;
  const bounded = Math.max(-WITHIN_LIMIT, Math.min(WITHIN_LIMIT, within + tie));
  const rank = PRIORITY.order.length - PRIORITY.order.indexOf(group);
  return rank * GROUP_GAP + bounded;
}

function reasonsFor(row: EmployeeRow, group: QueueGroup, now: Date): string[] {
  if (group === "rfe") {
    return [PRIORITY.rfe.reason];
  }
  if (group === "readyToFile") {
    return [PRIORITY.profile.readyReason];
  }
  if (group === "denied") {
    return [PRIORITY.denied.reason];
  }
  if (group === "withdrawn") {
    return [PRIORITY.withdrawn.reason];
  }
  if (group === "profile") {
    const reasons: string[] = [PRIORITY.profile.incompleteReason];
    if (completionPercent(row) >= PRIORITY.profile.quickWinAtPercent) {
      reasons.push(PRIORITY.profile.quickWinReason);
    }
    return reasons;
  }
  if (group === "waiting") {
    const reason =
      row.case_status.trim() === CASE_STATUS.IN_REVIEW
        ? PRIORITY.waiting.inReviewReason
        : PRIORITY.waiting.filedReason;
    const days = daysSince(row.filed_at, now);
    if (days !== null && days >= PRIORITY.waiting.staleAfterDays) {
      return [reason, PRIORITY.waiting.staleReason];
    }
    return [reason];
  }
  return [];
}

export function priorityScore(
  row: EmployeeRow,
  now: Date = new Date()
): PriorityPart {
  const group = queueGroup(row);
  const score = groupScore(group, withinGroup(row, group, now), row);
  return {
    score: Math.round(score * 10) / 10,
    reasons: reasonsFor(row, group, now),
  };
}
