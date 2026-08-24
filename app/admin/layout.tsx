import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  // The admin panel must never appear in search results.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Admin shell wrapper. The authenticated area adds its own sidebar in
 * app/admin/(dashboard)/layout.tsx; the login page deliberately sits outside
 * that group so it renders bare.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex min-h-screen flex-1 bg-cornsilk">{children}</div>;
}
