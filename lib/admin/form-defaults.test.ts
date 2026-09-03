import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

/**
 * No server file may READ a value from a "use client" module.
 *
 * A value exported from a client module is a client reference on the
 * server, not the value. Passing it through as a prop works; calling it,
 * spreading it or reading a property does not — PURCHASE_CATEGORIES.find()
 * took down the purchase and supplier pages in production, and three edit
 * pages were silently spreading nothing over their records.
 *
 * Rule: a file without "use client" may import from a client module only
 * names that look like components (PascalCase) or types. Anything else —
 * EMPTY_POST, emptyContact, PURCHASE_CATEGORIES — belongs in a plain module.
 */
const ROOT = resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function isClientModule(p: string): boolean {
  return /^\s*"use client"/.test(readFileSync(p, "utf8"));
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : resolve(dirname(from), spec);
  for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

describe("server files and client modules", () => {
  it("read no plain values across the boundary", () => {
    const offenders: string[] = [];
    const files = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components"))];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (/^\s*"use client"/.test(source)) continue;
      for (const m of source.matchAll(/^import\s+\{([^}]*)\}\s+from\s+"([^"]+)";/gm)) {
        const target = resolveImport(file, m[2]);
        if (!target || !isClientModule(target)) continue;
        for (const raw of m[1].split(",")) {
          const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
          if (!name || raw.trim().startsWith("type ")) continue;
          // A component: PascalCase, including a one-letter one like T.
          if (/^[A-Z]/.test(name) && !/^[A-Z][A-Z0-9_]+$/.test(name)) continue;
          offenders.push(`${file.slice(ROOT.length + 1)} reads ${name} from ${m[2]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the defaults module itself plain", () => {
    expect(isClientModule(join(ROOT, "lib/admin/form-defaults.ts"))).toBe(false);
  });
});
