import { daysBetween, parseCsvDate } from "./dates";

export type EmployeeRow = Record<string, string>;

const IN_FLIGHT = new Set(["Filed", "In Review", "RFE Issued"]);

/** Inactive = successfully filed (Approved). Everything else is Active (work to do). */
export function isActive(row: EmployeeRow): boolean {
  return row.case_status !== "Approved";
}

export function isReadyToFile(row: EmployeeRow): boolean {
  const status = row.case_status.trim();
  const preFile = status === "" || status === "Not Filed";
  if (!preFile) {
    return false;
  }
  if (row.profile_status === "Completed") {
    return true;
  }
  const pct = Number(row.profile_completion_pct);
  return Number.isFinite(pct) && pct >= 100;
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

type PriorityResult = {
  score: number;
  reasons: string[];
};

function profileIncompleteBase(row: EmployeeRow): {
  score: number;
  reasons: string[];
} {
  const pct = Number(row.profile_completion_pct);
  const completion = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  // Higher completion = quicker win → 20–45
  const score = 20 + (completion / 100) * 25;
  const reasons = ["incomplete profile"];
  if (completion >= 80) {
    reasons.push("quick win");
  }
  return { score, reasons };
}

function statusBase(row: EmployeeRow): PriorityResult {
  const status = row.case_status.trim();

  switch (status) {
    case "RFE Issued":
      return { score: 80, reasons: ["RFE"] };
    case "In Review":
      return { score: 50, reasons: ["in review"] };
    case "Filed":
      return { score: 40, reasons: ["filed"] };
    case "Denied":
      return { score: 15, reasons: ["denied"] };
    case "Withdrawn":
      return { score: 5, reasons: ["withdrawn"] };
    case "Approved":
      return { score: 0, reasons: [] };
    default: {
      // Not Filed or blank
      if (isReadyToFile(row)) {
        return { score: 60, reasons: ["ready to file"] };
      }
      return profileIncompleteBase(row);
    }
  }
}

export function priorityScore(
  row: EmployeeRow,
  now: Date = new Date()
): PriorityResult {
  const { score: base, reasons } = statusBase(row);
  let score = base;
  const tags = [...reasons];

  const status = row.case_status.trim();
  if (IN_FLIGHT.has(status)) {
    const filed = parseCsvDate(row.filed_at);
    if (filed) {
      const days = daysBetween(filed, now);
      if (days > 0) {
        score += days * 0.5;
        if (days >= 30) {
          tags.push("stale filed");
        }
      }
    }
  }

  if (row.visa_type === "O-1A") {
    score += 25;
    tags.push("O-1A");
  }

  return { score: Math.round(score * 10) / 10, reasons: tags };
}
