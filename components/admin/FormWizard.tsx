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
 *
 * The rail has two shapes. Below xl it is a horizontal strip of pills. From
 * xl up it becomes a vertical column that shows every step's description and
 * state at once — no horizontal scrolling, and the wide screen earns its
 * width instead of padding the margins.
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
  /** True when everything this step is for has been filled in. */
  complete: boolean;
  /** Nothing here is required to publish — the rail says so. */
  optional?: boolean;
  /** Count shown as a quiet badge, e.g. how many FAQs are on the step. */
  count?: number;
  content: ReactNode;
}

/** How many server errors belong to this step. */
function errorCount(step: WizardStep, errors: Record<string, string>) {
  return Object.keys(errors).filter((key) =>
    step.errorKeys.some(
      (prefix) => key === prefix || key.startsWith(`${prefix}.`),
    ),
  ).length;
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function AlertIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.5 3.3a1.7 1.7 0 0 1 3 0l6 10.4a1.7 1.7 0 0 1-1.5 2.6H4a1.7 1.7 0 0 1-1.5-2.6l6-10.4ZM10 7a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** The numbered/ticked/alerting disc shared by both rail shapes. */
function StepMarker({
  index,
  active,
  failed,
  complete,
  size = "sm",
}: {
  index: number;
  active: boolean;
  failed: boolean;
  complete: boolean;
  size?: "sm" | "md";
}) {
  const box = size === "md" ? "h-7 w-7 text-xs" : "h-5 w-5 text-[11px]";
  const tone = failed
    ? "bg-alloy text-cornsilk-light"
    : active
      ? "bg-olive text-cornsilk-light"
      : complete
        ? "bg-laurel text-olive-dark"
        : "bg-meringue-dark/50 text-russet-dark/60";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold transition-colors ${box} ${tone}`}
    >
      {failed ? (
        <AlertIcon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      ) : complete ? (
        <CheckIcon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      ) : (
        index + 1
      )}
    </span>
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
    const first = steps.findIndex((s) => errorCount(s, errors) > 0);
    if (first >= 0) {
      setCurrent(first);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // steps is rebuilt every render; errors is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors]);

  // Keep the active pill visible when the horizontal rail overflows.
  useEffect(() => {
    const active = railRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [safeCurrent]);

  /**
   * Alt+← / Alt+→ walk the steps. Plain arrows would fight every text field
   * in the form, and Alt is not otherwise bound here.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight" && safeCurrent < total - 1) {
        e.preventDefault();
        goTo(safeCurrent + 1);
      } else if (e.key === "ArrowLeft" && safeCurrent > 0) {
        e.preventDefault();
        goTo(safeCurrent - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [safeCurrent, total, goTo]);

  const completed = steps.filter((s) => s.complete).length;
  const requiredLeft = steps.filter((s) => !s.optional && !s.complete).length;
  const totalErrors = Object.keys(errors).length;

  return (
    <>
      {/*
        Scroll anchor for "a save failed, take me to the first bad field".
        It sits outside the grid so it neither takes a grid row nor gets
        hidden — scrollIntoView is a no-op on a display:none element.
      */}
      <div ref={topRef} className="scroll-mt-24" />

      <div className="xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-8">
        {/* ---------- Vertical rail (xl and up) ---------- */}
        <nav
          aria-label="Form steps"
          className="hidden xl:sticky xl:top-4 xl:block xl:self-start"
        >
          <div className="admin-card overflow-hidden p-2">
            <div className="px-3 pb-2 pt-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-olive">
                {completed} of {total} done
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-meringue">
                <div
                  className="h-full rounded-full bg-olive transition-[width] duration-300"
                  style={{ width: `${(completed / total) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-russet-dark/55">
                {requiredLeft === 0
                  ? "All required steps filled in"
                  : `${requiredLeft} required step${requiredLeft === 1 ? "" : "s"} left`}
              </p>
            </div>

            <ol className="relative mt-1">
              {steps.map((s, index) => {
                const active = index === safeCurrent;
                const failures = errorCount(s, errors);
                return (
                  <li key={s.id} className="relative">
                    {/* Connector between markers, stopping at the last step. */}
                    {index < total - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-[1.4rem] top-9 h-[calc(100%-1.5rem)] w-px bg-camel-light/60"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      aria-current={active ? "step" : undefined}
                      className={`relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "bg-meringue-light"
                          : "hover:bg-meringue-light/60"
                      }`}
                    >
                      <StepMarker
                        index={index}
                        active={active}
                        failed={failures > 0}
                        complete={s.complete}
                        size="md"
                      />
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span
                          className={`flex items-center gap-1.5 text-sm font-semibold ${
                            active ? "text-russet" : "text-russet-dark/80"
                          }`}
                        >
                          <span className="truncate">{s.title}</span>
                          {s.count !== undefined && s.count > 0 && (
                            <span className="shrink-0 rounded-full bg-meringue-dark/50 px-1.5 text-[10px] font-bold text-russet-dark/60">
                              {s.count}
                            </span>
                          )}
                        </span>
                        {failures > 0 ? (
                          <span className="mt-0.5 block text-[11px] font-semibold text-alloy-dark">
                            {failures} field{failures === 1 ? "" : "s"} need
                            fixing
                          </span>
                        ) : (
                          s.description && (
                            <span className="mt-0.5 block text-[11px] leading-snug text-russet-dark/50">
                              {s.description}
                              {s.optional && !s.complete && " · optional"}
                            </span>
                          )
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <p className="mt-3 px-2 text-[11px] leading-relaxed text-russet-dark/45">
            Save from any step — nothing is lost by stopping partway.
            <br />
            <kbd className="rounded bg-meringue px-1 font-sans">⌘/Ctrl</kbd>+
            <kbd className="rounded bg-meringue px-1 font-sans">S</kbd> saves,{" "}
            <kbd className="rounded bg-meringue px-1 font-sans">Alt</kbd>+
            <kbd className="rounded bg-meringue px-1 font-sans">←→</kbd> moves.
          </p>
        </nav>

        {/* ---------- Content column ---------- */}
        <div className="min-w-0">
          {/* Horizontal rail (below xl) */}
          <div className="admin-card sticky top-[64px] z-20 mb-6 overflow-hidden lg:top-2 xl:hidden">
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
                const failures = errorCount(s, errors);
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
                        : failures > 0
                          ? "bg-alloy/12 text-alloy-dark hover:bg-alloy/20"
                          : "text-russet-dark/65 hover:bg-meringue hover:text-russet"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        active
                          ? "bg-cornsilk-light/25 text-cornsilk-light"
                          : failures > 0
                            ? "bg-alloy text-cornsilk-light"
                            : s.complete
                              ? "bg-laurel text-olive-dark"
                              : "bg-meringue-dark/50 text-russet-dark/60"
                      }`}
                    >
                      {failures > 0 ? (
                        <AlertIcon />
                      ) : s.complete ? (
                        <CheckIcon />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="whitespace-nowrap">{s.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={
              aside
                ? "grid gap-8 2xl:grid-cols-[minmax(0,1fr)_20rem]"
                : undefined
            }
          >
            <div className="min-w-0">
              {/* Where you are, plus whether this step can be skipped. The
                section header inside step.content names the step itself, so
                this row deliberately does not repeat the title. */}
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Step {safeCurrent + 1} of {total}
                </span>
                {step.optional && (
                  <span className="rounded-full bg-meringue px-2 py-0.5 text-[11px] font-semibold text-russet-dark/55">
                    Optional — nothing here is required to publish
                  </span>
                )}
              </div>

              {totalErrors > 0 && (
                <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-alloy-dark">
                  <AlertIcon className="h-4 w-4" />
                  {totalErrors} field{totalErrors === 1 ? "" : "s"} need fixing
                  across {steps.filter((s) => errorCount(s, errors) > 0).length}{" "}
                  step
                  {steps.filter((s) => errorCount(s, errors) > 0).length === 1
                    ? ""
                    : "s"}
                  .
                </p>
              )}

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
                  <Button
                    variant="secondary"
                    onClick={() => goTo(safeCurrent + 1)}
                  >
                    {/*
                    One flex item, not two — Button gaps its children, so a bare
                    "Next" beside the span renders as "Next : Media".
                  */}
                    <span>
                      Next
                      {/* The step name is useful but too long on a phone. */}
                      <span className="hidden sm:inline">
                        : {steps[safeCurrent + 1].title}
                      </span>
                    </span>
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
                        <span className="text-russet-dark/55">
                          All changes saved
                        </span>
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

              <p className="mt-2 px-4 text-xs text-russet-dark/45 xl:hidden">
                You can save from any step — nothing is lost by stopping
                partway.
              </p>
            </div>

            {aside}
          </div>
        </div>
      </div>
    </>
  );
}
