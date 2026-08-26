"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, Spinner } from "./ui";

/**
 * Step-by-step wrapper for the long admin forms.
 *
 * Each form is one <form> with all its state in the parent — the wizard only
 * decides which step's fields are on screen. That keeps saving a single
 * request and means an admin can hit Save from any step, rather than being
 * marched to the end before anything can be written.
 *
 * Steps are freely clickable, not gated: this is an editing tool, not a
 * sign-up funnel, and someone fixing a typo on step 6 should not have to walk
 * through five screens to reach it.
 */

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  /**
   * Error-key prefixes this step owns, e.g. ["name", "slug"]. Used to mark
   * the step when the server rejects a save, and to jump to the first
   * offending step automatically.
   */
  errorKeys: string[];
  /** True when everything required on this step has been filled in. */
  complete: boolean;
  /** Count shown as a quiet badge, e.g. how many FAQs are on the step. */
  count?: number;
  content: ReactNode;
}

function stepHasError(step: WizardStep, errors: Record<string, string>) {
  const keys = Object.keys(errors);
  if (keys.length === 0) return false;
  return keys.some((key) =>
    step.errorKeys.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)),
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.5 3.3a1.7 1.7 0 0 1 3 0l6 10.4a1.7 1.7 0 0 1-1.5 2.6H4a1.7 1.7 0 0 1-1.5-2.6l6-10.4ZM10 7a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function FormWizard({
  steps,
  errors,
  saving,
  dirty,
  submitLabel,
  onCancel,
  aside,
}: {
  steps: WizardStep[];
  /** Server-side field errors; a new object each failed save. */
  errors: Record<string, string>;
  saving: boolean;
  dirty: boolean;
  submitLabel: string;
  onCancel: () => void;
  /** Optional column beside the step content, e.g. the live product preview. */
  aside?: ReactNode;
}) {
  const [current, setCurrent] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const total = steps.length;
  const safeCurrent = Math.min(current, total - 1);
  const step = steps[safeCurrent];

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // A rejected save should land you on the problem, not leave you hunting.
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const first = steps.findIndex((s) => stepHasError(s, errors));
    if (first >= 0) {
      setCurrent(first);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // steps is rebuilt every render; errors is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors]);

  // Keep the active pill visible when the rail overflows.
  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [safeCurrent]);

  const completed = steps.filter((s) => s.complete).length;

  return (
    <div>
      <div ref={topRef} className="scroll-mt-24" />

      {/* Progress + step rail */}
      <div className="admin-card sticky top-[64px] z-20 mb-6 overflow-hidden lg:top-2">
        <div className="h-1 bg-meringue">
          <div
            className="h-full bg-olive transition-[width] duration-300"
            style={{ width: `${((safeCurrent + 1) / total) * 100}%` }}
          />
        </div>

        <div
          ref={railRef}
          className="flex gap-1.5 overflow-x-auto px-3 py-2.5"
          role="group"
          aria-label="Form steps"
        >
          {steps.map((s, index) => {
            const active = index === safeCurrent;
            const failed = stepHasError(s, errors);
            return (
              <button
                key={s.id}
                type="button"
                data-active={active}
                aria-current={active ? "step" : undefined}
                onClick={() => goTo(index)}
                title={s.description ?? s.title}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-olive text-cornsilk-light"
                    : failed
                      ? "bg-alloy/12 text-alloy-dark hover:bg-alloy/20"
                      : "text-russet-dark/65 hover:bg-meringue hover:text-russet"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    active
                      ? "bg-cornsilk-light/25 text-cornsilk-light"
                      : failed
                        ? "bg-alloy text-cornsilk-light"
                        : s.complete
                          ? "bg-laurel text-olive-dark"
                          : "bg-meringue-dark/50 text-russet-dark/60"
                  }`}
                >
                  {failed ? <AlertIcon /> : s.complete ? <CheckIcon /> : index + 1}
                </span>
                <span className="whitespace-nowrap">{s.title}</span>
                {s.count !== undefined && s.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-bold ${
                      active
                        ? "bg-cornsilk-light/25"
                        : "bg-meringue-dark/50 text-russet-dark/60"
                    }`}
                  >
                    {s.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={
          aside ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_380px]" : undefined
        }
      >
        <div className="min-w-0">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
            Step {safeCurrent + 1} of {total}
            <span className="ml-2 normal-case tracking-normal text-russet-dark/45">
              {completed} of {total} complete
            </span>
          </p>

          <div className="space-y-6">{step.content}</div>

          {/* Step navigation + save */}
          <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center gap-3 rounded-t-2xl border-t border-camel-light/50 bg-[var(--admin-surface)]/92 px-4 py-3.5 backdrop-blur">
            <Button
              variant="secondary"
              disabled={safeCurrent === 0}
              onClick={() => goTo(safeCurrent - 1)}
            >
              ← Back
            </Button>

            {safeCurrent < total - 1 ? (
              <Button variant="secondary" onClick={() => goTo(safeCurrent + 1)}>
                Next
                {/* The next step's name is useful but too long on a phone. */}
                <span className="hidden sm:inline">
                  : {steps[safeCurrent + 1].title}
                </span>{" "}
                →
              </Button>
            ) : null}

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-1.5 text-xs font-medium sm:flex">
                {dirty ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-alloy" />
                    <span className="text-alloy-dark">Unsaved changes</span>
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-laurel" />
                    <span className="text-russet-dark/55">All changes saved</span>
                  </>
                )}
              </span>
              <Button variant="ghost" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner />}
                {saving ? "Saving…" : submitLabel}
              </Button>
            </div>
          </div>

          <p className="mt-2 px-4 text-xs text-russet-dark/45">
            You can save from any step — nothing is lost by stopping partway.
            Press <kbd className="rounded bg-meringue px-1 font-sans">⌘/Ctrl</kbd>
            {" + "}
            <kbd className="rounded bg-meringue px-1 font-sans">S</kbd> to save.
          </p>
        </div>

        {aside}
      </div>
    </div>
  );
}
