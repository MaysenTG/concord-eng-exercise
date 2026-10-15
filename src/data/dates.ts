const CSV_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Parse DD/MM/YYYY (CSV format). Returns null if missing or invalid. */
export function parseCsvDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = CSV_DATE.exec(trimmed);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Whole days from `from` to `to` (can be negative if from is after to). */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((toUtc - fromUtc) / msPerDay);
}

const THREE_MONTHS_DAYS = 90;

/**
 * Expiry display: exact date if within 3 months (or past);
 * otherwise relative ("in 6 months", "in 1 year").
 */
export function formatExpiry(
  value: string,
  now: Date = new Date()
): { label: string; title?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { label: "—" };
  }

  const expiry = parseCsvDate(trimmed);
  if (!expiry) {
    return { label: trimmed };
  }

  const days = daysBetween(now, expiry);

  if (days < 0) {
    return { label: "Expired", title: trimmed };
  }

  if (days < THREE_MONTHS_DAYS) {
    return { label: trimmed };
  }

  const months = Math.max(1, Math.round(days / 30.44));
  if (months >= 12) {
    const years = Math.round(months / 12);
    return {
      label: years === 1 ? "in 1 year" : `in ${years} years`,
      title: trimmed,
    };
  }

  return {
    label: months === 1 ? "in 1 month" : `in ${months} months`,
    title: trimmed,
  };
}
