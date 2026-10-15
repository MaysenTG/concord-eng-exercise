import { CASE_STATUS, RFE_RESPONSE_DAYS } from "./constants";
import { daysBetween, parseCsvDate } from "./dates";
import type { EmployeeRow } from "./priority";

export type ReplyClock = {
  label: string;
  due: string | null;
  detail: string;
  overdue: boolean;
};

function formatCsvDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function replyLabel(daysLeft: number): string {
  if (daysLeft < 0) {
    const overdue = -daysLeft;
    return overdue === 1
      ? "Reply overdue by 1 day"
      : `Reply overdue by ${overdue} days`;
  }
  if (daysLeft === 0) {
    return "Reply today";
  }
  return daysLeft === 1 ? "Reply in 1 day" : `Reply in ${daysLeft} days`;
}

/** Evidence-request reply window. Null when the case is not waiting on evidence. */
export function replyClock(
  row: EmployeeRow,
  now: Date = new Date()
): ReplyClock | null {
  if (row.case_status.trim() !== CASE_STATUS.RFE_ISSUED) {
    return null;
  }

  const anchor = parseCsvDate(row.last_updated) ?? parseCsvDate(row.filed_at);
  if (!anchor) {
    return {
      label: "Reply date unknown",
      due: null,
      detail: "There is no date on file to count the reply window from.",
      overdue: true,
    };
  }

  const due = addDays(anchor, RFE_RESPONSE_DAYS);
  const daysLeft = daysBetween(now, due);
  return {
    label: replyLabel(daysLeft),
    due: formatCsvDate(due),
    detail: `Counted as ${RFE_RESPONSE_DAYS} days from the last update. The export has no notice date.`,
    overdue: daysLeft < 0,
  };
}

export type PassportGap = {
  passport: string;
  visa: string;
};

/** Passport runs out while the visa would still be valid. */
export function passportBeforeVisa(row: EmployeeRow): PassportGap | null {
  const passport = parseCsvDate(row.passport_expiry);
  const visa = parseCsvDate(row.expires_at);
  if (!(passport && visa) || daysBetween(passport, visa) <= 0) {
    return null;
  }
  return {
    passport: row.passport_expiry.trim(),
    visa: row.expires_at.trim(),
  };
}
