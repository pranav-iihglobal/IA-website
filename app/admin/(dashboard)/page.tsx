import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { connectToDatabase, isDatabaseConfigured } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Testimonial } from "@/lib/db/models/Testimonial";
import { Post } from "@/lib/db/models/Post";
import { currentActiveUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { dashboardFigures } from "@/lib/erp/reports";
import { BusinessTiles } from "@/components/admin/BusinessTiles";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

async function getCounts(show: {
  products: boolean;
  testimonials: boolean;
  posts: boolean;
}) {
  await connectToDatabase();
  // Zero for a hidden module: the tile is not rendered, and not counting it
  // keeps the query off the database entirely.
  const zeroIf = (allowed: boolean, query: Promise<number>) =>
    allowed ? query : Promise.resolve(0);
  const [products, productDrafts, testimonials, testimonialDrafts, posts, postDrafts] =
    await Promise.all([
      zeroIf(show.products, Product.countDocuments({ status: "published" })),
      zeroIf(show.products, Product.countDocuments({ status: "draft" })),
      zeroIf(show.testimonials, Testimonial.countDocuments({ status: "published" })),
      zeroIf(show.testimonials, Testimonial.countDocuments({ status: "draft" })),
      zeroIf(show.posts, Post.countDocuments({ status: "published" })),
      zeroIf(
        show.posts,
        Post.countDocuments({ status: { $in: ["draft", "scheduled"] } }),
      ),
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
      className="admin-card admin-card-hover group flex flex-col p-4 sm:p-6"
    >
      <div className="flex items-start justify-between">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}
        >
          {icon}
        </span>
        <svg
          viewBox="0 0 20 20"
          className="h-5 w-5 -translate-x-1 text-ink-faint opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4Z" />
        </svg>
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {title}
      </p>
      <p className="mt-1 font-display text-3xl font-bold leading-none text-ink-strong sm:text-4xl">
        {published}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        published
        {drafts > 0 && (
          <>
            {" · "}
            <span className="font-semibold text-cta">
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
      : "border-line-soft bg-surface-muted";
  return (
    <div className={`max-w-2xl rounded-2xl border p-6 ${styles}`}>
      <h2 className="font-display text-xl font-bold text-ink-strong">{title}</h2>
      {/* break-words: a database error carries a bare URL, which was long
          enough to push the whole dashboard sideways on a 320px screen. */}
      <div className="mt-2 space-y-2 break-words text-sm leading-relaxed text-ink">
        {children}
      </div>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-raised px-1.5 py-0.5 text-[0.8em] ring-1 ring-line-soft">
      {children}
    </code>
  );
}

/**
 * The tiles, and the six count queries behind them.
 *
 * Split into its own async component so the page shell — heading, subtitle,
 * the New button — streams immediately instead of waiting on the database.
 * The dashboard is force-dynamic and used to await all six counts before
 * sending a single byte, which put the whole round trip in front of First
 * Contentful Paint on a cold visit.
 */
async function Tiles({
  show,
}: {
  show: { products: boolean; testimonials: boolean; posts: boolean };
}) {
  const configured = isDatabaseConfigured();
  if (!configured) {
    return (
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
    );
  }

  let counts: Awaited<ReturnType<typeof getCounts>>;
  try {
    counts = await getCounts(show);
  } catch (e) {
    return (
      <Notice tone="error" title="Could not reach the database">
        <p>{e instanceof Error ? e.message : "Could not reach the database"}</p>
        <p>
          Check the connection string and that this deployment&rsquo;s IP is
          allowed in Atlas (Network Access → 0.0.0.0/0 for Vercel).
        </p>
      </Notice>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
      {show.products && (
        <StatCard
          title="Products"
          href="/admin/products"
          published={counts.products}
          drafts={counts.productDrafts}
          accent="bg-accent-soft/50 text-ink-muted"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7.5 12 3 4 7.5m16 0L12 12M20 7.5v9L12 21m0-9L4 7.5M12 12v9m-8-4.5v-9" />
            </svg>
          }
        />
      )}
      {show.testimonials && (
        <StatCard
          title="Testimonials"
          href="/admin/testimonials"
          published={counts.testimonials}
          drafts={counts.testimonialDrafts}
          accent="bg-surface-strong/45 text-ink-strong"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" />
            </svg>
          }
        />
      )}
      {show.posts && (
        <StatCard
          title="Blog posts"
          href="/admin/blog"
          published={counts.posts}
          drafts={counts.postDrafts}
          draftLabel="draft/scheduled"
          accent="bg-alloy/12 text-cta"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm9 0v5h5M8 13h8M8 17h5" />
            </svg>
          }
        />
      )}
    </div>
  );
}

/** Same geometry as the tiles, so nothing shifts when the counts land. */
function TilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="admin-card flex flex-col p-4 sm:p-6">
          <div className="admin-skeleton h-11 w-11 rounded-xl" />
          <div className="admin-skeleton mt-5 h-3 w-20 rounded" />
          <div className="admin-skeleton mt-2 h-9 w-12 rounded" />
          <div className="admin-skeleton mt-2 h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * The trading figures, in their own Suspense boundary.
 *
 * Separate from the content tiles so a slow aggregation cannot hold up the
 * rest of the page — and so a failure here degrades to a missing section
 * rather than an error where the whole dashboard used to be.
 */
async function BusinessSection() {
  /*
    The await is inside the try, the JSX is not. React renders a component
    lazily, so JSX constructed inside a try/catch is NOT protected by it — the
    catch would only ever have caught the query, while reading as though it
    covered the render too.
  */
  let figures;
  try {
    figures = await dashboardFigures();
  } catch (error) {
    console.error("[dashboard] could not read trading figures", error);
    return (
      <p className="admin-card px-4 py-3 text-sm text-ink-muted">
        Trading figures are unavailable right now.
      </p>
    );
  }
  return <BusinessTiles figures={figures} />;
}

export default async function AdminDashboardPage() {
  /*
    The dashboard is the one page everyone with access can reach, so it is
    also the one that must not leak the shape of modules they cannot see. A
    tile is both a link and a count — showing "Blog posts 3" to someone with
    no blog access tells them something and then refuses to elaborate.
  */
  const me = await currentActiveUser();
  const show = {
    products: can(me, "products:read"),
    testimonials: can(me, "testimonials:read"),
    posts: can(me, "posts:read"),
  };

  const mine = [
    show.products && "products",
    show.testimonials && "testimonials",
    show.posts && "blog posts",
  ].filter(Boolean) as string[];

  const subtitle =
    mine.length === 0
      ? "You have no modules yet. Ask an owner for access."
      : `Manage ${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(mine)}.`;

  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink-strong sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
        </div>
        {can(me, "products:write") && (
          <Link
            href="/admin/products/new"
            className="admin-btn admin-btn-primary shrink-0"
            aria-label="New product"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
            </svg>
            <span className="hidden sm:inline">New product</span>
            <span className="sm:hidden">New</span>
          </Link>
        )}
      </header>

      {/*
        The business first, the content second. A director opens this to see
        what the month looks like and who owes money, not to count blog posts
        — and the ERP figures are gated on billing:read, so someone without it
        simply does not see them.
      */}
      {can(me, "billing:read") && (
        <div className="mt-8">
          <Suspense fallback={<TilesSkeleton />}>
            <BusinessSection />
          </Suspense>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Content
        </h2>
        {/* Everything above this streams before the database is asked. */}
        <Suspense fallback={<TilesSkeleton />}>
          <Tiles show={show} />
        </Suspense>
      </div>
    </>
  );
}
