"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not sign in");
        setBusy(false);
        return;
      }
      const next = params.get("next");
      router.push(next && next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="admin-card w-full max-w-sm p-8">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-meringue-light ring-1 ring-camel-light">
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
        <h1 className="mt-4 font-display text-2xl font-bold text-russet">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-olive-dark">
          Sign in to the IKSARVA backoffice
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="admin-toast mt-6 flex items-start gap-2 rounded-xl border border-alloy/45 bg-alloy/10 px-4 py-3 text-sm font-medium text-russet"
        >
          <svg viewBox="0 0 20 20" className="mt-px h-4.5 w-4.5 shrink-0" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1-5a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.3-7.7a1 1 0 0 1 1.7.7v4a1 1 0 1 1-2 0V6a1 1 0 0 1 .3-.7Z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}

      <label className="admin-field mt-6 block">
        <span className="admin-label text-sm font-semibold text-russet">
          Email
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          placeholder="you@iksarva.com"
          className="admin-input mt-1.5"
        />
      </label>

      <label className="admin-field mt-4 block">
        <span className="admin-label text-sm font-semibold text-russet">
          Password
        </span>
        <span className="relative mt-1.5 block">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="admin-input pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-russet-dark/45 transition-colors hover:bg-meringue hover:text-russet"
          >
            <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
              {showPassword ? (
                <path
                  fillRule="evenodd"
                  d="M3.7 2.3a1 1 0 0 0-1.4 1.4l14 14a1 1 0 0 0 1.4-1.4l-2-2A9.9 9.9 0 0 0 18.5 10S15.6 4.5 10 4.5c-1.4 0-2.6.3-3.7.9L3.7 2.3ZM10 13.5c.4 0 .8-.1 1.2-.3l-4.4-4.4A3.5 3.5 0 0 0 10 13.5ZM1.5 10s1-1.9 2.8-3.4l2.1 2.1a3.5 3.5 0 0 0 4.9 4.9l1.6 1.6c-.9.3-1.9.5-2.9.5C4.4 15.5 1.5 10 1.5 10Z"
                  clipRule="evenodd"
                />
              ) : (
                <path
                  fillRule="evenodd"
                  d="M10 4.5c5.6 0 8.5 5.5 8.5 5.5s-2.9 5.5-8.5 5.5S1.5 10 1.5 10 4.4 4.5 10 4.5Zm0 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                  clipRule="evenodd"
                />
              )}
            </svg>
          </button>
        </span>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="admin-btn admin-btn-primary mt-7 w-full py-3 text-base"
      >
        {busy && (
          <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
            <path d="M18 10a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
