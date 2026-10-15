import { type ChangeEvent, useEffect, useState } from "react";
import {
  type ActionPlan,
  type ChecklistItem,
  doneLabelFor,
} from "../data/action-desk";

const ADVANCE_MS = 900;

type ActionDeskProps = {
  plan: ActionPlan;
  /** When set, completing the action opens this case next. */
  nextCaseId?: string;
  onComplete: (nextCaseId?: string) => void;
};

function isRequired(item: ChecklistItem): boolean {
  return item.required !== false;
}

function allRequiredChecked(
  checklist: ChecklistItem[],
  checked: ReadonlySet<string>
): boolean {
  return checklist.every((item) => !isRequired(item) || checked.has(item.id));
}

function toggleId(checked: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(checked);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/**
 * Interactive work surface for the advisor's next move.
 * Visual-only: ticking items and pressing the CTA do not change the export.
 * Remount with a React `key` (usually the employee id) to reset per case.
 */
export function ActionDesk({ plan, nextCaseId, onComplete }: ActionDeskProps) {
  const [checked, setChecked] = useState(() => new Set<string>());
  const [phase, setPhase] = useState<"ready" | "done">("ready");

  useEffect(() => {
    if (phase !== "done") {
      return;
    }
    const timer = window.setTimeout(() => {
      onComplete(nextCaseId);
    }, ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [nextCaseId, onComplete, phase]);

  const ready = allRequiredChecked(plan.checklist, checked);
  const urgent = plan.urgent && phase === "ready";

  if (phase === "done") {
    return (
      <section
        aria-live="polite"
        className="action-desk action-desk-done"
        role="status"
      >
        <h2>{doneLabelFor(plan, Boolean(nextCaseId))}</h2>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="action-desk-title"
      className={urgent ? "action-desk action-desk-urgent" : "action-desk"}
    >
      <div className="action-desk-main">
        <p className="action-desk-eyebrow">Do this now</p>
        <h2 id="action-desk-title">{plan.title}</h2>
        {plan.detail ? (
          <p className="action-desk-detail">{plan.detail}</p>
        ) : null}

        {plan.checklist.length > 0 ? (
          <ul className="action-desk-list">
            {plan.checklist.map((item) => {
              const inputId = `action-check-${item.id}`;
              return (
                <li key={item.id}>
                  <label className="action-desk-check" htmlFor={inputId}>
                    <input
                      checked={checked.has(item.id)}
                      id={inputId}
                      // Same pattern as the queue filters — biome flags inline handlers project-wide.
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        setChecked((current) =>
                          toggleId(current, event.currentTarget.value)
                        );
                      }}
                      type="checkbox"
                      value={item.id}
                    />
                    <span>
                      <span className="action-desk-check-label">
                        {item.label}
                      </span>
                      {item.detail ? (
                        <span className="action-desk-check-detail">
                          {item.detail}
                        </span>
                      ) : null}
                      {isRequired(item) ? null : (
                        <span className="action-desk-optional">Optional</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="action-desk-aside">
        <button
          className="action-desk-cta"
          disabled={!ready}
          onClick={() => setPhase("done")}
          type="button"
        >
          {plan.cta}
        </button>
        {ready ? (
          <p className="action-desk-hint">
            {nextCaseId
              ? "Then we open the next case in your list"
              : "Then we return you to the list"}
          </p>
        ) : (
          <p className="action-desk-hint">Tick the required items first</p>
        )}
      </div>
    </section>
  );
}
