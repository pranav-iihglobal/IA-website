import { AdminNav } from "@/components/admin/AdminNav";
import { ToastProvider } from "@/components/admin/Toast";
import { NavProgress } from "@/components/NavProgress";
import { RouteTransition } from "@/components/RouteTransition";
import { redirect } from "next/navigation";
import {
  currentActiveUser,
  currentSession,
} from "@/lib/auth/current-user";

/**
 * Authenticated admin area.
 *
 * The proxy has already established that a session exists. This is where that
 * session becomes a person: the database says who they are and what they may
 * do, and both the guard below and the nav are driven by that answer rather
 * than by anything carried in the token.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
    The authoritative check. The proxy runs on the edge and only knows that
    SOME valid session exists; whether this person still has access, and as
    what, is a database question and it is asked here on every single page
    load. Suspend or demote someone and their very next click reflects it.
  */
  const me = await currentActiveUser();
  if (!me) redirect("/admin/restricted");

  // Same decode currentActiveUser already did — the avatar lives on the
  // token, not in the User document.
  const session = await currentSession();

  const user = {
    name: me.name || session?.user?.name || undefined,
    email: me.email,
    image: session?.user?.image ?? undefined,
    // Live from the database, so the nav can never offer a module the API
    // would refuse — including per-module overrides, which is how an
    // accountant sees Products and nothing else.
    access: { role: me.role, modules: me.modules },
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
      {/*
        First thing in the tab order, invisible until focused.

        Without it a keyboard user tabbed the entire sidebar — around fifteen
        links, the group toggles, View site and Sign out — on every single
        page before reaching any content. Neither <main> even had an id to
        jump to.
      */}
      <a
        href="#admin-content"
        className="admin-tap sr-only z-[70] rounded-full bg-russet px-5 font-semibold text-cornsilk-light focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:inline-flex focus:items-center"
      >
        Skip to content
      </a>
      <div className="flex min-w-0 flex-1">
        <AdminNav user={user} />
        {/* pt clears the fixed mobile top bar rendered by AdminNav. */}
        {/* px-4 matches --admin-gutter, which .admin-bleed cancels. */}
        <main
          id="admin-content"
          /* -1 so the skip link can move focus here without adding it to the
             tab order for everybody else. */
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pb-10 pt-[74px] sm:px-8 lg:py-9"
        >
          {/* Same 1600px ceiling as the public site — see .container-page. */}
          <div className="mx-auto w-full max-w-[100rem]">
            <RouteTransition>{children}</RouteTransition>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
