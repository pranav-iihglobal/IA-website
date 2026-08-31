import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthorisedEmail } from "@/lib/auth/users";
import { auth } from "@/auth";
import { SITE } from "@/lib/content";
import { GoogleSignInButton } from "@/components/admin/GoogleSignInButton";

export const dynamic = "force-dynamic";

/**
 * Admin sign-in.
 *
 * One button. There is no password to type, reset or leak — Google vouches
 * for the person's identity and this app only decides whether to accept it.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  /*
    Only bounce an ALLOWED session onward. Sending every session to /admin
    would trap a signed-in-but-rejected account in a loop: /admin/login →
    /admin → /admin/restricted, with no way back to the account picker.
  */
  if (session?.user && (await isAuthorisedEmail(session.user.email))) {
    redirect("/admin");
  }

  const { next } = await searchParams;
  // Only ever return to somewhere inside the admin panel — an attacker-supplied
  // ?next= must not turn the sign-in into an open redirect.
  const redirectTo = next && next.startsWith("/admin") ? next : "/admin";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-line-soft bg-surface p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-muted ring-1 ring-line-soft">
            <Image
              src="/logo.svg"
              alt="IKSARVA"
              width={48}
              height={68}
              unoptimized
              priority
              className="h-14 w-auto"
            />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink-strong">
            IKSARVA Backoffice
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sign in with your director Google account.
          </p>
        </div>

        <div className="mt-7">
          <GoogleSignInButton redirectTo={redirectTo} />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-soft">
          Access is limited to the IKSARVA team. If your account is not
          approved, Google will refuse the sign-in.
        </p>

        <p className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-ink-muted hover:underline"
          >
            ← Back to {SITE.shortName}
          </Link>
        </p>
      </div>
    </div>
  );
}
