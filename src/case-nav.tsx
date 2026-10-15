import { createContext, type ReactNode, useContext } from "react";

/** Neighbours in the current ranked queue — used by the action desk to advance. */
export type CaseNav = {
  nextCaseId?: string;
  previousCaseId?: string;
};

const CaseNavContext = createContext<CaseNav>({});

export function CaseNavProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: CaseNav;
}) {
  return (
    <CaseNavContext.Provider value={value}>{children}</CaseNavContext.Provider>
  );
}

export function useCaseNav(): CaseNav {
  return useContext(CaseNavContext);
}
