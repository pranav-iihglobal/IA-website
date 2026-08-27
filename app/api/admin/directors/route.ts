import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Director } from "@/lib/db/models/Director";
import { currentEditor, requireAdmin } from "@/lib/admin/api";
import { isOwnerEmail, normalizeEmail } from "@/lib/auth/allowlist";
import { listAuthorised } from "@/lib/auth/directors";
import { directorSchema } from "@/lib/schemas";

/**
 * Who may use the admin panel.
 *
 * This endpoint grants and revokes access to itself, so the guards matter
 * more than usual:
 *
 *  - Owners (ADMIN_ALLOWED_EMAILS) are not stored here and cannot be removed
 *    through the API. They are the way back in if this collection is emptied.
 *  - You cannot remove yourself. Doing so would log you out of the only page
 *    that could undo it.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const directors = await listAuthorised();
    return NextResponse.json(
      { items: directors },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[directors] list failed", error);
    return NextResponse.json(
      { error: "Could not load the director list" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const parsed = directorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Check the form", fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const email = normalizeEmail(parsed.data.email);

    // Adding an owner would create a row that looks removable but is not.
    if (isOwnerEmail(email)) {
      return NextResponse.json(
        { error: "That address is already a permanent owner." },
        { status: 409 },
      );
    }

    await connectToDatabase();
    const existing = await Director.exists({ email });
    if (existing) {
      return NextResponse.json(
        { error: "That address already has access." },
        { status: 409 },
      );
    }

    const created = await Director.create({
      email,
      name: parsed.data.name,
      addedBy: await currentEditor(),
    });

    return NextResponse.json(
      { id: String(created._id), email: created.email },
      { status: 201 },
    );
  } catch (error) {
    console.error("[directors] create failed", error);
    return NextResponse.json(
      { error: "Could not add that director" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Unknown director" }, { status: 400 });
    }

    await connectToDatabase();
    const director = await Director.findById(id).select("email").lean();
    if (!director) {
      return NextResponse.json({ error: "Unknown director" }, { status: 404 });
    }

    // Removing yourself would take away the page that could undo it.
    const me = normalizeEmail(await currentEditor());
    if (me && me === director.email) {
      return NextResponse.json(
        { error: "You cannot remove your own access." },
        { status: 409 },
      );
    }

    await Director.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[directors] delete failed", error);
    return NextResponse.json(
      { error: "Could not remove that director" },
      { status: 500 },
    );
  }
}
