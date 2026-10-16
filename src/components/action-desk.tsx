import { type ChangeEvent, useEffect, useState } from "react";
import {
  type ActionPlan,
  type ChecklistItem,
  doneLabelFor,
} from "../data/action-desk";

const ADVANCE_MS = 1400;

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

function destinationLabel(plan: ActionPlan): string {
  if (plan.destination === "government") {
    return "Outbound · government";
  }
  if (plan.destination === "beneficiary") {
    return "Outbound · employee";
  }
  return "Outbound · client";
}

/**
 * Interactive work surface for the advisor's next move.
 * CTAs look like real outbound sends; this exercise does not call an API.
 * Remount with a React `key` (usually the employee id) to reset per case.
 */
export function ActionDesk({ plan, nextCaseId, onComplete }: ActionDeskProps) {
  const [checked, setChecked] = useState(() => new Set<string>());
  const [attached, setAttached] = useState(false);
  const [phase, setPhase] = useState<"ready" | "sending" | "done">("ready");

  useEffect(() => {
    if (phase !== "sending") {
      return;
    }
    const timer = window.setTimeout(() => {
      setPhase("done");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "done") {
      return;
    }
    const timer = window.setTimeout(() => {
      onComplete(nextCaseId);
    }, ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [nextCaseId, onComplete, phase]);

  // Upload workflows use a demo attach only — no real File is involved.
  const uploadReady = !plan.upload || attached;
  const ready = uploadReady && allRequiredChecked(plan.checklist, checked);
  const urgent = plan.urgent && phase === "ready";
  const busy = phase !== "ready";
  const statusHint = ready
    ? plan.demoNote
    : plan.upload && !attached
      ? "Attach the evidence packet first"
      : "Tick the required items first";

  if (phase === "done") {
    return (
      <section
        aria-live="polite"
        className="action-desk action-desk-done"
        role="status"
      >
        <p className="action-desk-eyebrow">Not sent — demo</p>
        <h2>{doneLabelFor(plan, Boolean(nextCaseId))}</h2>
      </section>
    );
  }

  if (phase === "sending") {
    return (
      <section
        aria-live="polite"
        className="action-desk action-desk-sending"
        role="status"
      >
        <p className="action-desk-eyebrow">{destinationLabel(plan)}</p>
        <h2>Preparing submission…</h2>
        <p className="action-desk-detail">{plan.demoNote}</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="action-desk-title"
      className={urgent ? "action-desk action-desk-urgent" : "action-desk"}
    >
      <div className="action-desk-main">
        <p className="action-desk-eyebrow">
          Do this now · {destinationLabel(plan)}
        </p>
        <h2 id="action-desk-title">{plan.title}</h2>
        {plan.detail ? (
          <p className="action-desk-detail">{plan.detail}</p>
        ) : null}

        {plan.upload ? (
          <div className="action-desk-upload">
            <p className="action-desk-upload-label">{plan.upload.label}</p>
            {/*
              Real file selection is blocked on purpose. Clicking the dropzone
              only attaches a placeholder packet so the resubmit flow is usable.
              The dropzone and submit button share a row so attaching a file
              does not push the button out of line with the box.
            */}
            <div className="action-desk-upload-row">
              {attached ? (
                <div className="action-desk-dropzone action-desk-dropzone-disabled">
                  <span className="action-desk-dropzone-file">
                    {plan.upload.demoFileName}
                    <span className="action-desk-dropzone-badge">
                      Demo evidence — not uploaded
                    </span>
                  </span>
                </div>
              ) : (
                <button
                  className="action-desk-dropzone"
                  disabled={busy}
                  onClick={() => setAttached(true)}
                  type="button"
                >
                  <span className="action-desk-dropzone-prompt">
                    Attach evidence packet
                    <span className="action-desk-dropzone-badge">
                      Demo only — choose to attach a placeholder PDF
                    </span>
                  </span>
                </button>
              )}
              <button
                className="action-desk-cta"
                disabled={!ready || busy}
                onClick={() => setPhase("sending")}
                type="button"
              >
                {plan.cta}
              </button>
            </div>
            <div className="action-desk-upload-row action-desk-upload-notes">
              <div className="action-desk-upload-meta">
                {attached ? (
                  <button
                    className="action-desk-upload-clear"
                    disabled={busy}
                    onClick={() => setAttached(false)}
                    type="button"
                  >
                    Remove attachment
                  </button>
                ) : null}
                <p className="action-desk-upload-hint">{plan.upload.hint}</p>
              </div>
              <p className="action-desk-hint">{statusHint}</p>
            </div>
          </div>
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
                      disabled={busy}
                      id={inputId}
                      // Same pattern as the queue filters — biome flags inline handlers project-wide.
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const id = event.currentTarget.value;
                        setChecked((current) => toggleId(current, id));
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

      {plan.upload ? null : (
        <div className="action-desk-aside">
          <button
            className="action-desk-cta"
            disabled={!ready || busy}
            onClick={() => setPhase("sending")}
            type="button"
          >
            {plan.cta}
          </button>
          <p className="action-desk-hint">{statusHint}</p>
        </div>
      )}
    </section>
  );
}
