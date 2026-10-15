export const CASE_STATUS = {
  APPROVED: "Approved",
  NOT_FILED: "Not Filed",
  FILED: "Filed",
  IN_REVIEW: "In Review",
  RFE_ISSUED: "RFE Issued",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
} as const;

export const PROFILE_STATUS = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In Progress",
  NOT_STARTED: "Not Started",
} as const;

export const VISA_TYPE = {
  O1A: "O-1A",
} as const;

export const FILTER = {
  ALL: "all",
  BLANK: "__blank__",
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export const OVERVIEW = {
  NEEDING_WORK: "needingWork",
  RFE: "rfe",
  IN_FLIGHT: "inFlight",
  READY_TO_FILE: "readyToFile",
  INCOMPLETE_PROFILES: "incompleteProfiles",
  WARNINGS: "withWarnings",
} as const;

export const COPY = {
  UNKNOWN_COMPANY: "Unknown company",
  BLANK_STATUS: "Blank",
  NO_CASE_STARTED: "No case started",
  EMPTY: "—",
  UNKNOWN: "Unknown",
  NEEDS_ATTENTION: "Needs attention",
  NOTHING_TO_DO: "Nothing to do right now",
  SIGNED_IN: "Signed in as",
  CLOSE: "Close",
  PREVIOUS_CASE: "Previous",
  NEXT_CASE: "Next",
  MOST_URGENT_FIRST: "Most urgent first",
  NOT_IN_LIST: "Not in the current list",
  NO_MATCH: "No cases match these filters.",
  CLEAR_FILTERS: "Clear filters",
  CASE_NOT_FOUND: "We couldn't find that case.",
  CHOOSE_CASE: "Choose a case to view",
  LOADING: "Loading cases…",
  LOADING_CASE: "Loading this case…",
  LOAD_FAILED: "Cases couldn't be loaded. Refresh the page.",
  WHY_LISTED: "Why this case is on your list",
  CHECK_THESE: "Check this record",
  OPEN_CASE: "Open case",
} as const;

export type LoadState = "loading" | "ready" | "error";

/** Plain-language labels for advisors. The raw CSV value is still shown on the case page. */
export const CASE_STATUS_LABEL: Record<string, string> = {
  [CASE_STATUS.APPROVED]: "Approved",
  [CASE_STATUS.NOT_FILED]: "Not submitted yet",
  [CASE_STATUS.FILED]: "Submitted, waiting on a decision",
  [CASE_STATUS.IN_REVIEW]: "Being reviewed",
  [CASE_STATUS.RFE_ISSUED]: "More evidence requested",
  [CASE_STATUS.DENIED]: "Denied",
  [CASE_STATUS.WITHDRAWN]: "Withdrawn",
  "": COPY.NO_CASE_STARTED,
};

/** Days to answer a request for evidence. The export has no notice date, so the clock starts at the last update. */
export const RFE_RESPONSE_DAYS = 87;

export const ACTION = {
  SUBMIT_EVIDENCE: "Submit the evidence",
  FOLLOW_UP_DENIAL: "Follow up on the denial",
  CONFIRM_WITHDRAWN: "Confirm nothing else is owed",
  WAITING_TO_SUBMIT: "Waiting to submit",
  SUBMIT_CASE_DETAIL: "The profile is complete.",
} as const;

export const WARNING = {
  GRANTED_SET: "but an approval date is still filled in",
  EXPIRES_SET: "but an expiry date is still filled in",
  MISSING_FILED:
    "This case is with the government, but no filing date is recorded",
  UNPARSEABLE_FILED: "The filing date couldn't be read",
  FILED_AFTER_UPDATED:
    "The filing date is later than the last update — the dates may be swapped",
  APPROVED_NO_GRANTED: "Marked approved, but no approval date is recorded",
  APPROVED_NO_EXPIRES: "Marked approved, but no expiry date is recorded",
  PERCENT_NOT_NUMERIC: "Profile completion isn't a number",
} as const;

export const IN_FLIGHT_STATUSES = [
  CASE_STATUS.FILED,
  CASE_STATUS.IN_REVIEW,
  CASE_STATUS.RFE_ISSUED,
] as const;

export const CLOSED_WITH_DATES = [
  CASE_STATUS.DENIED,
  CASE_STATUS.WITHDRAWN,
] as const;

export function caseStatusLabel(status: string): string {
  return CASE_STATUS_LABEL[status] ?? status;
}
