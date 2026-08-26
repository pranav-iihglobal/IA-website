import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * Where Auth.js sends a sign-in that did not succeed.
 *
 * Mostly that means an account this app declined. Note that a Google account
 * which is not a test user on the OAuth consent screen never gets this far —
 * Google stops it on its own error page, before the callback.
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
  heading: "Could not sign you in",
  body: "Something went wrong while signing in with Google. Please try again.",
};

export default async function RestrictedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { heading, body } = MESSAGES[error ?? ""] ?? FALLBACK;

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
          <Link
            href="/admin/login"
            className="rounded-full border border-camel px-5 py-2.5 text-sm font-semibold text-russet transition-colors hover:border-olive hover:bg-meringue"
          >
            Try a different account
          </Link>
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
