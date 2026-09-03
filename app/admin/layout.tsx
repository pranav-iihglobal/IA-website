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
  /*
    min-h-0, not min-h-screen. The authenticated area is an app shell that
    fills the body exactly (see the (dashboard) layout and globals.css); a
    100vh minimum here would be taller than the body on a phone whose browser
    toolbar is showing, and the bottom of the shell would sit under it.
  */
  return <div className="admin-ui flex min-h-0 flex-1">{children}</div>;
}
