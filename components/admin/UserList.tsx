"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/fetch";
import { formatShortDate } from "@/lib/format";
import {
  LEVELS,
  LEVEL_LABELS,
  MODULES,
  ACCESS_PRESETS,
  MODULE_LABELS,
  ROLES,
  ROLE_LABELS,
  canAssignRole,
  defaultLevelFor,
  levelIn,
  rankOf,
  type Level,
  type ModuleKey,
  type Role,
} from "@/lib/auth/permissions";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Section,
  SelectField,
  Spinner,
  TableSkeleton,
  TextField,
} from "./ui";

interface Person {
  id: string;
  email: string;
  name: string;
  role: Role;
  modules: Partial<Record<ModuleKey, Level>>;
  status: "active" | "suspended";
  addedBy: string;
  lastSignInAt: string | null;
  createdAt: string | null;
}

/** Initial, for the avatar disc. */
function Avatar({ person }: { person: Person }) {
  const letter = (person.name || person.email).trim().charAt(0).toUpperCase();
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${
        person.status === "suspended"
          ? "bg-surface-strong/40 text-ink-soft"
          : "bg-accent-soft/50 text-ink-muted"
      }`}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  // Deeper colour as the role gets more powerful, so the list is scannable
  // without reading every word.
  const tone: Record<Role, string> = {
    owner: "bg-alloy text-cornsilk-light",
    admin: "bg-accent-soft/70 text-ink-muted",
    editor: "bg-surface-subtle text-ink",
    viewer: "bg-surface-strong/30 text-ink-muted",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone[role]}`}
      title={ROLE_LABELS[role].description}
    >
      {ROLE_LABELS[role].label}
    </span>
  );
}

const ROLE_OPTIONS = ROLES.map((r) => ({
  value: r,
  label: ROLE_LABELS[r].label,
}));

/**
 * Per-module access for one person.
 *
 * "Follow role" is a real, distinct option rather than a synonym for whatever
 * the role happens to grant today — pick it and changing the role later moves
 * this module too. Pick an explicit level and it stays put. That distinction
 * is the whole reason the overrides are stored sparsely.
 */
function ModuleAccess({
  person,
  disabled,
  onChange,
}: {
  person: Person;
  disabled: boolean;
  onChange: (module: ModuleKey, level: Level | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODULES.map((module) => {
        const override = person.modules?.[module];
        const effective = levelIn(person, module);
        return (
          <label key={module} className="block">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-accent">
              {MODULE_LABELS[module]}
            </span>
            <select
              value={override ?? ""}
              disabled={disabled}
              aria-label={`${MODULE_LABELS[module]} access for ${person.email}`}
              title={LEVEL_LABELS[effective].description}
              onChange={(e) =>
                onChange(module, e.target.value === "" ? null : (e.target.value as Level))
              }
              /*
                No text-xs: a utility beats .admin-input's 16px inside
                @layer components, and a 12px select is the one control iOS
                Safari zooms the page for. h-11 is the 44px tap invariant.
              */
              className={`admin-input mt-0.5 h-11 w-36 appearance-none py-0 disabled:opacity-50 ${
                effective === "none" ? "text-ink-soft" : ""
              }`}
            >
              <option value="">
                Follow role ({LEVEL_LABELS[defaultLevelFor(person.role)].label})
              </option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level].label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

function RoleSelect({
  person,
  disabled,
  currentRole,
  onChange,
}: {
  person: Person;
  disabled: boolean;
  currentRole: Role;
  onChange: (role: Role) => void;
}) {
  return (
    <select
      value={person.role}
      disabled={disabled}
      aria-label={`Role for ${person.email}`}
      onChange={(e) => onChange(e.target.value as Role)}
      className="admin-input h-11 w-full appearance-none py-0 disabled:opacity-50 sm:w-40"
    >
      {ROLE_OPTIONS.filter((o) => canAssignRole(currentRole, o.value)).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Apply a whole access shape in one action.
 *
 * The point is not convenience. A `viewer` defaults to `view` on every module,
 * so "accountant, billing only" is really five separate settings — and the
 * failure mode of missing one is silent: he simply sees the customer list and
 * nobody notices. One action cannot be half-applied.
 */
function PresetPicker({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (preset: (typeof ACCESS_PRESETS)[number]) => void;
}) {
  return (
    <select
      value=""
      disabled={disabled}
      aria-label="Apply an access preset"
      onChange={(e) => {
        const preset = ACCESS_PRESETS.find((p) => p.id === e.target.value);
        if (preset) onPick(preset);
        e.target.value = "";
      }}
      className="admin-input h-11 w-full appearance-none py-0 disabled:opacity-50"
    >
      <option value="">Apply a preset…</option>
      {ACCESS_PRESETS.map((p) => (
        <option key={p.id} value={p.id} title={p.description}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

export function UserList({
  currentEmail,
  currentRole,
}: {
  currentEmail: string;
  /** Read live from the database by the page, never from the session. */
  currentRole: Role;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [adding, setAdding] = useState(false);
  /*
    Which access shape a new person gets, chosen BEFORE they exist.

    A viewer defaults to `view` on every module, so adding someone and setting
    their modules afterwards means they can read the customer list, the
    products and the blog in the gap between the two actions — and the gap is
    however long it takes to remember. The preset closes it by making access
    part of creating the person rather than a follow-up.
  */
  const [preset, setPreset] = useState<string>("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [pending, setPending] = useState<Person | null>(null);
  const [removing, setRemoving] = useState(false);
  /** Ids currently mid-request, so their controls disable individually. */
  const [busy, setBusy] = useState<string[]>([]);

  const canManage = canAssignRole(currentRole, "viewer");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await adminFetch<{ items: Person[] }>("/api/admin/users");
    if (!result.ok || !result.data) {
      setError(result.error ?? "Could not load the list");
    } else {
      setRows(result.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setAdding(true);
    const chosen = ACCESS_PRESETS.find((p) => p.id === preset);
    const result = await adminFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        name,
        role: chosen?.role ?? role,
        // Sent WITH the create, not after it.
        modules: chosen?.modules,
      }),
    });
    setAdding(false);
    if (!result.ok) {
      setFieldError(result.error ?? "Could not add that person");
      return;
    }
    toast(
      chosen
        ? `${email} can now sign in — ${chosen.label}`
        : `${email} can now sign in as ${ROLE_LABELS[role].label}`,
    );
    setEmail("");
    setName("");
    setPreset("");
    load();
  }

  async function patch(person: Person, body: Record<string, unknown>, done: string) {
    setBusy((b) => [...b, person.id]);
    const result = await adminFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ id: person.id, ...body }),
    });
    setBusy((b) => b.filter((id) => id !== person.id));
    if (!result.ok) {
      toast(result.error ?? "Could not update that person", "error");
      // Reload anyway: the refusal may be because the list is stale.
      load();
      return;
    }
    toast(done);
    load();
  }

  async function confirmRemove() {
    if (!pending) return;
    setRemoving(true);
    const result = await adminFetch(
      `/api/admin/users?id=${encodeURIComponent(pending.id)}`,
      { method: "DELETE" },
    );
    setRemoving(false);
    if (!result.ok) {
      toast(result.error ?? "Could not remove that person", "error");
      setPending(null);
      return;
    }
    toast(`${pending.email} no longer has access`);
    setPending(null);
    load();
  }

  /** Everything an owner may not do to this row, and why. */
  function lockedReason(person: Person): string | null {
    if (person.email === currentEmail) return "This is you";
    if (!canManage) return "Owners only";
    if (rankOf(person.role) > rankOf(currentRole)) return "Above your role";
    const owners = rows.filter((r) => r.role === "owner" && r.status === "active");
    if (person.role === "owner" && person.status === "active" && owners.length <= 1)
      return "Only owner";
    return null;
  }

  const activeOwners = rows.filter(
    (r) => r.role === "owner" && r.status === "active",
  ).length;

  return (
    <div>
      {canManage && (
        <Section
          title="Give someone access"
          description="They sign in with Google using this address. Access starts immediately — they do not need to be invited anywhere else."
        >
          <form onSubmit={add} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_14rem_auto] lg:items-end">
            <TextField
              label="Google email"
              kind="email"
              required
              value={email}
              onChange={setEmail}
              placeholder="colleague@gmail.com"
              error={fieldError ?? undefined}
            />
            <TextField
              label="Name"
              value={name}
              onChange={setName}
              placeholder="Bharatbhai Chaudhari"
              hint="Optional — just a label for this list"
            />
            <SelectField
              label="Access"
              value={preset}
              onChange={setPreset}
              options={[
                ...ACCESS_PRESETS.filter((p) =>
                  canAssignRole(currentRole, p.role),
                ).map((p) => ({ value: p.id, label: p.label })),
                { value: "", label: "Choose a role instead…" },
              ]}
              hint={
                ACCESS_PRESETS.find((p) => p.id === preset)?.description ??
                "A role alone gives read access to every module. Pick a preset unless you mean that."
              }
            />
            {/*
              Only when no preset is chosen. A role on its own is the sharp
              edge — `viewer` means "can read everything" — so it is available
              but not the default path.
            */}
            {!preset && (
              <SelectField
                label="Role"
                value={role}
                onChange={(v) => setRole(v as Role)}
                options={ROLE_OPTIONS.filter((o) =>
                  canAssignRole(currentRole, o.value),
                )}
                hint={ROLE_LABELS[role].description}
              />
            )}
            <Button type="submit" disabled={adding || !email.trim()}>
              {adding && <Spinner />}
              <span>{adding ? "Adding…" : "Add"}</span>
            </Button>
          </form>
        </Section>
      )}

      <div className={canManage ? "mt-8" : ""}>
        <h2 className="font-display text-xl font-bold text-ink-strong">
          Who can sign in
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {loading
            ? "Loading…"
            : `${rows.length} ${rows.length === 1 ? "person" : "people"} — anyone not listed here is refused, whatever Google says.`}
        </p>

        <ErrorBanner message={error} />

        {loading && rows.length === 0 && <TableSkeleton rows={2} />}

        {!loading && rows.length === 0 && !error && (
          <EmptyState
            title="Nobody can sign in"
            message="There are no users, so the panel is locked to everyone. Create the first owner from a terminal: npm run users -- add you@gmail.com owner"
          />
        )}

        {rows.length > 0 && (
          <>
            {/*
              Cards below lg, table from lg up — same shape as the other
              lists. The cards used to be read-only: role, module access,
              suspend and remove lived in the table alone, which is hidden
              on a phone, so an owner away from a desk could not take
              somebody's access away. Everything the table can do is here
              now, folded under "Manage" so the list still scans as a list.
            */}
            <ul className="mt-6 admin-rows grid gap-3 sm:grid-cols-2 lg:hidden">
              {rows.map((person) => {
                const locked = lockedReason(person);
                const isBusy = busy.includes(person.id);
                const summary =
                  MODULES.filter((m) => levelIn(person, m) !== "none")
                    .map(
                      (m) =>
                        `${MODULE_LABELS[m]} ${LEVEL_LABELS[levelIn(person, m)].label.toLowerCase()}`,
                    )
                    .join(", ") || "No modules";
                return (
                  <li
                    key={person.id}
                    className="admin-bleed min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar person={person} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold leading-snug text-ink-strong">
                          {person.name || person.email}
                        </h3>
                        {person.name && (
                          <p className="truncate text-sm text-ink-muted">{person.email}</p>
                        )}
                        <p className="mt-2 flex flex-wrap items-center gap-1.5">
                          <RoleBadge role={person.role} />
                          {person.status === "suspended" && (
                            <span className="rounded-full bg-danger-light/15 px-2.5 py-1 text-xs font-semibold text-danger-dark">
                              Suspended
                            </span>
                          )}
                          {person.email === currentEmail && (
                            <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-ink-muted">
                              You
                            </span>
                          )}
                        </p>
                        <p className="mt-2 text-xs text-ink-muted">
                          {summary}
                          {" · "}
                          {person.lastSignInAt
                            ? `Last signed in ${formatShortDate(person.lastSignInAt)}`
                            : "Never signed in"}
                        </p>
                      </div>
                    </div>

                    {locked ? (
                      <p className="mt-3 border-t border-line-soft pt-3 text-xs text-ink-soft">
                        {locked === "This is you"
                          ? "This is you. Changing your own access would lock you out of this page."
                          : locked === "Only owner"
                            ? "The only owner. Removing them would leave nobody able to manage access."
                            : locked}
                      </p>
                    ) : (
                      <details className="group mt-3 border-t border-line-soft pt-1">
                        <summary className="admin-tap flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink-muted marker:hidden [&::-webkit-details-marker]:hidden">
                          Manage access
                          <svg
                            viewBox="0 0 20 20"
                            className="h-4 w-4 transition-transform group-open:rotate-180"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
                          </svg>
                        </summary>
                        <div className="space-y-3 pb-1">
                          <label className="block">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-accent">
                              Role
                            </span>
                            <div className="mt-0.5">
                              <RoleSelect
                                person={person}
                                disabled={isBusy}
                                currentRole={currentRole}
                                onChange={(next) =>
                                  patch(
                                    person,
                                    { role: next },
                                    `${person.email} is now ${ROLE_LABELS[next].label}`,
                                  )
                                }
                              />
                            </div>
                          </label>
                          <PresetPicker
                            disabled={isBusy}
                            onPick={(preset) =>
                              patch(
                                person,
                                { role: preset.role, modules: preset.modules },
                                `${person.email}: ${preset.label}`,
                              )
                            }
                          />
                          <ModuleAccess
                            person={person}
                            disabled={isBusy}
                            onChange={(module, level) =>
                              patch(
                                person,
                                { modules: { [module]: level } },
                                level === null
                                  ? `${MODULE_LABELS[module]} follows ${person.email}'s role again`
                                  : `${person.email}: ${MODULE_LABELS[module]} set to ${LEVEL_LABELS[level].label}`,
                              )
                            }
                          />
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              variant="secondary"
                              disabled={isBusy}
                              onClick={() =>
                                patch(
                                  person,
                                  {
                                    status:
                                      person.status === "suspended" ? "active" : "suspended",
                                  },
                                  person.status === "suspended"
                                    ? `${person.email} can sign in again`
                                    : `${person.email} is suspended`,
                                )
                              }
                            >
                              {person.status === "suspended" ? "Restore" : "Suspend"}
                            </Button>
                            <Button
                              variant="danger"
                              disabled={isBusy}
                              onClick={() => setPending(person)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="admin-card mt-6 hidden overflow-hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="admin-section-head text-[11px] uppercase tracking-[0.12em] text-accent">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Person</th>
                      <th className="px-5 py-3 font-semibold">Role</th>
                      <th className="px-5 py-3 font-semibold">Module access</th>
                      <th className="px-5 py-3 font-semibold">Last signed in</th>
                      <th className="px-5 py-3 text-right font-semibold">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((person) => {
                      const locked = lockedReason(person);
                      const isBusy = busy.includes(person.id);
                      return (
                        <tr
                          key={person.id}
                          className="admin-row border-t border-line-soft/25"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar person={person} />
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 font-semibold text-ink-strong">
                                  <span className="truncate">
                                    {person.name || person.email}
                                  </span>
                                  {person.email === currentEmail && (
                                    <span className="shrink-0 rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                                      You
                                    </span>
                                  )}
                                  {person.status === "suspended" && (
                                    <span className="shrink-0 rounded-full bg-danger-light/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger-dark">
                                      Suspended
                                    </span>
                                  )}
                                </p>
                                {person.name && (
                                  <p className="truncate text-xs text-ink-soft">
                                    {person.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {locked ? (
                              <RoleBadge role={person.role} />
                            ) : (
                              <RoleSelect
                                person={person}
                                disabled={isBusy}
                                currentRole={currentRole}
                                onChange={(next) =>
                                  patch(
                                    person,
                                    { role: next },
                                    `${person.email} is now ${ROLE_LABELS[next].label}`,
                                  )
                                }
                              />
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {locked ? (
                              <span className="text-xs text-ink-soft">
                                {MODULES.map(
                                  (m) =>
                                    `${MODULE_LABELS[m]}: ${LEVEL_LABELS[levelIn(person, m)].label}`,
                                ).join(" · ")}
                              </span>
                            ) : (
                              <div className="space-y-2">
                                {/*
                                  Presets first, because the shape people
                                  actually want is almost always one of three —
                                  and setting five modules by hand means five
                                  chances to leave one on `view`, which is what
                                  a viewer defaults to.
                                */}
                                <PresetPicker
                                  disabled={isBusy}
                                  onPick={(preset) =>
                                    patch(
                                      person,
                                      { role: preset.role, modules: preset.modules },
                                      `${person.email}: ${preset.label}`,
                                    )
                                  }
                                />
                                <ModuleAccess
                                  person={person}
                                  disabled={isBusy}
                                  onChange={(module, level) =>
                                    patch(
                                      person,
                                      { modules: { [module]: level } },
                                      level === null
                                        ? `${MODULE_LABELS[module]} follows ${person.email}'s role again`
                                        : `${person.email}: ${MODULE_LABELS[module]} set to ${LEVEL_LABELS[level].label}`,
                                    )
                                  }
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-ink-muted">
                            {person.lastSignInAt
                              ? formatShortDate(person.lastSignInAt)
                              : "Never"}
                            {person.addedBy && (
                              <span className="block text-ink-soft">
                                added by {person.addedBy}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              {locked ? (
                                <span
                                  title={
                                    locked === "This is you"
                                      ? "Changing your own access would lock you out of this page."
                                      : locked === "Only owner"
                                        ? "Removing the only owner would leave nobody able to manage access."
                                        : undefined
                                  }
                                  className="text-xs text-ink-soft"
                                >
                                  {locked}
                                </span>
                              ) : (
                                <>
                                  <Button
                                    variant="secondary"
                                    disabled={isBusy}
                                    onClick={() =>
                                      patch(
                                        person,
                                        {
                                          status:
                                            person.status === "suspended"
                                              ? "active"
                                              : "suspended",
                                        },
                                        person.status === "suspended"
                                          ? `${person.email} can sign in again`
                                          : `${person.email} is suspended`,
                                      )
                                    }
                                  >
                                    {person.status === "suspended"
                                      ? "Restore"
                                      : "Suspend"}
                                  </Button>
                                  <Button
                                    variant="danger"
                                    disabled={isBusy}
                                    onClick={() => setPending(person)}
                                  >
                                    Remove
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {canManage && activeOwners <= 1 && rows.length > 0 && (
          <p className="mt-4 text-sm text-ink-soft">
            You are the only owner. Nobody else can add or remove people, and
            your own access cannot be changed from here — make someone else an
            owner if you want a second pair of hands.
          </p>
        )}

        {!canManage && (
          <p className="mt-4 text-sm text-ink-soft">
            You can see who has access, but only an owner can change it.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        busy={removing}
        title="Remove this person?"
        message={`${pending?.email ?? ""} will lose access to the admin panel on their next request. Suspending instead keeps their record and their name on everything they edited.`}
        confirmLabel="Remove access"
        onConfirm={confirmRemove}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
