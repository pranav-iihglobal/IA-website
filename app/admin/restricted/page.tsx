import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/auth";
import { countDirectors } from "@/lib/auth/directors";
import { SITE } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * Where a sign-in that did not succeed ends up, and where the admin layout
 * sends a signed-in account that is not a director.
 *
 * Access is decided by the Director collection, not by Google. Google's OAuth
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
 * Shown when there are no directors at all.
 *
 * Without this the first person to arrive sees "you are not on the approved
 * list" and has no way to guess that there is no list yet. Safe to surface:
 * it reveals that setup is unfinished, not who has access.
 */
const NOT_CONFIGURED = {
  heading: "No directors yet",
  body: "Nobody has been given access to this panel, so nobody can sign in. Create the first director from a terminal with: npm run directors -- add you@gmail.com",
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
  const total = await countDirectors();
  const { heading, body } =
    total === 0 ? NOT_CONFIGURED : (MESSAGES[error ?? ""] ?? FALLBACK);

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
