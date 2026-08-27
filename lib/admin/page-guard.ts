import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { findActiveUser, type ActiveUser } from "@/lib/auth/users";
import { can, type Permission } from "@/lib/auth/permissions";

/**
 * The page-level half of requirePermission().
 *
 * The dashboard layout establishes that someone is signed in and still has an
 * active account; it cannot know which module a given page belongs to. This
 * does, and every admin page calls it.
 *
 * Hiding a link in the nav is a courtesy. This is the control — without it,
 * typing /admin/blog would render the page shell for someone with no blog
 * access, and only the API calls inside it would fail, which reads as a bug
 * rather than as a refusal.
 *
 * Sends people to /admin rather than /admin/restricted: they are legitimately
 * signed in and this is simply not their module. The dashboard is where they
 * belong.
 */
export async function requirePageAccess(
  permission: Permission,
): Promise<ActiveUser> {
  const session = await auth();
  // Read live rather than from the session: access changed a moment ago must
  // be the access this page enforces, and the token cannot know about it.
  const me = await findActiveUser(session?.user?.email);
  if (!me) redirect("/admin/restricted");
  if (!can(me, permission)) redirect("/admin");
  return me;
}
