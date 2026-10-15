import { Fragment, useEffect, useMemo, useState } from "react";
import { Card } from "./components/card";
import { formatExpiry } from "./data/dates";
import { loadEmployees } from "./data/load-employees";
import {
  defaultAdvisor,
  type EmployeeRow,
  isActive,
  isReadyToFile,
  priorityScore,
  uniqueAdvisors,
  uniqueCaseStatuses,
  uniqueCompanies,
} from "./data/priority";
import { validateEmployee } from "./data/validate-employee";

type ActiveFilter = "all" | "active" | "inactive";

type OverviewKey =
  | "needingWork"
  | "rfe"
  | "inFlight"
  | "readyToFile"
  | "incompleteProfiles"
  | "withWarnings";

const OVERVIEW_CARDS: { key: OverviewKey; label: string }[] = [
  { key: "needingWork", label: "Needing work" },
  { key: "rfe", label: "Requiring evidence (RFE)" },
  { key: "inFlight", label: "In flight with gov" },
  { key: "readyToFile", label: "Ready to file" },
  { key: "incompleteProfiles", label: "Incomplete profiles" },
  { key: "withWarnings", label: "Data warnings" },
];

function matchesAdvisor(row: EmployeeRow, advisorFilter: string): boolean {
  if (advisorFilter === "all" || advisorFilter === "") {
    return true;
  }
  return row.assigned_advisor === advisorFilter;
}

function matchesCompany(row: EmployeeRow, companyFilter: string): boolean {
  if (companyFilter === "all" || companyFilter === "") {
    return true;
  }
  return row.company === companyFilter;
}

function matchesCaseStatus(
  row: EmployeeRow,
  caseStatusFilter: string
): boolean {
  if (caseStatusFilter === "all") {
    return true;
  }
  if (caseStatusFilter === "__blank__") {
    return row.case_status === "";
  }
  return row.case_status === caseStatusFilter;
}

function matchesActive(row: EmployeeRow, activeFilter: ActiveFilter): boolean {
  if (activeFilter === "all") {
    return true;
  }
  if (activeFilter === "active") {
    return isActive(row);
  }
  return !isActive(row);
}

function matchesOverview(
  row: EmployeeRow,
  key: OverviewKey,
  allRows: EmployeeRow[]
): boolean {
  const status = row.case_status.trim();
  switch (key) {
    case "needingWork":
      return isActive(row);
    case "rfe":
      return status === "RFE Issued";
    case "inFlight":
      return (
        status === "Filed" || status === "In Review" || status === "RFE Issued"
      );
    case "readyToFile":
      return isReadyToFile(row);
    case "incompleteProfiles":
      return row.profile_status !== "Completed";
    case "withWarnings":
      return validateEmployee(row, allRows).length > 0;
    default:
      return true;
  }
}

function formatProfile(row: EmployeeRow): string {
  const pct = row.profile_completion_pct.trim();
  const status = row.profile_status || "Unknown";
  if (pct === "") {
    return status;
  }
  return `${status} (${pct}%)`;
}

function buildOverview(baseRows: EmployeeRow[], allRows: EmployeeRow[]) {
  const counts: Record<OverviewKey, number> = {
    needingWork: 0,
    rfe: 0,
    inFlight: 0,
    readyToFile: 0,
    incompleteProfiles: 0,
    withWarnings: 0,
  };

  for (const row of baseRows) {
    for (const { key } of OVERVIEW_CARDS) {
      if (matchesOverview(row, key, allRows)) {
        counts[key] += 1;
      }
    }
  }

  return counts;
}

function App() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [sessionAdvisor, setSessionAdvisor] = useState<string>("");
  const [advisorFilter, setAdvisorFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [overviewFilter, setOverviewFilter] = useState<OverviewKey | null>(
    null
  );

  useEffect(() => {
    loadEmployees().then((loaded) => {
      const advisor = defaultAdvisor(loaded);
      setRows(loaded);
      setSessionAdvisor(advisor);
      setAdvisorFilter(advisor);
    });
  }, []);

  const advisors = useMemo(() => uniqueAdvisors(rows), [rows]);
  const companies = useMemo(() => uniqueCompanies(rows), [rows]);
  const caseStatuses = useMemo(() => uniqueCaseStatuses(rows), [rows]);

  const baseFiltered = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesAdvisor(row, advisorFilter) &&
          matchesCompany(row, companyFilter) &&
          matchesCaseStatus(row, caseStatusFilter) &&
          matchesActive(row, activeFilter)
      ),
    [rows, advisorFilter, companyFilter, caseStatusFilter, activeFilter]
  );

  const overview = useMemo(
    () => buildOverview(baseFiltered, rows),
    [baseFiltered, rows]
  );

  const filtered = useMemo(() => {
    if (!overviewFilter) {
      return baseFiltered;
    }
    return baseFiltered.filter((row) =>
      matchesOverview(row, overviewFilter, rows)
    );
  }, [baseFiltered, overviewFilter, rows]);

  const ranked = useMemo(
    () =>
      [...filtered]
        .map((row) => ({
          row,
          score: priorityScore(row).score,
          warnings: validateEmployee(row, rows),
        }))
        .sort((a, b) => b.score - a.score),
    [filtered, rows]
  );

  type RankedRow = (typeof ranked)[number];

  const groupedByCompany = useMemo(() => {
    const groups = new Map<string, RankedRow[]>();
    for (const item of ranked) {
      const company = item.row.company.trim() || "Unknown company";
      const list = groups.get(company);
      if (list) {
        list.push(item);
      } else {
        groups.set(company, [item]);
      }
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [ranked]);

  function toggleOverview(key: OverviewKey) {
    if (overview[key] === 0) {
      return;
    }
    setOverviewFilter((current) => (current === key ? null : key));
  }

  // Drop overview filter if the selected slice became empty under base filters
  useEffect(() => {
    if (overviewFilter && overview[overviewFilter] === 0) {
      setOverviewFilter(null);
    }
  }, [overview, overviewFilter]);

  const activeOverviewLabel = overviewFilter
    ? OVERVIEW_CARDS.find((c) => c.key === overviewFilter)?.label
    : null;

  return (
    <div className="page">
      <h1>Visa Tracking</h1>
      <p className="subtitle">
        Advisor work queue — signed in as {sessionAdvisor || "…"}
      </p>

      <div className="cards">
        {OVERVIEW_CARDS.map(({ key, label }) => {
          const count = overview[key];
          return (
            <Card
              disabled={count === 0}
              key={key}
              label={label}
              onClick={() => toggleOverview(key)}
              selected={overviewFilter === key}
              value={count}
            />
          );
        })}
      </div>

      <div className="filters">
        <label className="filter">
          <span>Advisor</span>
          <select
            onChange={(e) => setAdvisorFilter(e.target.value)}
            value={advisorFilter}
          >
            <option value="all">All</option>
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
            onChange={(e) => setCompanyFilter(e.target.value)}
            value={companyFilter}
          >
            <option value="all">All</option>
            {companies.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="filter">
          <span>Case status</span>
          <select
            onChange={(e) => setCaseStatusFilter(e.target.value)}
            value={caseStatusFilter}
          >
            <option value="all">All</option>
            {caseStatuses.map((status) => (
              <option
                key={status === "" ? "__blank__" : status}
                value={status === "" ? "__blank__" : status}
              >
                {status === "" ? "Blank" : status}
              </option>
            ))}
          </select>
        </label>

        <label className="filter">
          <span>Ready to action</span>
          <select
            onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
            value={activeFilter}
          >
            <option value="all">All</option>
            <option value="active">Ready to action</option>
            <option value="inactive">No action (Approved)</option>
          </select>
        </label>
      </div>

      <div className="table-meta">
        <span>
          Showing <strong>{ranked.length}</strong> cases
          {activeOverviewLabel ? (
            <>
              {" "}
              · filtered to {activeOverviewLabel}{" "}
              <button
                className="link-button"
                onClick={() => setOverviewFilter(null)}
                type="button"
              >
                Clear
              </button>
            </>
          ) : null}
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Ready to action</th>
            <th>Warnings</th>
            <th>Name</th>
            <th>Visa</th>
            <th>Case status</th>
            <th>Profile</th>
            <th>Advisor</th>
            <th>Filed</th>
            <th>Expires</th>
            <th>Last updated</th>
          </tr>
        </thead>
        <tbody>
          {groupedByCompany.map(([company, items]) => (
            <Fragment key={company}>
              <tr className="group-header">
                <td colSpan={10}>
                  {company}
                  <span className="muted"> · {items.length}</span>
                </td>
              </tr>
              {items.map(({ row, warnings }) => {
                const active = isActive(row);
                const expiry = formatExpiry(row.expires_at);
                return (
                  <tr key={row.employee_id}>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: active ? "#1565c0" : "#9e9e9e",
                        }}
                      >
                        {active ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>
                      {warnings.length > 0 ? (
                        <span
                          className="warning-badge"
                          title={warnings.join("\n")}
                        >
                          ⚠ {warnings.length}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div>{row.full_name}</div>
                      <div className="muted">{row.employee_id}</div>
                    </td>
                    <td>{row.visa_type}</td>
                    <td>
                      {row.case_status || <span className="muted">Blank</span>}
                    </td>
                    <td>{formatProfile(row)}</td>
                    <td>{row.assigned_advisor}</td>
                    <td>{row.filed_at || <span className="muted">—</span>}</td>
                    <td>
                      {expiry.label === "—" ? (
                        <span className="muted">—</span>
                      ) : (
                        <span title={expiry.title}>{expiry.label}</span>
                      )}
                    </td>
                    <td>
                      {row.last_updated || <span className="muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
