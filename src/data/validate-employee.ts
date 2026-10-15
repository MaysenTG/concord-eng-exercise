import { daysBetween, parseCsvDate } from "./dates";
import type { EmployeeRow } from "./priority";

const IN_FLIGHT = new Set(["Filed", "In Review", "RFE Issued"]);
const TERMINAL_WITH_GRANT_SUSPICION = new Set(["Denied", "Withdrawn"]);

function warnTerminalDates(status: string, row: EmployeeRow): string[] {
  if (!TERMINAL_WITH_GRANT_SUSPICION.has(status)) {
    return [];
  }
  const warnings: string[] = [];
  if (row.granted_at.trim()) {
    warnings.push(`${status} but granted_at is set`);
  }
  if (row.expires_at.trim()) {
    warnings.push(`${status} but expires_at is set`);
  }
  return warnings;
}

function warnInFlightFiledAt(status: string, row: EmployeeRow): string[] {
  if (!IN_FLIGHT.has(status)) {
    return [];
  }
  if (!row.filed_at.trim()) {
    return ["In-flight case missing filed_at"];
  }
  const filed = parseCsvDate(row.filed_at);
  if (!filed) {
    return ["filed_at is unparseable"];
  }
  const updated = parseCsvDate(row.last_updated);
  if (updated && daysBetween(filed, updated) < 0) {
    return ["filed_at is after last_updated"];
  }
  return [];
}

function warnApproved(status: string, row: EmployeeRow): string[] {
  if (status !== "Approved") {
    return [];
  }
  const warnings: string[] = [];
  if (!row.granted_at.trim()) {
    warnings.push("Approved without granted_at");
  }
  if (!row.expires_at.trim()) {
    warnings.push("Approved without expires_at");
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
  return [
    `Duplicate person (also ${duplicates.map((d) => d.employee_id).join(", ")})`,
  ];
}

/** Per-row data-quality warnings. Blank case_status + Completed profile is ready-to-file, not an error. */
export function validateEmployee(
  row: EmployeeRow,
  allRows: EmployeeRow[] = []
): string[] {
  const status = row.case_status.trim();
  const warnings = [
    ...warnTerminalDates(status, row),
    ...warnInFlightFiledAt(status, row),
    ...warnApproved(status, row),
    ...warnDuplicates(row, allRows),
  ];

  const pctRaw = row.profile_completion_pct.trim();
  if (pctRaw !== "" && !Number.isFinite(Number(pctRaw))) {
    warnings.push("profile_completion_pct is not numeric");
  }

  return warnings;
}
