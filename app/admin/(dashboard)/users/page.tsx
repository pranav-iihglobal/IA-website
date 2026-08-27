import { redirect } from "next/navigation";
import { currentActiveUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { UserList } from "@/components/admin/UserList";

export const dynamic = "force-dynamic";

export const metadata = { title: "People" };

export default async function UsersPage() {
  // Read live rather than from the session: a role changed a moment ago must
  // be the one this page enforces, and the session cannot know about it.
  const me = await currentActiveUser();
  if (!me) redirect("/admin/restricted");

  // Admins may look; only owners may change anything. The list enforces the
  // same split again in its controls, and the API enforces it for real.
  if (!can(me, "users:read")) redirect("/admin");

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-bold text-russet sm:text-3xl">People</h1>
        <p className="mt-1 text-olive-dark">
          Everyone who can sign in to this panel, and what each of them may do.
          Changes take effect on their next request.
        </p>
      </header>
      <div className="mt-8">
        <UserList currentEmail={me.email} currentRole={me.role} />
      </div>
    </>
  );
}
