"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const LINKS: {
  href: string;
  label: string;
  exact?: boolean;
  icon: ReactNode;
}[] = [
  {
    href: "/admin",
    label: "Dashboard",
    exact: true,
    icon: <Icon path="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />,
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: (
      <Icon path="M20 7.5 12 3 4 7.5m16 0L12 12M20 7.5v9L12 21m0-9L4 7.5M12 12v9m-8-4.5v-9" />
    ),
  },
  {
    href: "/admin/testimonials",
    label: "Testimonials",
    icon: <Icon path="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" />,
  },
  {
    href: "/admin/blog",
    label: "Blog",
    icon: (
      <Icon path="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm9 0v5h5M8 13h8M8 17h5" />
    ),
  },
];

export interface AdminUser {
  name?: string;
  email?: string;
  /** Google profile picture. */
  image?: string;
}

export function AdminNav({ user }: { user: AdminUser }) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const label = user.name || user.email || "Signed in";
  const initial = (user.name || user.email || "A").trim().charAt(0);

  // The drawer covers the screen; letting the page scroll behind it means a
  // tap on the backdrop lands somewhere unexpected.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Close the drawer on Escape, like every other overlay in the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleSignOut() {
    setSigningOut(true);
    signOut({ redirectTo: "/admin/login" });
  }

  const nav = (
    <ul className="space-y-1">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`admin-nav-link admin-tap flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                active
                  ? "admin-nav-link-active bg-olive-dark/70 text-cornsilk-light"
                  : "text-cornsilk/75 hover:bg-olive-dark/45 hover:text-cornsilk-light"
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Mobile bar — the sidebar collapses below lg. */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-olive-dark bg-olive px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt=""
            width={22}
            height={32}
            unoptimized
            className="h-7 w-auto"
          />
          <span className="font-display text-sm font-bold text-cornsilk-light">
            IKSARVA Admin
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-cornsilk-light hover:bg-olive-dark"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            {open ? (
              <path d="m6 6 12 12M18 6 6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>
      {open && (
        <div
          className="admin-backdrop fixed inset-0 z-30 bg-russet-dark/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-olive text-cornsilk transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-olive-dark/70 px-5 py-5">
          <Image
            src="/logo.svg"
            alt=""
            width={28}
            height={40}
            unoptimized
            className="h-10 w-auto"
          />
          <div className="leading-tight">
            <p className="font-display text-base font-bold text-cornsilk-light">
              IKSARVA
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-laurel-light">
              Admin
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">{nav}</nav>

        <div className="border-t border-olive-dark/70 px-4 py-4">
          <Link
            href="/"
            target="_blank"
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-laurel-light transition-colors hover:bg-olive-dark/50 hover:text-cornsilk-light"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M11 3a1 1 0 1 0 0 2h1.6l-5.3 5.3a1 1 0 1 0 1.4 1.4L14 6.4V8a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-4Z" />
              <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
            </svg>
            View site
          </Link>

          <div className="mt-3 rounded-xl bg-olive-dark/45 p-2.5">
            <div className="flex items-center gap-2.5">
            {user.image && !avatarFailed ? (
              <Image
                src={user.image}
                alt=""
                width={32}
                height={32}
                unoptimized
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-laurel text-sm font-bold uppercase text-olive-dark">
                {initial}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-semibold text-cornsilk-light"
                title={user.email}
              >
                {label}
              </p>
              {user.name && user.email && (
                <p className="truncate text-xs text-cornsilk/65" title={user.email}>
                  {user.email}
                </p>
              )}
            </div>
            </div>

            {/* Its own full-width row: this used to be a 48x17 sliver of text
                tucked under the email, which is not a target you can hit with
                a thumb. */}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-lg bg-olive-dark/60 text-xs font-semibold text-alloy-light transition-colors hover:bg-olive-dark hover:text-cornsilk-light disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
