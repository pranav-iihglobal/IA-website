/**
 * Who can do what.
 *
 * One file. Every access decision in the app resolves to a permission string
 * checked against this map — routes never test a role name directly, because
 * "is this person an admin" is the question that stops being answerable the
 * moment a fifth role exists. Adding a module later means adding its
 * permissions here and using them; it does not mean revisiting every route
 * to ask which roles are now allowed.
 *
 * Roles nest: each one is the previous plus more. That is not a requirement
 * of the design — GRANTS could hold any arbitrary set — it is just what this
 * company needs, and writing it as a chain makes the escalation obvious.
 */

export const ROLES = ["viewer", "editor", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

/** Ordered least to most privileged — the array index is the rank. */
export function rankOf(role: Role): number {
  return ROLES.indexOf(role);
}

export const PERMISSIONS = [
  "products:read",
  "products:write",
  "products:delete",
  "testimonials:read",
  "testimonials:write",
  "testimonials:delete",
  "posts:read",
  "posts:write",
  /** Separate from posts:write — an editor drafts, someone senior publishes. */
  "posts:publish",
  "posts:delete",
  /** Signing a Cloudinary upload. Anyone who can write content needs it. */
  "media:upload",
  "users:read",
  "users:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: Permission[] = [
  "products:read",
  "testimonials:read",
  "posts:read",
];

const EDITOR: Permission[] = [
  ...VIEWER,
  "products:write",
  "testimonials:write",
  "posts:write",
  "media:upload",
];

const ADMIN: Permission[] = [
  ...EDITOR,
  "products:delete",
  "testimonials:delete",
  "posts:delete",
  "posts:publish",
  "users:read",
];

const OWNER: Permission[] = [...ADMIN, "users:manage"];

const GRANTS: Record<Role, readonly Permission[]> = {
  viewer: VIEWER,
  editor: EDITOR,
  admin: ADMIN,
  owner: OWNER,
};

/** The only way to ask an access question. */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return GRANTS[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): readonly Permission[] {
  return GRANTS[role] ?? [];
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Nobody may hand out a role they do not hold themselves.
 *
 * Without this an admin could promote a colleague — or themselves via a
 * second account — to owner, which is the whole privilege boundary gone.
 * Managing users is already owner-only; this is the second lock on it.
 */
export function canAssignRole(actor: Role, target: Role): boolean {
  return can(actor, "users:manage") && rankOf(target) <= rankOf(actor);
}

/** For the admin UI — kept next to the grants so they cannot drift apart. */
export const ROLE_LABELS: Record<Role, { label: string; description: string }> = {
  owner: {
    label: "Owner",
    description: "Everything, including adding and removing people.",
  },
  admin: {
    label: "Admin",
    description: "All content, including deleting and publishing. Cannot change who has access.",
  },
  editor: {
    label: "Editor",
    description: "Writes and edits content, and uploads images. Cannot delete or publish.",
  },
  viewer: {
    label: "Viewer",
    description: "Reads everything in the panel. Changes nothing.",
  },
};
