import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { currentUser, requirePermission } from "@/lib/admin/api";
import {
  countActiveOwners,
  listUsers,
  normalizeEmail,
} from "@/lib/auth/users";
import {
  canAssignRole,
  isRole,
  MODULES,
  ROLE_LABELS,
  type Level,
  type ModuleKey,
} from "@/lib/auth/permissions";
import { userCreateSchema, userUpdateSchema } from "@/lib/schemas";

/**
 * Who may use the admin panel, and as what.
 *
 * This endpoint grants and revokes access to itself, so it carries guards the
 * other modules do not need. Three invariants, each protecting against a way
 * the panel could be made permanently unusable or quietly escalated:
 *
 *  - You cannot change or remove your own access. Doing so would log you out
 *    of the only page that could undo it.
 *  - The last active owner cannot be removed, suspended or demoted. An
 *    ownerless panel can never grant anyone access again, and is recoverable
 *    only from a terminal with `npm run users`.
 *  - Nobody can grant a role above their own, so managing users can never be
 *    used to escalate past the person doing it.
 *
 * Reading the list needs users:read (admins and owners). Every mutation needs
 * users:manage, which only owners have.
 */

/**
 * Turn the submitted overrides into a Mongo update.
 *
 * `null` means "clear this override so the module follows the role again",
 * which is $unset, not a value. An absent key is left alone entirely — so
 * editing one module never silently resets the others.
 */
function moduleUpdate(
  modules: Partial<Record<ModuleKey, Level | null | undefined>> | undefined,
): { set: Partial<Record<ModuleKey, Level>>; cleared: ModuleKey[] } {
  const set: Partial<Record<ModuleKey, Level>> = {};
  const cleared: ModuleKey[] = [];
  if (!modules) return { set, cleared };

  for (const key of MODULES) {
    if (!(key in modules)) continue;
    const value = modules[key];
    if (value === null) cleared.push(key);
    else if (value) set[key] = value;
  }
  return { set, cleared };
}

/** `{ products: "view" }` → `{ "modules.products": "view" }`, for $set. */
function dotted(set: Partial<Record<ModuleKey, Level>>): Record<string, Level> {
  return Object.fromEntries(
    Object.entries(set).map(([key, value]) => [`modules.${key}`, value]),
  );
}

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requirePermission("users:read");
  if (denied) return denied;

  try {
    const users = await listUsers();
    return NextResponse.json(
      { items: users },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[users] list failed", error);
    return NextResponse.json(
      { error: "Could not load the list of people" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = await requirePermission("users:manage");
  if (denied) return denied;

  try {
    const parsed = userCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Check the form", fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const me = await currentUser();
    if (!me) return NextResponse.json({ error: "Not authorised" }, { status: 403 });

    if (!canAssignRole(me.role, parsed.data.role)) {
      return NextResponse.json(
        {
          error: `You cannot give someone the ${ROLE_LABELS[parsed.data.role].label} role — it is above your own.`,
        },
        { status: 403 },
      );
    }

    const email = normalizeEmail(parsed.data.email);

    await connectToDatabase();
    if (await User.exists({ email })) {
      return NextResponse.json(
        { error: "That address already has access." },
        { status: 409 },
      );
    }

    const { set } = moduleUpdate(parsed.data.modules);
    const created = await User.create({
      email,
      name: parsed.data.name,
      role: parsed.data.role,
      modules: set,
      addedBy: me.email,
    });

    return NextResponse.json(
      { id: String(created._id), email: created.email },
      { status: 201 },
    );
  } catch (error) {
    console.error("[users] create failed", error);
    return NextResponse.json(
      { error: "Could not add that person" },
      { status: 500 },
    );
  }
}

/** Change someone's role, or suspend and restore them. */
export async function PATCH(request: Request) {
  const denied = await requirePermission("users:manage");
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Check the form", fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { id, role, status, modules } = parsed.data;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Unknown person" }, { status: 400 });
    }

    const me = await currentUser();
    if (!me) return NextResponse.json({ error: "Not authorised" }, { status: 403 });

    await connectToDatabase();
    const target = await User.findById(id).select("email role status").lean();
    if (!target) {
      return NextResponse.json({ error: "Unknown person" }, { status: 404 });
    }

    if (normalizeEmail(target.email) === normalizeEmail(me.email)) {
      return NextResponse.json(
        { error: "You cannot change your own role or access." },
        { status: 409 },
      );
    }

    if (role && !canAssignRole(me.role, role)) {
      return NextResponse.json(
        {
          error: `You cannot give someone the ${ROLE_LABELS[role].label} role — it is above your own.`,
        },
        { status: 403 },
      );
    }

    /*
      Demoting or suspending the last active owner is the same catastrophe as
      deleting them, so it is refused for the same reason. Checked before the
      write, against the database, rather than trusting the list the client
      happened to be looking at.
    */
    const losesOwnership =
      isRole(target.role) &&
      target.role === "owner" &&
      target.status === "active" &&
      ((role && role !== "owner") || status === "suspended");

    if (losesOwnership && (await countActiveOwners()) <= 1) {
      return NextResponse.json(
        {
          error:
            "This is the only owner. Make someone else an owner first, or nobody will be able to manage access.",
        },
        { status: 409 },
      );
    }

    const { set, cleared } = moduleUpdate(modules);
    const update: Record<string, unknown> = dotted(set);
    if (role) update.role = role;
    if (status) update.status = status;

    if (Object.keys(update).length === 0 && cleared.length === 0) {
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    }

    await User.updateOne(
      { _id: id },
      {
        ...(Object.keys(update).length ? { $set: update } : {}),
        ...(cleared.length
          ? {
              $unset: Object.fromEntries(
                cleared.map((key) => [`modules.${key}`, ""]),
              ),
            }
          : {}),
      },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[users] update failed", error);
    return NextResponse.json(
      { error: "Could not update that person" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const denied = await requirePermission("users:manage");
  if (denied) return denied;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Unknown person" }, { status: 400 });
    }

    const me = await currentUser();
    if (!me) return NextResponse.json({ error: "Not authorised" }, { status: 403 });

    await connectToDatabase();
    const target = await User.findById(id).select("email role status").lean();
    if (!target) {
      return NextResponse.json({ error: "Unknown person" }, { status: 404 });
    }

    // Removing yourself would take away the page that could undo it.
    if (normalizeEmail(target.email) === normalizeEmail(me.email)) {
      return NextResponse.json(
        { error: "You cannot remove your own access." },
        { status: 409 },
      );
    }

    if (
      target.role === "owner" &&
      target.status === "active" &&
      (await countActiveOwners()) <= 1
    ) {
      return NextResponse.json(
        {
          error:
            "This is the only owner. Make someone else an owner before removing them.",
        },
        { status: 409 },
      );
    }

    await User.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[users] delete failed", error);
    return NextResponse.json(
      { error: "Could not remove that person" },
      { status: 500 },
    );
  }
}
