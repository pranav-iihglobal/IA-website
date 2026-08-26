import { AdminNav } from "@/components/admin/AdminNav";
import { ToastProvider } from "@/components/admin/Toast";
import { auth } from "@/auth";

/**
 * Authenticated admin area. Access is enforced by middleware.ts; this layout
 * only reads the session to show who is signed in.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // middleware.ts has already rejected unauthenticated requests; this read is
  // only to show who is signed in.
  const session = await auth();
  const user = {
    name: session?.user?.name ?? undefined,
    email: session?.user?.email ?? undefined,
    image: session?.user?.image ?? undefined,
  };

  return (
    <ToastProvider>
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
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
