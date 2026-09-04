"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  useEffect,
  useMemo,
  useRef,
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
import { GlobalSearch } from "./GlobalSearch";

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
  /**
   * The group's overview page, when it has one. The heading becomes a link
   * to it; the chevron beside it still folds the group. Module links keep
   * going straight to their lists — an overview is a place to go, not a hop
   * in front of the list.
   */
  href?: string;
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
    href: "/admin/sales",
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
        href: "/admin/schemes",
        module: "billing",
        label: "Schemes",
        needs: "billing:read",
        icon: <Icon path="M20 12 12 20 4 12V4h8l8 8ZM7.5 7.5h.01M14 10l-4 4" />,
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
    href: "/admin/crm",
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
      {
        href: "/admin/suppliers",
        module: "billing",
        label: "Suppliers",
        needs: "billing:read",
        icon: <Icon path="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h.01M15 11h.01" />,
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
        href: "/admin/settings",
        // The seller's GSTIN and bank details. Owners only, like Team: it is
        // what every legal document the company issues says about the company.
        label: "Business",
        needs: "users:manage",
        icon: (
          <Icon path="M4 21V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15M4 21h16M8 8h3M8 12h3M8 16h3M15 11h3a2 2 0 0 1 2 2v8" />
        ),
      },
      {
        href: "/admin/activity",
        label: "Activity",
        needs: "users:read",
        icon: (
          <Icon path="M12 8v4l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z" />
        ),
      },
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

/**
 * Is a text field focused — i.e. is the on-screen keyboard most likely up?
 *
 * Selects are left out: Android opens a picker for those, not a keyboard.
 * The clear is delayed a frame so tabbing from one field to the next does
 * not flash the strip in between.
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      t.matches(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]), textarea, [contenteditable="true"]',
      );
    const onIn = (e: FocusEvent) => {
      if (!isField(e.target)) return;
      if (timer) clearTimeout(timer);
      setOpen(true);
    };
    const onOut = () => {
      timer = setTimeout(() => setOpen(false), 80);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return open;
}

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
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const stripRef = useRef<HTMLUListElement>(null);
  const keyboardOpen = useKeyboardOpen();
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    collapsedOnServer,
  );

  const label = user.name || user.email || "Signed in";
  const initial = (user.name || user.email || "A").trim().charAt(0);

  // One element, rendered in the top bar, the account menu and the sidebar footer.
  const avatar =
    user.image && !avatarFailed ? (
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
    );

  function toggleGroup(id: string) {
    writeCollapsed(
      collapsed.includes(id)
        ? collapsed.filter((group) => group !== id)
        : [...collapsed, id],
    );
  }

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
    if (menuOpen) setMenuOpen(false);
  }

  // Escape closes the account menu, like every other overlay here.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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

  /*
    The phone's tab strip: EVERY section the viewer may open, in sidebar
    order, flattened. The bar used to hold four and a "More" that opened the
    desktop sidebar as a drawer from the left — reached from a button on the
    right, which read as odd, and it hid two thirds of the panel behind an
    extra tap. The strip scrolls sideways instead; the active tab is scrolled
    into view on every navigation.
  */
  const strip = useMemo(
    () => visible.flatMap((entry) => (isGroup(entry) ? entry.items : [entry])),
    [visible],
  );

  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname, strip]);

  const NavLink = ({ item, note }: { item: NavItem; note?: string | null }) => {
    const active = itemActive(item, pathname);
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`admin-nav-link admin-tap flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${
          active
            ? "admin-nav-link-active bg-olive-dark/70 text-cornsilk-light"
            /* Was cornsilk/75 — 3.66:1 against the olive sidebar, under the
               4.5:1 this text needs. Full cornsilk is 5.09:1, and the active
               link still reads as active by its background and weight. */
            : "text-cornsilk hover:bg-olive-dark/45 hover:text-cornsilk-light"
        }`}
      >
        {item.icon}
        <span className="truncate">{item.label}</span>
        {note && <BetaStar note={note} className="ml-auto text-[13px] text-cornsilk" />}
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
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => toggleGroup(entry.id)}
                aria-expanded={isOpen}
                aria-controls={`nav-group-${entry.id}`}
                aria-label={`${isOpen ? "Fold" : "Unfold"} ${entry.label}`}
                /* admin-tap-square: an icon-only fold measured 36×20px, the
                   one control in the sidebar under the flat 44px rule. */
                className="admin-nav-group admin-tap-square flex shrink-0 items-center justify-center rounded-lg text-cornsilk/95 transition-colors hover:text-cornsilk-light"
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
              </button>
              {/* The heading itself: a link to the overview where there is one. */}
              {entry.href ? (
                <Link
                  href={entry.href}
                  aria-current={pathname === entry.href ? "page" : undefined}
                  className={`admin-nav-group admin-tap -ml-2 flex min-w-0 flex-1 items-center gap-1.5 rounded-lg pr-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] transition-colors hover:text-cornsilk-light ${
                    pathname === entry.href ? "text-cornsilk-light underline" : "text-cornsilk/95"
                  }`}
                >
                  <span className="truncate">{entry.label}</span>
                  {!isOpen && foldedBeta && (
                    <BetaStar note={foldedBeta} className="ml-1 text-[11px] text-cornsilk" />
                  )}
                  {hasActive && !isOpen && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-alloy-light" />
                  )}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.id)}
                  aria-expanded={isOpen}
                  aria-controls={`nav-group-${entry.id}`}
                  className="admin-nav-group admin-tap -ml-2 flex min-w-0 flex-1 items-center gap-1.5 rounded-lg pr-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-cornsilk/95 transition-colors hover:text-cornsilk-light"
                >
                  <span className="truncate">{entry.label}</span>
                  {!isOpen && foldedBeta && (
                    <BetaStar note={foldedBeta} className="ml-1 text-[11px] text-cornsilk" />
                  )}
                  {hasActive && !isOpen && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-alloy-light" />
                  )}
                </button>
              )}
            </div>

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
      {/*
        The phone's top bar — an ordinary flex child at the top of the shell,
        not position:fixed. Title, search, and the account menu where the
        hamburger was: there is no drawer on the phone any more, every section
        is in the strip below.
      */}
      <header className="relative z-30 order-first flex shrink-0 items-center justify-between border-b border-olive-dark bg-olive px-4 py-2.5 lg:hidden">
        <Link href="/admin" className="admin-tap -ml-1 flex items-center gap-2 rounded-lg pl-1 pr-2">
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
        </Link>
        <div className="-mr-2 flex items-center gap-0.5">
          <GlobalSearch variant="topbar" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={menuOpen ? "Close account menu" : `Account: ${label}`}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-cornsilk-light hover:bg-olive-dark"
            >
              {avatar}
            </button>
            {menuOpen && (
              <>
                {/* A transparent sheet behind the menu: tap anywhere else to close. */}
                <button
                  type="button"
                  aria-label="Close account menu"
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-30 cursor-default bg-transparent"
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-2xl border border-line bg-surface p-2 text-ink shadow-[var(--admin-shadow-lg)]"
                >
                  <div className="flex items-center gap-2.5 rounded-xl bg-surface-muted px-2.5 py-2">
                    {avatar}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-strong" title={user.email}>
                        {label}
                      </p>
                      {user.name && user.email && (
                        <p className="truncate text-xs text-ink-muted" title={user.email}>
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    href="/"
                    target="_blank"
                    role="menuitem"
                    className="admin-tap mt-1 flex items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-surface-muted"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-ink-muted" fill="currentColor" aria-hidden="true">
                      <path d="M11 3a1 1 0 1 0 0 2h1.6l-5.3 5.3a1 1 0 1 0 1.4 1.4L14 6.4V8a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-4Z" />
                      <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
                    </svg>
                    View site
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="admin-tap flex w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-ink hover:bg-surface-muted disabled:opacity-60"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-ink-muted" fill="currentColor" aria-hidden="true">
                      <path d="M7 3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2H8V5h3a1 1 0 1 0 0-2H7Zm6.3 4.3a1 1 0 0 1 1.4 0l2 2a1 1 0 0 1 0 1.4l-2 2a1 1 0 0 1-1.4-1.4l.3-.3H10a1 1 0 1 1 0-2h3.6l-.3-.3a1 1 0 0 1 0-1.4Z" />
                    </svg>
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/*
        The tab strip — the phone's whole navigation, at the bottom of the
        shell. In flow, so it is on screen exactly when the header is. Hidden
        while a text field has focus: the keyboard shrinks the shell (viewport
        interactiveWidget), and the field needs that room more than the tabs.
        Height is --admin-tabbar, which the toast stack offsets by.
      */}
      <nav
        aria-label="Sections"
        hidden={keyboardOpen}
        className="order-last shrink-0 border-t border-olive-dark bg-olive pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
      >
        <div className="admin-tabstrip-fade">
          <ul ref={stripRef} className="admin-tabstrip flex h-14 items-stretch overflow-x-auto px-1">
            {strip.map((item) => {
              const active = itemActive(item, pathname);
              return (
                <li key={item.href} className="min-w-[4.5rem] shrink-0 snap-start">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`admin-tap flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                      active
                        ? "text-cornsilk-light"
                        : "text-cornsilk hover:text-cornsilk-light"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-12 items-center justify-center rounded-full ${
                        active ? "bg-olive-dark/70" : ""
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="whitespace-nowrap px-2.5">
                      {item.href === "/admin" ? "Today" : item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/*
        The sidebar, lg and up only. It used to double as the phone's drawer —
        fixed, translated off-screen, focus-trapped, with a backdrop — and the
        phone has the strip above instead now. A flex child of the shell, the
        full height of it, with its own scrolling nav.
      */}
      <aside
        id="admin-sidebar"
        aria-label="Sidebar"
        className="admin-drawer hidden w-64 shrink-0 flex-col bg-olive text-cornsilk lg:order-first lg:flex lg:h-full"
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
            <p className="text-[10px] uppercase tracking-[0.18em] text-cornsilk">
              Admin
            </p>
          </div>
        </div>

        <GlobalSearch variant="sidebar" hotkey />

        <nav className="flex-1 overflow-y-auto px-3 py-4">{nav}</nav>

        <div className="border-t border-olive-dark/70 px-4 py-4">
          <Link
            href="/"
            target="_blank"
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-cornsilk transition-colors hover:bg-olive-dark/50 hover:text-cornsilk-light"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M11 3a1 1 0 1 0 0 2h1.6l-5.3 5.3a1 1 0 1 0 1.4 1.4L14 6.4V8a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-4Z" />
              <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
            </svg>
            View site
          </Link>

          <div className="mt-3 rounded-xl bg-olive-dark/45 p-2.5">
            <div className="flex items-center gap-2.5">
            {avatar}
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-semibold text-cornsilk-light"
                title={user.email}
              >
                {label}
              </p>
              {user.name && user.email && (
                <p className="truncate text-xs text-cornsilk" title={user.email}>
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
              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-lg bg-olive-dark/60 text-xs font-semibold text-cornsilk-light transition-colors hover:bg-olive-dark disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
