import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/auth";
import { isOwnerConfigured } from "@/lib/auth/allowlist";
import { SITE } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * Where a sign-in that did not succeed ends up, and where middleware sends a
 * signed-in account that is not on the allowlist.
 *
 * Access is decided by ADMIN_ALLOWED_EMAILS, not by Google. Google's OAuth
 * "test users" list only restricts anything while the consent screen is in
 * Testing status, so it is not something to hang authorisation on.
 */

const MESSAGES: Record<string, { heading: string; body: string }> = {
  AccessDenied: {
    heading: "Access restricted",
    body: "This admin panel is limited to IKSARVA directors. The Google account you used is not on the approved list.",
  },
  Verification: {
    heading: "Sign-in link expired",
    body: "That sign-in attempt is no longer valid. Please start again.",
  },
  Configuration: {
    heading: "Sign-in is not configured",
    body: "The Google sign-in credentials are missing or incorrect on the server. An administrator needs to check the environment variables.",
  },
};

const FALLBACK = {
  heading: "Access restricted",
  body: "This admin panel is limited to IKSARVA directors. The Google account you used is not on the approved list.",
};

/**
 * Shown when the server has no allowlist at all.
 *
 * Without this a locked-out director sees "you are not on the approved list"
 * and has no way to guess that the list itself is missing. The check is safe
 * to surface: it reveals a misconfiguration, not who is on the list.
 */
const NOT_CONFIGURED = {
  heading: "Admin access is not configured",
  body: "ADMIN_ALLOWED_EMAILS is not set on the server, so nobody can sign in. Add the director email addresses to that environment variable and redeploy.",
};

export default async function RestrictedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { heading, body } = !isOwnerConfigured()
    ? NOT_CONFIGURED
    : (MESSAGES[error ?? ""] ?? FALLBACK);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-camel-light bg-cornsilk-light p-8 text-center shadow-sm">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-meringue-light ring-1 ring-camel-light">
          <Image
            src="/logo.svg"
            alt="IKSARVA"
            width={48}
            height={68}
            unoptimized
            className="h-14 w-auto"
          />
        </span>

        <h1 className="mt-5 font-display text-2xl font-bold text-russet">
          {heading}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-russet-dark/80">{body}</p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {/*
            Sign out first. Landing on /admin/login while still holding the
            rejected session just shows the same account again.
          */}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/admin/login" });
            }}
          >
            <button
              type="submit"
              className="admin-tap w-full rounded-full border border-camel px-5 py-2.5 text-sm font-semibold text-russet transition-colors hover:border-olive hover:bg-meringue sm:w-auto"
            >
              Try a different account
            </button>
          </form>
          <Link
            href="/"
            className="rounded-full bg-alloy px-5 py-2.5 text-sm font-semibold text-cornsilk-light transition-colors hover:bg-alloy-dark"
          >
            Go to {SITE.shortName}
          </Link>
        </div>
      </div>
    </div>
  );
}
