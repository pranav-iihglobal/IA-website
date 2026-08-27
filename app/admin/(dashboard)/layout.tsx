import { AdminNav } from "@/components/admin/AdminNav";
import { ToastProvider } from "@/components/admin/Toast";
import { NavProgress } from "@/components/NavProgress";
import { RouteTransition } from "@/components/RouteTransition";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAuthorisedEmail } from "@/lib/auth/directors";

/**
 * Authenticated admin area.
 *
 * Access is enforced in proxy.ts; the check here is a second, redundant
 * one, and the session read that follows is only to show who is signed in.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  /*
    Last line of defence. proxy.ts already enforces this, but a matcher
    change or an edge-runtime failure must never be the only thing standing
    between a stranger's Google account and the panel.
  */
  if (!(await isAuthorisedEmail(session?.user?.email))) {
    redirect("/admin/restricted");
  }

  const user = {
    name: session?.user?.name ?? undefined,
    email: session?.user?.email ?? undefined,
    image: session?.user?.image ?? undefined,
  };

  return (
    <ToastProvider>
      <NavProgress />
      {/*
        min-w-0: a flex item defaults to min-width:auto, so without this the
        row inflates to its content's min-content width and inner
        overflow-x-auto containers (the step rail, wide tables) never get to
        scroll — the whole page scrolls sideways instead.
      */}
      <div className="flex min-w-0 flex-1">
        <AdminNav user={user} />
        {/* pt clears the fixed mobile top bar rendered by AdminNav. */}
        <main className="min-w-0 flex-1 px-5 pb-10 pt-[74px] sm:px-8 lg:py-9">
          {/* Same 1600px ceiling as the public site — see .container-page. */}
          <div className="mx-auto w-full max-w-[100rem]">
            <RouteTransition>{children}</RouteTransition>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
