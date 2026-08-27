"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/fetch";
import { formatShortDate } from "@/lib/format";
import {
  LEVELS,
  LEVEL_LABELS,
  MODULES,
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
  RecordCard,
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
          ? "bg-camel-light/40 text-russet-dark/40"
          : "bg-laurel-light/50 text-olive-dark"
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
    admin: "bg-laurel-light/70 text-olive-dark",
    editor: "bg-meringue text-russet-dark/80",
    viewer: "bg-camel-light/30 text-russet-dark/60",
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
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-olive">
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
              className={`admin-input mt-0.5 h-9 w-32 appearance-none py-0 text-xs disabled:opacity-50 ${
                effective === "none" ? "text-russet-dark/45" : ""
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
    const result = await adminFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, name, role }),
    });
    setAdding(false);
    if (!result.ok) {
      setFieldError(result.error ?? "Could not add that person");
      return;
    }
    toast(`${email} can now sign in as ${ROLE_LABELS[role].label}`);
    setEmail("");
    setName("");
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
          <form onSubmit={add} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_10rem_auto] lg:items-end">
            <TextField
              label="Google email"
              type="email"
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
              label="Role"
              value={role}
              onChange={(v) => setRole(v as Role)}
              options={ROLE_OPTIONS.filter((o) =>
                canAssignRole(currentRole, o.value),
              )}
              hint={ROLE_LABELS[role].description}
            />
            <Button type="submit" disabled={adding || !email.trim()}>
              {adding && <Spinner />}
              <span>{adding ? "Adding…" : "Add"}</span>
            </Button>
          </form>
        </Section>
      )}

      <div className={canManage ? "mt-8" : ""}>
        <h2 className="font-display text-xl font-bold text-russet">
          Who can sign in
        </h2>
        <p className="mt-1 text-sm text-olive-dark">
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
            {/* Cards below lg, table from lg up — same shape as the other lists. */}
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:hidden">
              {rows.map((person) => {
                const locked = lockedReason(person);
                return (
                  <RecordCard
                    key={person.id}
                    thumb={<Avatar person={person} />}
                    title={person.name || person.email}
                    subtitle={person.name ? person.email : undefined}
                    badges={
                      <>
                        <RoleBadge role={person.role} />
                        {person.status === "suspended" && (
                          <span className="rounded-full bg-danger-light/15 px-2.5 py-1 text-xs font-semibold text-danger-dark">
                            Suspended
                          </span>
                        )}
                        {person.email === currentEmail && (
                          <span className="rounded-full bg-meringue px-2.5 py-1 text-xs font-semibold text-russet-dark/70">
                            You
                          </span>
                        )}
                      </>
                    }
                    meta={[
                      MODULES.filter((m) => levelIn(person, m) !== "none")
                        .map(
                          (m) =>
                            `${MODULE_LABELS[m]} ${LEVEL_LABELS[levelIn(person, m)].label.toLowerCase()}`,
                        )
                        .join(", ") || "No modules",
                      person.lastSignInAt
                        ? `Last signed in ${formatShortDate(person.lastSignInAt)}`
                        : "Never signed in",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    onDelete={() => setPending(person)}
                    label={person.email}
                    removable={!locked}
                  />
                );
              })}
            </ul>

            <div className="admin-card mt-6 hidden overflow-hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="admin-section-head text-[11px] uppercase tracking-[0.12em] text-olive">
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
                          className="admin-row border-t border-camel-light/25"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar person={person} />
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 font-semibold text-russet">
                                  <span className="truncate">
                                    {person.name || person.email}
                                  </span>
                                  {person.email === currentEmail && (
                                    <span className="shrink-0 rounded-full bg-meringue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-russet-dark/70">
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
                                  <p className="truncate text-xs text-russet-dark/55">
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
                              <select
                                value={person.role}
                                disabled={isBusy}
                                aria-label={`Role for ${person.email}`}
                                onChange={(e) =>
                                  patch(
                                    person,
                                    { role: e.target.value },
                                    `${person.email} is now ${ROLE_LABELS[e.target.value as Role].label}`,
                                  )
                                }
                                className="admin-input h-10 w-36 appearance-none py-0 text-sm disabled:opacity-50"
                              >
                                {ROLE_OPTIONS.filter((o) =>
                                  canAssignRole(currentRole, o.value),
                                ).map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {locked ? (
                              <span className="text-xs text-russet-dark/45">
                                {MODULES.map(
                                  (m) =>
                                    `${MODULE_LABELS[m]}: ${LEVEL_LABELS[levelIn(person, m)].label}`,
                                ).join(" · ")}
                              </span>
                            ) : (
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
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-russet-dark/65">
                            {person.lastSignInAt
                              ? formatShortDate(person.lastSignInAt)
                              : "Never"}
                            {person.addedBy && (
                              <span className="block text-russet-dark/45">
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
                                  className="text-xs text-russet-dark/45"
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
          <p className="mt-4 text-sm text-russet-dark/55">
            You are the only owner. Nobody else can add or remove people, and
            your own access cannot be changed from here — make someone else an
            owner if you want a second pair of hands.
          </p>
        )}

        {!canManage && (
          <p className="mt-4 text-sm text-russet-dark/55">
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
