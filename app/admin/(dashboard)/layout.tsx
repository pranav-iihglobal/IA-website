import { AdminNav } from "@/components/admin/AdminNav";
import { getAdminSession } from "@/lib/auth/session";

/**
 * Authenticated admin area. Access is enforced by middleware.ts; this layout
 * only reads the session to show who is signed in.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let email: string | undefined;
  try {
    const session = await getAdminSession();
    email = session.email;
  } catch {
    email = undefined;
  }

  return (
    <div className="flex flex-1">
      <AdminNav email={email} />
      <main className="flex-1 overflow-x-auto px-8 py-8">{children}</main>
    </div>
  );
}
