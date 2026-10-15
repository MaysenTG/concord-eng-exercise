import {
  CASE_STATUS,
  CLOSED_WITH_DATES,
  IN_FLIGHT_STATUSES,
  WARNING,
} from "./constants";
import { daysBetween, parseCsvDate } from "./dates";
import type { EmployeeRow } from "./priority";

const IN_FLIGHT = new Set<string>(IN_FLIGHT_STATUSES);
const CLOSED_WITH_SUSPICIOUS_DATES = new Set<string>(CLOSED_WITH_DATES);

function warnClosedDates(status: string, row: EmployeeRow): string[] {
  if (!CLOSED_WITH_SUSPICIOUS_DATES.has(status)) {
    return [];
  }
  const warnings: string[] = [];
  if (row.granted_at.trim()) {
    warnings.push(`${status} ${WARNING.GRANTED_SET}`);
  }
  if (row.expires_at.trim()) {
    warnings.push(`${status} ${WARNING.EXPIRES_SET}`);
  }
  return warnings;
}

function warnInFlightFiledAt(status: string, row: EmployeeRow): string[] {
  if (!IN_FLIGHT.has(status)) {
    return [];
  }
  if (!row.filed_at.trim()) {
    return [WARNING.MISSING_FILED];
  }
  const filed = parseCsvDate(row.filed_at);
  if (!filed) {
    return [WARNING.UNPARSEABLE_FILED];
  }
  const updated = parseCsvDate(row.last_updated);
  if (updated && daysBetween(filed, updated) < 0) {
    return [WARNING.FILED_AFTER_UPDATED];
  }
  return [];
}

function warnApproved(status: string, row: EmployeeRow): string[] {
  if (status !== CASE_STATUS.APPROVED) {
    return [];
  }
  const warnings: string[] = [];
  if (!row.granted_at.trim()) {
    warnings.push(WARNING.APPROVED_NO_GRANTED);
  }
  if (!row.expires_at.trim()) {
    warnings.push(WARNING.APPROVED_NO_EXPIRES);
  }
  return warnings;
}

function warnDuplicates(row: EmployeeRow, allRows: EmployeeRow[]): string[] {
  if (allRows.length === 0) {
    return [];
  }
  const duplicates = allRows.filter(
    (other) =>
      other.employee_id !== row.employee_id &&
      other.full_name === row.full_name &&
      other.email === row.email
  );
  if (duplicates.length === 0) {
    return [];
  }
  const ids = duplicates.map((d) => d.employee_id).join(", ");
  return [
    `This looks like the same person as ${ids}. Check you are working the right record.`,
  ];
}

function warnCompletion(row: EmployeeRow): string[] {
  const pctRaw = row.profile_completion_pct.trim();
  if (pctRaw !== "" && !Number.isFinite(Number(pctRaw))) {
    return [WARNING.PERCENT_NOT_NUMERIC];
  }
  return [];
}

/** Per-row data-quality warnings. Blank case status + completed profile is ready to file, not an error. */
export function validateEmployee(
  row: EmployeeRow,
  allRows: EmployeeRow[] = []
): string[] {
  const status = row.case_status.trim();
  return [
    ...warnClosedDates(status, row),
    ...warnInFlightFiledAt(status, row),
    ...warnApproved(status, row),
    ...warnDuplicates(row, allRows),
    ...warnCompletion(row),
  ];
}
