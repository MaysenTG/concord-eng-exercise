import {
  Fragment,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
} from "react";
import {
  CASE_STATUS,
  COPY,
  caseStatusLabel,
  FILTER,
  IN_FLIGHT_STATUSES,
  type LoadState,
  OVERVIEW,
  PROFILE_STATUS,
} from "../data/constants";
import { formatExpiry } from "../data/dates";
import {
  comparePriority,
  type EmployeeRow,
  isActive,
  isReadyToFile,
  priorityScore,
  uniqueAdvisors,
  uniqueCaseStatuses,
  uniqueCompanies,
} from "../data/priority";
import { passportBeforeVisa, replyClock } from "../data/signals";
import { validateEmployee } from "../data/validate-employee";
import { casePath, openCase, openQueue } from "../router";

export type OverviewKey = (typeof OVERVIEW)[keyof typeof OVERVIEW];

export type QueueFilters = {
  advisor: string;
  company: string;
  caseStatus: string;
  overview: OverviewKey | null;
};

const OVERVIEW_CARDS: { key: OverviewKey; label: string; hint: string }[] = [
  {
    key: OVERVIEW.NEEDING_WORK,
    label: "Needs your attention",
    hint: "Anything that is not already approved",
  },
  {
    key: OVERVIEW.RFE,
    label: "More evidence requested",
    hint: "The government asked for something else",
  },
  {
    key: OVERVIEW.IN_FLIGHT,
    label: "With the government",
    hint: "Submitted, in review, or waiting on evidence",
  },
  {
    key: OVERVIEW.READY_TO_FILE,
    label: "Ready to submit",
    hint: "Profile is finished and the case is not filed yet",
  },
  {
    key: OVERVIEW.INCOMPLETE_PROFILES,
    label: "Profile not finished",
    hint: "Still missing information before it can be filed",
  },
  {
    key: OVERVIEW.WARNINGS,
    label: "Records to double-check",
    hint: "Dates or details that don't line up",
  },
];

const IN_FLIGHT = new Set<string>(IN_FLIGHT_STATUSES);

type QueuePageProps = {
  rows: EmployeeRow[];
  sessionAdvisor: string;
  filters: QueueFilters;
  onChange: (next: QueueFilters) => void;
  loadState: LoadState;
  selectedId?: string;
  detail?: ReactNode;
};

function matchesAdvisor(row: EmployeeRow, advisor: string): boolean {
  if (advisor === FILTER.ALL || advisor === "") {
    return true;
  }
  return row.assigned_advisor === advisor;
}

function matchesCompany(row: EmployeeRow, company: string): boolean {
  if (company === FILTER.ALL || company === "") {
    return true;
  }
  return row.company === company;
}

function matchesCaseStatus(row: EmployeeRow, caseStatus: string): boolean {
  if (caseStatus === FILTER.ALL) {
    return true;
  }
  if (caseStatus === FILTER.BLANK) {
    return row.case_status === "";
  }
  return row.case_status === caseStatus;
}

function matchesOverview(
  row: EmployeeRow,
  key: OverviewKey,
  allRows: EmployeeRow[]
): boolean {
  const status = row.case_status.trim();
  switch (key) {
    case OVERVIEW.NEEDING_WORK:
      return isActive(row);
    case OVERVIEW.RFE:
      return status === CASE_STATUS.RFE_ISSUED;
    case OVERVIEW.IN_FLIGHT:
      return IN_FLIGHT.has(status);
    case OVERVIEW.READY_TO_FILE:
      return isReadyToFile(row);
    case OVERVIEW.INCOMPLETE_PROFILES:
      return row.profile_status !== PROFILE_STATUS.COMPLETED;
    case OVERVIEW.WARNINGS:
      return validateEmployee(row, allRows).length > 0;
    default:
      return true;
  }
}

function countOverview(baseRows: EmployeeRow[], allRows: EmployeeRow[]) {
  const counts = {
    [OVERVIEW.NEEDING_WORK]: 0,
    [OVERVIEW.RFE]: 0,
    [OVERVIEW.IN_FLIGHT]: 0,
    [OVERVIEW.READY_TO_FILE]: 0,
    [OVERVIEW.INCOMPLETE_PROFILES]: 0,
    [OVERVIEW.WARNINGS]: 0,
  };
  for (const row of baseRows) {
    for (const card of OVERVIEW_CARDS) {
      if (matchesOverview(row, card.key, allRows)) {
        counts[card.key] += 1;
      }
    }
  }
  return counts;
}

type RankedCase = {
  row: EmployeeRow;
  reasons: string[];
  warnings: string[];
  score: number;
};

function openCaseFromClick(
  event: MouseEvent<HTMLAnchorElement>,
  employeeId: string
) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  openCase(employeeId);
}

function caseSummary(item: RankedCase): string {
  const active = isActive(item.row);
  return (
    item.reasons[0] ?? (active ? COPY.NEEDS_ATTENTION : COPY.NOTHING_TO_DO)
  );
}

function neighbors(ranked: RankedCase[], selectedId?: string) {
  const index = ranked.findIndex((item) => item.row.employee_id === selectedId);
  if (index < 0) {
    return null;
  }
  return {
    place: index + 1,
    total: ranked.length,
    previousId: ranked[index - 1]?.row.employee_id,
    nextId: ranked[index + 1]?.row.employee_id,
  };
}

function queueSummary(
  loadState: LoadState,
  sessionAdvisor: string,
  visibleCount: number,
  attentionCount: number,
  overview: OverviewKey | null
): string {
  if (loadState === "loading") {
    return COPY.LOADING;
  }
  if (loadState === "error") {
    return COPY.LOAD_FAILED;
  }
  const signedIn = `${COPY.SIGNED_IN} ${sessionAdvisor}`;
  if (overview) {
    const noun = visibleCount === 1 ? "case" : "cases";
    return `${signedIn} · ${visibleCount} ${noun}`;
  }
  const noun =
    attentionCount === 1 ? "case needs attention" : "cases need attention";
  return `${signedIn} · ${attentionCount} ${noun}`;
}

function filtersAreNarrowed(
  filters: QueueFilters,
  sessionAdvisor: string
): boolean {
  return !(
    filters.advisor === (sessionAdvisor || filters.advisor) &&
    filters.company === FILTER.ALL &&
    filters.caseStatus === FILTER.ALL &&
    !filters.overview
  );
}

function clearedFilters(sessionAdvisor: string): QueueFilters {
  return {
    advisor: sessionAdvisor || FILTER.ALL,
    company: FILTER.ALL,
    caseStatus: FILTER.ALL,
    overview: null,
  };
}

function PersonRow({
  item,
  selected,
}: {
  item: RankedCase;
  selected: boolean;
}) {
  const { row, warnings } = item;
  const active = isActive(row);
  const reply = replyClock(row);
  const passport = passportBeforeVisa(row);
  const expiry = formatExpiry(row.expires_at);
  const className = [
    "person",
    selected ? "person-selected" : "",
    active ? "" : "person-quiet",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <a
      aria-current={selected ? "page" : undefined}
      className={className}
      href={casePath(row.employee_id)}
      onClick={(event) => openCaseFromClick(event, row.employee_id)}
    >
      <span className="person-main">
        <span className="case-name">{row.full_name}</span>
        <span className="case-meta">
          {row.company || COPY.UNKNOWN_COMPANY}
          {row.job_title ? ` · ${row.job_title}` : ""}
          {row.visa_type ? ` · ${row.visa_type}` : ""}
        </span>
        <span className="case-summary">{caseSummary(item)}</span>
      </span>
      <span className="person-side">
        {reply ? (
          <span className={reply.overdue ? "reply-overdue" : undefined}>
            {reply.label}
          </span>
        ) : expiry.label === COPY.EMPTY ? null : (
          <span className="expiry-note" title={expiry.title}>
            <span>Visa expires</span>
            <span>{expiry.label}</span>
          </span>
        )}
        {passport ? (
          <span
            className="warning-badge"
            title={`Passport ${passport.passport} · visa ${passport.visa}`}
          >
            Passport first
          </span>
        ) : null}
        {warnings.length > 0 ? (
          <span className="warning-badge" title={warnings.join("\n")}>
            Check
          </span>
        ) : null}
      </span>
    </a>
  );
}

function placeLabel(
  loadState: LoadState,
  place: ReturnType<typeof neighbors>,
  selectedId?: string
): string {
  if (loadState !== "ready") {
    return "";
  }
  if (place) {
    return `${place.place} of ${place.total}`;
  }
  return selectedId ? COPY.NOT_IN_LIST : "";
}

function openNeighbor(employeeId?: string) {
  if (employeeId) {
    openCase(employeeId);
  }
}

function CasePane({
  detail,
  loadState,
  place,
  selectedId,
}: {
  detail?: ReactNode;
  loadState: LoadState;
  place: ReturnType<typeof neighbors>;
  selectedId?: string;
}) {
  if (!detail) {
    return (
      <div className="case-pane case-pane-empty">
        <p>{COPY.CHOOSE_CASE}</p>
      </div>
    );
  }

  return (
    <div className="case-pane">
      <div className="case-toolbar">
        <button className="close-button" onClick={openQueue} type="button">
          {COPY.CLOSE}
        </button>
        <div className="case-toolbar-actions">
          <p>{placeLabel(loadState, place, selectedId)}</p>
          <button
            className="case-nav"
            disabled={!place?.previousId}
            onClick={() => openNeighbor(place?.previousId)}
            title="Previous case in this list"
            type="button"
          >
            {COPY.PREVIOUS_CASE}
          </button>
          <button
            className="case-nav"
            disabled={!place?.nextId}
            onClick={() => openNeighbor(place?.nextId)}
            title="Next case in this list"
            type="button"
          >
            {COPY.NEXT_CASE}
          </button>
        </div>
      </div>
      {detail}
    </div>
  );
}

function CaseList({
  ranked,
  selectedId,
}: {
  ranked: RankedCase[];
  selectedId?: string;
}) {
  return (
    <>
      <p className="list-order">{COPY.MOST_URGENT_FIRST}</p>
      {ranked.map((item, index) => {
        const quietStart =
          !isActive(item.row) &&
          (index === 0 || isActive(ranked[index - 1].row));
        return (
          <Fragment key={item.row.employee_id}>
            {quietStart ? (
              <p className="list-divider">{COPY.NOTHING_TO_DO}</p>
            ) : null}
            <PersonRow
              item={item}
              selected={item.row.employee_id === selectedId}
            />
          </Fragment>
        );
      })}
    </>
  );
}

export function QueuePage({
  rows,
  sessionAdvisor,
  filters,
  onChange,
  loadState,
  selectedId,
  detail,
}: QueuePageProps) {
  const advisors = useMemo(() => uniqueAdvisors(rows), [rows]);
  const companies = useMemo(() => uniqueCompanies(rows), [rows]);
  const caseStatuses = useMemo(() => uniqueCaseStatuses(rows), [rows]);

  const baseFiltered = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesAdvisor(row, filters.advisor) &&
          matchesCompany(row, filters.company) &&
          matchesCaseStatus(row, filters.caseStatus)
      ),
    [rows, filters]
  );

  const overview = useMemo(
    () => countOverview(baseFiltered, rows),
    [baseFiltered, rows]
  );

  useEffect(() => {
    if (filters.overview && overview[filters.overview] === 0) {
      onChange({ ...filters, overview: null });
    }
  }, [filters, onChange, overview]);

  const visible = useMemo(() => {
    if (!filters.overview) {
      return baseFiltered;
    }
    return baseFiltered.filter((row) =>
      matchesOverview(row, filters.overview as OverviewKey, rows)
    );
  }, [baseFiltered, filters.overview, rows]);

  const ranked = useMemo(
    () =>
      visible
        .map((row) => {
          const priority = priorityScore(row);
          return {
            row,
            reasons: priority.reasons,
            warnings: validateEmployee(row, rows),
            score: priority.score,
          };
        })
        .sort(comparePriority),
    [rows, visible]
  );

  const place = neighbors(ranked, selectedId);
  const pageClass = detail ? "page has-case" : "page";
  const narrowed = filtersAreNarrowed(filters, sessionAdvisor);

  useEffect(() => {
    if (!detail) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest("select, input, textarea")
      ) {
        return;
      }
      openQueue();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  useEffect(() => {
    if (!selectedId || ranked.length === 0) {
      return;
    }
    document.querySelector(".case-pane")?.scrollTo(0, 0);
    document
      .querySelector(".person-selected")
      ?.scrollIntoView({ block: "nearest" });
  }, [ranked.length, selectedId]);

  return (
    <div className={pageClass}>
      <header className="toolbar">
        <div className="toolbar-title">
          <h1>Your cases</h1>
          <p>
            {queueSummary(
              loadState,
              sessionAdvisor,
              visible.length,
              overview[OVERVIEW.NEEDING_WORK],
              filters.overview
            )}
          </p>
        </div>

        {loadState === "ready" ? (
          <>
            <div className="chips">
              <button
                className={filters.overview ? "chip" : "chip chip-selected"}
                onClick={() => onChange({ ...filters, overview: null })}
                title="Every case in this list"
                type="button"
              >
                All <span>{baseFiltered.length}</span>
              </button>
              {OVERVIEW_CARDS.map(({ key, label, hint }) => {
                const count = overview[key];
                const selected = filters.overview === key;
                return (
                  <button
                    className={selected ? "chip chip-selected" : "chip"}
                    disabled={count === 0}
                    key={key}
                    onClick={() =>
                      onChange({
                        ...filters,
                        overview: selected ? null : key,
                      })
                    }
                    title={hint}
                    type="button"
                  >
                    {label} <span>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="filters">
              <label className="filter">
                <span>Advisor</span>
                <select
                  onChange={(event) =>
                    onChange({ ...filters, advisor: event.target.value })
                  }
                  value={filters.advisor}
                >
                  <option value={FILTER.ALL}>Everyone</option>
                  {advisors.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter">
                <span>Company</span>
                <select
                  onChange={(event) =>
                    onChange({ ...filters, company: event.target.value })
                  }
                  value={filters.company}
                >
                  <option value={FILTER.ALL}>All companies</option>
                  {companies.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter">
                <span>Status</span>
                <select
                  onChange={(event) =>
                    onChange({ ...filters, caseStatus: event.target.value })
                  }
                  value={filters.caseStatus}
                >
                  <option value={FILTER.ALL}>Any status</option>
                  {caseStatuses.map((status) => (
                    <option
                      key={status === "" ? FILTER.BLANK : status}
                      value={status === "" ? FILTER.BLANK : status}
                    >
                      {status === ""
                        ? COPY.BLANK_STATUS
                        : caseStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : null}
      </header>

      <div className="workspace">
        <div className="list-pane">
          {loadState === "loading" ? (
            <p className="subtitle list-status">{COPY.LOADING}</p>
          ) : loadState === "error" ? (
            <p className="empty">{COPY.LOAD_FAILED}</p>
          ) : ranked.length === 0 ? (
            <div className="empty">
              {COPY.NO_MATCH}
              {narrowed ? (
                <button
                  className="link-button"
                  onClick={() => onChange(clearedFilters(sessionAdvisor))}
                  type="button"
                >
                  {COPY.CLEAR_FILTERS}
                </button>
              ) : null}
            </div>
          ) : (
            <CaseList ranked={ranked} selectedId={selectedId} />
          )}
        </div>
        <CasePane
          detail={detail}
          loadState={loadState}
          place={place}
          selectedId={selectedId}
        />
      </div>
    </div>
  );
}
