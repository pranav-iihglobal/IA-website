import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/session";
import { normalizePasswordHash } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Best-effort login throttling.
 *
 * NOTE: this Map lives in one serverless instance's memory. Vercel may run
 * several instances, and they recycle — so it slows down casual guessing but
 * is NOT a hard limit. If brute-force protection ever matters, move this to
 * a shared store (e.g. Upstash Redis free tier).
 */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function rateLimit(key: string): { ok: boolean; retryInMinutes?: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return {
      ok: false,
      retryInMinutes: Math.ceil((WINDOW_MS - (now - entry.firstAt)) / 60000),
    };
  }
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const passwordHash = normalizePasswordHash(process.env.ADMIN_PASSWORD_HASH);

  if (!adminEmail || !passwordHash || !process.env.SESSION_SECRET) {
    return NextResponse.json(
      {
        error:
          "Admin login is not configured on the server. Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH and SESSION_SECRET.",
      },
      { status: 500 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = rateLimit(ip);
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in about ${limited.retryInMinutes} minute(s).`,
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const emailMatches =
    parsed.data.email.toLowerCase() === adminEmail.toLowerCase();
  // Always run the hash comparison so a wrong email and a wrong password take
  // the same amount of time (no user enumeration via response timing).
  const passwordMatches = await bcrypt.compare(parsed.data.password, passwordHash);

  if (!emailMatches || !passwordMatches) {
    return NextResponse.json(
      { error: "Incorrect email or password" },
      { status: 401 },
    );
  }

  attempts.delete(ip);

  const session = await getAdminSession();
  session.isLoggedIn = true;
  session.email = adminEmail;
  session.loginAt = Date.now();
  await session.save();

  return NextResponse.json({ ok: true });
}
