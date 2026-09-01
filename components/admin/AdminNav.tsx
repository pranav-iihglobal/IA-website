"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  betaNote,
  can,
  type Access,
  type ModuleKey,
  type Permission,
} from "@/lib/auth/permissions";
import { BetaStar } from "./ui";
import { itemActive, type NavTarget } from "@/lib/admin/nav";

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

/** The Beta note for an item, if its module has one. */
function betaNoteFor(item: NavItem): string | null {
  return item.module ? betaNote(item.module) : null;
}

interface NavItem extends NavTarget {
  label: string;
  icon: ReactNode;
  /** Hidden unless the signed-in role holds this. Omit for always-visible. */
  needs?: Permission;
  /** Drives the Beta star. Omit for links that are not a module. */
  module?: ModuleKey;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * The navigation, as parents and children.
 *
 * Thirteen flat links had no shape: Invoices sat beside Blog, and finding
 * Purchases meant reading the whole list. The grouping is NOT invented — it
 * follows the directors' own workbooks, which is the same rule the rest of
 * this project follows for their vocabulary. Their Operations workbook holds
 * Products_Master, Inventory_Tracker and Purchases_Log; those three are the
 * Operations group here.
 *
 * Dashboard stays outside every group. It is the landing page, it belongs to
 * nothing, and burying it under a heading would put a click in front of the
 * screen people open first.
 *
 * PRODUCTS IS THE ONE JUDGEMENT CALL. The product record drives both the
 * public product pages and every invoice line's HSN, GST rate and price, so it
 * genuinely belongs to two groups. It sits in Operations because that is where
 * their own workbook keeps it, and because a price is edited far more often
 * than a product page is rewritten. Easy to move if that reads wrong in use.
 */
const NAV: (NavItem | NavGroup)[] = [
  {
    href: "/admin",
    label: "Dashboard",
    exact: true,
    icon: <Icon path="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />,
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      {
        href: "/admin/invoices",
        module: "billing",
        label: "Invoices",
        needs: "billing:read",
        icon: (
          <Icon path="M6 3h9l3 3v15l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Zm3 5h6M9 12h6M9 16h4" />
        ),
      },
      {
        href: "/admin/outstanding",
        module: "billing",
        label: "Outstanding",
        needs: "billing:read",
        icon: <Icon path="M12 3v18M8 7h6.5a2.5 2.5 0 0 1 0 5h-5a2.5 2.5 0 0 0 0 5H16" />,
      },
      {
        href: "/admin/gst",
        module: "billing",
        label: "GST return",
        needs: "billing:read",
        icon: <Icon path="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" />,
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      {
        href: "/admin/customers",
        label: "Customers",
        needs: "crm:read",
        module: "crm",
        // The profile page is shared by all three lists — see `owns`.
        owns: ["/admin/contacts"],
        icon: (
          <Icon path="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        ),
      },
      {
        href: "/admin/dealers",
        label: "Dealers",
        needs: "crm:read",
        module: "crm",
        icon: (
          <Icon path="M3 9h18l-1.5 11a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1L3 9Zm3 0V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3" />
        ),
      },
      {
        href: "/admin/leads",
        label: "Leads",
        needs: "crm:read",
        module: "crm",
        icon: (
          <Icon path="M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.8 2.8m5.8 5.8 2.8 2.8m0-11.4-2.8 2.8m-5.8 5.8-2.8 2.8" />
        ),
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        href: "/admin/products",
        module: "products",
        label: "Products",
        needs: "products:read",
        icon: (
          <Icon path="M20 7.5 12 3 4 7.5m16 0L12 12M20 7.5v9L12 21m0-9L4 7.5M12 12v9m-8-4.5v-9" />
        ),
      },
      {
        href: "/admin/stock",
        module: "billing",
        label: "Stock",
        needs: "billing:read",
        icon: <Icon path="M4 8l8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4m0 0 8-4m-8 4v8" />,
      },
      {
        href: "/admin/purchases",
        module: "billing",
        label: "Purchases",
        needs: "billing:read",
        icon: <Icon path="M6 7h12l-1 12H7L6 7Zm3 0V5a3 3 0 0 1 6 0v2" />,
      },
    ],
  },
  {
    id: "website",
    label: "Website",
    items: [
      {
        href: "/admin/testimonials",
        module: "testimonials",
        label: "Testimonials",
        needs: "testimonials:read",
        icon: <Icon path="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" />,
      },
      {
        href: "/admin/blog",
        module: "posts",
        label: "Blog",
        needs: "posts:read",
        icon: (
          <Icon path="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm9 0v5h5M8 13h8M8 17h5" />
        ),
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        href: "/admin/users",
        // "People" moved to "Team": a group called Customers now sits above it,
        // and two people-shaped words in one sidebar is one too many.
        label: "Team",
        needs: "users:read",
        icon: (
          <Icon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        ),
      },
    ],
  },
];

const isGroup = (entry: NavItem | NavGroup): entry is NavGroup =>
  "items" in entry;

/* -------------------------------------------------------------------------- */
/* Which groups are folded away — remembered per browser                      */
/* -------------------------------------------------------------------------- */

/**
 * Read through `useSyncExternalStore` rather than in an effect.
 *
 * localStorage does not exist on the server, and reading it during the first
 * client render would disagree with the HTML that came down. This is the tool
 * for exactly that: the server snapshot is "nothing folded", and React swaps
 * in the stored value without a hydration mismatch and without the cascading
 * re-render an effect would cause.
 *
 * The snapshot is CACHED because `getSnapshot` has to return the same
 * reference until something actually changes — parsing the JSON afresh on
 * every call hands React a new array each time and spins forever.
 *
 * Nothing depends on this. A private window, blocked site data, or a corrupt
 * value all land on "everything open", which is a perfectly good sidebar.
 */
const COLLAPSED_KEY = "iksarva.admin.nav.collapsed";
const NOTHING_FOLDED: string[] = [];

let cachedRaw: string | null = null;
let cachedValue: string[] = NOTHING_FOLDED;
const listeners = new Set<() => void>();

function readCollapsed(): string[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(COLLAPSED_KEY);
  } catch {
    return NOTHING_FOLDED;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      cachedValue = Array.isArray(parsed) ? (parsed as string[]) : NOTHING_FOLDED;
    } catch {
      cachedValue = NOTHING_FOLDED;
    }
  }
  return cachedValue;
}

function writeCollapsed(next: string[]) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
  } catch {
    // The fold still works for this visit; it just is not remembered.
  }
  for (const listener of listeners) listener();
}

function subscribeCollapsed(listener: () => void) {
  listeners.add(listener);
  // A `storage` event means another tab folded something. Follow it, rather
  // than letting two open tabs quietly disagree about the same sidebar.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const collapsedOnServer = () => NOTHING_FOLDED;

export interface AdminUser {
  name?: string;
  email?: string;
  /** Read live from the database by the layout, never from the session. */
  access?: Access;
  /** Google profile picture. */
  image?: string;
}

export function AdminNav({ user }: { user: AdminUser }) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    collapsedOnServer,
  );

  const label = user.name || user.email || "Signed in";
  const initial = (user.name || user.email || "A").trim().charAt(0);

  function toggleGroup(id: string) {
    writeCollapsed(
      collapsed.includes(id)
        ? collapsed.filter((group) => group !== id)
        : [...collapsed, id],
    );
  }

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

  /*
    Close on any navigation, not just on tapping a link. The browser Back
    button and a redirect both change the route without a click, and either
    one used to leave the drawer sitting open over the page it had moved to.

    Adjusted during render rather than in an effect, which is what React
    recommends for state that derives from a prop changing: an effect would
    paint the drawer over the new page for one frame before closing it.
  */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  function handleSignOut() {
    setSigningOut(true);
    signOut({ redirectTo: "/admin/login" });
  }

  /*
    Hiding a link is a courtesy, not a control — the page and its API refuse
    the request regardless. Showing someone a module that will only tell them
    no is just a worse way to say the same thing.

    A group disappears with its last visible child rather than leaving an empty
    heading behind, which is how the accountant sees Sales and nothing else.
  */
  const visible = useMemo(() => {
    const allowed = (item: NavItem) => !item.needs || can(user.access, item.needs);
    return NAV.flatMap<NavItem | NavGroup>((entry) => {
      if (!isGroup(entry)) return allowed(entry) ? [entry] : [];
      const items = entry.items.filter(allowed);
      return items.length > 0 ? [{ ...entry, items }] : [];
    });
  }, [user.access]);

  const NavLink = ({ item, note }: { item: NavItem; note?: string | null }) => {
    const active = itemActive(item, pathname);
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`admin-nav-link admin-tap flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${
          active
            ? "admin-nav-link-active bg-olive-dark/70 text-cornsilk-light"
            : "text-cornsilk/75 hover:bg-olive-dark/45 hover:text-cornsilk-light"
        }`}
      >
        {item.icon}
        <span className="truncate">{item.label}</span>
        {note && <BetaStar note={note} className="ml-auto text-[13px] text-laurel-light/80" />}
      </Link>
    );
  };

  const nav = (
    <ul className="space-y-1">
      {visible.map((entry) => {
        if (!isGroup(entry)) {
          return (
            <li key={entry.href}>
              <NavLink item={entry} note={betaNoteFor(entry)} />
            </li>
          );
        }

        const hasActive = entry.items.some((item) => itemActive(item, pathname));
        // The star still has to be visible when the group hides its children.
        const foldedBeta = entry.items.map(betaNoteFor).find(Boolean) ?? null;
        /*
          The group holding the current page is always open, whatever was
          stored. Folding a group away is about tidying what you are not using;
          it must never hide where you actually are.
        */
        const isOpen = hasActive || !collapsed.includes(entry.id);

        return (
          <li key={entry.id} className="pt-1.5 first:pt-0">
            <button
              type="button"
              onClick={() => toggleGroup(entry.id)}
              aria-expanded={isOpen}
              aria-controls={`nav-group-${entry.id}`}
              className="admin-nav-group flex w-full items-center gap-1.5 rounded-lg px-3 py-1 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-laurel-light/70 transition-colors hover:text-cornsilk-light"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
                  isOpen ? "" : "-rotate-90"
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
              <span className="truncate">{entry.label}</span>
              {!isOpen && foldedBeta && (
                <BetaStar note={foldedBeta} className="ml-1 text-[11px] text-laurel-light/80" />
              )}
              {hasActive && !isOpen && (
                <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-alloy-light" />
              )}
            </button>

            {isOpen && (
              <ul
                id={`nav-group-${entry.id}`}
                /* The hairline is the parent–child relation, drawn. */
                className="admin-nav-children mt-0.5 space-y-0.5 border-l border-laurel/25 pl-2"
              >
                {entry.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} note={betaNoteFor(item)} />
                  </li>
                ))}
              </ul>
            )}
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

      {/*
        `invisible` when closed, not just translated off-screen. A transform
        alone leaves every link in the tab order, so tabbing off the mobile
        top bar used to walk invisibly through the whole menu. Visibility is
        transitioned rather than switched so the slide-out still plays.
      */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-olive text-cornsilk transition-[transform,visibility] duration-300 lg:visible lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
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
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-mid text-sm font-bold uppercase text-ink-muted">
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
