import { useEffect, useState } from "react";
import { FILTER, type LoadState } from "./data/constants";
import { loadEmployees } from "./data/load-employees";
import { defaultAdvisor, type EmployeeRow } from "./data/priority";
import { CasePage } from "./pages/case-page";
import { type QueueFilters, QueuePage } from "./pages/queue-page";
import { useRoute } from "./router";

const INITIAL_FILTERS: QueueFilters = {
  advisor: "",
  company: FILTER.ALL,
  caseStatus: FILTER.ALL,
  overview: null,
};

function App() {
  const route = useRoute();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [sessionAdvisor, setSessionAdvisor] = useState("");
  const [filters, setFilters] = useState<QueueFilters>(INITIAL_FILTERS);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;
    loadEmployees()
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        const advisor = defaultAdvisor(loaded);
        setRows(loaded);
        setSessionAdvisor(advisor);
        setFilters((current) =>
          current.advisor === "" ? { ...current, advisor } : current
        );
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedId = route.name === "case" ? route.id : undefined;

  return (
    <QueuePage
      detail={
        selectedId ? (
          <CasePage employeeId={selectedId} loadState={loadState} rows={rows} />
        ) : null
      }
      filters={filters}
      loadState={loadState}
      onChange={setFilters}
      rows={rows}
      selectedId={selectedId}
      sessionAdvisor={sessionAdvisor}
    />
  );
}

export default App;
