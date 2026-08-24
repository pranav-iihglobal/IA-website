"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-2xl border border-cornsilk-dark bg-cornsilk-light p-8 shadow-sm"
    >
      <div className="flex flex-col items-center">
        <Image
          src="/logo.svg"
          alt="IKSARVA"
          width={48}
          height={68}
          unoptimized
          priority
          className="h-16 w-auto"
        />
        <h1 className="mt-4 font-display text-2xl font-bold text-russet">
          Admin sign in
        </h1>
        <p className="mt-1 text-sm text-olive-dark">IKSARVA Agritech</p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-alloy/40 bg-alloy/10 px-4 py-3 text-sm font-medium text-russet"
        >
          {error}
        </p>
      )}

      <label className="mt-6 block text-sm font-semibold text-russet">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          className="mt-1 w-full rounded-lg border border-camel-light bg-white px-3 py-2 text-base text-russet-dark outline-none focus:border-olive focus:ring-2 focus:ring-olive/30"
        />
      </label>

      <label className="mt-4 block text-sm font-semibold text-russet">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-camel-light bg-white px-3 py-2 text-base text-russet-dark outline-none focus:border-olive focus:ring-2 focus:ring-olive/30"
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-full bg-alloy px-6 py-3 text-base font-semibold text-cornsilk-light transition-colors hover:bg-alloy-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
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
