import { useEffect, useState } from "react";

const CASE_PATH = /^\/cases\/([^/]+)\/?$/;

export type AppRoute = { name: "queue" } | { name: "case"; id: string };

function readRoute(): AppRoute {
  const match = CASE_PATH.exec(window.location.pathname);
  if (!match?.[1]) {
    return { name: "queue" };
  }
  return { name: "case", id: decodeURIComponent(match[1]) };
}

export function useRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(readRoute);

  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return route;
}

function go(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function openCase(employeeId: string) {
  go(`/cases/${encodeURIComponent(employeeId)}`);
}

export function openQueue() {
  go("/");
}

export function casePath(employeeId: string): string {
  return `/cases/${encodeURIComponent(employeeId)}`;
}
