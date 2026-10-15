import { useEffect, useState } from "react";

/**
 * Vite `base` ends with `/` (e.g. `/concord-eng-exercise/` on GitHub Pages).
 * All in-app paths are rooted at that base.
 */
const BASE = import.meta.env.BASE_URL;

const CASE_PATH = /^\/cases\/([^/]+)\/?$/;

export type AppRoute = { name: "queue" } | { name: "case"; id: string };

/** Strip the deploy base so route matching stays `/cases/...`. */
function appPathname(pathname: string = window.location.pathname): string {
  if (BASE !== "/" && pathname.startsWith(BASE)) {
    const rest = pathname.slice(BASE.length - 1); // keep leading /
    return rest.length > 0 ? rest : "/";
  }
  if (BASE !== "/" && pathname === BASE.slice(0, -1)) {
    return "/";
  }
  return pathname;
}

/** Turn an app path (`/cases/x`) into a full URL path including the base. */
function withBase(path: string): string {
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `${BASE}${trimmed}`;
}

function readRoute(): AppRoute {
  const match = CASE_PATH.exec(appPathname());
  if (!match?.[1]) {
    return { name: "queue" };
  }
  return { id: decodeURIComponent(match[1]), name: "case" };
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
  window.history.pushState({}, "", withBase(path));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function openCase(employeeId: string) {
  go(`/cases/${encodeURIComponent(employeeId)}`);
}

export function openQueue() {
  go("/");
}

export function casePath(employeeId: string): string {
  return withBase(`/cases/${encodeURIComponent(employeeId)}`);
}
