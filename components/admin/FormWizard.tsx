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
        ? "bg-accent-mid text-ink-muted"
        : "bg-surface-strong/50 text-ink-muted";
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

  const total = steps.length;
  const safeCurrent = Math.min(current, total - 1);
  const step = steps[safeCurrent];

  /**
   * Move to a step and put it where the eye already is.
   *
   * Below xl that means the accordion header you just tapped, so its fields
   * open directly beneath it. At xl the headers are display:none and
   * scrollIntoView on a hidden element silently does nothing — offsetParent
   * is the test for that — so it falls back to the top of the form, which is
   * what the desktop layout wants anyway.
   */
  const goTo = useCallback((index: number) => {
    setCurrent(index);
    const header = document.querySelector<HTMLElement>(
      `[data-step-header="${index}"]`,
    );
    if (header && header.offsetParent !== null) {
      header.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

  /**
   * Alt+← / Alt+→ walk the steps. Plain arrows would fight every text field
   * in the form, and Alt is not otherwise bound here.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      /*
        Not while an overlay is up — a window listener would otherwise walk
        the wizard behind an open dialog, so dismissing it revealed a
        different step than the one that was left.
      */
      if (document.querySelector("dialog[open], [role='alertdialog']")) return;
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                {completed} of {total} done
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className="admin-progress h-full rounded-full bg-olive transition-[width] duration-300"
                  style={{ width: `${(completed / total) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-ink-soft">
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
                        className="absolute left-[1.4rem] top-9 h-[calc(100%-1.5rem)] w-px bg-surface-strong/60"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      aria-current={active ? "step" : undefined}
                      className={`relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "bg-surface-muted"
                          : "hover:bg-surface-muted/60"
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
                            active ? "text-ink-strong" : "text-ink"
                          }`}
                        >
                          <span className="truncate">{s.title}</span>
                          {s.count !== undefined && s.count > 0 && (
                            <span className="shrink-0 rounded-full bg-surface-strong/50 px-1.5 text-[10px] font-bold text-ink-muted">
                              {s.count}
                            </span>
                          )}
                        </span>
                        {failures > 0 ? (
                          <span className="mt-0.5 block text-[11px] font-semibold text-cta">
                            {failures} field{failures === 1 ? "" : "s"} need
                            fixing
                          </span>
                        ) : (
                          s.description && (
                            <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">
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

          <p className="mt-3 px-2 text-[11px] leading-relaxed text-ink-soft">
            Save from any step — nothing is lost by stopping partway.
            <br />
            <kbd className="rounded bg-surface-subtle px-1 font-sans">⌘/Ctrl</kbd>+
            <kbd className="rounded bg-surface-subtle px-1 font-sans">S</kbd> saves,{" "}
            <kbd className="rounded bg-surface-subtle px-1 font-sans">Alt</kbd>+
            <kbd className="rounded bg-surface-subtle px-1 font-sans">←→</kbd> moves.
          </p>
        </nav>

        {/* ---------- Content column ---------- */}
        <div className="min-w-0">
          {/*
            Below xl the steps are an accordion, not a horizontal rail.

            The rail was a scrolling strip of pills: on a phone it showed
            three of eight steps and clipped the fourth mid-word, with no
            indication the rest existed. A vertical list shows every step, its
            state, and what it contains, and the open one drops its fields
            directly underneath.

            The content is rendered ONCE, further down. It is placed under the
            active header by CSS order rather than by nesting it inside each
            accordion item — nesting would mean mounting the step's content
            per item, and one of those steps holds a rich text editor. At xl
            the container is `block`, order is ignored and the headers are
            hidden, so the desktop layout is exactly what it was.
          */}
          <div className="mb-4 flex items-center gap-3 xl:hidden">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-subtle">
              <div
                className="admin-progress h-full rounded-full bg-olive transition-[width] duration-300"
                style={{ width: `${(steps.filter((s) => s.complete).length / total) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold text-ink-muted">
              {steps.filter((s) => s.complete).length}/{total} done
            </span>
          </div>

          {/*
            flex below xl so `order` interleaves the single content node
            between the headers; plain block at xl, where order does nothing
            and the headers are hidden.
          */}
          <div
            className={`flex flex-col gap-2 xl:block ${
              aside ? "2xl:grid 2xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_20rem]" : ""
            }`}
          >
            {steps.map((s, index) => {
              const active = index === safeCurrent;
              const failures = errorCount(s, errors);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-expanded={active}
                  aria-controls="wizard-step-panel"
                  data-step-header={index}
                  style={{ order: index * 2, scrollMarginTop: "72px" }}
                  className={`admin-tap flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors xl:hidden ${
                    active
                      ? "border-olive bg-olive text-cornsilk-light"
                      : failures > 0
                        ? "border-alloy/40 bg-alloy/10"
                        : "border-line-soft/60 bg-surface"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      active
                        ? "bg-surface/25 text-cornsilk-light"
                        : failures > 0
                          ? "bg-alloy text-cornsilk-light"
                          : s.complete
                            ? "bg-accent-mid text-ink-muted"
                            : "bg-surface-strong/50 text-ink-muted"
                    }`}
                  >
                    {failures > 0 ? <AlertIcon /> : s.complete ? <CheckIcon /> : index + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-semibold ${active ? "" : "text-ink-strong"}`}>
                      {s.title}
                    </span>
                    <span
                      className={`block truncate text-[11px] ${
                        active
                          ? "text-cornsilk/75"
                          : failures > 0
                            ? "font-semibold text-cta"
                            : "text-ink-soft"
                      }`}
                    >
                      {failures > 0
                        ? `${failures} field${failures === 1 ? "" : "s"} need fixing`
                        : (s.description ?? "") + (s.optional ? " · optional" : "")}
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className={`shrink-0 text-lg leading-none transition-transform ${
                      active ? "rotate-180" : "text-ink-faint"
                    }`}
                  >
                    ⌃
                  </span>
                </button>
              );
            })}

            <div
              id="wizard-step-panel"
              style={{ order: safeCurrent * 2 + 1 }}
              className="min-w-0 xl:order-none"
            >
              {/* Where you are, plus whether this step can be skipped. The
                section header inside step.content names the step itself, so
                this row deliberately does not repeat the title. The step
                counter is desktop-only now — below xl the accordion header
                directly above already says which step this is. */}
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-accent xl:inline">
                  Step {safeCurrent + 1} of {total}
                </span>
                {step.optional && (
                  <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                    Optional — nothing here is required to publish
                  </span>
                )}
              </div>

              {totalErrors > 0 && (
                <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-cta">
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

              {/*
                Step navigation and save.

                On a phone this is one row, not four wrapped controls. Back,
                Next and Save at 390px wrapped onto two lines and the bar grew
                to ~130px of permanently sticky screen, sitting on top of the
                fields you were trying to fill in. Cancel is dropped from the
                bar on mobile — the "‹ Products" link at the top of the page
                already leaves, and a destructive-ish action does not deserve
                a third of a phone's toolbar.
              */}
              <div className="sticky bottom-[var(--admin-tabbar)] z-10 mt-6 flex items-center gap-2 rounded-t-2xl border-t border-line-soft/50 bg-[var(--admin-surface)]/92 px-3 py-3 backdrop-blur sm:flex-wrap sm:gap-3 sm:px-4 sm:py-3.5">
                <Button
                  variant="secondary"
                  disabled={safeCurrent === 0}
                  onClick={() => goTo(safeCurrent - 1)}
                  aria-label="Previous step"
                >
                  <span aria-hidden="true">←</span>
                  <span className="hidden sm:inline">Back</span>
                </Button>

                {safeCurrent < total - 1 ? (
                  <Button
                    variant="secondary"
                    onClick={() => goTo(safeCurrent + 1)}
                  >
                    {/*
                      One flex item, not two — Button gaps its children, so a
                      bare "Next" beside the span renders as "Next : Media".
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

                <div className="ml-auto flex min-w-0 items-center gap-3">
                  {/*
                    Visible on a phone too.

                    The whole indicator was `hidden … sm:flex`, so on the one
                    device where a stray back-swipe loses a half-filled
                    product there was no sign that anything was unsaved. The
                    dot alone carries it below sm — it is the part that
                    changes — and the words come back with the room for them.
                  */}
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    {dirty ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-alloy" />
                        <span className="text-cta">
                          Unsaved<span className="hidden sm:inline"> changes</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-accent-mid" />
                        <span className="text-ink-soft">
                          Saved<span className="hidden sm:inline">
                            {" "}
                            — all changes
                          </span>
                        </span>
                      </>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    onClick={onCancel}
                    disabled={saving}
                    className="hidden sm:inline-flex"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Spinner />}
                    {/*
                      "Create product" is 149px. With Back and Next beside it
                      that is 326px of controls in a 280px bar at 320px wide —
                      the narrowest phone still in real use. The short label
                      is what makes one row possible there.
                    */}
                    <span className="hidden truncate sm:inline">
                      {saving ? "Saving…" : submitLabel}
                    </span>
                    <span className="sm:hidden">
                      {saving ? "Saving…" : "Save"}
                    </span>
                  </Button>
                </div>
              </div>

              <p className="mt-2 px-4 text-xs text-ink-soft xl:hidden">
                You can save from any step — nothing is lost by stopping
                partway.
              </p>
            </div>

            {/*
              Ordered past every header and the panel. Without an explicit
              order it defaults to 0 and sorts alongside the FIRST accordion
              header, which dropped the live preview between "Basics" and its
              own fields. On a phone the preview belongs after the form; at
              2xl the grid takes over and order stops mattering.
            */}
            {aside && (
              <div style={{ order: total * 2 + 2 }} className="min-w-0 2xl:order-none">
                {aside}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
