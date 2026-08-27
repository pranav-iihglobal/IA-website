/**
 * Who can do what.
 *
 * One file. Every access decision in the app resolves to a permission string
 * checked here — routes never test a role name directly, because "is this
 * person an admin" is the question that stops being answerable the moment a
 * fifth role, or a second kind of person, exists.
 *
 * Two dimensions, because one was not enough:
 *
 *   role     what someone is across the panel, and the only thing that
 *            governs managing other people
 *   modules  what they may do in each content area, overriding the role
 *
 * The second exists because a blanket role is too coarse for real jobs. An
 * accountant needs the products list for SKU, HSN and GST and has no business
 * reading farmer testimonials; a copywriter needs the blog and nothing else.
 * Without per-module access the only way to give either of them anything is
 * to give them everything, read-only.
 *
 * A module left unset simply follows the role, so the simple case stays
 * simple: most people get a role and no overrides at all.
 */

export const ROLES = ["viewer", "editor", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

/** Ordered least to most privileged — the array index is the rank. */
export function rankOf(role: Role): number {
  return ROLES.indexOf(role);
}

/** The content areas access can be granted over, one per admin module. */
export const MODULES = ["products", "testimonials", "posts"] as const;
export type ModuleKey = (typeof MODULES)[number];

/**
 * What someone may do within one module.
 *
 * Ordered, and each level contains the one before it. "full" differs from
 * "edit" by the irreversible actions — deleting, and making a post public.
 */
export const LEVELS = ["none", "view", "edit", "full"] as const;
export type Level = (typeof LEVELS)[number];

export function levelRank(level: Level): number {
  return LEVELS.indexOf(level);
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
  /** Signing a Cloudinary upload. Anyone who can write anything needs it. */
  "media:upload",
  "users:read",
  "users:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** The lowest level that grants each action within a module. */
const NEEDED: Record<string, Level> = {
  read: "view",
  write: "edit",
  delete: "full",
  publish: "full",
};

/** What a role grants in a module it has no explicit override for. */
const ROLE_DEFAULT_LEVEL: Record<Role, Level> = {
  viewer: "view",
  editor: "edit",
  admin: "full",
  owner: "full",
};

/** Managing other people is a role question only — never per-module. */
const USER_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: [],
  editor: [],
  admin: ["users:read"],
  owner: ["users:read", "users:manage"],
};

export interface Access {
  role: Role;
  /** Per-module overrides. Absent keys follow the role. */
  modules?: Partial<Record<ModuleKey, Level>>;
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && (MODULES as readonly string[]).includes(value);
}

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

/** The level someone actually holds in one module, override or role default. */
export function levelIn(access: Access | null | undefined, module: ModuleKey): Level {
  if (!access) return "none";
  return access.modules?.[module] ?? ROLE_DEFAULT_LEVEL[access.role] ?? "none";
}

/** Every module this person can at least see. Drives the nav. */
export function visibleModules(access: Access | null | undefined): ModuleKey[] {
  return MODULES.filter((m) => levelRank(levelIn(access, m)) >= levelRank("view"));
}

/**
 * The only way to ask an access question.
 *
 * Takes the whole access shape rather than a role, because a role alone can
 * no longer answer it.
 */
export function can(
  access: Access | null | undefined,
  permission: Permission,
): boolean {
  if (!access) return false;

  const [scope, action] = permission.split(":");

  // Managing people ignores module overrides entirely.
  if (scope === "users") {
    return USER_PERMISSIONS[access.role]?.includes(permission) ?? false;
  }

  /*
    Uploading is not a module of its own — it is the thing you do while
    editing one. Granted to anyone who can write somewhere, so an editor
    restricted to the blog can still add a cover image, and a viewer cannot
    obtain a signed upload URL by asking nicely.
  */
  if (scope === "media") {
    return MODULES.some((m) => levelRank(levelIn(access, m)) >= levelRank("edit"));
  }

  if (!isModuleKey(scope)) return false;
  const needed = NEEDED[action];
  if (!needed) return false;

  return levelRank(levelIn(access, scope)) >= levelRank(needed);
}

/**
 * Nobody may hand out a role they do not hold themselves.
 *
 * Without this an admin could promote a colleague — or themselves via a
 * second account — to owner, which is the whole privilege boundary gone.
 * Managing users is already owner-only; this is the second lock on it.
 */
export function canAssignRole(actor: Role, target: Role): boolean {
  return (
    (USER_PERMISSIONS[actor]?.includes("users:manage") ?? false) &&
    rankOf(target) <= rankOf(actor)
  );
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
    description: "Reads the panel. Changes nothing.",
  },
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  products: "Products",
  testimonials: "Testimonials",
  posts: "Blog",
};

export const LEVEL_LABELS: Record<Level, { label: string; description: string }> = {
  none: { label: "No access", description: "The module is hidden entirely." },
  view: { label: "View", description: "Can read, cannot change anything." },
  edit: { label: "Edit", description: "Can create and edit, but not delete or publish." },
  full: { label: "Full", description: "Can also delete, and publish posts." },
};

/** What the role grants in a module with no override, for the UI to show. */
export function defaultLevelFor(role: Role): Level {
  return ROLE_DEFAULT_LEVEL[role];
}
