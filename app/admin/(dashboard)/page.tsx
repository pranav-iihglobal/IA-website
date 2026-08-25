import Link from "next/link";
import type { ReactNode } from "react";
import { connectToDatabase, isDatabaseConfigured } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Testimonial } from "@/lib/db/models/Testimonial";
import { Post } from "@/lib/db/models/Post";

export const dynamic = "force-dynamic";

async function getCounts() {
  await connectToDatabase();
  const [products, productDrafts, testimonials, testimonialDrafts, posts, postDrafts] =
    await Promise.all([
      Product.countDocuments({ status: "published" }),
      Product.countDocuments({ status: "draft" }),
      Testimonial.countDocuments({ status: "published" }),
      Testimonial.countDocuments({ status: "draft" }),
      Post.countDocuments({ status: "published" }),
      Post.countDocuments({ status: { $in: ["draft", "scheduled"] } }),
    ]);
  return {
    products,
    productDrafts,
    testimonials,
    testimonialDrafts,
    posts,
    postDrafts,
  };
}

function StatCard({
  title,
  href,
  published,
  drafts,
  draftLabel = "drafts",
  icon,
  accent,
}: {
  title: string;
  href: string;
  published: number;
  drafts: number;
  draftLabel?: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="admin-card admin-card-hover group flex flex-col p-6"
    >
      <div className="flex items-start justify-between">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}
        >
          {icon}
        </span>
        <svg
          viewBox="0 0 20 20"
          className="h-5 w-5 -translate-x-1 text-camel opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4Z" />
        </svg>
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-olive">
        {title}
      </p>
      <p className="mt-1 font-display text-4xl font-bold leading-none text-russet">
        {published}
      </p>
      <p className="mt-2 text-sm text-russet-dark/65">
        published
        {drafts > 0 && (
          <>
            {" · "}
            <span className="font-semibold text-alloy-dark">
              {drafts} {draftLabel}
            </span>
          </>
        )}
      </p>
    </Link>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: "info" | "error";
  title: string;
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-alloy/45 bg-alloy/8"
      : "border-camel-light bg-meringue-light";
  return (
    <div className={`max-w-2xl rounded-2xl border p-6 ${styles}`}>
      <h2 className="font-display text-xl font-bold text-russet">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-russet-dark/85">
        {children}
      </div>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-white px-1.5 py-0.5 text-[0.8em] ring-1 ring-camel-light">
      {children}
    </code>
  );
}

export default async function AdminDashboardPage() {
  const configured = isDatabaseConfigured();
  let counts: Awaited<ReturnType<typeof getCounts>> | null = null;
  let error: string | null = null;

  if (configured) {
    try {
      counts = await getCounts();
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not reach the database";
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-russet">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-olive-dark">
            Manage products, testimonials and blog posts.
          </p>
        </div>
        {counts && (
          <Link href="/admin/products/new" className="admin-btn admin-btn-primary">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
            </svg>
            New product
          </Link>
        )}
      </header>

      <div className="mt-8">
        {!configured && (
          <Notice tone="info" title="Database not connected">
            <p>
              <Code>MONGODB_URI</Code> is not set, so there is nothing to manage
              yet. Add it to <Code>.env.local</Code> (local) and to Vercel →
              Settings → Environment Variables (production), then run{" "}
              <Code>npm run seed</Code> once to import the existing products,
              testimonials and articles.
            </p>
            <p>
              See <Code>.env.example</Code> and the README for the full setup
              steps.
            </p>
          </Notice>
        )}

        {configured && error && (
          <Notice tone="error" title="Could not reach the database">
            <p>{error}</p>
            <p>
              Check the connection string and that this deployment&rsquo;s IP is
              allowed in Atlas (Network Access → 0.0.0.0/0 for Vercel).
            </p>
          </Notice>
        )}

        {counts && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Products"
              href="/admin/products"
              published={counts.products}
              drafts={counts.productDrafts}
              accent="bg-laurel-light/50 text-olive-dark"
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 7.5 12 3 4 7.5m16 0L12 12M20 7.5v9L12 21m0-9L4 7.5M12 12v9m-8-4.5v-9" />
                </svg>
              }
            />
            <StatCard
              title="Testimonials"
              href="/admin/testimonials"
              published={counts.testimonials}
              drafts={counts.testimonialDrafts}
              accent="bg-camel-light/45 text-russet"
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" />
                </svg>
              }
            />
            <StatCard
              title="Blog posts"
              href="/admin/blog"
              published={counts.posts}
              drafts={counts.postDrafts}
              draftLabel="draft/scheduled"
              accent="bg-alloy/12 text-alloy-dark"
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm9 0v5h5M8 13h8M8 17h5" />
                </svg>
              }
            />
          </div>
        )}
      </div>
    </>
  );
}
