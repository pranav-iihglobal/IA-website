import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/auth";
import { countUsers } from "@/lib/auth/users";
import { SITE } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * Where a sign-in that did not succeed ends up, and where the admin layout
 * sends a signed-in account that is not a director.
 *
 * Access is decided by the User collection, not by Google. Google's OAuth
 * "test users" list only restricts anything while the consent screen is in
 * Testing status, so it is not something to hang authorisation on.
 */

const MESSAGES: Record<string, { heading: string; body: string }> = {
  AccessDenied: {
    heading: "Access restricted",
    body: "This admin panel is limited to the IKSARVA team. The Google account you used has no access, or it has been suspended.",
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
  body: "This admin panel is limited to the IKSARVA team. The Google account you used has no access, or it has been suspended.",
};

/**
 * Shown when there are no users at all.
 *
 * Without this the first person to arrive sees "you are not on the approved
 * list" and has no way to guess that there is no list yet. Safe to surface:
 * it reveals that setup is unfinished, not who has access.
 */
const NOT_CONFIGURED = {
  heading: "Nobody has access yet",
  body: "Nobody has been given access to this panel, so nobody can sign in. Create the first owner from a terminal with: npm run users -- add you@gmail.com owner",
};

export default async function RestrictedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  /*
    An empty collection and "you are not on the list" look identical to
    whoever is staring at this page, so they are told apart here. -1 means the
    database could not be reached, which is neither.
  */
  const total = await countUsers();
  const { heading, body } =
    total === 0 ? NOT_CONFIGURED : (MESSAGES[error ?? ""] ?? FALLBACK);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-line-soft bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-muted ring-1 ring-line-soft">
          <Image
            src="/logo.svg"
            alt="IKSARVA"
            width={48}
            height={68}
            unoptimized
            className="h-14 w-auto"
          />
        </span>

        <h1 className="mt-5 font-display text-2xl font-bold text-ink-strong">
          {heading}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink">{body}</p>

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
              className="admin-tap w-full rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-strong transition-colors hover:border-olive hover:bg-surface-subtle sm:w-auto"
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
