import type { Metadata } from "next";

export const metadata: Metadata = {
  /*
    A template, so every tab says what it is showing.

    One page in eighteen exported metadata, so every admin tab read
    "Admin | IKSARVA" — with the panel open in three tabs, which is how these
    screens are actually used, none of them could be told apart.
  */
  title: { default: "Admin", template: "%s · Admin" },
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
  // .admin-ui scopes the entire admin design system (globals.css) so nothing
  // here can leak into the public site.
  return <div className="admin-ui flex min-h-screen flex-1">{children}</div>;
}
