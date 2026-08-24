"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/testimonials", label: "Testimonials" },
  { href: "/admin/blog", label: "Blog" },
];

export function AdminNav({ email }: { email?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-cornsilk-dark bg-olive text-cornsilk">
      <div className="flex items-center gap-2 border-b border-olive-dark px-5 py-4">
        <Image
          src="/logo.svg"
          alt=""
          width={28}
          height={40}
          unoptimized
          className="h-9 w-auto"
        />
        <div className="leading-tight">
          <p className="font-display text-base font-bold text-cornsilk-light">
            IKSARVA
          </p>
          <p className="text-[10px] uppercase tracking-widest text-laurel-light">
            Admin
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {LINKS.map((link) => {
            const active = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-olive-dark text-cornsilk-light"
                      : "text-cornsilk/80 hover:bg-olive-dark/60 hover:text-cornsilk-light"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-olive-dark px-5 py-4">
        <Link
          href="/"
          target="_blank"
          className="block text-xs text-laurel-light hover:text-cornsilk-light"
        >
          View site ↗
        </Link>
        {email && (
          <p className="mt-3 truncate text-xs text-cornsilk/70" title={email}>
            {email}
          </p>
        )}
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="mt-2 text-xs font-semibold text-alloy-light hover:text-cornsilk-light disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
